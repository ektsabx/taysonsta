import type { BillingPeriod } from "../types/database";

// Annual billing math: "2 months free" (owner brief 2026-10-19, replaces the
// 20% discount of D-192). A year costs 10 × the monthly price, charged once;
// the per-month rate shown is that year ÷ 12. No other imports, so both apps
// can use it.

export const ANNUAL_PAID_MONTHS = 10;
/** Months free on annual billing (12 − paid months), shown as "2 months free". */
export const ANNUAL_FREE_MONTHS = 12 - ANNUAL_PAID_MONTHS;

const cents = (v: number) => Math.round(v * 100) / 100;

/** What one billing period charges: the monthly price, or 10 × the monthly price paid once a year. */
export function priceFor(monthlyUsd: number, period: BillingPeriod): number {
  return period === "annual" ? cents(monthlyUsd * ANNUAL_PAID_MONTHS) : monthlyUsd;
}

/** The price per month: the list price, or the annual charge spread over 12 months. Shown on every price. */
export function monthlyRate(monthlyUsd: number, period: BillingPeriod): number {
  return period === "annual" ? cents(priceFor(monthlyUsd, period) / 12) : monthlyUsd;
}
