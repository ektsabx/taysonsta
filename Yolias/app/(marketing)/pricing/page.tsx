import type { Metadata } from "next";
import { getDictionary } from "@/lib/i18n/server";
import { currencyFor, getPlanCatalog, workspaceCurrency } from "@/lib/plan-catalog";
import { requestCountry } from "@/lib/geo-server";
import { getSession } from "@/lib/session";
import { PricingView } from "./PricingView";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: t.pricing.title, description: `${t.pricing.heroSupport} ${t.pricing.noCommitment}.` };
}

// Public pricing page. Picking a plan → signup (new visitors) or checkout
// (signed-in users). Journey: signup → magic link → checkout → onboarding → Yolias.
export default async function PricingPage() {
  const session = await getSession();
  // A workspace already on a plan keeps its billing currency; visitors get their country's.
  const [plans, currency] = await Promise.all([getPlanCatalog(), session ? workspaceCurrency(session.workspace) : currencyFor(await requestCountry())]);
  return <PricingView signedIn={Boolean(session)} plans={plans} currency={currency} />;
}
