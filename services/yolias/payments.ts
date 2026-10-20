import "server-only";
import type { BosUser } from "@/lib/bos/auth";
import { audit } from "@/lib/bos/audit";
import { NotFoundError, ValidationError } from "@/lib/bos/errors";
import { ydb } from "@/lib/yolias/db";

// Yolias payments in the Admin (final spec phase 3): the Paymob status (its
// keys are entered in Settings → Integrations and copied to Yolias, D-132),
// Buy More Prospects packs, and the payments log. platform.manage only for
// writes; every change is audited.

export type PaymentSecretName = "secret_key" | "hmac_secret";
export const paymentSecretNames: PaymentSecretName[] = ["secret_key", "hmac_secret"];

export interface PaymobSettings {
  enabled: boolean;
  mode: "test" | "live";
  baseUrl: string;
  publicKey: string;
  integrations: { USD: number[] };
  secrets: Record<PaymentSecretName, { set: boolean; hint: string | null; updatedAt: string | null }>;
  updatedBy: string | null;
  updatedAt: string | null;
}

export async function getPaymobSettings(): Promise<PaymobSettings> {
  const [{ data: row, error }, { data: secrets }] = await Promise.all([
    ydb().from("payment_providers").select("*").eq("id", "paymob").maybeSingle(),
    ydb().from("payment_provider_secrets").select("name, hint, updated_at").eq("provider", "paymob"),
  ]);
  if (error) throw error;
  if (!row) throw new NotFoundError();
  const cfg = (row.config ?? {}) as { base_url?: string; public_key?: string; integrations?: { USD?: number[] } };
  const s = Object.fromEntries(paymentSecretNames.map((n) => {
    const hit = secrets?.find((x) => x.name === n);
    return [n, { set: Boolean(hit), hint: hit?.hint ?? null, updatedAt: hit?.updated_at ?? null }];
  })) as PaymobSettings["secrets"];
  return {
    enabled: row.enabled,
    mode: row.mode,
    baseUrl: cfg.base_url ?? "https://accept.paymob.com",
    publicKey: cfg.public_key ?? "",
    integrations: { USD: cfg.integrations?.USD ?? [] },
    secrets: s,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  };
}

/* ───────────────────────── Prospect packs ───────────────────────── */

export async function listPacks() {
  const { data, error } = await ydb().from("prospect_packs").select("*").order("sort").order("prospects");
  if (error) throw error;
  return data ?? [];
}

const money = (v: number | null, field: string) => {
  if (v == null) throw new ValidationError("السعر مطلوب.", { [field]: "مطلوب" });
  if (!Number.isFinite(v) || v <= 0 || v > 1_000_000 || Math.round(v * 100) !== v * 100) throw new ValidationError("السعر غير صالح.", { [field]: "رقم أكبر من 0 بحد أقصى منزلتين عشريتين" });
  return v;
};

/* ───────────────────────── Pay As You Go (D-247) ───────────────────────── */

/** The price of one prospect (site_settings.credits): the only rate top-ups are converted with. */
export async function getCreditRate(): Promise<{ usdPerProspect: number; updatedAt: string | null }> {
  const { data } = await ydb().from("site_settings").select("value, updated_at").eq("key", "credits").maybeSingle();
  const v = Number((data?.value as { usd_per_prospect?: number } | null)?.usd_per_prospect);
  return { usdPerProspect: Number.isFinite(v) && v > 0 ? v : 0.05, updatedAt: data?.updated_at ?? null };
}

const prospectsFor = (priceUsd: number, rate: number) => Math.floor(Math.round((priceUsd / rate) * 1e6) / 1e6);

/** Changes the rate and recalculates every top-up option from it. Past top-ups keep what they gave. */
export async function saveCreditRate(bos: BosUser, usdPerProspect: number | null): Promise<void> {
  if (usdPerProspect == null || !Number.isFinite(usdPerProspect) || usdPerProspect <= 0 || usdPerProspect > 100 || Math.round(usdPerProspect * 10000) !== usdPerProspect * 10000)
    throw new ValidationError("السعر غير صالح.", { usd_per_prospect: "رقم أكبر من 0 بحد أقصى 4 منازل عشرية" });
  const before = await getCreditRate();
  const { error } = await ydb().from("site_settings").upsert({ key: "credits", value: { usd_per_prospect: usdPerProspect }, updated_at: new Date().toISOString() });
  if (error) throw error;
  for (const p of await listPacks()) {
    const prospects = prospectsFor(Number(p.price_usd), usdPerProspect);
    if (prospects !== p.prospects) await ydb().from("prospect_packs").update({ prospects: Math.max(prospects, 1), updated_by: bos.email, updated_at: new Date().toISOString() }).eq("id", p.id);
  }
  await audit({ actorId: bos.userId, action: "yolias.payments.credit_rate", entityType: "yolias_site_setting", entityId: null, oldValue: { usd_per_prospect: before.usdPerProspect }, newValue: { usd_per_prospect: usdPerProspect }, metadata: {} });
}

/**
 * A top-up option: the amount is set here, the prospects always come from the
 * rate (never typed in). Emails are not sold (D-247).
 */
export async function savePack(bos: BosUser, input: { id?: string | null; priceUsd: number | null; active: boolean; sort: number }): Promise<void> {
  const price = money(input.priceUsd, "price_usd");
  const { usdPerProspect } = await getCreditRate();
  const prospects = prospectsFor(price, usdPerProspect);
  if (prospects < 1) throw new ValidationError("المبلغ أقل من سعر عميل محتمل واحد.", { price_usd: "مبلغ أكبر" });
  const row = {
    prospects,
    emails: 0,
    price_usd: price,
    active: input.active,
    sort: Number.isInteger(input.sort) ? input.sort : 0,
    updated_by: bos.email,
    updated_at: new Date().toISOString(),
  };
  const q = input.id ? ydb().from("prospect_packs").update(row).eq("id", input.id).select("id").maybeSingle() : ydb().from("prospect_packs").insert(row).select("id").single();
  const { data, error } = await q;
  if (error) throw error;
  if (!data) throw new NotFoundError();
  await audit({ actorId: bos.userId, action: input.id ? "yolias.payments.pack_update" : "yolias.payments.pack_create", entityType: "yolias_prospect_pack", entityId: null, newValue: row, metadata: { pack: data.id } });
}

export interface CreditEntry { at: string; kind: "topup" | "used" | "adjust"; prospects: number; search: string | null; by: string | null; reason: string | null }

/**
 * A workspace's Pay As You Go credit: what was topped up (confirmed payments
 * only), what was drawn from it, the balance, and the history of top-ups and
 * prospects delivered. Same ledger and rules as Yolias usage_summary.
 */
export async function workspaceCredit(workspaceId: string) {
  const db = ydb();
  const [{ data: all, error }, { data: recent }, { data: ws }] = await Promise.all([
    db.from("usage_ledger").select("kind, prospects, reason").eq("workspace_id", workspaceId).in("kind", ["grant", "consume"]),
    db.from("usage_ledger").select("kind, prospects, reason, created_at, created_by, campaign_id").eq("workspace_id", workspaceId).in("kind", ["grant", "consume", "adjust"]).order("created_at", { ascending: false }).limit(60),
    db.from("workspaces").select("credit_started_at").eq("id", workspaceId).maybeSingle(),
  ]);
  if (error) throw error;
  const rows = all ?? [];
  const toppedUp = rows.filter((r) => r.kind === "grant" && (r.reason ?? "").startsWith("prospect_pack:")).reduce((n, r) => n + r.prospects, 0);
  const fromCredit = rows.filter((r) => r.kind === "consume" && r.reason === "extra").reduce((n, r) => n + r.prospects, 0);
  const delivered = rows.filter((r) => r.kind === "consume").reduce((n, r) => n + r.prospects, 0);
  const ids = [...new Set((recent ?? []).map((r) => r.campaign_id).filter(Boolean))] as string[];
  const names = new Map<string, string>();
  if (ids.length) for (const c of (await db.from("campaigns").select("id, name").in("id", ids)).data ?? []) names.set(c.id, c.name);
  const history: CreditEntry[] = (recent ?? [])
    .filter((r) => r.kind !== "grant" || (r.reason ?? "").startsWith("prospect_pack:"))
    .map((r) => ({ at: r.created_at, kind: r.kind === "grant" ? "topup" : r.kind === "consume" ? "used" : "adjust", prospects: r.prospects, search: r.campaign_id ? names.get(r.campaign_id) ?? null : null, by: r.created_by, reason: r.reason }));
  return { toppedUp, fromCredit, delivered, balance: Math.max(toppedUp - fromCredit, 0), startedAt: (ws as { credit_started_at?: string | null } | null)?.credit_started_at ?? null, history };
}

/* ───────────────────────── Payments log ───────────────────────── */

export async function recentPayments(limit = 50) {
  const cols = "id, workspace_id, kind, plan, billing_period, prospects, amount, currency, provider, mode, status, provider_ref, provider_txn, failure_reason, invoice_id, created_at, paid_at, created_by, charge_amount, charge_currency, workspace:workspaces(name)";
  const run = (extra: string) => ydb().from("payments").select(`${cols}${extra}`).order("created_at", { ascending: false }).limit(limit);
  // payments.checkout_id comes with migration 20261113000000; a database without it still lists payments.
  let { data, error } = await run(", checkout_id");
  if (error) ({ data, error } = await run(""));
  if (error) throw error;
  return (data ?? []) as unknown as {
    id: string; workspace_id: string; kind: string; plan: string | null; billing_period: string | null; prospects: number | null; amount: number; currency: string;
    provider: string; mode: string; status: string; provider_ref: string | null; provider_txn: string | null; failure_reason: string | null; invoice_id: string | null;
    created_at: string; paid_at: string | null; created_by: string | null; charge_amount: number | null; charge_currency: string | null; checkout_id?: string | null;
    workspace: { name: string | null } | null;
  }[];
}

/** Paid totals per currency and mode — never summed across currencies (D-120). */
export async function paymentTotals(days: number) {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data, error } = await ydb().from("payments").select("amount, currency, mode, status").gte("created_at", since);
  if (error) throw error;
  const out: Record<string, { succeeded: number; failed: number; amount: number }> = {};
  for (const p of data ?? []) {
    const k = `${p.currency}:${p.mode}`;
    out[k] ??= { succeeded: 0, failed: 0, amount: 0 };
    if (p.status === "succeeded") { out[k].succeeded++; out[k].amount += Number(p.amount); }
    if (p.status === "failed") out[k].failed++;
  }
  return out;
}

/** Kashier (D-235): status and non-secret settings for Admin → Payments. */
export async function getKashierSettings() {
  const [{ data: row }, { count }] = await Promise.all([
    ydb().from("payment_providers").select("*").eq("id", "kashier").maybeSingle(),
    ydb().from("billing_cards").select("id", { count: "exact", head: true }).eq("provider", "kashier").eq("status", "active"),
  ]);
  const cfg = (row?.config ?? {}) as { merchant_id?: string; currency?: string };
  return { enabled: Boolean(row?.enabled), mode: row?.mode ?? "test", merchantId: cfg.merchant_id ?? null, currency: cfg.currency === "EGP" ? "EGP" : "USD", savedCards: count ?? 0 };
}
