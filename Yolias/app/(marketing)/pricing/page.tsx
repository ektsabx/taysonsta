import type { Metadata } from "next";
import { getDictionary } from "@/lib/i18n/server";
import { currencyFor, getPlanCatalog, workspaceCurrency } from "@/lib/plan-catalog";
import { getSession } from "@/lib/session";
import { offeredPlans } from "@/lib/plans";
import { PricingView } from "./PricingView";
import { requestCountry } from "@/lib/geo-server";
import { paysInEgp, trialAvailable } from "@/lib/payments";
import { pricingFaq } from "@/lib/pricing-copy";
import { JsonLd } from "@/components/marketing/JsonLd";
import { breadcrumbSchema, faqSchema, pageMetadata, softwareSchema } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return pageMetadata({ title: t.pricing.title, absoluteTitle: true, description: `${t.pricing.heroTitle} ${t.pricing.heroSupport}`, path: "/pricing" });
}

// Public pricing page. Picking a plan → signup (new visitors) or checkout
// (signed-in users). Journey: signup → magic link → checkout → onboarding → Yolias.
export default async function PricingPage() {
  const session = await getSession();
  const [plans, currency, t, trialDays] = await Promise.all([getPlanCatalog(), session ? workspaceCurrency(session.workspace) : currencyFor(), getDictionary(), trialAvailable()]);
  // Structured data repeats what the page shows: the monthly plan prices and the FAQ.
  const offers = offeredPlans.filter((k) => plans[k]).map((k) => ({ name: t.plans[k], price: plans[k].priceUsd, period: "month" as const }));
  return (
    <>
      <JsonLd nodes={[softwareSchema(offers), faqSchema(pricingFaq(t.pricing, trialDays).map(([q, a]) => ({ q, a }))), breadcrumbSchema([{ name: "Yolias", path: "/" }, { name: t.site.pricing, path: "/pricing" }])]} />
      <PricingView signedIn={Boolean(session)} plans={plans} currency={currency} trialDays={trialDays} egp={paysInEgp(session?.workspace ?? { billing_country: null }, await requestCountry())} />
    </>
  );
}
