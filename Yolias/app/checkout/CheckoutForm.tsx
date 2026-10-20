"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, CreditCard, Lock } from "lucide-react";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { fmt } from "@/lib/i18n/config";
import { useI18n } from "@/lib/i18n/client";
import { monthlyRate, monthlyRateEgp, planName, priceFor, priceForEgp } from "@/lib/plans";
import type { BillingPeriod, BillingProvider, Currency, PaidPlan, Plan } from "@/types/database";
import { metaTrack, track } from "@/lib/analytics/client";
import { callAction, isNetworkFailure } from "@/lib/action-client";
import { activatePlan, buyProspectPack, checkoutDetails, checkoutReturned, checkoutState, startKashierCheckout, startPolarCheckout } from "./actions";
import { KashierFrame } from "@/components/app/KashierFrame";

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
  /** Which payment methods are connected (lib/payments). */
  methods: Record<BillingProvider, boolean>;
  email: string;
  workspaceName: string;
  continueHref: string;
  options: Option[];
  currency: Currency;
  /** The provider of a running subscription; the customer can't switch it here. */
  locked: BillingProvider | null;
  /** The free trial this workspace can still start with the card method (null: none). */
  trial: { days: number; prospects: number; emails: number; contacts: number } | null;
  /** Error carried back from /checkout/polar. */
  initialError: string | null;
  /** Payment methods shown (the others are switched off in Admin, D-213). */
  shown: BillingProvider[];
  /** This visit's checkout session (journey tracking, D-212). */
  checkoutId: string | null;
  /** The buyer is in Egypt: Paymob shows and charges the EGP prices (D-237). */
  egp: boolean;
  /** Pay As You Go top-up amounts and the prospects each one gives (D-247). */
  topUps: { id: string; priceUsd: number; prospects: number }[];
  /** Open on Pay As You Go (/checkout?plan=payg). */
  initialPayg: boolean;
}

export function CheckoutForm({ initialPlan, currentPlan, currentPeriod, canManage, testMode, methods, email, workspaceName, continueHref, options, currency, locked, trial: trialOffer, initialError, shown, checkoutId, egp, topUps, initialPayg }: Props) {
  const { t, locale } = useI18n();
  const c = t.checkout;
  const [selected, setSelected] = useState<PaidPlan>(initialPlan);
  // Monthly only (D-247): no annual billing for new subscriptions.
  const period: BillingPeriod = "monthly";
  const initialPeriod: BillingPeriod = "monthly";
  const [payg, setPayg] = useState(initialPayg && topUps.length > 0);
  const [topUp, setTopUp] = useState(topUps[0]?.id ?? "");
  const [error, setError] = useState<string | null>(initialError);
  // The customer picks how to pay (D-209) — never chosen by country or IP.
  const [route, setRoute] = useState<BillingProvider>(locked ?? (shown.find((m) => methods[m]) ?? shown[0] ?? "polar"));
  const online = methods[route] && shown.includes(route);
  const trial = route === "polar" ? trialOffer : null;
  const [pending, start] = useTransition();
  const router = useRouter();
  // Polar's checkout embedded in this page: "opening" → Polar's window → "activating" until the webhook starts the plan.
  const [embed, setEmbed] = useState<"idle" | "opening" | "activating" | "slow">("idle");
  // Kashier (card payment, D-235): its payment form opens here, in place of the summary.
  const [kashier, setKashier] = useState<{ url: string; paymentId: string } | null>(null);
  const plan = options.find((o) => o.id === selected) ?? options[0];
  const name = planName(selected, t);
  const isCurrent = currentPlan === selected && currentPeriod === period;
  const n = (v: number) => formatNumber(v, locale);
  // Egypt pays Paymob in EGP at the plan's EGP price (D-237); every other route is USD.
  const inEgp = egp && route === "paymob";
  const price = (o: Option) => (inEgp && o.priceEgp ? priceForEgp(o.priceEgp, period) : priceFor(o.price, period));
  // Plan rows show the price per month (annual: the discounted rate); the summary shows the charge.
  const rate = (o: Option) => (inEgp && o.priceEgp ? monthlyRateEgp(o.priceEgp, period) : monthlyRate(o.price, period));
  const shownCurrency = inEgp ? "EGP" : currency;
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

  // Polar (card): the checkout opens inside Yolias (Polar's iframe, card
  // details stay with Polar). After Polar's success message the plan starts
  // when Polar's webhook arrives; the page waits for it, then continues.
  const subscribeEmbedded = () => {
    if (pending || embed !== "idle") return;
    setError(null);
    setEmbed("opening");
    start(async () => {
      const r = await callAction(() => startPolarCheckout(selected, period, checkoutId));
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
        checkout.addEventListener("close", () => { void checkoutReturned(checkoutId, "closed").catch(() => {}); });
        checkout.addEventListener("success", (e) => {
          e.preventDefault(); // stay in Yolias instead of Polar's success page
          // Polar's page said "success": recorded as a claim; the plan starts only from Polar's webhook.
          void checkoutReturned(checkoutId, "succeeded").catch(() => {});
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

  const subscribeKashier = () => {
    if (pending) return;
    setError(null);
    start(async () => {
      const r = await callAction(() => startKashierCheckout(selected, period, checkoutId));
      if (isNetworkFailure(r)) return setError(c.errors.network);
      if (!r.ok) return setError(r.error);
      setKashier({ url: r.url, paymentId: r.paymentId });
    });
  };

  const subscribe = () => {
    if (route === "polar" && online) return subscribeEmbedded();
    if (route === "kashier" && online) return subscribeKashier();
    if (pending) return;
    start(async () => {
      setError(null);
      const r = await callAction(() => activatePlan(selected, period, route, checkoutId));
      if (isNetworkFailure(r)) setError(c.errors.network);
      else if (r && !r.ok) setError(r.error);
    });
  };

  // First charge (after the trial) or next renewal, from today.
  const renewal = (() => {
    const d = new Date();
    if (trial) d.setDate(d.getDate() + trial.days);
    else d.setMonth(d.getMonth() + 1);
    return d;
  })();

  return (
    <main className="checkout-grid">
      <section>
        <p className="checkout-eyebrow">{payg ? c.payg.eyebrow : c.eyebrow}</p>
        <h1 className="checkout-title">{payg ? c.payg.title : trial ? fmt(c.startTrial, { days: n(trial.days) }) : fmt(c.title, { plan: name })}</h1>
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
        <TopUpSummary topUps={topUps} value={topUp} onChange={setTopUp} canManage={canManage} continueHref={continueHref} email={email} />
      ) : kashier ? (
        <aside className="checkout-summary checkout-kashier">
          <div className="checkout-line"><span><span>{name}</span><small>{t.plans.billedMonthly}</small></span><span dir="ltr" translate="no">{money(price(plan))}</span></div>
          <KashierFrame url={kashier.url} paymentId={kashier.paymentId} onCancel={() => setKashier(null)} />
          <p className="checkout-fine">{c.savedCardNote}</p>
        </aside>
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
        {trial ? (
          <div className="checkout-line muted"><span>{fmt(c.afterTrial, { days: n(trial.days) })}</span><span dir="ltr" translate="no">{money(price(plan))}</span></div>
        ) : (
          <div className="checkout-line muted"><span>{c.subtotal}</span><span dir="ltr" translate="no">{money(price(plan))}</span></div>
        )}
        <div className="checkout-line muted"><span>{c.tax}</span><span>{c.taxNotIncluded}</span></div>
        <div className="checkout-line total"><span>{trial ? c.dueToday : c.total}</span><span dir="ltr" translate="no">{money(trial ? 0 : price(plan))}</span></div>

        <div className="checkout-payment">
          <div className="checkout-payment-title"><CreditCard aria-hidden="true" /> <span>{c.paymentMethod}</span></div>
          {/* The customer chooses: card payment → Paymob, card on this page → Kashier (D-236), card with trial → Polar. Never the provider's name or internal mode (owner, 2026-10-13). */}
          <div className="checkout-methods" role="radiogroup" aria-label={c.paymentMethod}>
            {shown.map((m) => {
              const off = (locked !== null && locked !== m) || (!methods[m] && !testMode);
              return (
                <button key={m} type="button" role="radio" aria-checked={route === m} disabled={off} className={`checkout-method${route === m ? " selected" : ""}`} onClick={() => { setRoute(m); setError(null); detail({ method: m }); }}>
                  <span className="checkout-radio" aria-hidden="true" />
                  <span className="checkout-method-main">
                    <span className="checkout-method-name">{m === "polar" ? c.methodCard : m === "kashier" ? c.methodKashier : c.methodEgypt}</span>
                    <span className="checkout-method-desc">{off && !methods[m] ? c.methodUnavailable : m === "polar" ? c.methodCardDesc : m === "kashier" ? c.methodKashierDesc : c.methodEgyptDesc}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <p className="checkout-payment-note"><span>{route === "kashier" ? c.paymentHere : c.paymentRedirect}</span></p>
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

        <p className="checkout-fine">{fmt(trial ? c.fineTrial : c.fine, { email, days: n(trial?.days ?? 0) })}</p>
      </aside>
      )}
    </main>
  );
}

/**
 * Pay As You Go (D-247): pick an amount, see the prospects it gives, pay.
 * The credit is added only after the payment provider confirms the payment.
 */
function TopUpSummary({ topUps, value, onChange, canManage, continueHref, email }: { topUps: Props["topUps"]; value: string; onChange: (id: string) => void; canManage: boolean; continueHref: string; email: string }) {
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
      <p className="checkout-topup-result" role="status">{fmt(c.payg.youGet, { amount: money(picked.priceUsd), count: n(picked.prospects) })}</p>
      <div className="checkout-line muted"><span>{c.tax}</span><span>{c.taxNotIncluded}</span></div>
      <div className="checkout-line total"><span>{c.total}</span><span dir="ltr" translate="no">{money(picked.priceUsd)}</span></div>
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
