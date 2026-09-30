import "server-only";
import { db } from "@/lib/bos/db";
import { addMoney, parseMoney, percentOf, toDecimalString } from "@/lib/bos/money";

// Pipeline metrics (§11) computed from real deals. Amounts are converted to
// the company base currency with dated exchange rates; deals without a rate
// are reported separately instead of being silently dropped or mis-summed.

export interface PipelineMetrics {
  baseCurrency: string;
  openCount: number;
  pipelineValue: string;
  weightedPipeline: string;
  expectedRevenue: string;
  wonCount: number;
  wonRevenue: string;
  lostCount: number;
  lostRevenue: string;
  qualifiedCount: number;
  conversionRate: number;
  missingRates: number;
}

async function ratesToBase(currencies: string[], base: string): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  for (const c of new Set(currencies)) {
    if (c === base) {
      out.set(c, "1");
      continue;
    }
    const { data } = await db().rpc("bos_fx_rate", { p_from: c, p_to: base });
    out.set(c, data === null || data === undefined ? null : String(data));
  }
  return out;
}

export async function getBaseCurrency(): Promise<string> {
  const { data } = await db().from("bos_settings").select("value").eq("key", "company").maybeSingle();
  return String((data?.value as { base_currency?: string } | null)?.base_currency ?? "USD");
}

function convert(value: unknown, rate: string | null): bigint | null {
  if (rate === null) return null;
  const v = parseMoney(value) ?? BigInt(0);
  const r = parseMoney(rate) ?? BigInt(0);
  return (v * r) / BigInt(1000);
}

export async function pipelineMetrics(opts: { userIds: string[] | null; from: string; to: string; clientId?: string }): Promise<PipelineMetrics> {
  const base = await getBaseCurrency();
  let query = db()
    .from("deals")
    .select("id, value, currency, probability, expected_close_date, won_at, lost_at, created_at, pipeline_stages!inner(category)")
    .is("archived_at", null);
  if (opts.userIds) query = query.in("assigned_to", opts.userIds);
  if (opts.clientId) query = query.eq("client_id", opts.clientId);
  const { data } = await query;
  const deals = (data ?? []).map((d) => ({ ...d, category: (d.pipeline_stages as unknown as { category: string }).category }));
  const rates = await ratesToBase(deals.map((d) => d.currency), base);

  let pipeline = BigInt(0);
  let weighted = BigInt(0);
  let expected = BigInt(0);
  let won = BigInt(0);
  let lost = BigInt(0);
  let wonCount = 0;
  let lostCount = 0;
  let openCount = 0;
  let missing = 0;
  let createdInRange = 0;
  let wonOfCreated = 0;
  const from = new Date(`${opts.from}T00:00:00Z`).getTime();
  const to = new Date(`${opts.to}T23:59:59Z`).getTime();
  const inRange = (iso: string | null) => !!iso && new Date(iso).getTime() >= from && new Date(iso).getTime() <= to;

  for (const d of deals) {
    const rate = rates.get(d.currency) ?? null;
    const valueBase = convert(d.value, rate);
    if (valueBase === null) {
      missing++;
      continue;
    }
    if (inRange(d.created_at)) {
      createdInRange++;
      if (d.won_at) wonOfCreated++;
    }
    if (d.category === "open") {
      openCount++;
      pipeline += valueBase;
      const w = percentOf(toDecimalString(valueBase, 3), d.probability, base);
      weighted += w;
      if (d.expected_close_date && d.expected_close_date >= opts.from && d.expected_close_date <= opts.to) expected += w;
    }
    if (d.won_at && inRange(d.won_at)) {
      wonCount++;
      won += valueBase;
    }
    if (d.lost_at && inRange(d.lost_at)) {
      lostCount++;
      lost += valueBase;
    }
  }

  return {
    baseCurrency: base,
    openCount,
    pipelineValue: toDecimalString(pipeline, 2),
    weightedPipeline: toDecimalString(weighted, 2),
    expectedRevenue: toDecimalString(expected, 2),
    wonCount,
    wonRevenue: toDecimalString(won, 2),
    lostCount,
    lostRevenue: toDecimalString(lost, 2),
    qualifiedCount: createdInRange,
    conversionRate: createdInRange ? Math.round((wonOfCreated / createdInRange) * 10000) / 100 : 0,
    missingRates: missing,
  };
}

export function sumStrings(values: (string | number | null | undefined)[]): string {
  return toDecimalString(addMoney(...values), 2);
}
