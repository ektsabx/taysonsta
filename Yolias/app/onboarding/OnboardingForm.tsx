"use client";

import { useActionState } from "react";
import { ArrowRight } from "lucide-react";
import { completeOnboarding, type OnboardingState } from "./actions";

export function OnboardingForm({ isOwner, defaults }: { isOwner: boolean; defaults: Record<string, string> }) {
  const [state, action, pending] = useActionState<OnboardingState, FormData>(completeOnboarding, {});
  const v = (k: string) => state.fields?.[k] ?? defaults[k] ?? "";

  return (
    <form className="auth-form" action={action}>
      <div className="field">
        <label htmlFor="full_name">Your name</label>
        <input id="full_name" name="full_name" className="form-input" placeholder="Youseef Waleed" defaultValue={v("full_name")} autoComplete="name" required autoFocus />
      </div>
      {isOwner && (
        <>
          <div className="field">
            <label htmlFor="company_name">Company name</label>
            <input id="company_name" name="company_name" className="form-input" placeholder="Taysonsta" defaultValue={v("company_name")} autoComplete="organization" required />
          </div>
          <div className="field">
            <label htmlFor="website">Website</label>
            <input id="website" name="website" className="form-input" placeholder="taysonsta.com" defaultValue={v("website")} autoComplete="url" required />
          </div>
          <div className="field">
            <label htmlFor="offering">What do you sell?</label>
            <textarea id="offering" name="offering" className="form-input" placeholder="Describe your product or service..." defaultValue={v("offering")} rows={4} required />
          </div>
        </>
      )}
      {state.error && <p className="form-error" role="alert">{state.error}</p>}
      <button className="btn-primary auth-submit" type="submit" disabled={pending}>
        {pending ? "Saving…" : "Get Started"}
        {!pending && <ArrowRight />}
      </button>
    </form>
  );
}
