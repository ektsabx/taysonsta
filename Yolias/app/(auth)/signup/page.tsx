import type { Metadata } from "next";
import Link from "next/link";
import { formatMoney } from "@/lib/format";
import { requestCountry } from "@/lib/geo-server";
import { getDictionary } from "@/lib/i18n/server";
import { isBillingPeriod, isPlan, planName, planPrice, priceFor } from "@/lib/plans";
import { currencyFor, getPlanCatalog } from "@/lib/plan-catalog";
import { MagicLinkForm } from "../MagicLinkForm";
import { GoogleButton } from "../GoogleButton";
import { googleSignInEnabled } from "@/lib/auth/providers";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).auth.signupSubmit} — Yolias` };
}

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const [t, plans, currency] = await Promise.all([getDictionary(), getPlanCatalog(), requestCountry().then(currencyFor)]);
  const { plan, period: rawPeriod } = await searchParams;
  const picked = isPlan(plan) ? plan : undefined;
  const period = isBillingPeriod(rawPeriod) ? rawPeriod : "monthly";

  return (
    <>
      <h1>{t.auth.signupTitle}</h1>
      <p className="auth-lead">{t.auth.signupLead}</p>
      {picked && (
        <div className="selected-plan">
          <div>
            <span className="selected-plan-label">{t.auth.selectedPlan}</span>
            <strong>{planName(picked, t)}</strong> · <span dir="ltr">{formatMoney(priceFor(planPrice(plans[picked], currency) ?? 0, period), currency)}</span>{picked !== "free" && period === "annual" ? t.plans.perYear : t.plans.perMonth}
          </div>
          <Link href="/pricing">{t.auth.change}</Link>
        </div>
      )}
      {(await googleSignInEnabled()) && <GoogleButton label={t.auth.google} or={t.auth.orEmail} plan={picked} period={picked ? period : undefined} />}
      <MagicLinkForm mode="signup" plan={picked} period={picked ? period : undefined} />
    </>
  );
}
