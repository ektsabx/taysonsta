import type { Metadata } from "next";
import { MagicLinkForm } from "../MagicLinkForm";
import { errorFrom } from "../errors";

export const metadata: Metadata = { title: "Account recovery — Yolias" };

// Yolias has no passwords, so recovery means getting a fresh sign-in link
// (e.g. the previous one expired or was already used).
export default async function RecoverPage({ searchParams }: PageProps<"/recover">) {
  return (
    <>
      <h1>Can&apos;t sign in?</h1>
      <p className="auth-lead">
        Links expire after 1 hour and work once. Enter your account email and we&apos;ll send you a new magic link.
      </p>
      <MagicLinkForm mode="recover" initialError={await errorFrom(searchParams)} />
    </>
  );
}
