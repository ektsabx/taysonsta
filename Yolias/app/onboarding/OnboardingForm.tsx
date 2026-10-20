"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { completeOnboarding, type OnboardingState } from "./actions";
import { AnalyzeWebsite } from "@/components/app/ws/KnowledgeView";
import type { WebsiteAnalysis } from "@/lib/website-analysis";
import { ACQUISITION_SOURCES } from "@/lib/onboarding/source";

export function OnboardingForm({ isOwner, defaults }: { isOwner: boolean; defaults: Record<string, string> }) {
  const { t } = useI18n();
  const o = t.onboarding;
  const [state, action, pending] = useActionState<OnboardingState, FormData>(completeOnboarding, {});
  const v = (k: string) => state.fields?.[k] ?? defaults[k] ?? "";
  // The device's time zone, saved on the account with the form (Settings can change it).
  const [timeZone, setTimeZone] = useState("");
  const src = t.ws.sources;
  const [source, setSource] = useState(v("acquisition_source"));
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone ?? ""), []);
  // Analyze website (D-232): the site fills the company fields; the owner reviews them before continuing.
  const formRef = useRef<HTMLFormElement>(null);
  const [website, setWebsite] = useState(v("website"));
  const [knowledge, setKnowledge] = useState("");
  const [analyzed, setAnalyzed] = useState<number | null>(null);
  const fill = (a: WebsiteAnalysis) => {
    const f = formRef.current;
    const put = (name: string, value: string | null) => {
      const el = f?.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | null;
      if (el && value) el.value = value;
    };
    put("company_name", a.profile.name); put("industry", a.profile.industry); put("offering", a.profile.offering);
    put("ideal_customer", a.profile.ideal_customer); put("target_markets", a.profile.target_markets);
    setWebsite(a.url);
    setKnowledge(JSON.stringify(a.knowledge));
    setAnalyzed(a.pages.length);
  };

  return (
    <form className="auth-form" action={action} ref={formRef}>
      <input type="hidden" name="timezone" value={timeZone} />
      <input type="hidden" name="knowledge_json" value={knowledge} />
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
            <input id="website" name="website" dir="ltr" className="form-input" placeholder={o.websitePlaceholder} value={website} onChange={(e) => setWebsite(e.target.value)} autoComplete="url" required />
            <AnalyzeWebsite compact initialUrl={website} url={website} onUrl={setWebsite} onResult={fill} context="onboarding" />
            {analyzed != null && <p className="field-note">{fmt(t.ws.ai.knowledge.analyze.done, { count: analyzed })}</p>}
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
      <div className="field">
        <label htmlFor="acquisition_source">{src.question} <span className="field-optional">{o.optional}</span></label>
        <select id="acquisition_source" name="acquisition_source" className="form-select" value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="">{src.placeholder}</option>
          {ACQUISITION_SOURCES.map((k) => <option key={k} value={k}>{src.options[k]}</option>)}
        </select>
        {source === "other" && (
          <input name="acquisition_source_other" className="form-input source-other" aria-label={src.otherLabel} placeholder={src.otherPlaceholder} defaultValue={v("acquisition_source_other")} maxLength={120} required />
        )}
        <p className="field-note">{src.hint}</p>
      </div>
      {state.error && <p className="form-error" role="alert">{state.error}</p>}
      <button className="btn-primary auth-submit" type="submit" disabled={pending}>
        {pending ? t.common.saving : o.submit}
      </button>
    </form>
  );
}
