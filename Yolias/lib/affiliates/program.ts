// Affiliate program settings (the latest affiliate_program_versions row).
// Pure helpers, shared by the server code and unit tests. Every value is
// read defensively: a missing or broken setting falls back to a safe default
// (program closed, nothing paid) rather than to something generous.

import { priceFor } from "../pricing-math";

export interface ProgramQuestion {
  id: string;
  label: string;
  required: boolean;
}

export interface PayoutMethod {
  id: string;
  label: string;
  enabled: boolean;
}

export interface ProgramSettings {
  enabled: boolean;
  autoApprove: boolean;
  questions: ProgramQuestion[];
  commission: { type: "percent" | "fixed"; percentBps: number; fixedCents: number };
  eligible: { plans: ("pro" | "growth" | "scale")[]; periods: ("monthly" | "annual")[]; packs: boolean };
  recurring: { enabled: boolean; maxPayments: number | null };
  attribution: { days: number; model: "first_touch" | "last_touch" };
  minPaymentCents: number;
  holdDays: number;
  minPayoutCents: number;
  currencies: string[];
  payoutMethods: PayoutMethod[];
  includeTestPayments: boolean;
  notifyAffiliates: boolean;
}

export interface Program {
  versionId: number;
  termsVersion: string;
  settings: ProgramSettings;
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const int = (v: unknown, min: number, max: number, fallback: number) => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
};
const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);

export function parseProgramSettings(raw: unknown): ProgramSettings {
  const s = obj(raw);
  const c = obj(s.commission);
  const e = obj(s.eligible);
  const r = obj(s.recurring);
  const a = obj(s.attribution);
  const questions = (Array.isArray(s.questions) ? s.questions : [])
    .map(obj)
    .filter((q) => typeof q.id === "string" && /^[a-z0-9_]{1,30}$/.test(q.id) && typeof q.label === "string" && q.label.trim())
    .slice(0, 10)
    .map((q) => ({ id: q.id as string, label: (q.label as string).slice(0, 200), required: q.required !== false }));
  const payoutMethods = (Array.isArray(s.payout_methods) ? s.payout_methods : [])
    .map(obj)
    .filter((m) => typeof m.id === "string" && /^[a-z_]{2,30}$/.test(m.id) && typeof m.label === "string")
    .map((m) => ({ id: m.id as string, label: (m.label as string).slice(0, 60), enabled: m.enabled === true }));
  const max = r.max_payments === null || r.max_payments === undefined || r.max_payments === "" ? null : int(r.max_payments, 1, 1200, 1);
  return {
    enabled: bool(s.enabled, false),
    autoApprove: bool(s.auto_approve, false),
    questions,
    commission: {
      type: c.type === "fixed" ? "fixed" : "percent",
      percentBps: int(c.percent_bps, 0, 10000, 0),
      fixedCents: int(c.fixed_cents, 0, 10_000_000, 0),
    },
    eligible: {
      plans: (Array.isArray(e.plans) ? e.plans : []).filter((p): p is "pro" | "growth" | "scale" => p === "pro" || p === "growth" || p === "scale"),
      periods: (Array.isArray(e.periods) ? e.periods : []).filter((p): p is "monthly" | "annual" => p === "monthly" || p === "annual"),
      packs: bool(e.packs, false),
    },
    recurring: { enabled: bool(r.enabled, false), maxPayments: max },
    attribution: { days: int(a.days, 1, 365, 30), model: a.model === "last_touch" ? "last_touch" : "first_touch" },
    minPaymentCents: int(s.min_payment_cents, 0, 100_000_000, 0),
    holdDays: int(s.hold_days, 0, 365, 30),
    minPayoutCents: int(s.min_payout_cents, 1, 100_000_000, 5000),
    currencies: (Array.isArray(s.currencies) ? s.currencies : []).filter((x): x is string => x === "USD"),
    payoutMethods,
    includeTestPayments: bool(s.include_test_payments, false),
    notifyAffiliates: bool(s.notify_affiliates, true),
  };
}

/** "20%" or "$25" — what one qualifying payment earns, for display. */
export function commissionLabel(s: ProgramSettings, money: (cents: number) => string): string {
  return s.commission.type === "fixed" ? money(s.commission.fixedCents) : `${s.commission.percentBps / 100}%`;
}

/** Same rule as the database (affiliate_record_payment): floor, in cents. */
export function commissionFor(s: ProgramSettings, baseCents: number): number {
  if (s.commission.type === "fixed") return Math.min(s.commission.fixedCents, baseCents);
  return Math.floor((baseCents * s.commission.percentBps) / 10000);
}

export const AFFILIATE_COOKIE = "yl_ref";
export const CODE_RE = /^[a-z0-9]{6,16}$/;

/** "$12.50" in both languages (shown inside dir="ltr", like every Yolias price). */
export function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", currencyDisplay: "narrowSymbol", minimumFractionDigits: 2 }).format(cents / 100);
}

export interface CommissionExample {
  plan: "pro" | "growth" | "scale";
  period: "monthly" | "annual";
  paymentCents: number;
  perPaymentCents: number;
  /** Most one referred customer can earn the affiliate (null: no limit). */
  maxCents: number | null;
}

/**
 * Worked examples for the public page, from the live settings and the live
 * plan prices (same rounding as the database). Only eligible plans and
 * periods; annual = one yearly payment at the annual discount.
 */
export function commissionExamples(s: ProgramSettings, monthlyUsd: Record<"pro" | "growth" | "scale", number>): CommissionExample[] {
  const out: CommissionExample[] = [];
  for (const plan of s.eligible.plans) {
    for (const period of s.eligible.periods) {
      const paymentCents = Math.round(priceFor(monthlyUsd[plan] ?? 0, period) * 100);
      if (paymentCents <= 0 || paymentCents < s.minPaymentCents) continue;
      const perPaymentCents = commissionFor(s, paymentCents);
      const payments = !s.recurring.enabled ? 1 : s.recurring.maxPayments;
      out.push({ plan, period, paymentCents, perPaymentCents, maxCents: payments == null ? null : perPaymentCents * payments });
    }
  }
  return out;
}
