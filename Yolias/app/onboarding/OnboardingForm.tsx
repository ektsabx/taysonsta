"use client";

import { useActionState } from "react";
import { ArrowRight } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { completeOnboarding, type OnboardingState } from "./actions";

export function OnboardingForm({ isOwner, defaults }: { isOwner: boolean; defaults: Record<string, string> }) {
  const { t } = useI18n();
  const o = t.onboarding;
  const [state, action, pending] = useActionState<OnboardingState, FormData>(completeOnboarding, {});
  const v = (k: string) => state.fields?.[k] ?? defaults[k] ?? "";

  return (
    <form className="auth-form" action={action}>
      <div className="field">
        <label htmlFor="full_name">{o.name}</label>
        <input id="full_name" name="full_name" className="form-input" placeholder={o.namePlaceholder} defaultValue={v("full_name")} autoComplete="name" required autoFocus />
      </div>
      {isOwner && (
        <>
          <div className="field">
            <label htmlFor="company_name">{o.company}</label>
            <input id="company_name" name="company_name" className="form-input" placeholder={o.companyPlaceholder} defaultValue={v("company_name")} autoComplete="organization" required />
          </div>
          <div className="field">
            <label htmlFor="website">{o.website}</label>
            <input id="website" name="website" dir="ltr" className="form-input" placeholder={o.websitePlaceholder} defaultValue={v("website")} autoComplete="url" required />
          </div>
          <div className="field">
            <label htmlFor="industry">{o.industry}</label>
            <input id="industry" name="industry" className="form-input" placeholder={o.industryPlaceholder} defaultValue={v("industry")} maxLength={120} required />
          </div>
          <div className="field">
            <label htmlFor="offering">{o.offering}</label>
            <textarea id="offering" name="offering" className="form-input" placeholder={o.offeringPlaceholder} defaultValue={v("offering")} rows={3} maxLength={2000} required />
          </div>
          <div className="field">
            <label htmlFor="ideal_customer">{o.idealCustomer} <span className="field-optional">{o.optional}</span></label>
            <textarea id="ideal_customer" name="ideal_customer" className="form-input" placeholder={o.idealCustomerPlaceholder} defaultValue={v("ideal_customer")} rows={3} maxLength={2000} />
          </div>
          <div className="field">
            <label htmlFor="target_markets">{o.targetMarkets}</label>
            <input id="target_markets" name="target_markets" className="form-input" placeholder={o.targetMarketsPlaceholder} defaultValue={v("target_markets")} maxLength={300} required />
          </div>
          <p className="field-note">{o.contextNote}</p>
        </>
      )}
      {state.error && <p className="form-error" role="alert">{state.error}</p>}
      <button className="btn-primary auth-submit" type="submit" disabled={pending}>
        {pending ? t.common.saving : o.submit}
        {!pending && <ArrowRight className="flip-rtl" />}
      </button>
    </form>
  );
}
