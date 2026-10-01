import type { Metadata } from "next";
import { MagicLinkForm } from "../MagicLinkForm";
import { errorFrom } from "../errors";

export const metadata: Metadata = { title: "Log in — Yolias" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <>
      <h1>Welcome back</h1>
      <p className="auth-lead">Enter your email and we&apos;ll send you a magic link to log in. No password needed.</p>
      <MagicLinkForm mode="login" initialError={await errorFrom(searchParams)} />
    </>
  );
}
