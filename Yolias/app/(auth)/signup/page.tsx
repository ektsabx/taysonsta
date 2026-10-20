import type { Metadata } from "next";
import Link from "next/link";
import { formatMoney } from "@/lib/format";
import { requestCountry } from "@/lib/geo-server";
import { fmt } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";
import { isPaidPlan, planName, planPrice } from "@/lib/plans";
import { currencyFor, getPlanCatalog } from "@/lib/plan-catalog";
import { SignupForms } from "../SignupForms";
import { googleSignInEnabled } from "@/lib/auth/providers";
import { captchaConfig } from "@/lib/auth/captcha";
import { topUps } from "@/lib/credits";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).auth.signupSubmit} | Yolias` };
}

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const [t, plans, currency] = await Promise.all([getDictionary(), getPlanCatalog(), requestCountry().then(currencyFor)]);
  const { plan } = await searchParams;
  const picked = isPaidPlan(plan) ? plan : undefined;
  // Pay As You Go (D-247): signup continues to the top-up step of checkout.
  const payg = plan === "payg";
  const minTopUp = payg ? (await topUps())[0] : undefined;

  return (
    <>
      <h1>{t.auth.signupTitle}</h1>
      <p className="auth-lead">{t.auth.signupLead}</p>
      {picked && (
        <div className="selected-plan">
          <div>
            <span className="selected-plan-label">{t.auth.selectedPlan}</span>
            <strong>{planName(picked, t)}</strong> · <span dir="ltr">{formatMoney(planPrice(plans[picked], currency) ?? 0, currency)}</span>{t.plans.perMonth}
          </div>
          <Link href="/pricing">{t.auth.change}</Link>
        </div>
      )}
      {payg && minTopUp && (
        <div className="selected-plan">
          <div>
            <span className="selected-plan-label">{t.auth.selectedPlan}</span>
            <strong>{t.pricing.payg.name}</strong> · {fmt(t.pricing.payg.from, { amount: formatMoney(minTopUp.priceUsd, "USD") })}
          </div>
          <Link href="/pricing">{t.auth.change}</Link>
        </div>
      )}
      <SignupForms google={await googleSignInEnabled()} plan={picked ?? (payg ? "payg" : undefined)} period={picked ? "monthly" : undefined} captchaSiteKey={(await captchaConfig())?.siteKey ?? null} />
      {/* What signing up leads to (owner brief 2026-10-20): no surprises between this form and the first search. */}
      <section className="signup-next" aria-labelledby="signup-next-title">
        <h2 id="signup-next-title">{t.auth.signupNextTitle}</h2>
        <ol>{t.auth.signupNext.map((step) => <li key={step}>{step}</li>)}</ol>
      </section>
    </>
  );
}
