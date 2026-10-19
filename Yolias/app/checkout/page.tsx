import type { Metadata } from "next";
import { noindex } from "@/lib/seo";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { LanguageMenu } from "@/components/LanguageMenu";
import { billingTestMode } from "@/lib/billing";
import { getDictionary } from "@/lib/i18n/server";
import { hasActivePlan, isBillingPeriod, isPaidPlan, offeredPlans, planPrice, priceFor } from "@/lib/plans";
import { getPlanCatalog, workspaceCurrency } from "@/lib/plan-catalog";
import { canManageTeam, pendingPeriod, pendingPlan, requireUser } from "@/lib/session";
import { CheckoutForm } from "./CheckoutForm";
import { lockedProvider, paymentMethods, paysInEgp } from "@/lib/payments";
import { requestCountry } from "@/lib/geo-server";
import { trialLimits, trialOpen } from "@/lib/trial";
import { switches } from "@/lib/switches";
import { openCheckout } from "@/lib/funnel";
import type { BillingProvider } from "@/types/database";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).checkout.eyebrow} | Yolias`, robots: noindex };
}

// Step 2 of the journey (after signup): choose and activate a plan.
export default async function CheckoutPage({ searchParams }: PageProps<"/checkout">) {
  const session = await requireUser();
  const plans = await getPlanCatalog();
  const t = await getDictionary();
  const { plan, period, error } = await searchParams;
  const ws = session.workspace;
  const active = hasActivePlan(ws);
  const currency = await workspaceCurrency(ws);
  const current = active && isPaidPlan(ws.plan) ? ws.plan : null;
  const pending = await pendingPlan(session);
  const picked = isPaidPlan(plan) ? plan : isPaidPlan(pending) ? pending : null;
  const initial = picked ?? current ?? "growth";
  const [methods, trial] = await Promise.all([paymentMethods(), trialLimits()]);
  const locked = lockedProvider(ws);
  // Annual is the default choice (owner brief 2026-10-12); monthly stays available.
  const initialPeriod = isBillingPeriod(period) ? period : (await pendingPeriod()) ?? (current ? ws.billing_period : "annual");
  // Methods switched off in Admin are hidden (a running subscription keeps its
  // own, D-213). Kashier shows once its account is connected (D-236).
  const on = await switches();
  const switchOf = { polar: "payments_polar", paymob: "payments_paymob", kashier: "payments_kashier" } as const;
  const shown = (["paymob", "kashier", "polar"] as BillingProvider[]).filter((m) => locked === m || (!locked && on[switchOf[m]] && (m !== "kashier" || methods.kashier)));
  // The free trial comes with the Polar method only; the card gateways pay up front.
  const trialOffer = (!locked || locked === "polar") && shown.includes("polar") && (await trialOpen(ws)) && !(ws.subscription_status === "active" || ws.subscription_status === "test") ? trial : null;
  const errors = t.checkout.errors;
  // Journey tracking (D-212): one checkout session per visit (reloads continue it).
  const checkoutId = canManageTeam(session) && !(current && current === initial)
    ? await openCheckout(ws, session.userId, { plan: initial, period: initialPeriod, amountUsd: (() => { const m = planPrice(plans[initial], currency); return m == null ? null : priceFor(m, initialPeriod); })(), trialOffered: Boolean(trialOffer) })
    : null;
  const initialError = error === "admins" ? errors.admins : error === "not_connected" ? errors.notConnected : error === "plan" ? errors.choosePlan : error === "payment" ? errors.paymentFailed : null;

  return (
    <div className="checkout-page">
      <header className="checkout-top">
        <Link href="/" aria-label="Yolias"><BrandLogo /></Link>
        <div className="checkout-top-actions">
          <LanguageMenu />
          <Link href="/pricing" className="checkout-back"><ArrowLeft className="flip-rtl" /> {t.checkout.back}</Link>
        </div>
      </header>
      <CheckoutForm
        initialPlan={initial}
        currentPlan={current}
        currentPeriod={current ? ws.billing_period : null}
        initialPeriod={initialPeriod}
        canManage={canManageTeam(session)}
        testMode={billingTestMode()}
        methods={methods}
        email={session.email}
        workspaceName={ws.name ?? ""}
        continueHref={session.profile.onboarded_at ? "/" : "/onboarding"}
        options={offeredPlans.map((p) => ({ id: p, price: planPrice(plans[p], currency) ?? 0, priceEgp: plans[p].priceEgp, prospects: plans[p].prospects, emails: plans[p].emails, contacts: plans[p].contacts }))}
        currency={currency}
        locked={locked}
        trial={trialOffer}
        initialError={initialError}
        shown={shown}
        checkoutId={checkoutId}
        egp={paysInEgp(ws, await requestCountry())}
      />
    </div>
  );
}

