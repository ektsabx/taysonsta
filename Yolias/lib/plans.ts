import { fmt, type Dictionary, type Locale } from "@/lib/i18n/config";
import { formatNumber } from "@/lib/format";
import type { BillingPeriod, Currency, PaidPlan, Plan, WorkspaceRow } from "@/types/database";

// Plans from the Yolias pricing page: Free, Pro and Growth. Every plan has
// the same features and unlimited users; they differ only in how many
// prospects Yolias delivers per month. One prospect = one target decision
// maker discovered with a verified email and company data (phone when
// available). That is the only thing usage counts.
export interface PlanTerms {
  priceUsd: number;
  prospects: number;
}

/** Fallback only — the live values come from the database (lib/plan-catalog.ts). */
export const defaultPlans: Record<Plan, PlanTerms> = {
  free: { priceUsd: 0, prospects: 50 },
  pro: { priceUsd: 50, prospects: 1000 },
  growth: { priceUsd: 100, prospects: 3000 },
};

/** Monthly price of a plan (one USD price for every country, D-131). */
export function planPrice(terms: PlanTerms, currency: Currency): number | null {
  void currency;
  return terms.priceUsd;
}

export const allPlans: Plan[] = ["free", "pro", "growth"];
export const paidPlans: PaidPlan[] = ["pro", "growth"];

/** Localized plan name: "Free" / "Yolias Pro" / "Yolias Growth". */
export function planName(plan: Plan, t: Dictionary): string {
  return t.plans[plan];
}

/** Short badge label: "Growth" / "نمو". */
export function planLabel(plan: Plan, t: Dictionary): string {
  const key = { free: "labelFree", pro: "labelPro", growth: "labelGrowth" } as const;
  return t.plans[key[plan]];
}

/** "1,000 prospects / month" */
export function planUsage(prospects: number, t: Dictionary, locale: Locale, plan?: Plan): string {
  // Free: a one-time gift at signup, not monthly (D-138).
  return fmt(plan === "free" ? t.plans.prospectsOnce : t.plans.prospectsPerMonth, { count: formatNumber(prospects, locale) });
}

/** A workspace has chosen a plan (paid, test, or — if offered later — free). */
export function hasActivePlan(ws: Pick<WorkspaceRow, "subscription_status">): boolean {
  return ws.subscription_status === "active" || ws.subscription_status === "test" || ws.subscription_status === "past_due";
}

export function isPaidPlan(v: unknown): v is PaidPlan {
  return typeof v === "string" && (paidPlans as string[]).includes(v);
}

export function isPlan(v: unknown): v is Plan {
  return typeof v === "string" && (allPlans as string[]).includes(v);
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
