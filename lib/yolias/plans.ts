// Yolias plan ids and labels. Prices and prospect quotas are configuration
// in the Yolias database (public.plan_quotas, D-005) — read them with
// getPlanTerms() from services/yolias/usage.ts, never from constants.
export type YoliasPlan = "free" | "pro" | "growth";

export const yoliasPlanIds: YoliasPlan[] = ["free", "pro", "growth"];

// "free" = no subscription: Pay As You Go credit only (D-247).
export const yoliasPlanLabel: Record<YoliasPlan, string> = { free: "Pay As You Go", pro: "Pro", growth: "Growth" };

export function isYoliasPlan(v: unknown): v is YoliasPlan {
  return typeof v === "string" && (yoliasPlanIds as string[]).includes(v);
}

export function monthStartUtc(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}
