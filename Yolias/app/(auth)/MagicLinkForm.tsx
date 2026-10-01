"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowRight, MailCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { sendMagicLink, type MagicLinkMode, type MagicLinkState } from "./actions";

export function MagicLinkForm({ mode, initialError, plan, period }: { mode: MagicLinkMode; initialError?: string; plan?: string; period?: string }) {
  const { t } = useI18n();
  const a = t.auth;
  const [state, action, pending] = useActionState<MagicLinkState, FormData>(
    sendMagicLink.bind(null, mode),
    initialError ? { status: "error", message: initialError } : { status: "idle" }
  );

  const submit = { login: a.loginSubmit, signup: a.signupSubmit, recover: a.recoverSubmit }[mode];
  const alt = {
    login: <>{a.loginAltNew} <Link href="/signup">{a.loginAltCreate}</Link> · <Link href="/recover">{a.loginAltRecover}</Link></>,
    signup: <>{a.signupAlt} <Link href="/login">{a.signupAltLogin}</Link></>,
    recover: <>{a.recoverAlt} <Link href="/login">{a.recoverAltLogin}</Link></>,
  }[mode];

  if (state.status === "sent") {
    const [before, after] = a.checkEmailBody.split("{email}");
    return (
      <div className="check-email" role="status">
        <div className="check-email-icon"><MailCheck /></div>
        <strong>{a.checkEmailTitle}</strong>
        <p>{before}<b dir="ltr">{state.email}</b>{after}</p>
        <form action={action}>
          <input type="hidden" name="email" value={state.email} />
          {plan && <input type="hidden" name="plan" value={plan} />}
          {period && <input type="hidden" name="period" value={period} />}
          <button className="link-button" type="submit" disabled={pending}>{pending ? t.common.sending : a.resend}</button>
        </form>
      </div>
    );
  }

  return (
    <>
      <form className="auth-form" action={action}>
        {plan && <input type="hidden" name="plan" value={plan} />}
        {period && <input type="hidden" name="period" value={period} />}
        <div className="field">
          <label htmlFor="email">{a.workEmail}</label>
          <input
            id="email"
            name="email"
            type="email"
            dir="ltr"
            className="form-input"
            placeholder={a.emailPlaceholder}
            autoComplete="email"
            defaultValue={state.status === "error" ? state.email : undefined}
            required
            autoFocus
          />
        </div>
        {state.status === "error" && <p className="form-error" role="alert">{state.message}</p>}
        <button className="btn-primary auth-submit" type="submit" disabled={pending}>
          {pending ? t.common.sending : submit}
          {!pending && <ArrowRight className="flip-rtl" />}
        </button>
      </form>
      <p className="auth-alt">{alt}</p>
    </>
  );
}
