import type { BillingPeriod } from "../types/database";

// Annual billing math (D-192): annual = monthly price − 20%, shown per month,
// charged once a year. No other imports, so both apps can use it.

export const ANNUAL_DISCOUNT = 0.2;

const cents = (v: number) => Math.round(v * 100) / 100;

/** The price per month: the list price, or the discounted rate on annual billing. Shown on every price. */
export function monthlyRate(monthlyUsd: number, period: BillingPeriod): number {
  return period === "annual" ? cents(monthlyUsd * (1 - ANNUAL_DISCOUNT)) : monthlyUsd;
}

/** What one billing period charges: the monthly price, or 12 × the discounted rate paid once a year. */
export function priceFor(monthlyUsd: number, period: BillingPeriod): number {
  return period === "annual" ? cents(monthlyRate(monthlyUsd, period) * 12) : monthlyUsd;
}
