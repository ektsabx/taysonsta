import Link from "next/link";
import type { Metadata } from "next";
import { noindex } from "@/lib/seo";
import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/BrandLogo";
import { LanguageMenu } from "@/components/LanguageMenu";
import { ThemeMenu } from "@/components/ThemeMenu";
import { fmt } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";
import { canUseApp } from "@/lib/plans";
import { requireUser } from "@/lib/session";
import { OnboardingForm } from "./OnboardingForm";
import { createAdminClient } from "@/lib/supabase/admin";
import { ONBOARDING_KEY, parseSteps } from "@/lib/onboarding/steps";
import { getLocale } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).onboarding.title}`, robots: noindex };
}

export default async function OnboardingPage() {
  const session = await requireUser();
  // Onboarding comes before the plan (owner, 2026-10-29).
  if (session.profile.onboarded_at) redirect(canUseApp(session.workspace) ? "/" : "/checkout");
  const [t, locale, { data: config }] = await Promise.all([getDictionary(), getLocale(), createAdminClient().from("site_settings").select("value").eq("key", ONBOARDING_KEY).maybeSingle()]);
  // The pages and their wording come from Yolias Admin → Onboarding (D-276).
  const steps = parseSteps(config?.value);
  const own = (l: { ar: string; en: string }) => (locale === "ar" ? l.ar || l.en : l.en || l.ar);
  const company = steps[0];

  const isOwner = session.role === "owner";
  const { workspace, profile } = session;

  return (
    <div className="auth-page">
      <div className="auth-brand"><Link href="/" aria-label="Yolias"><BrandLogo /></Link><span className="auth-brand-tools"><ThemeMenu /><LanguageMenu /></span></div>
      <main className="auth-card wide">
        <h1>{own(company.title) || t.onboarding.title}</h1>
        <p className="auth-lead">
          {own(company.lead) || (isOwner ? t.onboarding.leadOwner : fmt(t.onboarding.leadMember, { workspace: workspace.name ?? t.onboarding.teamWorkspace }))}
        </p>
        <OnboardingForm
          isOwner={isOwner}
          steps={steps}
          defaults={{
            full_name: profile.full_name ?? session.signupMeta.full_name ?? "",
            company_name: workspace.name ?? session.signupMeta.company ?? "",
            website: workspace.website ?? "",
            industry: workspace.industry ?? "",
            offering: workspace.offering ?? "",
            ideal_customer: workspace.ideal_customer ?? "",
            target_markets: workspace.target_markets ?? "",
          }}
        />
      </main>
    </div>
  );
}
