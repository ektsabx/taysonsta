"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, CreditCard, Lock } from "lucide-react";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { fmt } from "@/lib/i18n/config";
import { useI18n } from "@/lib/i18n/client";
import { monthlyRate, planName, priceFor } from "@/lib/plans";
import type { BillingPeriod, BillingProvider, Currency, PaidPlan, Plan } from "@/types/database";
import { metaTrack, track } from "@/lib/analytics/client";
import { callAction, isNetworkFailure } from "@/lib/action-client";
import { activatePlan, checkoutState, startPolarCheckout } from "./actions";

interface Option {
  id: PaidPlan;
  /** Monthly price in `currency`. */
  price: number;
  prospects: number;
  emails: number;
  contacts: number;
}

interface Props {
  initialPlan: PaidPlan;
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
  /** Who bills this workspace: Polar (free trial) or Paymob (Egypt, paid up front). */
  route: BillingProvider;
  /** The free trial this workspace can still start (null: none). */
  trial: { days: number; prospects: number; emails: number; contacts: number } | null;
  /** Error carried back from /checkout/polar. */
  initialError: string | null;
}

export function CheckoutForm({ initialPlan, currentPlan, currentPeriod, initialPeriod, canManage, testMode, online, email, workspaceName, continueHref, options, currency, route, trial, initialError }: Props) {
  const { t, locale } = useI18n();
  const c = t.checkout;
  const [selected, setSelected] = useState<PaidPlan>(initialPlan);
  const [period, setPeriod] = useState<BillingPeriod>(initialPeriod);
  const [error, setError] = useState<string | null>(initialError);
  const [pending, start] = useTransition();
  const router = useRouter();
  // Polar's checkout embedded in this page: "opening" → Polar's window → "activating" until the webhook starts the plan.
  const [embed, setEmbed] = useState<"idle" | "opening" | "activating" | "slow">("idle");
  const plan = options.find((o) => o.id === selected) ?? options[0];
  const name = planName(selected, t);
  const isCurrent = currentPlan === selected && currentPeriod === period;
  const n = (v: number) => formatNumber(v, locale);
  const price = (o: Option) => priceFor(o.price, period);
  // Plan rows show the price per month (annual: the discounted rate); the summary shows the charge.
  const rate = (o: Option) => monthlyRate(o.price, period);
  const money = (n: number) => formatMoney(n, currency, true);

  // Meta "InitiateCheckout" once, when the checkout page opens with a paid plan.
  useEffect(() => {
    const o = options.find((x) => x.id === initialPlan);
    const value = o ? priceFor(o.price, initialPeriod) : 0;
    track("checkout_viewed", { plan: initialPlan, billing_period: initialPeriod, value, currency });
    if (value > 0) metaTrack("InitiateCheckout", { value, currency, content_type: "product", content_ids: [`${initialPlan}_${initialPeriod}`], num_items: 1 });
  }, [initialPlan, initialPeriod, options, currency]);

  // Coming back from the payment page with the browser's Back button restores
  // this page from the back/forward cache with the button still "Opening
  // payment…": reload it so the button works again.
  useEffect(() => {
    const restored = (e: PageTransitionEvent) => { if (e.persisted) window.location.reload(); };
    window.addEventListener("pageshow", restored);
    return () => window.removeEventListener("pageshow", restored);
  }, []);

  // Polar (outside Egypt): the checkout opens inside Yolias (Polar's iframe, card
  // details stay with Polar). After Polar's success message the plan starts
  // when Polar's webhook arrives; the page waits for it, then continues.
  const subscribeEmbedded = () => {
    if (pending || embed !== "idle") return;
    setError(null);
    setEmbed("opening");
    start(async () => {
      const r = await callAction(() => startPolarCheckout(selected, period));
      if (isNetworkFailure(r)) { setEmbed("idle"); return setError(c.errors.network); }
      if (!r.ok) {
        setEmbed("idle");
        if (r.portal) window.location.assign(r.portal);
        return setError(r.error);
      }
      try {
        const { PolarEmbedCheckout } = await import("@polar-sh/checkout/embed");
        const dark = document.documentElement.getAttribute("data-theme") === "dark";
        const checkout = await PolarEmbedCheckout.create(r.url, { theme: dark ? "dark" : "light" });
        setEmbed("idle");
        checkout.addEventListener("success", (e) => {
          e.preventDefault(); // stay in Yolias instead of Polar's success page
          checkout.close();
          setEmbed("activating");
          const startedAt = Date.now();
          const poll = async () => {
            const s = await checkoutState().catch(() => ({ active: false }));
            if (s.active) return router.push(continueHref);
            if (Date.now() - startedAt > 60_000) return setEmbed("slow");
            window.setTimeout(poll, 2000);
          };
          void poll();
        });
      } catch {
        setEmbed("idle");
        // The embedded window couldn't open: use Polar's page instead.
        window.location.assign(r.url);
      }
    });
  };

  const subscribe = () => {
    if (route === "polar" && online) return subscribeEmbedded();
    if (pending) return;
    start(async () => {
      setError(null);
      const r = await callAction(() => activatePlan(selected, period));
      if (isNetworkFailure(r)) setError(c.errors.network);
      else if (r && !r.ok) setError(r.error);
    });
  };

  // First charge (after the trial) or next renewal, from today.
  const renewal = (() => {
    const d = new Date();
    if (trial) d.setDate(d.getDate() + trial.days);
    else if (period === "annual") d.setFullYear(d.getFullYear() + 1);
    else d.setMonth(d.getMonth() + 1);
    return d;
  })();

  return (
    <main className="checkout-grid">
      <section>
        <p className="checkout-eyebrow">{c.eyebrow}</p>
        <h1 className="checkout-title">{trial ? fmt(c.startTrial, { days: n(trial.days) }) : fmt(c.title, { plan: name })}</h1>
        <p className="checkout-lead">{c.lead}</p>

        <div className="period-toggle app" role="radiogroup" aria-label={t.pricing.billingPeriod}>
          {(["monthly", "annual"] as BillingPeriod[]).map((p) => (
            <button key={p} type="button" role="radio" aria-checked={period === p} className={period === p ? "active" : ""} onClick={() => setPeriod(p)}>
              {p === "monthly" ? t.plans.monthly : t.plans.annual}
              {p === "annual" && <span className="period-save">{t.plans.annualSave}</span>}
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
                  <span>{planName(o.id, t)}</span>
                  {o.id === "growth" && <span className="plan-badge">{t.plans.recommended}</span>}
                  {o.id === currentPlan && currentPeriod === period && <span className="coming-soon">{c.currentPlan}</span>}
                </span>
                <span className="checkout-plan-sub">{fmt(t.plans.prospectsPerMonth, { count: n(o.prospects) })} · {fmt(t.plans.emailsPerMonth, { count: n(o.emails) })}</span>
              </span>
              <span className="checkout-plan-price"><span dir="ltr" translate="no">{formatMoney(rate(o), currency)}</span><small>{t.plans.perMonth}</small></span>
            </button>
          ))}
        </div>

        <div className="checkout-included">
          <div className="checkout-included-title">{fmt(c.includedIn, { plan: name })}</div>
          <ul>
            <li><Check aria-hidden="true" /> <span>{c.sameFeatures}</span></li>
            <li><Check aria-hidden="true" /> <span>{c.unlimitedUsers}</span></li>
            <li><Check aria-hidden="true" /> <span>{fmt(c.credits, { count: n(plan.prospects) })}</span></li>
            <li><Check aria-hidden="true" /> <span>{fmt(c.emails, { count: n(plan.emails) })}</span></li>
            <li><Check aria-hidden="true" /> <span>{c.contactsUnlimited}</span></li>
            <li><Check aria-hidden="true" /> <span>{t.pricing.noCommitment}</span></li>
          </ul>
        </div>
      </section>

      <aside className="checkout-summary">
        <div className="checkout-summary-title">{c.orderSummary}</div>
        <div className="checkout-line">
          <span>
            <span>{name}</span>
            <small>{`${period === "annual" ? t.plans.billedAnnually : t.plans.billedMonthly}${workspaceName ? ` · ${workspaceName}` : ""}`}</small>
          </span>
          <span dir="ltr" translate="no">{money(price(plan))}</span>
        </div>
        {trial ? (
          <div className="checkout-line muted"><span>{fmt(c.afterTrial, { days: n(trial.days) })}</span><span dir="ltr" translate="no">{money(price(plan))}</span></div>
        ) : (
          <div className="checkout-line muted"><span>{c.subtotal}</span><span dir="ltr" translate="no">{money(price(plan))}</span></div>
        )}
        <div className="checkout-line muted"><span>{c.tax}</span><span>{c.taxNotIncluded}</span></div>
        <div className="checkout-line total"><span>{trial ? c.dueToday : c.total}</span><span dir="ltr" translate="no">{money(trial ? 0 : price(plan))}</span></div>

        <div className="checkout-payment">
          <div className="checkout-payment-title"><CreditCard aria-hidden="true" /> <span>{c.paymentMethod}</span></div>
          {/* Customers see where they go and when it renews — never which provider or internal mode (owner, 2026-10-13). */}
          <p className="checkout-payment-note"><span>{c.paymentRedirect}</span></p>
          <p className="checkout-payment-note"><span>{fmt(trial ? c.firstPaymentOn : c.renewsOn, { date: formatDate(renewal, locale) })}</span></p>
        </div>

        {/* Each button has its own key and its text in its own <span>: browser
            translation (Chrome/Safari on phones) moves bare text nodes into
            <font> tags, and React then failed to remove them when the button
            changed between two states (YOLIAS-8/9: removeChild). */}
        {!canManage ? (
          <p key="no-manage" className="form-error"><span>{currentPlan ? c.onlyAdmins : c.waitingForOwner}</span></p>
        ) : isCurrent ? (
          <Link key="current" className="btn-primary checkout-submit" href={continueHref}><span>{c.onThisPlan}</span></Link>
        ) : online ? (
          <button key={trial ? "trial" : "pay"} className="btn-primary checkout-submit" type="button" onClick={subscribe} disabled={pending || embed !== "idle"} aria-busy={pending || embed !== "idle"}>
            <Lock aria-hidden="true" /><span>{embed === "opening" ? c.openingPayment : embed === "activating" || embed === "slow" ? c.activatingTrial : pending ? c.redirecting : trial ? fmt(c.startTrial, { days: n(trial.days) }) : c.pay}</span>
          </button>
        ) : testMode ? (
          <button key={trial ? "test-trial" : "test"} className="btn-primary checkout-submit" type="button" onClick={subscribe} disabled={pending} aria-busy={pending}>
            <Lock aria-hidden="true" /><span>{pending ? c.activating : trial ? c.startTrialTest : fmt(c.activate, { plan: name })}</span>
          </button>
        ) : (
          <button key="soon" className="btn-primary checkout-submit" type="button" disabled>
            <Lock aria-hidden="true" /><span>{c.subscribeSoon}</span>
          </button>
        )}
        {error && <p className="form-error" role="alert"><span>{error}</span></p>}
        {embed === "activating" && <p className="checkout-payment-note" role="status"><span>{c.activatingTrial}</span></p>}
        {embed === "slow" && <p className="checkout-payment-note" role="status"><span>{c.activationSlow}</span></p>}

        <p className="checkout-fine">{fmt(trial ? (period === "annual" ? c.fineTrialAnnual : c.fineTrial) : period === "annual" ? c.fineAnnual : c.fine, { email, days: n(trial?.days ?? 0) })}</p>
      </aside>
    </main>
  );
}
