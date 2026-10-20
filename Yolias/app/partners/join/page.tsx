import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getDictionary } from "@/lib/i18n/server";
import { captchaConfig } from "@/lib/auth/captcha";
import { partnerUser } from "@/lib/partners";
import { PartnerAuthForm } from "../PartnerAuthForm";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).partners.joinTitle} | Yolias Partners` };
}

// Join in one step: name, email, terms — no application, no subscription (D-206).
export default async function PartnerJoinPage() {
  if (await partnerUser()) redirect("/partners");
  const t = await getDictionary();
  return (
    <main className="auth-card partners-auth">
      <h1>{t.partners.joinTitle}</h1>
      <p className="auth-lead">{t.partners.joinLead}</p>
      <PartnerAuthForm mode="signup" captchaSiteKey={(await captchaConfig())?.siteKey ?? null} />
    </main>
  );
}
