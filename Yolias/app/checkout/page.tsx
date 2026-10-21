import type { Metadata } from "next";
import { noindex } from "@/lib/seo";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { LanguageMenu } from "@/components/LanguageMenu";
import { billingTestMode } from "@/lib/billing";
import { getDictionary } from "@/lib/i18n/server";
import { hasActivePlan, isPaidPlan, offeredPlans, planPrice, priceFor } from "@/lib/plans";
import { getPlanCatalog, workspaceCurrency } from "@/lib/plan-catalog";
import { canManageTeam, pendingPlan, requireUser } from "@/lib/session";
import { CheckoutForm } from "./CheckoutForm";
import { paymentMethods, paysInEgp } from "@/lib/payments";
import { requestCountry } from "@/lib/geo-server";
import { switches } from "@/lib/switches";
import { creditRate, topUps } from "@/lib/credits";
import { toEgp, usdToEgp } from "@/lib/payments/fx";
import { openCheckout } from "@/lib/funnel";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).checkout.eyebrow} | Yolias`, robots: noindex };
}

// Step 2 of the journey (after signup): choose and activate a plan.
export default async function CheckoutPage({ searchParams }: PageProps<"/checkout">) {
  const session = await requireUser();
  const plans = await getPlanCatalog();
  const t = await getDictionary();
  const { plan, error } = await searchParams;
  const ws = session.workspace;
  const active = hasActivePlan(ws);
  const currency = await workspaceCurrency(ws);
  const current = active && isPaidPlan(ws.plan) ? ws.plan : null;
  const pending = await pendingPlan(session);
  const picked = isPaidPlan(plan) ? plan : isPaidPlan(pending) ? pending : null;
  const initial = picked ?? current ?? "pro";
  const methods = await paymentMethods();
  // Monthly only for new subscriptions (D-247); a running annual one keeps going.
  const initialPeriod = "monthly" as const;
  // Paymob only (D-254), hidden when switched off in Admin (D-213).
  const on = await switches();
  const online = on.payments_paymob && methods.paymob;
  // Top-ups in USD; in Egypt the EGP charge at today's rate is shown under the total.
  const egpBuyer = paysInEgp(ws, await requestCountry());
  const fx = egpBuyer ? await usdToEgp() : null;
  const packs = on.buy_more ? (await topUps()).map((p) => ({ ...p, priceEgp: fx ? toEgp(p.priceUsd, fx) : null })) : [];
  const errors = t.checkout.errors;
  // Journey tracking (D-212): one checkout session per visit (reloads continue it).
  const checkoutId = canManageTeam(session) && !(current && current === initial)
    ? await openCheckout(ws, session.userId, { plan: initial, period: initialPeriod, amountUsd: (() => { const m = planPrice(plans[initial], currency); return m == null ? null : priceFor(m, initialPeriod); })(), trialOffered: false })
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
        canManage={canManageTeam(session)}
        testMode={billingTestMode()}
        online={online}
        email={session.email}
        workspaceName={ws.name ?? ""}
        continueHref={session.profile.onboarded_at ? "/" : "/onboarding"}
        options={offeredPlans.map((p) => ({ id: p, price: planPrice(plans[p], currency) ?? 0, priceEgp: plans[p].priceEgp, prospects: plans[p].prospects }))}
        currency={currency}
        initialError={initialError}
        checkoutId={checkoutId}
        egp={egpBuyer}
        topUps={packs}
        centsPerProspect={Math.round((await creditRate()) * 10000) / 100}
        initialPayg={plan === "payg" || (!isPaidPlan(plan) && pending === "payg")}
      />
    </div>
  );
}

