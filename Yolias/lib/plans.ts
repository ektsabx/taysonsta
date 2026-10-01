import type { PaidPlan, Plan } from "@/types/database";

// Plans from the Yolias pricing page. Every plan has the same features and
// unlimited users; they differ only in monthly discovery usage. The usage
// numbers are the product's quotas — adjust them here.
export const plans: Record<Plan, { label: string; name: string; priceUsd: number; prospectCredits: number; companyLookups: number }> = {
  free: { label: "Free", name: "Yolias Free", priceUsd: 0, prospectCredits: 50, companyLookups: 20 },
  pro: { label: "Pro", name: "Yolias Pro", priceUsd: 20, prospectCredits: 1000, companyLookups: 200 },
  growth: { label: "Growth", name: "Yolias Growth", priceUsd: 50, prospectCredits: 3000, companyLookups: 600 },
  scale: { label: "Scale", name: "Yolias Scale", priceUsd: 100, prospectCredits: 8000, companyLookups: 1500 },
};

export const paidPlans: PaidPlan[] = ["pro", "growth", "scale"];

export function isPaidPlan(v: unknown): v is PaidPlan {
  return typeof v === "string" && (paidPlans as string[]).includes(v);
}

/** Cookie remembering which plan a visitor picked on /pricing before signing up. */
export const PLAN_COOKIE = "yolias_plan";

export function monthWindow(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const resets = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, resets };
}
