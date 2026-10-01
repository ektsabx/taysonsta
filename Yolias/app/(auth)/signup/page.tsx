import type { Metadata } from "next";
import { MagicLinkForm } from "../MagicLinkForm";

export const metadata: Metadata = { title: "Create account — Yolias" };

export default function SignupPage() {
  return (
    <>
      <h1>Tell Yolias who you want to sell to.</h1>
      <p className="auth-lead">Create your account with your work email. We&apos;ll send you a magic link — no password needed.</p>
      <MagicLinkForm mode="signup" />
    </>
  );
}
