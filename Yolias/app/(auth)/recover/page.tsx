import type { Metadata } from "next";
import { getDictionary } from "@/lib/i18n/server";
import { MagicLinkForm } from "../MagicLinkForm";
import { errorFrom } from "../errors";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).auth.recoverTitle} — Yolias` };
}

// Yolias has no passwords, so recovery means getting a fresh sign-in link
// (e.g. the previous one expired or was already used).
export default async function RecoverPage({ searchParams }: PageProps<"/recover">) {
  const t = await getDictionary();
  return (
    <>
      <h1>{t.auth.recoverTitle}</h1>
      <p className="auth-lead">{t.auth.recoverLead}</p>
      <MagicLinkForm mode="recover" initialError={await errorFrom(searchParams, t)} />
    </>
  );
}
