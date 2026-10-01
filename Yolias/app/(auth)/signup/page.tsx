import type { Metadata } from "next";
import Link from "next/link";
import { isPaidPlan, plans } from "@/lib/plans";
import { MagicLinkForm } from "../MagicLinkForm";

export const metadata: Metadata = { title: "Create account — Yolias" };

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const { plan } = await searchParams;
  const picked = isPaidPlan(plan) ? plan : undefined;

  return (
    <>
      <h1>Tell Yolias who you want to sell to.</h1>
      <p className="auth-lead">Create your account with your work email. We&apos;ll send you a magic link — no password needed.</p>
      {picked && (
        <div className="selected-plan">
          <div>
            <span className="selected-plan-label">Selected plan</span>
            <strong>{plans[picked].name}</strong> · ${plans[picked].priceUsd}/month
          </div>
          <Link href="/pricing">Change</Link>
        </div>
      )}
      <MagicLinkForm mode="signup" plan={picked} />
    </>
  );
}
