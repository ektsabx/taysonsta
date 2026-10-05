import type { Metadata } from "next";
import { getDictionary } from "@/lib/i18n/server";
import { TwoFactorForm } from "./TwoFactorForm";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).auth.twoFactorTitle} — Yolias` };
}

// Second sign-in step for accounts with two-factor authentication.
export default async function TwoFactorPage() {
  const t = await getDictionary();
  return (
    <>
      <h1>{t.auth.twoFactorTitle}</h1>
      <p className="auth-lead">{t.auth.twoFactorLead}</p>
      <TwoFactorForm />
    </>
  );
}
