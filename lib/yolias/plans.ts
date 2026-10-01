// Yolias plans as the admin needs them. Mirrors Yolias/lib/plans.ts until
// quotas move into the database (docs/10-roadmap.md phase 9, D-005); change
// both together.
export type YoliasPlan = "free" | "pro" | "growth";

export const yoliasPlans: Record<YoliasPlan, { label: string; priceUsd: number; prospects: number }> = {
  free: { label: "Free", priceUsd: 0, prospects: 50 },
  pro: { label: "Pro", priceUsd: 20, prospects: 1000 },
  growth: { label: "Growth", priceUsd: 50, prospects: 3000 },
};

export function monthStartUtc(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}
