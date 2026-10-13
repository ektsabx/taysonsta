"use client";

import { useActionState } from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { Turnstile } from "@/components/Turnstile";
import { useI18n } from "@/lib/i18n/client";
import type { MagicLinkState } from "@/app/(auth)/actions";
import { partnerMagicLink } from "./auth-actions";

export function PartnerAuthForm({ mode, captchaSiteKey }: { mode: "login" | "signup"; captchaSiteKey?: string | null }) {
  const { t } = useI18n();
  const a = t.auth;
  const p = t.partners;
  const [state, action, pending] = useActionState<MagicLinkState, FormData>(partnerMagicLink.bind(null, mode), { status: "idle" });

  if (state.status === "sent") {
    const [before, after] = a.checkEmailBody.split("{email}");
    return (
      <div className="check-email" role="status">
        <div className="check-email-icon"><MailCheck /></div>
        <strong>{a.checkEmailTitle}</strong>
        <p>{before}<b dir="ltr">{state.email}</b>{after}</p>
      </div>
    );
  }
  return (
    <>
      <form className="auth-form" action={action}>
        {mode === "signup" && (
          <div className="field">
            <label htmlFor="full_name">{p.name}</label>
            <input id="full_name" name="full_name" className="form-input" autoComplete="name" required maxLength={120} autoFocus />
          </div>
        )}
        <div className="field">
          <label htmlFor="email">{a.workEmail}</label>
          <input id="email" name="email" type="email" dir="ltr" className="form-input" placeholder={a.emailPlaceholder} autoComplete="email" required
            defaultValue={state.status === "error" ? state.email : undefined} autoFocus={mode === "login"} />
        </div>
        {mode === "signup" && (
          <label className="affiliate-accept">
            <input type="checkbox" name="accept" />
            <span>{p.accept} <Link href="/affiliates#terms" target="_blank">{p.terms}</Link></span>
          </label>
        )}
        {mode === "signup" && captchaSiteKey && <Turnstile siteKey={captchaSiteKey} resetKey={state} />}
        {state.status === "error" && <p className="form-error" role="alert">{state.message}</p>}
        <button className="btn-primary auth-submit" type="submit" disabled={pending}><span>{pending ? t.common.sending : mode === "signup" ? p.joinSubmit : p.loginSubmit}</span></button>
      </form>
      <p className="auth-alt">{mode === "signup" ? <>{p.haveAccount} <Link href="/partners/login">{p.loginLink}</Link></> : <>{p.noAccount} <Link href="/partners/join">{p.joinLink}</Link></>}</p>
    </>
  );
}
