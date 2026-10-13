import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DailyUsageKind, Plan } from "@/types/database";

// Daily limits per signed-in account (2026-10-12, docs/12 D-169). Each search
// and each Yolias AI message can cost an LLM call, so they are capped per
// user and UTC day (reset at 00:00 UTC) on the server. Separate from the
// monthly Prospects allowance and purchased packs, which limit results.
//
// Counting is atomic in the database (consume_daily_usage): concurrent
// requests can't pass the limit and the counter never goes negative. A slot
// taken for work that then didn't happen is given back with release().
//
// Limits are configuration: site_settings "yolias_daily_limits"
// ({ free: { search, ai_message }, pro: {…}, growth: {…} }), written with the
// service role only. Missing values use DEFAULT_DAILY_LIMITS (provisional,
// awaiting the owner's review against the pricing model, docs/18).

export const DAILY_LIMITS_KEY = "yolias_daily_limits";

export type DailyLimits = Record<Plan, Record<DailyUsageKind, number>>;

export const DEFAULT_DAILY_LIMITS: DailyLimits = {
  free: { search: 5, ai_message: 30 },
  pro: { search: 50, ai_message: 300 },
  growth: { search: 100, ai_message: 600 },
  scale: { search: 200, ai_message: 1200 },
};

const TTL_MS = 60_000;
let cache: { at: number; value: DailyLimits } | null = null;

/** Positive whole numbers only; anything else falls back to the default. */
export function parseDailyLimits(raw: unknown): DailyLimits {
  const out = structuredClone(DEFAULT_DAILY_LIMITS);
  if (!raw || typeof raw !== "object") return out;
  for (const plan of Object.keys(out) as Plan[]) {
    const p = (raw as Record<string, unknown>)[plan];
    if (!p || typeof p !== "object") continue;
    for (const kind of ["search", "ai_message"] as DailyUsageKind[]) {
      const v = (p as Record<string, unknown>)[kind];
      if (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 100_000) out[plan][kind] = v;
    }
  }
  return out;
}

export async function dailyLimits(): Promise<DailyLimits> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  let value = DEFAULT_DAILY_LIMITS;
  try {
    const { data } = await createAdminClient().from("site_settings").select("value").eq("key", DAILY_LIMITS_KEY).maybeSingle();
    value = parseDailyLimits(data?.value);
  } catch {
    value = cache?.value ?? DEFAULT_DAILY_LIMITS;
  }
  cache = { at: Date.now(), value };
  return value;
}

export function resetDailyLimitsCache() {
  cache = null;
}

export type DailyTake = { ok: true; used: number; limit: number } | { ok: false; limit: number };

/** Takes one slot of today's limit for this user, or reports that the limit is reached. */
export async function takeDaily(userId: string, plan: Plan, kind: DailyUsageKind): Promise<DailyTake> {
  const limit = (await dailyLimits())[plan][kind];
  const { data, error } = await createAdminClient().rpc("consume_daily_usage", { p_user: userId, p_kind: kind, p_limit: limit });
  if (error) throw new Error(`daily limit check failed: ${error.message}`);
  return typeof data === "number" ? { ok: true, used: data, limit } : { ok: false, limit };
}

/** Gives back a slot taken for work that didn't happen. */
export async function releaseDaily(userId: string, kind: DailyUsageKind): Promise<void> {
  await createAdminClient().rpc("release_daily_usage", { p_user: userId, p_kind: kind });
}
