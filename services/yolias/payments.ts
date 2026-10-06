import "server-only";
import type { BosUser } from "@/lib/bos/auth";
import { audit } from "@/lib/bos/audit";
import { NotFoundError, ValidationError } from "@/lib/bos/errors";
import { ydb } from "@/lib/yolias/db";

// Yolias payment settings from the Admin (final spec phase 3): the Paymob
// provider (non-secret config in public.payment_providers, secrets in Vault
// through public.set_payment_secret), Buy More Prospects packs, and the
// payments log. platform.manage only for writes; every change is audited.

export type PaymentSecretName = "secret_key" | "hmac_secret";
export const paymentSecretNames: PaymentSecretName[] = ["secret_key", "hmac_secret"];

export interface PaymobSettings {
  enabled: boolean;
  mode: "test" | "live";
  baseUrl: string;
  publicKey: string;
  integrations: { EGP: number[]; USD: number[] };
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
  const cfg = (row.config ?? {}) as { base_url?: string; public_key?: string; integrations?: { EGP?: number[]; USD?: number[] } };
  const s = Object.fromEntries(paymentSecretNames.map((n) => {
    const hit = secrets?.find((x) => x.name === n);
    return [n, { set: Boolean(hit), hint: hit?.hint ?? null, updatedAt: hit?.updated_at ?? null }];
  })) as PaymobSettings["secrets"];
  return {
    enabled: row.enabled,
    mode: row.mode,
    baseUrl: cfg.base_url ?? "https://accept.paymob.com",
    publicKey: cfg.public_key ?? "",
    integrations: { EGP: cfg.integrations?.EGP ?? [], USD: cfg.integrations?.USD ?? [] },
    secrets: s,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  };
}

const ids = (v: string) => {
  const parts = v.split(/[\s,]+/).map((x) => x.trim()).filter(Boolean);
  if (parts.some((x) => !/^\d{1,12}$/.test(x))) throw new ValidationError("أرقام التكامل غير صالحة.", { integrations: "أرقام مفصولة بفواصل" });
  return parts.map(Number);
};

export async function updatePaymob(bos: BosUser, input: { enabled: boolean; mode: "test" | "live"; baseUrl: string; publicKey: string; egp: string; usd: string }): Promise<void> {
  const base = input.baseUrl.trim().replace(/\/+$/, "");
  if (!/^https:\/\/[a-z0-9.-]+\.paymob\.com$/i.test(base)) throw new ValidationError("الرابط غير صالح.", { base_url: "رابط Paymob لمنطقة الحساب، مثل https://accept.paymob.com" });
  const publicKey = input.publicKey.trim();
  if (publicKey && !/^[A-Za-z0-9_-]{8,200}$/.test(publicKey)) throw new ValidationError("المفتاح العام غير صالح.", { public_key: "كما يظهر في لوحة Paymob" });
  const integrations = { EGP: ids(input.egp), USD: ids(input.usd) };
  const before = await getPaymobSettings();
  if (input.enabled && (!publicKey || !before.secrets.secret_key.set || !before.secrets.hmac_secret.set || integrations.EGP.length + integrations.USD.length === 0)) {
    throw new ValidationError("أكمل الإعداد قبل التفعيل.", { enabled: "يلزم المفتاح العام والمفتاح السري وسر HMAC ورقم تكامل واحد على الأقل" });
  }
  const { error } = await ydb().from("payment_providers").update({
    enabled: input.enabled,
    mode: input.mode,
    config: { base_url: base, public_key: publicKey, integrations },
    updated_by: bos.email,
    updated_at: new Date().toISOString(),
  }).eq("id", "paymob");
  if (error) throw error;
  await audit({
    actorId: bos.userId, action: "yolias.payments.provider_update", entityType: "yolias_payment_provider", entityId: null,
    oldValue: { enabled: before.enabled, mode: before.mode, integrations: before.integrations }, newValue: { enabled: input.enabled, mode: input.mode, integrations }, metadata: { provider: "paymob" },
  });
}

export async function setPaymentSecret(bos: BosUser, name: string, secret: string): Promise<void> {
  if (!(paymentSecretNames as string[]).includes(name)) throw new ValidationError("مفتاح غير معروف.");
  const value = secret.trim();
  if (value.length < 8 || value.length > 4000) throw new ValidationError("المفتاح غير صالح.", { secret: "8 أحرف على الأقل" });
  const { error } = await ydb().rpc("set_payment_secret", { p_provider: "paymob", p_name: name, p_secret: value });
  if (error) throw error;
  await audit({ actorId: bos.userId, action: "yolias.payments.secret_set", entityType: "yolias_payment_provider", entityId: null, metadata: { provider: "paymob", name } });
}

export async function clearPaymentSecret(bos: BosUser, name: string): Promise<void> {
  if (!(paymentSecretNames as string[]).includes(name)) throw new ValidationError("مفتاح غير معروف.");
  // A provider can't stay enabled without its secrets.
  await ydb().from("payment_providers").update({ enabled: false, updated_by: bos.email, updated_at: new Date().toISOString() }).eq("id", "paymob");
  const { error } = await ydb().rpc("clear_payment_secret", { p_provider: "paymob", p_name: name });
  if (error) throw error;
  await audit({ actorId: bos.userId, action: "yolias.payments.secret_cleared", entityType: "yolias_payment_provider", entityId: null, metadata: { provider: "paymob", name } });
}

/* ───────────────────────── Prospect packs ───────────────────────── */

export async function listPacks() {
  const { data, error } = await ydb().from("prospect_packs").select("*").order("sort").order("prospects");
  if (error) throw error;
  return data ?? [];
}

const money = (v: number | null, field: string, required: boolean) => {
  if (v == null) {
    if (required) throw new ValidationError("السعر مطلوب.", { [field]: "مطلوب" });
    return null;
  }
  if (!Number.isFinite(v) || v <= 0 || v > 1_000_000 || Math.round(v * 100) !== v * 100) throw new ValidationError("السعر غير صالح.", { [field]: "رقم أكبر من 0 بحد أقصى منزلتين عشريتين" });
  return v;
};

export async function savePack(bos: BosUser, input: { id?: string | null; prospects: number; priceUsd: number | null; priceEgp: number | null; active: boolean; sort: number }): Promise<void> {
  if (!Number.isInteger(input.prospects) || input.prospects <= 0 || input.prospects > 1_000_000) throw new ValidationError("العدد غير صالح.", { prospects: "عدد صحيح موجب" });
  const row = {
    prospects: input.prospects,
    price_usd: money(input.priceUsd, "price_usd", true)!,
    price_egp: money(input.priceEgp, "price_egp", false),
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
