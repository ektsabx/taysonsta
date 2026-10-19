"use client";

import { useI18n } from "@/lib/i18n/client";
import { ConsentText } from "./ConsentText";
import { GoogleButton } from "./GoogleButton";
import { MagicLinkForm } from "./MagicLinkForm";

// Sign-up: a sentence, not a box (owner, 2026-10-19) — signing up (Google or
// the email link) is the agreement. The email form sends consent=1 and the
// server keeps the time on the account.
export function SignupForms({ google, plan, period, captchaSiteKey }: { google: boolean; plan?: string; period?: string; captchaSiteKey: string | null }) {
  const { t } = useI18n();
  const a = t.auth;
  return (
    <>
      {google && <GoogleButton label={a.google} or={a.orEmail} plan={plan} period={period} />}
      <MagicLinkForm mode="signup" plan={plan} period={period} captchaSiteKey={captchaSiteKey} />
      <p className="signup-consent">
        <ConsentText text={a.consent} links={{ terms: { href: "/legal/terms", label: a.consentTerms }, privacy: { href: "/legal/privacy", label: a.consentPrivacy } }} />
      </p>
    </>
  );
}
