import type { Metadata } from "next";
import Link from "next/link";
import { formatNumber } from "@/lib/format";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { isPaidPlan, planName, plans } from "@/lib/plans";
import { MagicLinkForm } from "../MagicLinkForm";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).auth.signupSubmit} — Yolias` };
}

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  const { plan } = await searchParams;
  const picked = isPaidPlan(plan) ? plan : undefined;

  return (
    <>
      <h1>{t.auth.signupTitle}</h1>
      <p className="auth-lead">{t.auth.signupLead}</p>
      {picked && (
        <div className="selected-plan">
          <div>
            <span className="selected-plan-label">{t.auth.selectedPlan}</span>
            <strong>{planName(picked, t)}</strong> · ${formatNumber(plans[picked].priceUsd, locale)}{t.checkout.perMonth}
          </div>
          <Link href="/pricing">{t.auth.change}</Link>
        </div>
      )}
      <MagicLinkForm mode="signup" plan={picked} />
    </>
  );
}
