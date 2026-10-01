"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowRight, MailCheck } from "lucide-react";
import { sendMagicLink, type MagicLinkMode, type MagicLinkState } from "./actions";

const copy: Record<MagicLinkMode, { submit: string; alt: React.ReactNode }> = {
  login: {
    submit: "Send Magic Link",
    alt: <>New to Yolias? <Link href="/signup">Create an account</Link> · <Link href="/recover">Can&apos;t sign in?</Link></>,
  },
  signup: {
    submit: "Create Account",
    alt: <>Already have an account? <Link href="/login">Log in</Link></>,
  },
  recover: {
    submit: "Send New Link",
    alt: <>Remembered it? <Link href="/login">Back to log in</Link></>,
  },
};

export function MagicLinkForm({ mode, initialError }: { mode: MagicLinkMode; initialError?: string }) {
  const [state, action, pending] = useActionState<MagicLinkState, FormData>(
    sendMagicLink.bind(null, mode),
    initialError ? { status: "error", message: initialError } : { status: "idle" }
  );

  if (state.status === "sent") {
    return (
      <div className="check-email" role="status">
        <div className="check-email-icon"><MailCheck /></div>
        <strong>Check your email</strong>
        <p>
          We sent a sign-in link to <b>{state.email}</b>. Open it on this device to continue to Yolias. The link expires in 1 hour.
        </p>
        <form action={action}>
          <input type="hidden" name="email" value={state.email} />
          <button className="link-button" type="submit" disabled={pending}>{pending ? "Sending…" : "Resend link"}</button>
        </form>
      </div>
    );
  }

  return (
    <>
      <form className="auth-form" action={action}>
        <div className="field">
          <label htmlFor="email">Work email</label>
          <input
            id="email"
            name="email"
            type="email"
            className="form-input"
            placeholder="you@company.com"
            autoComplete="email"
            defaultValue={state.status === "error" ? state.email : undefined}
            required
            autoFocus
          />
        </div>
        {state.status === "error" && <p className="form-error" role="alert">{state.message}</p>}
        <button className="btn-primary auth-submit" type="submit" disabled={pending}>
          {pending ? "Sending…" : copy[mode].submit}
          {!pending && <ArrowRight />}
        </button>
      </form>
      <p className="auth-alt">{copy[mode].alt}</p>
    </>
  );
}
