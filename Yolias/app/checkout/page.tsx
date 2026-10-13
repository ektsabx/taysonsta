import type { Metadata } from "next";
import { noindex } from "@/lib/seo";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { LanguageMenu } from "@/components/LanguageMenu";
import { billingTestMode } from "@/lib/billing";
import { getDictionary } from "@/lib/i18n/server";
import { hasActivePlan, isBillingPeriod, isPaidPlan, offeredPlans, planPrice } from "@/lib/plans";
import { getPlanCatalog, workspaceCurrency } from "@/lib/plan-catalog";
import { canManageTeam, pendingPeriod, pendingPlan, requireUser } from "@/lib/session";
import { CheckoutForm } from "./CheckoutForm";
import { lockedProvider, paymentMethods } from "@/lib/payments";
import { canStartTrial, trialLimits } from "@/lib/trial";

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
  // The free trial comes with the card (Polar) method only; Egypt pays up front.
  const trialOffer = locked !== "paymob" && canStartTrial(ws) && !(ws.subscription_status === "active" || ws.subscription_status === "test") ? trial : null;
  const errors = t.checkout.errors;
  const initialError = error === "admins" ? errors.admins : error === "not_connected" ? errors.notConnected : error === "plan" ? errors.choosePlan : error === "payment" ? errors.paymentFailed : null;

  return (
    <div className="checkout-page">
      <header className="checkout-top">
        <Link href={active ? "/" : "/pricing"} aria-label="Yolias"><BrandLogo /></Link>
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
        options={offeredPlans.map((p) => ({ id: p, price: planPrice(plans[p], currency) ?? 0, prospects: plans[p].prospects, emails: plans[p].emails, contacts: plans[p].contacts }))}
        currency={currency}
        locked={locked}
        trial={trialOffer}
        initialError={initialError}
      />
    </div>
  );
}

