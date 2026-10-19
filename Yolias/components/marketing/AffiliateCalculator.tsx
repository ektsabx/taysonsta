"use client";

import { useState } from "react";
import { formatCents } from "@/lib/affiliates/program";

export interface CalcOption { key: string; planLabel: string; period: "monthly" | "annual"; periodLabel: string; perPaymentCents: number }

// Earnings estimate on /affiliates: N paying customers on a plan → commission
// per month and in the first year, from the live rate and prices (props).
// `paymentsPerYear` caps recurring commissions (1 = first payment only).
export function AffiliateCalculator({ options, maxRecurring, copy }: {
  options: CalcOption[];
  /** Commissionable payments per customer (null = no limit). */
  maxRecurring: number | null;
  copy: { plan: string; period: string; customers: string; perMonth: string; perYear: string };
}) {
  const [key, setKey] = useState(options[0]?.key ?? "");
  const [n, setN] = useState(10);
  const opt = options.find((o) => o.key === key) ?? options[0];
  if (!opt) return null;
  const cap = maxRecurring ?? Infinity;
  const paymentsFirstYear = opt.period === "annual" ? 1 : Math.min(12, cap);
  const perYear = n * opt.perPaymentCents * paymentsFirstYear;
  const perMonth = opt.period === "annual" ? Math.round(perYear / 12) : n * opt.perPaymentCents * (cap >= 1 ? 1 : 0);
  return (
    <div className="affiliate-calculator">
      <div className="affiliate-calc-controls">
        <label className="affiliate-calc-field">
          <span>{copy.plan}</span>
          <select className="form-field" value={opt.key} onChange={(e) => setKey(e.target.value)}>
            {options.map((o) => <option key={o.key} value={o.key}>{o.planLabel} · {o.periodLabel}</option>)}
          </select>
        </label>
        <label className="affiliate-calc-field">
          <span>{copy.customers}: <strong dir="ltr">{n}</strong></span>
          <input type="range" min={1} max={200} value={n} onChange={(e) => setN(Number(e.target.value))} />
        </label>
      </div>
      <div className="affiliate-calc-results">
        <div><span>{copy.perMonth}</span><strong dir="ltr">{formatCents(perMonth)}</strong></div>
        <div><span>{copy.perYear}</span><strong dir="ltr">{formatCents(perYear)}</strong></div>
      </div>
    </div>
  );
}
