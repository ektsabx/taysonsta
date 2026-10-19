import type { Metadata } from "next";
import Link from "next/link";
import { formatMoney } from "@/lib/format";
import { requestCountry } from "@/lib/geo-server";
import { fmt } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";
import { isBillingPeriod, isPaidPlan, monthlyRate, planName, planPrice, priceFor } from "@/lib/plans";
import { currencyFor, getPlanCatalog } from "@/lib/plan-catalog";
import { SignupForms } from "../SignupForms";
import { googleSignInEnabled } from "@/lib/auth/providers";
import { captchaConfig } from "@/lib/auth/captcha";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).auth.signupSubmit} — Yolias` };
}

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const [t, plans, currency] = await Promise.all([getDictionary(), getPlanCatalog(), requestCountry().then(currencyFor)]);
  const { plan, period: rawPeriod } = await searchParams;
  const picked = isPaidPlan(plan) ? plan : undefined;
  const period = isBillingPeriod(rawPeriod) ? rawPeriod : "annual";

  return (
    <>
      <h1>{t.auth.signupTitle}</h1>
      <p className="auth-lead">{t.auth.signupLead}</p>
      {picked && (
        <div className="selected-plan">
          <div>
            <span className="selected-plan-label">{t.auth.selectedPlan}</span>
            <strong>{planName(picked, t)}</strong> · <span dir="ltr">{formatMoney(monthlyRate(planPrice(plans[picked], currency) ?? 0, period), currency)}</span>{t.plans.perMonth}
            {period === "annual" && <> · {fmt(t.plans.billedYearlyAt, { amount: formatMoney(priceFor(planPrice(plans[picked], currency) ?? 0, period), currency) })}</>}
          </div>
          <Link href="/pricing">{t.auth.change}</Link>
        </div>
      )}
      <SignupForms google={await googleSignInEnabled()} plan={picked} period={picked ? period : undefined} captchaSiteKey={(await captchaConfig())?.siteKey ?? null} />
    </>
  );
}
