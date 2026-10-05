import "server-only";
import type { BosUser } from "@/lib/bos/auth";
import { audit } from "@/lib/bos/audit";
import { NotFoundError, ValidationError } from "@/lib/bos/errors";
import { yintel, ydb, type YoliasDatabase } from "@/lib/yolias/db";
import { monthStartUtc } from "@/lib/yolias/plans";
import { pricingSchema, settingSchemas, type SettingKey } from "@/lib/yolias/intel";

// Intelligence Layer control for Yolias Admin (docs/09 §B "Providers",
// "LLM usage & costs", "Platform costs", "Cost per prospect"). Reads and
// writes the Yolias `intel` schema; every write is audited. Credentials go
// straight into Supabase Vault and are never read back here.

export type ProviderRow = YoliasDatabase["intel"]["Tables"]["providers"]["Row"];
type Json = YoliasDatabase["public"]["Tables"]["strategies"]["Row"]["attachments"];

export async function listProviders(): Promise<ProviderRow[]> {
  const { data, error } = await yintel().from("providers").select("*").order("priority").order("id");
  if (error) throw error;
  return data ?? [];
}

export async function getProvider(id: string): Promise<ProviderRow | null> {
  const { data } = await yintel().from("providers").select("*").eq("id", id).maybeSingle();
  return data;
}

export interface ProviderInput {
  enabled: boolean;
  priority: number;
  concurrency: number;
  rate_limit_per_min: number | null;
  burst: number | null;
  daily_budget_usd: number | null;
  monthly_budget_usd: number | null;
  fallback_to: string[];
  pricing: string;
  license_scope: string | null;
  storage_allowed: boolean;
  retention_days: number | null;
  display_allowed: boolean;
  customer_facing_allowed: boolean;
  redistribution_allowed: boolean;
  derived_data_allowed: boolean;
  attribution_required: boolean;
  notes: string | null;
}

function publicView(p: ProviderRow) {
  const { credential_secret_id: _secret, ...rest } = p;
  void _secret;
  return rest;
}

export async function updateProvider(bos: BosUser, id: string, input: ProviderInput): Promise<void> {
  const before = await getProvider(id);
  if (!before) throw new NotFoundError();
  let pricing: unknown;
  try {
    pricing = JSON.parse(input.pricing || "{}");
  } catch {
    throw new ValidationError("الأسعار ليست JSON صالحاً.", { pricing: "JSON غير صالح" });
  }
  const parsed = pricingSchema.safeParse(pricing);
  if (!parsed.success) throw new ValidationError("الأسعار غير صالحة.", { pricing: parsed.error.issues[0]?.message ?? "غير صالح" });
  const unknownCap = Object.keys(parsed.data).find((c) => !before.capabilities.includes(c));
  if (unknownCap) throw new ValidationError("سعر لقدرة لا يدعمها المزود.", { pricing: unknownCap });
  const others = new Set((await listProviders()).map((p) => p.id));
  const badFallback = input.fallback_to.find((f) => f === id || !others.has(f));
  if (badFallback) throw new ValidationError("مزود بديل غير معروف.", { fallback_to: badFallback });
  const patch = { ...input, pricing: parsed.data as unknown as Json, license_scope: input.license_scope || null, notes: input.notes || null };
  const { error } = await yintel().from("providers").update(patch).eq("id", id);
  if (error) throw error;
  const after = await getProvider(id);
  await audit({ actorId: bos.userId, action: "yolias.provider.update", entityType: "yolias_provider", entityId: null, oldValue: publicView(before), newValue: after ? publicView(after) : null, metadata: { provider: id } });
}

export async function setProviderCredential(bos: BosUser, id: string, secret: string): Promise<void> {
  if (!(await getProvider(id))) throw new NotFoundError();
  const value = secret.trim();
  if (value.length < 8 || value.length > 4000) throw new ValidationError("المفتاح غير صالح.", { secret: "8 أحرف على الأقل" });
  const { error } = await yintel().rpc("set_provider_credential", { p_provider: id, p_secret: value });
  if (error) throw error;
  await audit({ actorId: bos.userId, action: "yolias.provider.credential_set", entityType: "yolias_provider", entityId: null, metadata: { provider: id } });
}

export async function clearProviderCredential(bos: BosUser, id: string): Promise<void> {
  const { error } = await yintel().rpc("clear_provider_credential", { p_provider: id });
  if (error) throw error;
  await audit({ actorId: bos.userId, action: "yolias.provider.credential_cleared", entityType: "yolias_provider", entityId: null, metadata: { provider: id } });
}

export async function getIntelSettings(): Promise<Record<string, unknown>> {
  const { data, error } = await yintel().from("settings").select("key, value");
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
}

export async function updateIntelSetting(bos: BosUser, key: SettingKey, raw: string): Promise<void> {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new ValidationError("القيمة ليست JSON صالحاً.", { value: "JSON غير صالح" });
  }
  const parsed = settingSchemas[key].safeParse(value);
  if (!parsed.success) throw new ValidationError("القيمة غير صالحة.", { value: parsed.error.issues[0]?.message ?? "غير صالح" });
  const before = (await getIntelSettings())[key] ?? null;
  const { error } = await yintel().from("settings").upsert({ key, value: parsed.data as unknown as Json, updated_by: bos.userId, updated_at: new Date().toISOString() });
  if (error) throw error;
  await audit({ actorId: bos.userId, action: "yolias.intel_setting.update", entityType: "yolias_setting", entityId: null, oldValue: before, newValue: parsed.data, metadata: { key } });
}

/** Costs since the start of the month, from SQL aggregates (docs/06). */
export async function costOverview(since = monthStartUtc()) {
  const [{ data: rows, error }, { count: prospects }, { data: recentLlm }, { data: recentCalls }] = await Promise.all([
    yintel().rpc("cost_summary", { p_since: since.toISOString() }),
    ydb().from("prospects").select("id", { count: "exact", head: true }).gte("created_at", since.toISOString()),
    yintel().from("llm_calls").select("id, task, model, served_model, input_tokens, output_tokens, cost_usd, cache_hit, ok, error, latency_ms, workspace_id, created_at").order("created_at", { ascending: false }).limit(20),
    yintel().from("provider_calls").select("id, provider, capability, ok, http_status, attempts, latency_ms, records_returned, cost_usd, error, created_at").order("created_at", { ascending: false }).limit(20),
  ]);
  if (error) throw error;
  const list = (rows ?? []).map((r) => ({ ...r, cost_usd: Number(r.cost_usd), calls: Number(r.calls), failures: Number(r.failures), cache_hits: Number(r.cache_hits), records: Number(r.records), unpriced: Number(r.unpriced ?? 0) }));
  const total = (kind: "llm" | "provider") => list.filter((r) => r.kind === kind).reduce((s, r) => s + r.cost_usd, 0);
  const llm = total("llm");
  const provider = total("provider");
  const delivered = prospects ?? 0;
  return {
    since: since.toISOString(),
    llm,
    provider,
    total: llm + provider,
    prospects: delivered,
    costPerProspect: delivered ? (llm + provider) / delivered : null,
    llmCalls: list.filter((r) => r.kind === "llm").reduce((s, r) => s + r.calls, 0),
    llmCacheHits: list.filter((r) => r.kind === "llm").reduce((s, r) => s + r.cache_hits, 0),
    unpriced: list.reduce((s, r) => s + r.unpriced, 0),
    rows: list,
    recentLlm: recentLlm ?? [],
    recentCalls: recentCalls ?? [],
  };
}
