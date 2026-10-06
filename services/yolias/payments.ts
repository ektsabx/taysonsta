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

export async function savePack(bos: BosUser, input: { id?: string | null; prospects: number; priceUsd: number | null; active: boolean; sort: number }): Promise<void> {
  if (!Number.isInteger(input.prospects) || input.prospects <= 0 || input.prospects > 1_000_000) throw new ValidationError("العدد غير صالح.", { prospects: "عدد صحيح موجب" });
  const row = {
    prospects: input.prospects,
    price_usd: money(input.priceUsd, "price_usd"),
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

/* ───────────────────────── Payments log ───────────────────────── */

export async function recentPayments(limit = 50) {
  const { data, error } = await ydb()
    .from("payments")
    .select("id, workspace_id, kind, plan, billing_period, prospects, amount, currency, provider, mode, status, provider_ref, provider_txn, failure_reason, invoice_id, created_at, paid_at, workspace:workspaces(name)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as (Omit<NonNullable<typeof data>[number], "workspace"> & { workspace: { name: string | null } | null })[];
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
