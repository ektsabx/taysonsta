"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Check, CreditCard, Lock } from "lucide-react";
import { formatMoney, formatNumber } from "@/lib/format";
import { fmt } from "@/lib/i18n/config";
import { useI18n } from "@/lib/i18n/client";
import { planName, planUsage, priceFor } from "@/lib/plans";
import type { BillingPeriod, Currency, Plan } from "@/types/database";
import { metaTrack, track } from "@/lib/analytics/client";
import { activatePlan } from "./actions";

interface Option {
  id: Plan;
  /** Monthly price in `currency`. */
  price: number;
  prospects: number;
}

interface Props {
  initialPlan: Plan;
  currentPlan: Plan | null;
  currentPeriod: BillingPeriod | null;
  initialPeriod: BillingPeriod;
  canManage: boolean;
  testMode: boolean;
  /** A payment provider is connected for this currency (lib/payments). */
  online: boolean;
  email: string;
  workspaceName: string;
  continueHref: string;
  options: Option[];
  currency: Currency;
}

export function CheckoutForm({ initialPlan, currentPlan, currentPeriod, initialPeriod, canManage, testMode, online, email, workspaceName, continueHref, options, currency }: Props) {
  const { t, locale } = useI18n();
  const c = t.checkout;
  const [selected, setSelected] = useState<Plan>(initialPlan);
  const [period, setPeriod] = useState<BillingPeriod>(initialPeriod);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const plan = options.find((o) => o.id === selected)!;
  const name = planName(selected, t);
  const isFree = selected === "free";
  const isCurrent = currentPlan === selected && (isFree || currentPeriod === period);
  const price = (o: Option) => priceFor(o.price, period);
  const per = (o: Option) => (period === "annual" && o.price ? t.plans.perYear : t.plans.perMonth);
  const money = (n: number) => formatMoney(n, currency, true);

  // Meta "InitiateCheckout" once, when the checkout page opens with a paid plan.
  useEffect(() => {
    const o = options.find((x) => x.id === initialPlan);
    const value = o ? priceFor(o.price, initialPeriod) : 0;
    track("checkout_viewed", { plan: initialPlan, billing_period: initialPeriod, value, currency });
    if (value > 0) metaTrack("InitiateCheckout", { value, currency, content_type: "product", content_ids: [`${initialPlan}_${initialPeriod}`], num_items: 1 });
  }, [initialPlan, initialPeriod, options, currency]);

  const subscribe = () =>
    start(async () => {
      setError(null);
      const r = await activatePlan(selected, period);
      if (r && !r.ok) setError(r.error);
    });

  return (
    <main className="checkout-grid">
      <section>
        <p className="checkout-eyebrow">{c.eyebrow}</p>
        <h1 className="checkout-title">{isFree ? c.titleFree : fmt(c.title, { plan: name })}</h1>
        <p className="checkout-lead">{c.lead}</p>

        <div className="period-toggle app" role="radiogroup" aria-label={t.pricing.billingPeriod}>
          {(["monthly", "annual"] as BillingPeriod[]).map((p) => (
            <button key={p} type="button" role="radio" aria-checked={period === p} className={period === p ? "active" : ""} onClick={() => setPeriod(p)}>
              {p === "monthly" ? t.plans.monthly : t.plans.annual}
            </button>
          ))}
        </div>

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
                  {o.id === currentPlan && (o.id === "free" || currentPeriod === period) && <span className="coming-soon">{c.currentPlan}</span>}
                </span>
                <span className="checkout-plan-sub">{planUsage(o.prospects, t, locale, o.id)}</span>
              </span>
              <span className="checkout-plan-price"><span dir="ltr">{formatMoney(price(o), currency)}</span><small>{per(o)}</small></span>
            </button>
          ))}
        </div>

        <div className="checkout-included">
          <div className="checkout-included-title">{fmt(c.includedIn, { plan: name })}</div>
          <ul>
            <li><Check /> {c.sameFeatures}</li>
            <li><Check /> {c.unlimitedUsers}</li>
            <li><Check /> {fmt(c.credits, { count: formatNumber(plan.prospects, locale) })}</li>
            <li><Check /> {t.pricing.noCommitment}</li>
          </ul>
        </div>
      </section>

      <aside className="checkout-summary">
        <div className="checkout-summary-title">{c.orderSummary}</div>
        <div className="checkout-line">
          <span>
            {name}
            <small>{isFree ? t.common.free : period === "annual" ? t.plans.billedAnnually : t.plans.billedMonthly}{workspaceName ? ` · ${workspaceName}` : ""}</small>
          </span>
          <span dir="ltr">{money(price(plan))}</span>
        </div>
        <div className="checkout-line muted"><span>{c.subtotal}</span><span dir="ltr">{money(price(plan))}</span></div>
        <div className="checkout-line muted"><span>{c.tax}</span><span>{c.taxNotIncluded}</span></div>
        <div className="checkout-line total"><span>{c.total}</span><span dir="ltr">{money(price(plan))}</span></div>

        {!isFree && <div className="checkout-payment">
          <div className="checkout-payment-title"><CreditCard /> {c.paymentMethod}</div>
          <p className="checkout-payment-note">
            {online ? c.paymentSecure : <>{c.paymentNote}{testMode && ` ${c.testModeNote}`}</>}
          </p>
        </div>}

        {!canManage ? (
          <p className="form-error">{currentPlan ? c.onlyAdmins : c.waitingForOwner}</p>
        ) : isCurrent ? (
          <Link className="btn-primary checkout-submit" href={continueHref}>{c.onThisPlan}</Link>
        ) : isFree ? (
          <button className="btn-primary checkout-submit" type="button" onClick={subscribe} disabled={pending}>
            {pending ? c.activating : c.startFree}
          </button>
        ) : online ? (
          <button className="btn-primary checkout-submit" type="button" onClick={subscribe} disabled={pending}>
            <Lock /> {pending ? c.redirecting : c.pay}
          </button>
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

        <p className="checkout-fine">{fmt(isFree ? c.fineFree : period === "annual" ? c.fineAnnual : c.fine, { email })}</p>
      </aside>
    </main>
  );
}
