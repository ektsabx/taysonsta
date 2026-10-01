"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, CreditCard, Lock } from "lucide-react";
import { formatNumber } from "@/lib/format";
import type { PaidPlan, Plan } from "@/types/database";
import { activatePlan } from "./actions";

interface Option {
  id: PaidPlan;
  name: string;
  priceUsd: number;
  prospectCredits: number;
  companyLookups: number;
}

const usageLabel: Record<PaidPlan, string> = { pro: "Limited usage capacity", growth: "More usage capacity", scale: "High usage capacity" };

interface Props {
  initialPlan: PaidPlan;
  currentPlan: Plan;
  canManage: boolean;
  testMode: boolean;
  email: string;
  workspaceName: string;
  options: Option[];
}

export function CheckoutForm({ initialPlan, currentPlan, canManage, testMode, email, workspaceName, options }: Props) {
  const [selected, setSelected] = useState<PaidPlan>(initialPlan);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const plan = options.find((o) => o.id === selected)!;
  const isCurrent = currentPlan === selected;

  const subscribe = () =>
    start(async () => {
      setError(null);
      const r = await activatePlan(selected);
      if (r && !r.ok) setError(r.error);
    });

  return (
    <main className="checkout-grid">
      <section>
        <p className="checkout-eyebrow">Subscribe</p>
        <h1 className="checkout-title">Upgrade to {plan.name}</h1>
        <p className="checkout-lead">Same Yolias. Unlimited users. More usage as you grow.</p>

        <div className="checkout-plans" role="radiogroup" aria-label="Plan">
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
                  {o.name}
                  {o.id === "growth" && <span className="plan-badge">Recommended</span>}
                  {o.id === currentPlan && <span className="coming-soon">Current plan</span>}
                </span>
                <span className="checkout-plan-sub">{usageLabel[o.id]}</span>
              </span>
              <span className="checkout-plan-price">${o.priceUsd}<small>/month</small></span>
            </button>
          ))}
        </div>

        <div className="checkout-included">
          <div className="checkout-included-title">Included in {plan.name}</div>
          <ul>
            <li><Check /> Same core Yolias features</li>
            <li><Check /> Unlimited users</li>
            <li><Check /> {formatNumber(plan.prospectCredits)} customer discovery credits / month</li>
            <li><Check /> {formatNumber(plan.companyLookups)} company deep-research lookups / month</li>
          </ul>
        </div>
      </section>

      <aside className="checkout-summary">
        <div className="checkout-summary-title">Order summary</div>
        <div className="checkout-line">
          <span>
            {plan.name}
            <small>Billed monthly{workspaceName ? ` · ${workspaceName}` : ""}</small>
          </span>
          <span>${plan.priceUsd.toFixed(2)}</span>
        </div>
        <div className="checkout-line muted"><span>Subtotal</span><span>${plan.priceUsd.toFixed(2)}</span></div>
        <div className="checkout-line muted"><span>Tax</span><span>Not included</span></div>
        <div className="checkout-line total"><span>Total due today</span><span>${plan.priceUsd.toFixed(2)}</span></div>

        <div className="checkout-payment">
          <div className="checkout-payment-title"><CreditCard /> Payment method</div>
          <p className="checkout-payment-note">
            Online card payments aren&apos;t connected yet.
            {testMode && " Billing test mode is on: the plan is activated without any charge."}
          </p>
        </div>

        {!canManage ? (
          <p className="form-error">Only the workspace owner or an admin can change the plan.</p>
        ) : isCurrent ? (
          <Link className="btn-primary checkout-submit" href="/">You&apos;re on this plan · Open Yolias</Link>
        ) : testMode ? (
          <button className="btn-primary checkout-submit" type="button" onClick={subscribe} disabled={pending}>
            <Lock /> {pending ? "Activating…" : `Activate ${plan.name} · test mode`}
          </button>
        ) : (
          <button className="btn-primary checkout-submit" type="button" disabled>
            <Lock /> Subscribe · Coming soon
          </button>
        )}
        {error && <p className="form-error" role="alert">{error}</p>}

        <p className="checkout-fine">
          Signed in as {email}. Renews monthly until canceled. Prices don&apos;t include applicable tax.
        </p>
      </aside>
    </main>
  );
}
