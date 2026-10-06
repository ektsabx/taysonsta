import type { Metadata } from "next";
import { getDictionary } from "@/lib/i18n/server";
import { MagicLinkForm } from "../MagicLinkForm";
import { GoogleButton } from "../GoogleButton";
import { googleSignInEnabled } from "@/lib/auth/providers";
import { errorFrom } from "../errors";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).auth.loginTitle} — Yolias` };
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const t = await getDictionary();
  return (
    <>
      <h1>{t.auth.loginTitle}</h1>
      <p className="auth-lead">{t.auth.loginLead}</p>
      {(await googleSignInEnabled()) && <GoogleButton label={t.auth.google} or={t.auth.orEmail} />}
      <MagicLinkForm mode="login" initialError={await errorFrom(searchParams, t)} />
    </>
  );
}
