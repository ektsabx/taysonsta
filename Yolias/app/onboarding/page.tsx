import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/BrandLogo";
import { LanguageMenu } from "@/components/LanguageMenu";
import { fmt } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";
import { hasActivePlan } from "@/lib/plans";
import { requireUser } from "@/lib/session";
import { OnboardingForm } from "./OnboardingForm";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).onboarding.title}` };
}

export default async function OnboardingPage() {
  const session = await requireUser();
  if (!hasActivePlan(session.workspace)) redirect("/checkout");
  if (session.profile.onboarded_at) redirect("/");
  const t = await getDictionary();

  const isOwner = session.role === "owner";
  const { workspace, profile } = session;

  return (
    <div className="auth-page">
      <div className="auth-brand"><BrandLogo /><LanguageMenu /></div>
      <main className="auth-card wide">
        <h1>{t.onboarding.title}</h1>
        <p className="auth-lead">
          {isOwner ? t.onboarding.leadOwner : fmt(t.onboarding.leadMember, { workspace: workspace.name ?? t.onboarding.teamWorkspace })}
        </p>
        <OnboardingForm
          isOwner={isOwner}
          defaults={{
            full_name: profile.full_name ?? session.signupMeta.full_name ?? "",
            company_name: workspace.name ?? session.signupMeta.company ?? "",
            website: workspace.website ?? "",
            offering: workspace.offering ?? "",
          }}
        />
      </main>
    </div>
  );
}
