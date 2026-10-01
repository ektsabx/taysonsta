import type { Dictionary } from "@/lib/i18n/config";
import type { BillingPeriod, PaidPlan, Plan, WorkspaceRow } from "@/types/database";

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

/** Localized "Yolias Growth" / "يولـياس للنمو". */
export function planName(plan: Plan, t: Dictionary): string {
  return t.plans[plan];
}

/** Short badge label: "Growth" / "نمو". */
export function planLabel(plan: Plan, t: Dictionary): string {
  const key = { free: "labelFree", pro: "labelPro", growth: "labelGrowth", scale: "labelScale" } as const;
  return t.plans[key[plan]];
}

export function planUsage(plan: PaidPlan, t: Dictionary): string {
  const key = { pro: "usagePro", growth: "usageGrowth", scale: "usageScale" } as const;
  return t.plans[key[plan]];
}

/** A workspace has chosen a plan (paid, test, or — if offered later — free). */
export function hasActivePlan(ws: Pick<WorkspaceRow, "subscription_status">): boolean {
  return ws.subscription_status === "active" || ws.subscription_status === "test";
}

export function isPaidPlan(v: unknown): v is PaidPlan {
  return typeof v === "string" && (paidPlans as string[]).includes(v);
}

/** Cookies remembering the plan and billing period picked on /pricing before signup. */
export const PLAN_COOKIE = "yolias_plan";
export const PERIOD_COOKIE = "yolias_period";

export function isBillingPeriod(v: unknown): v is BillingPeriod {
  return v === "monthly" || v === "annual";
}

/** Annual billing = 12 × the monthly price (no discount). */
export function priceFor(monthlyUsd: number, period: BillingPeriod): number {
  return period === "annual" ? monthlyUsd * 12 : monthlyUsd;
}

export function monthWindow(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const resets = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, resets };
}
