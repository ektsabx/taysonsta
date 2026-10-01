import type { Metadata } from "next";
import Link from "next/link";
import { formatNumber } from "@/lib/format";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { isBillingPeriod, isPaidPlan, planName, plans, priceFor } from "@/lib/plans";
import { MagicLinkForm } from "../MagicLinkForm";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).auth.signupSubmit} — Yolias` };
}

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  const { plan, period: rawPeriod } = await searchParams;
  const picked = isPaidPlan(plan) ? plan : undefined;
  const period = isBillingPeriod(rawPeriod) ? rawPeriod : "monthly";

  return (
    <>
      <h1>{t.auth.signupTitle}</h1>
      <p className="auth-lead">{t.auth.signupLead}</p>
      {picked && (
        <div className="selected-plan">
          <div>
            <span className="selected-plan-label">{t.auth.selectedPlan}</span>
            <strong>{planName(picked, t)}</strong> · <span dir="ltr">${formatNumber(priceFor(plans[picked].priceUsd, period), locale)}</span>{period === "annual" ? t.plans.perYear : t.plans.perMonth}
          </div>
          <Link href="/pricing">{t.auth.change}</Link>
        </div>
      )}
      <MagicLinkForm mode="signup" plan={picked} period={picked ? period : undefined} />
    </>
  );
}
