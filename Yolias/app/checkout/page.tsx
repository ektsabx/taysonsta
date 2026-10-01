import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { LanguageMenu } from "@/components/LanguageMenu";
import { billingTestMode } from "@/lib/billing";
import { getDictionary } from "@/lib/i18n/server";
import { allPlans, hasActivePlan, isBillingPeriod, isPlan } from "@/lib/plans";
import { getPlanCatalog } from "@/lib/plan-catalog";
import { canManageTeam, pendingPeriod, pendingPlan, requireUser } from "@/lib/session";
import { CheckoutForm } from "./CheckoutForm";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).checkout.eyebrow} — Yolias` };
}

// Step 2 of the journey (after signup): choose and activate a plan.
export default async function CheckoutPage({ searchParams }: PageProps<"/checkout">) {
  const session = await requireUser();
  const plans = await getPlanCatalog();
  const t = await getDictionary();
  const { plan, period } = await searchParams;
  const active = hasActivePlan(session.workspace);
  const current = active ? session.workspace.plan : null;
  const picked = isPlan(plan) ? plan : await pendingPlan(session);
  const initial = picked ?? current ?? "growth";
  const initialPeriod = isBillingPeriod(period) ? period : (await pendingPeriod()) ?? (active ? session.workspace.billing_period : "monthly");

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
        currentPeriod={active ? session.workspace.billing_period : null}
        initialPeriod={initialPeriod}
        canManage={canManageTeam(session)}
        testMode={billingTestMode()}
        email={session.email}
        workspaceName={session.workspace.name ?? ""}
        continueHref={session.profile.onboarded_at ? "/" : "/onboarding"}
        options={allPlans.map((p) => ({ id: p, ...plans[p] }))}
      />
    </div>
  );
}
