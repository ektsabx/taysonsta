import type { Metadata } from "next";
import { getDictionary } from "@/lib/i18n/server";
import { plans } from "@/lib/plans";
import { getSession } from "@/lib/session";
import { PricingView } from "./PricingView";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).pricing.title };
}

// Public pricing page. Picking a plan → signup (new visitors) or checkout
// (signed-in users). Journey: signup → magic link → checkout → onboarding → Yolias.
export default async function PricingPage() {
  const session = await getSession();
  const usage = (p: "pro" | "growth" | "scale") => ({ credits: plans[p].prospectCredits, lookups: plans[p].companyLookups, price: plans[p].priceUsd });
  return <PricingView signedIn={Boolean(session)} usage={{ pro: usage("pro"), growth: usage("growth"), scale: usage("scale") }} />;
}
