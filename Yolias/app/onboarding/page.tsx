import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/BrandLogo";
import { getSession } from "@/lib/session";
import { OnboardingForm } from "./OnboardingForm";

export const metadata: Metadata = { title: "Welcome — Yolias" };

export default async function OnboardingPage() {
  const session = await getSession();
  if (!session) redirect("/auth/signout");
  if (session.profile.onboarded_at) redirect("/");

  const isOwner = session.role === "owner";
  const { workspace, profile } = session;

  return (
    <div className="auth-page">
      <div className="auth-brand"><BrandLogo /></div>
      <main className="auth-card wide">
        <h1>Welcome to Yolias</h1>
        <p className="auth-lead">
          {isOwner
            ? "Let's get to know your business."
            : `You're joining ${workspace.name ?? "your team's workspace"}. Tell us your name to get started.`}
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
