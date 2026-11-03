// The growth math behind Yolias Admin's dashboard (owner, 2026-11-03, D-276).
// Pure functions (unit-tested): every number is worked out from real rows by
// services/yolias/growth.ts; a number that can't be worked out is null and
// shows as "—", never as 0.

export const DAY = 86_400_000;

/** a ÷ b, or null when b is 0. */
export const ratio = (a: number, b: number): number | null => (b > 0 ? a / b : null);

/** Change from prev to now (0.25 = +25%), or null without a base. */
export const change = (now: number, prev: number): number | null => (prev > 0 ? (now - prev) / prev : now > 0 ? null : 0);

/** Monthly price of a subscription: the list price, or the annual rate (20% off) per month. */
export function monthlyPrice(listUsd: number, period: string | null | undefined): number {
  return period === "annual" ? Math.round(listUsd * 0.8 * 100) / 100 : listUsd;
}

/** Monthly churn from the churn over a period of `days`. */
export function monthlyChurn(churned: number, activeAtStart: number, days: number): number | null {
  const p = ratio(churned, activeAtStart);
  if (p == null || days <= 0) return p;
  // Same compounding as a monthly rate: 1 − (1 − p)^(30/days).
  return 1 - Math.pow(Math.max(0, 1 - Math.min(1, p)), 30 / days);
}

/**
 * Lifetime value: average monthly revenue per paying customer × gross margin
 * ÷ monthly churn. Without churn yet it can't be worked out (null), instead
 * of an infinite number.
 */
export function ltv(arppuMonthly: number | null, grossMargin: number | null, churnMonthly: number | null): number | null {
  if (arppuMonthly == null || grossMargin == null || churnMonthly == null || churnMonthly <= 0) return null;
  return (arppuMonthly * grossMargin) / churnMonthly;
}

/** Months for a customer's gross profit to pay back what acquiring them cost. */
export function paybackMonths(cac: number | null, arppuMonthly: number | null, grossMargin: number | null): number | null {
  if (cac == null || arppuMonthly == null || grossMargin == null) return null;
  const perMonth = arppuMonthly * grossMargin;
  return perMonth > 0 ? cac / perMonth : null;
}

/** Share of revenue from the top `share` of customers (0.1 = top 10%), and the biggest customers. */
export function concentration(revenueByCustomer: number[], share = 0.1): { topShare: number | null; top1: number | null } {
  const xs = revenueByCustomer.filter((v) => v > 0).sort((a, b) => b - a);
  const total = xs.reduce((s, v) => s + v, 0);
  if (!total) return { topShare: null, top1: null };
  const n = Math.max(1, Math.ceil(xs.length * share));
  return { topShare: xs.slice(0, n).reduce((s, v) => s + v, 0) / total, top1: xs[0] / total };
}

/**
 * Net revenue retention: what customers who paid in the earlier window pay in
 * the later one (expansion above 1, contraction and churn below).
 */
export function nrr(prevByCustomer: Map<string, number>, nowByCustomer: Map<string, number>): number | null {
  let base = 0, kept = 0;
  for (const [id, v] of prevByCustomer) {
    if (v <= 0) continue;
    base += v;
    kept += nowByCustomer.get(id) ?? 0;
  }
  return base > 0 ? kept / base : null;
}

/** Buckets for a period: days up to 92 days, weeks up to a year, then months. */
export function buckets(sinceMs: number, untilMs: number): { unit: "day" | "week" | "month"; starts: number[] } {
  const days = (untilMs - sinceMs) / DAY;
  const unit = days <= 92 ? "day" : days <= 366 ? "week" : "month";
  const starts: number[] = [];
  const d = new Date(sinceMs);
  d.setUTCHours(0, 0, 0, 0);
  if (unit === "month") d.setUTCDate(1);
  if (unit === "week") d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  for (let t = d.getTime(); t < untilMs; ) {
    starts.push(t);
    const n = new Date(t);
    if (unit === "day") n.setUTCDate(n.getUTCDate() + 1);
    else if (unit === "week") n.setUTCDate(n.getUTCDate() + 7);
    else n.setUTCMonth(n.getUTCMonth() + 1);
    t = n.getTime();
  }
  return { unit, starts };
}

/** The bucket index of a timestamp (−1 outside). */
export function bucketOf(starts: number[], t: number, untilMs: number): number {
  if (!starts.length || t < starts[0] || t >= untilMs) return -1;
  let lo = 0, hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= t) lo = mid; else hi = mid - 1;
  }
  return lo;
}

/** The marketing channels the owner names, from Yolias's attribution channels. */
export const CHANNEL_GROUPS: Record<string, string> = {
  organic_search: "seo",
  ai_assistant: "geo",
  paid_search: "paid_ads",
  paid_social: "paid_ads",
  social: "social",
  email: "email",
  affiliate: "affiliate",
  referral: "referral",
  direct: "organic",
  unknown: "unknown",
};
export const channelGroup = (c: string | null | undefined) => CHANNEL_GROUPS[c ?? "unknown"] ?? "referral";
