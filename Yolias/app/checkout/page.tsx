import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { billingTestMode } from "@/lib/billing";
import { isPaidPlan, paidPlans, plans } from "@/lib/plans";
import { canManageTeam, requireSession } from "@/lib/session";
import { CheckoutForm } from "./CheckoutForm";

export const metadata: Metadata = { title: "Checkout — Yolias" };

export default async function CheckoutPage({ searchParams }: PageProps<"/checkout">) {
  const session = await requireSession();
  const { plan } = await searchParams;
  const current = session.workspace.plan;
  const initial = isPaidPlan(plan) ? plan : current !== "free" ? current : "growth";

  return (
    <div className="checkout-page">
      <header className="checkout-top">
        <Link href="/" aria-label="Yolias home"><BrandLogo /></Link>
        <Link href="/pricing" className="checkout-back"><ArrowLeft /> Back to pricing</Link>
      </header>
      <CheckoutForm
        initialPlan={initial}
        currentPlan={current}
        canManage={canManageTeam(session)}
        testMode={billingTestMode()}
        email={session.email}
        workspaceName={session.workspace.name ?? ""}
        options={paidPlans.map((p) => ({ id: p, ...plans[p] }))}
      />
    </div>
  );
}
