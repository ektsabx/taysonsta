"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, CreditCard, Lock } from "lucide-react";
import { formatNumber } from "@/lib/format";
import { fmt } from "@/lib/i18n/config";
import { useI18n } from "@/lib/i18n/client";
import { planName, planUsage } from "@/lib/plans";
import type { PaidPlan, Plan } from "@/types/database";
import { activatePlan } from "./actions";

interface Option {
  id: PaidPlan;
  priceUsd: number;
  prospectCredits: number;
  companyLookups: number;
}

interface Props {
  initialPlan: PaidPlan;
  currentPlan: Plan | null;
  canManage: boolean;
  testMode: boolean;
  email: string;
  workspaceName: string;
  continueHref: string;
  options: Option[];
}

export function CheckoutForm({ initialPlan, currentPlan, canManage, testMode, email, workspaceName, continueHref, options }: Props) {
  const { t, locale } = useI18n();
  const c = t.checkout;
  const [selected, setSelected] = useState<PaidPlan>(initialPlan);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const plan = options.find((o) => o.id === selected)!;
  const name = planName(selected, t);
  const isCurrent = currentPlan === selected;
  const money = (n: number) => `$${n.toFixed(2)}`;

  const subscribe = () =>
    start(async () => {
      setError(null);
      const r = await activatePlan(selected);
      if (r && !r.ok) setError(r.error);
    });

  return (
    <main className="checkout-grid">
      <section>
        <p className="checkout-eyebrow">{c.eyebrow}</p>
        <h1 className="checkout-title">{fmt(c.title, { plan: name })}</h1>
        <p className="checkout-lead">{c.lead}</p>

        <div className="checkout-plans" role="radiogroup" aria-label={c.eyebrow}>
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={o.id === selected}
              className={`checkout-plan${o.id === selected ? " selected" : ""}`}
              onClick={() => setSelected(o.id)}
            >
              <span className="checkout-radio" aria-hidden="true" />
              <span className="checkout-plan-main">
                <span className="checkout-plan-name">
                  {planName(o.id, t)}
                  {o.id === "growth" && <span className="plan-badge">{t.plans.recommended}</span>}
                  {o.id === currentPlan && <span className="coming-soon">{c.currentPlan}</span>}
                </span>
                <span className="checkout-plan-sub">{planUsage(o.id, t)}</span>
              </span>
              <span className="checkout-plan-price">${o.priceUsd}<small>{c.perMonth}</small></span>
            </button>
          ))}
        </div>

        <div className="checkout-included">
          <div className="checkout-included-title">{fmt(c.includedIn, { plan: name })}</div>
          <ul>
            <li><Check /> {c.sameFeatures}</li>
            <li><Check /> {c.unlimitedUsers}</li>
            <li><Check /> {fmt(c.credits, { count: formatNumber(plan.prospectCredits, locale) })}</li>
            <li><Check /> {fmt(c.lookups, { count: formatNumber(plan.companyLookups, locale) })}</li>
          </ul>
        </div>
      </section>

      <aside className="checkout-summary">
        <div className="checkout-summary-title">{c.orderSummary}</div>
        <div className="checkout-line">
          <span>
            {name}
            <small>{c.billedMonthly}{workspaceName ? ` · ${workspaceName}` : ""}</small>
          </span>
          <span dir="ltr">{money(plan.priceUsd)}</span>
        </div>
        <div className="checkout-line muted"><span>{c.subtotal}</span><span dir="ltr">{money(plan.priceUsd)}</span></div>
        <div className="checkout-line muted"><span>{c.tax}</span><span>{c.taxNotIncluded}</span></div>
        <div className="checkout-line total"><span>{c.total}</span><span dir="ltr">{money(plan.priceUsd)}</span></div>

        <div className="checkout-payment">
          <div className="checkout-payment-title"><CreditCard /> {c.paymentMethod}</div>
          <p className="checkout-payment-note">
            {c.paymentNote}
            {testMode && ` ${c.testModeNote}`}
          </p>
        </div>

        {!canManage ? (
          <p className="form-error">{currentPlan ? c.onlyAdmins : c.waitingForOwner}</p>
        ) : isCurrent ? (
          <Link className="btn-primary checkout-submit" href={continueHref}>{c.onThisPlan}</Link>
        ) : testMode ? (
          <button className="btn-primary checkout-submit" type="button" onClick={subscribe} disabled={pending}>
            <Lock /> {pending ? c.activating : fmt(c.activate, { plan: name })}
          </button>
        ) : (
          <button className="btn-primary checkout-submit" type="button" disabled>
            <Lock /> {c.subscribeSoon}
          </button>
        )}
        {error && <p className="form-error" role="alert">{error}</p>}

        <p className="checkout-fine">{fmt(c.fine, { email })}</p>
      </aside>
    </main>
  );
}
