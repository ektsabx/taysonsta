import { fmt, type Dictionary, type Locale } from "@/lib/i18n/config";
import { formatNumber } from "@/lib/format";
import type { BillingPeriod, Currency, PaidPlan, Plan, WorkspaceRow } from "@/types/database";

// Pricing (owner brief 2026-10-20, D-247): Pay As You Go credit (top-ups,
// lib/credits.ts) or a monthly plan, Pro ($50) or Growth ($100). No annual
// billing, no Scale for new customers (existing subscriptions keep running).
// The only unit is the prospect; emails and uploaded contacts are not limited.
export interface PlanTerms {
  priceUsd: number;
  /** Monthly price for Egypt, in EGP (D-237); null = Egypt pays the USD price at the day's rate. */
  priceEgp: number | null;
  prospects: number;
  emails: number;
  contacts: number;
}

/** Fallback only — the live values come from the database (lib/plan-catalog.ts). */
export const defaultPlans: Record<Plan, PlanTerms> = {
  free: { priceUsd: 0, priceEgp: null, prospects: 50, emails: 50, contacts: 50 },
  pro: { priceUsd: 50, priceEgp: 2499, prospects: 1000, emails: 1000, contacts: 1000 },
  growth: { priceUsd: 100, priceEgp: 4999, prospects: 2000, emails: 2000, contacts: 2000 },
  scale: { priceUsd: 200, priceEgp: 9999, prospects: 4000, emails: 4000, contacts: 4000 },
};

/** Monthly price of a plan (one USD price for every country, D-131). */
export function planPrice(terms: PlanTerms, currency: Currency): number | null {
  void currency;
  return terms.priceUsd;
}

export const allPlans: Plan[] = ["free", "pro", "growth", "scale"];
export const paidPlans: PaidPlan[] = ["pro", "growth", "scale"];
/** The monthly plans a workspace can choose (D-247: Scale is no longer offered). */
export const offeredPlans: PaidPlan[] = ["pro", "growth"];
/** The biggest plan on offer: nothing to upgrade to. */
export const topPlan: PaidPlan = "growth";

/** Localized plan name: "Free" / "Yolias Pro" / "Yolias Growth". */
export function planName(plan: Plan, t: Dictionary): string {
  return t.plans[plan];
}

/** Short badge label: "Growth" / "نمو". */
export function planLabel(plan: Plan, t: Dictionary): string {
  const key = { free: "labelFree", pro: "labelPro", growth: "labelGrowth", scale: "labelScale" } as const;
  return t.plans[key[plan]];
}

/** "1,000 prospects / month" */
export function planUsage(prospects: number, t: Dictionary, locale: Locale, plan?: Plan): string {
  // Free: a one-time gift at signup, not monthly (D-138).
  return fmt(plan === "free" ? t.plans.prospectsOnce : t.plans.prospectsPerMonth, { count: formatNumber(prospects, locale) });
}

/** A workspace has a plan it can use: paid, in its free trial, test, or the legacy Free plan. */
export function hasActivePlan(ws: Pick<WorkspaceRow, "subscription_status">): boolean {
  return ws.subscription_status === "active" || ws.subscription_status === "trialing" || ws.subscription_status === "test" || ws.subscription_status === "past_due";
}

/**
 * Can use Yolias: a plan as above, or Pay As You Go credit bought at least
 * once (D-247). The prospect balance decides what can run; this only opens
 * the app.
 */
export function canUseApp(ws: Pick<WorkspaceRow, "subscription_status"> & { credit_started_at?: string | null }): boolean {
  return hasActivePlan(ws) || Boolean(ws.credit_started_at);
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

/** Annual billing is 20% off the monthly price (owner decision 2026-10-13, D-192). */
// Annual pricing math lives in a dependency-free module so the Admin app can
// import it too (lib/affiliates/program.ts is shared with Yolias Admin).
export { ANNUAL_DISCOUNT, ANNUAL_DISCOUNT_PERCENT, monthlyRate, monthlyRateEgp, priceFor, priceForEgp } from "./pricing-math";

export function monthWindow(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const resets = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, resets };
}
