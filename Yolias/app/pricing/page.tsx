import type { Metadata } from "next";
import { Noto_Kufi_Arabic } from "next/font/google";
import { getSession } from "@/lib/session";
import { PricingView } from "./PricingView";
import "./pricing.css";

const kufi = Noto_Kufi_Arabic({ subsets: ["arabic"], weight: ["400", "500", "600", "700"], variable: "--font-kufi", display: "swap" });

export const metadata: Metadata = { title: "Yolias — Simple pricing. Powerful AI." };

// Public pricing page. Picking a plan → signup (new visitors) or checkout
// (signed-in users); the plan is carried through signup and onboarding.
export default async function PricingPage() {
  const session = await getSession();
  const signedIn = Boolean(session?.profile.onboarded_at);
  const href = (plan: "pro" | "growth" | "scale") => (signedIn ? `/checkout?plan=${plan}` : `/signup?plan=${plan}`);

  return (
    <div className={kufi.variable}>
      <PricingView signedIn={signedIn} planHref={{ pro: href("pro"), growth: href("growth"), scale: href("scale") }} />
    </div>
  );
}
