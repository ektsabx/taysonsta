import "server-only";
import { db } from "@/lib/bos/db";
import { addMoney, parseMoney, percentOf, toDecimalString } from "@/lib/bos/money";
import type { Currency } from "@/lib/bos/currency";
import { defaultCurrency } from "@/lib/bos/company-currency";

// Pipeline metrics (§11) computed from real deals. One currency at a time
// (EGP or USD, final spec §54): there is no conversion, so deals in the other
// currency are counted separately instead of being mis-summed.

export interface PipelineMetrics {
  currency: Currency;
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
  otherCurrencyCount: number;
}

export async function pipelineMetrics(opts: { userIds: string[] | null; from: string; to: string; clientId?: string; currency?: Currency }): Promise<PipelineMetrics> {
  const base = opts.currency ?? (await defaultCurrency());
  let query = db()
    .from("deals")
    .select("id, value, currency, probability, expected_close_date, won_at, lost_at, created_at, pipeline_stages!inner(category)")
    .is("archived_at", null);
  if (opts.userIds) query = query.in("assigned_to", opts.userIds);
  if (opts.clientId) query = query.eq("client_id", opts.clientId);
  const { data } = await query;
  const deals = (data ?? []).map((d) => ({ ...d, category: (d.pipeline_stages as unknown as { category: string }).category }));

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
    if (d.currency !== base) {
      missing++;
      continue;
    }
    const valueBase = parseMoney(d.value) ?? BigInt(0);
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
    currency: base,
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
    otherCurrencyCount: missing,
  };
}

export function sumStrings(values: (string | number | null | undefined)[]): string {
  return toDecimalString(addMoney(...values), 2);
}
