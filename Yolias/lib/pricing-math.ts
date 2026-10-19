import type { BillingPeriod } from "../types/database";

// Annual billing math: annual = monthly price − 20%, shown per month, charged
// once a year (D-192; restored by the owner 2026-10-19, D-237, replacing
// "2 months free"). EGP prices (Egypt, D-237) round the discounted month down
// to the whole pound: 2,499 → 1,999 / month, 23,988 / year. No other imports,
// so both apps can use it.

export const ANNUAL_DISCOUNT = 0.2;
/** "Save 20%". */
export const ANNUAL_DISCOUNT_PERCENT = Math.round(ANNUAL_DISCOUNT * 100);

const cents = (v: number) => Math.round(v * 100) / 100;

/** The price per month: the list price, or the discounted rate on annual billing. Shown on every price. */
export function monthlyRate(monthlyUsd: number, period: BillingPeriod): number {
  return period === "annual" ? cents(monthlyUsd * (1 - ANNUAL_DISCOUNT)) : monthlyUsd;
}

/** What one billing period charges: the monthly price, or 12 × the discounted rate paid once a year. */
export function priceFor(monthlyUsd: number, period: BillingPeriod): number {
  return period === "annual" ? cents(monthlyRate(monthlyUsd, period) * 12) : monthlyUsd;
}

/** EGP per month: the list price, or the annual rate rounded down to the whole pound. */
export function monthlyRateEgp(monthlyEgp: number, period: BillingPeriod): number {
  return period === "annual" ? Math.floor(monthlyEgp * (1 - ANNUAL_DISCOUNT)) : monthlyEgp;
}

/** EGP charged for one billing period. */
export function priceForEgp(monthlyEgp: number, period: BillingPeriod): number {
  return period === "annual" ? monthlyRateEgp(monthlyEgp, period) * 12 : monthlyEgp;
}
