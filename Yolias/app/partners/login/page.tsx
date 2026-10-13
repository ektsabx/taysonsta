import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getDictionary } from "@/lib/i18n/server";
import { partnerUser } from "@/lib/partners";
import { PartnerAuthForm } from "../PartnerAuthForm";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).partners.loginTitle} — Yolias Partners` };
}

export default async function PartnerLoginPage() {
  if (await partnerUser()) redirect("/partners");
  const t = await getDictionary();
  return (
    <main className="auth-card partners-auth">
      <h1>{t.partners.loginTitle}</h1>
      <p className="auth-lead">{t.partners.loginLead}</p>
      <PartnerAuthForm mode="login" />
    </main>
  );
}
