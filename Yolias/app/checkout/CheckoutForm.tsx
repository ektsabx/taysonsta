"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, CreditCard, Lock } from "lucide-react";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { fmt } from "@/lib/i18n/config";
import { useI18n } from "@/lib/i18n/client";
import { monthlyRate, planName, priceFor, priceForEgp } from "@/lib/plans";
import type { BillingPeriod, Currency, PaidPlan, Plan } from "@/types/database";
import { metaTrack, track } from "@/lib/analytics/client";
import { callAction, isNetworkFailure } from "@/lib/action-client";
import { activatePlan, buyProspectPack, checkoutDetails } from "./actions";

interface Option {
  id: PaidPlan;
  /** Monthly price in `currency`. */
  price: number;
  /** Monthly EGP price for Egypt (D-237), when set. */
  priceEgp: number | null;
  prospects: number;
}

interface Props {
  initialPlan: PaidPlan;
  currentPlan: Plan | null;
  currentPeriod: BillingPeriod | null;
  canManage: boolean;
  testMode: boolean;
  /** Paymob, the only payment method (D-254), is connected and switched on. */
  online: boolean;
  email: string;
  workspaceName: string;
  continueHref: string;
  options: Option[];
  currency: Currency;
  /** Error carried back from the payment page. */
  initialError: string | null;
  /** This visit's checkout session (journey tracking, D-212). */
  checkoutId: string | null;
  /** The buyer is in Egypt: Paymob shows and charges the EGP prices (D-237). */
  egp: boolean;
  /** Pay As You Go top-up amounts and the prospects each one gives (D-247). */
  topUps: { id: string; priceUsd: number; prospects: number; priceEgp: number | null }[];
  /** US cents one prospect costs from credit (lib/credits). */
  centsPerProspect: number;
  /** Open on Pay As You Go (/checkout?plan=payg). */
  initialPayg: boolean;
}

export function CheckoutForm({ initialPlan, currentPlan, currentPeriod, canManage, testMode, online, email, workspaceName, continueHref, options, currency, initialError, checkoutId, egp, topUps, initialPayg, centsPerProspect }: Props) {
  const { t, locale } = useI18n();
  const c = t.checkout;
  const [selected, setSelected] = useState<PaidPlan>(initialPlan);
  // Monthly only (D-247): no annual billing for new subscriptions.
  const period: BillingPeriod = "monthly";
  const initialPeriod: BillingPeriod = "monthly";
  const [payg, setPayg] = useState(initialPayg && topUps.length > 0);
  const [topUp, setTopUp] = useState(topUps[0]?.id ?? "");
  const [error, setError] = useState<string | null>(initialError);
  const [pending, start] = useTransition();
  const plan = options.find((o) => o.id === selected) ?? options[0];
  const name = planName(selected, t);
  const isCurrent = currentPlan === selected && currentPeriod === period;
  const n = (v: number) => formatNumber(v, locale);
  // Egypt pays Paymob in EGP at the plan's EGP price (D-237).
  const inEgp = egp;
  // Prices are shown in USD (owner, 2026-10-21); in Egypt the EGP charge is shown under the total.
  const price = (o: Option) => priceFor(o.price, period);
  const egpOf = (o: Option) => (inEgp && o.priceEgp ? priceForEgp(o.priceEgp, period) : null);
  // Plan rows show the price per month (annual: the discounted rate); the summary shows the charge.
  const rate = (o: Option) => monthlyRate(o.price, period);
  const shownCurrency = currency;
  const money = (n: number) => formatMoney(n, shownCurrency, shownCurrency === "USD");

  // Meta "InitiateCheckout" once, when the checkout page opens with a paid plan.
  useEffect(() => {
    const o = options.find((x) => x.id === initialPlan);
    const value = o ? priceFor(o.price, initialPeriod) : 0;
    track("checkout_viewed", { plan: initialPlan, billing_period: initialPeriod, value, currency });
    if (value > 0) metaTrack("InitiateCheckout", { value, currency, content_type: "product", content_ids: [`${initialPlan}_${initialPeriod}`], num_items: 1 });
  }, [initialPlan, initialPeriod, options, currency]);

  // Journey tracking (D-212): changing the plan, period or method counts as
  // filling in the checkout (the first change only moves the step forward).
  const detail = (input: { plan?: string; period?: string; method?: string }) => { void checkoutDetails(checkoutId, input).catch(() => {}); };

  // Coming back from the payment page with the browser's Back button restores
  // this page from the back/forward cache with the button still "Opening
  // payment…": reload it so the button works again.
  useEffect(() => {
    const restored = (e: PageTransitionEvent) => { if (e.persisted) window.location.reload(); };
    window.addEventListener("pageshow", restored);
    return () => window.removeEventListener("pageshow", restored);
  }, []);

  const subscribe = () => {
    if (pending) return;
    start(async () => {
      setError(null);
      const r = await callAction(() => activatePlan(selected, period, "paymob", checkoutId));
      if (isNetworkFailure(r)) setError(c.errors.network);
      else if (r && !r.ok) setError(r.error);
    });
  };

  // Next renewal, from today.
  const renewal = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d;
  })();

  return (
    <main className="checkout-grid">
      <section>
        <p className="checkout-eyebrow">{payg ? c.payg.eyebrow : c.eyebrow}</p>
        <h1 className="checkout-title">{payg ? c.payg.title : fmt(c.title, { plan: name })}</h1>
        <p className="checkout-lead">{payg ? c.payg.lead : c.lead}</p>

        <div className="checkout-plans" role="radiogroup" aria-label={c.eyebrow}>
          {topUps.length > 0 && (
            <button type="button" role="radio" aria-checked={payg} className={`checkout-plan${payg ? " selected" : ""}`} onClick={() => { setPayg(true); setError(null); }}>
              <span className="checkout-radio" aria-hidden="true" />
              <span className="checkout-plan-main">
                <span className="checkout-plan-name"><span>{c.payg.name}</span></span>
                <span className="checkout-plan-sub">{c.payg.sub}</span>
              </span>
              <span className="checkout-plan-price"><span>{fmt(c.payg.from, { amount: formatMoney(topUps[0].priceUsd, "USD") })}</span></span>
            </button>
          )}
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={!payg && o.id === selected}
              className={`checkout-plan${!payg && o.id === selected ? " selected" : ""}`}
              onClick={() => { setPayg(false); setSelected(o.id); detail({ plan: o.id }); }}
            >
              <span className="checkout-radio" aria-hidden="true" />
              <span className="checkout-plan-main">
                <span className="checkout-plan-name">
                  <span>{planName(o.id, t)}</span>
                  {o.id === "growth" && <span className="plan-badge">{t.plans.recommended}</span>}
                  {o.id === currentPlan && currentPeriod === period && <span className="coming-soon">{c.currentPlan}</span>}
                </span>
                <span className="checkout-plan-sub">{fmt(t.plans.prospectsPerMonth, { count: n(o.prospects) })}</span>
              </span>
              <span className="checkout-plan-price"><span dir="ltr" translate="no">{formatMoney(rate(o), shownCurrency)}</span><small>{t.plans.perMonth}</small></span>
            </button>
          ))}
        </div>

        {payg ? (
          <div className="checkout-included">
            <div className="checkout-included-title">{c.payg.name}</div>
            <ul>
              <li><Check aria-hidden="true" /> <span>{c.sameFeatures}</span></li>
              <li><Check aria-hidden="true" /> <span>{c.payg.unit}</span></li>
              <li><Check aria-hidden="true" /> <span>{c.payg.noExpiry}</span></li>
              <li><Check aria-hidden="true" /> <span>{c.payg.lifetime}</span></li>
              <li><Check aria-hidden="true" /> <span>{fmt(c.payg.perProspect, { cents: formatNumber(centsPerProspect, locale) })}</span></li>
              <li><Check aria-hidden="true" /> <span>{c.payg.noRenewal}</span></li>
              <li><Check aria-hidden="true" /> <span>{c.unlimitedUsers}</span></li>
            </ul>
          </div>
        ) : (
        <div className="checkout-included">
          <div className="checkout-included-title">{fmt(c.includedIn, { plan: name })}</div>
          <ul>
            <li><Check aria-hidden="true" /> <span>{c.sameFeatures}</span></li>
            <li><Check aria-hidden="true" /> <span>{c.teamWorkspace}</span></li>
            <li><Check aria-hidden="true" /> <span>{c.unlimitedUsers}</span></li>
            <li><Check aria-hidden="true" /> <span>{fmt(c.credits, { count: n(plan.prospects) })}</span></li>
            <li><Check aria-hidden="true" /> <span>{c.contactsUnlimited}</span></li>
            <li><Check aria-hidden="true" /> <span>{t.pricing.noCommitment}</span></li>
          </ul>
        </div>
        )}
      </section>

      {payg ? (
        <TopUpSummary topUps={topUps} value={topUp} onChange={setTopUp} canManage={canManage} continueHref={continueHref} email={email} egp={egp} />
      ) : (
      <aside className="checkout-summary">
        <div className="checkout-summary-title">{c.orderSummary}</div>
        <div className="checkout-line">
          <span>
            <span>{name}</span>
            <small>{`${t.plans.billedMonthly}${workspaceName ? ` · ${workspaceName}` : ""}`}</small>
          </span>
          <span dir="ltr" translate="no">{money(price(plan))}</span>
        </div>
        <div className="checkout-line muted"><span>{c.subtotal}</span><span dir="ltr" translate="no">{money(price(plan))}</span></div>
        <div className="checkout-line muted"><span>{c.tax}</span><span>{c.taxNotIncluded}</span></div>
        <div className="checkout-line total"><span>{c.total}</span><span dir="ltr" translate="no">{money(price(plan))}</span></div>
        {egpOf(plan) != null && <div className="checkout-line total"><span>{c.payInEgp}</span><span dir="ltr" translate="no">{formatMoney(egpOf(plan)!, "EGP")}</span></div>}

        <div className="checkout-payment">
          <div className="checkout-payment-title"><CreditCard aria-hidden="true" /> <span>{c.paymentMethod}</span></div>
          {/* One method (D-254): card payment on Paymob's secure page. Never the provider's name (owner, 2026-10-13). */}
          <div className="checkout-method selected" aria-disabled={!online && !testMode}>
            <span className="checkout-method-main">
              <span className="checkout-method-name">{c.methodEgypt}</span>
              <span className="checkout-method-desc">{online || testMode ? c.methodEgyptDesc : c.methodUnavailable}</span>
            </span>
          </div>
          <p className="checkout-payment-note"><span>{c.paymentRedirect}</span></p>
          <p className="checkout-payment-note"><span>{fmt(c.renewsOn, { date: formatDate(renewal, locale) })}</span></p>
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
          <button key="pay" className="btn-primary checkout-submit" type="button" onClick={subscribe} disabled={pending} aria-busy={pending}>
            <Lock aria-hidden="true" /><span>{pending ? c.redirecting : c.pay}</span>
          </button>
        ) : testMode ? (
          <button key="test" className="btn-primary checkout-submit" type="button" onClick={subscribe} disabled={pending} aria-busy={pending}>
            <Lock aria-hidden="true" /><span>{pending ? c.activating : fmt(c.activate, { plan: name })}</span>
          </button>
        ) : (
          <button key="soon" className="btn-primary checkout-submit" type="button" disabled>
            <Lock aria-hidden="true" /><span>{c.subscribeSoon}</span>
          </button>
        )}
        {error && <p className="form-error" role="alert"><span>{error}</span></p>}

        <p className="checkout-fine">{fmt(c.fine, { email, days: "0" })}</p>
      </aside>
      )}
    </main>
  );
}

/**
 * Pay As You Go (D-247): pick an amount, see the prospects it gives, pay.
 * The credit is added only after the payment provider confirms the payment.
 */
function TopUpSummary({ topUps, value, onChange, canManage, continueHref, email, egp }: { topUps: Props["topUps"]; value: string; onChange: (id: string) => void; canManage: boolean; continueHref: string; email: string; egp: boolean }) {
  const { t, locale } = useI18n();
  const c = t.checkout;
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const picked = topUps.find((x) => x.id === value) ?? topUps[0];
  const money = (v: number) => formatMoney(v, "USD", true);
  const n = (v: number) => formatNumber(v, locale);
  const pay = () => start(async () => {
    setError(null);
    const r = await callAction(() => buyProspectPack(picked.id));
    if (isNetworkFailure(r)) return setError(c.errors.network);
    if (!r.ok) return setError(r.error);
    // Test mode (no payment provider): the credit was added right away.
    router.push(continueHref);
  });
  return (
    <aside className="checkout-summary">
      <div className="checkout-summary-title">{c.payg.pick}</div>
      <div className="checkout-topups" role="radiogroup" aria-label={c.payg.pick}>
        {topUps.map((x) => (
          <button key={x.id} type="button" role="radio" aria-checked={x.id === picked.id} className={`checkout-topup${x.id === picked.id ? " selected" : ""}`} onClick={() => onChange(x.id)}>
            <span className="checkout-topup-amount" dir="ltr" translate="no">{money(x.priceUsd)}</span>
            <span className="checkout-topup-prospects">{fmt(c.payg.prospects, { count: n(x.prospects) })}</span>
          </button>
        ))}
      </div>
      <div className="checkout-line muted"><span>{c.tax}</span><span>{c.taxNotIncluded}</span></div>
      <div className="checkout-line total"><span>{c.total}</span><span dir="ltr" translate="no">{money(picked.priceUsd)}</span></div>
      {egp && picked.priceEgp != null && <div className="checkout-line total"><span>{c.payInEgp}</span><span dir="ltr" translate="no">{formatMoney(picked.priceEgp, "EGP")}</span></div>}
      {canManage ? (
        <button key="topup" className="btn-primary checkout-submit" type="button" onClick={pay} disabled={pending} aria-busy={pending}>
          <Lock aria-hidden="true" /><span>{pending ? c.redirecting : fmt(c.payg.pay, { amount: money(picked.priceUsd) })}</span>
        </button>
      ) : <p className="form-error"><span>{c.onlyAdmins}</span></p>}
      {error && <p className="form-error" role="alert"><span>{error}</span></p>}
      <p className="checkout-fine">{fmt(c.payg.fine, { email })}</p>
    </aside>
  );
}
