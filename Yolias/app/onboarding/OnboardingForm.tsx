"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { completeOnboarding, type OnboardingState } from "./actions";
import { AnalyzeWebsite } from "@/components/app/ws/KnowledgeView";
import type { WebsiteAnalysis } from "@/lib/website-analysis";
import { ACQUISITION_SOURCES } from "@/lib/onboarding/source";
import type { OnboardingStep } from "@/lib/onboarding/steps";

// Onboarding, one page per step (owner, 2026-11-03, D-276): the steps and
// their wording come from Yolias Admin → Onboarding. Every step's fields stay
// in one form, so "Back" never loses what was typed, and the account is saved
// once, on the last page.
export function OnboardingForm({ isOwner, defaults, steps }: { isOwner: boolean; defaults: Record<string, string>; steps: OnboardingStep[] }) {
  const { t, locale } = useI18n();
  const o = t.onboarding;
  const [state, action, pending] = useActionState<OnboardingState, FormData>(completeOnboarding, {});
  const v = (k: string) => state.fields?.[k] ?? defaults[k] ?? "";
  const [timeZone, setTimeZone] = useState("");
  const src = t.ws.sources;
  const [source, setSource] = useState(v("acquisition_source"));
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone ?? ""), []);
  const formRef = useRef<HTMLFormElement>(null);
  const [website, setWebsite] = useState(v("website"));
  const [knowledge, setKnowledge] = useState("");
  const [customer, setCustomer] = useState("");
  const [analyzed, setAnalyzed] = useState<number | null>(null);
  const [manual, setManual] = useState(Boolean(defaults.industry || defaults.offering));
  const showFields = !isOwner || manual || analyzed != null || Boolean(state.fields);
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
    setCustomer(JSON.stringify(a.customer));
    setAnalyzed(a.pages.length);
  };

  const live = steps.filter((s) => s.enabled);
  const [at, setAt] = useState(0);
  // A server error sends the member back to the first page, where the company fields are.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (state.error) setAt(0); }, [state]);
  const step = live[at];
  const last = at === live.length - 1;
  const pick = (l: { ar: string; en: string }, fallback: string) => (locale === "ar" ? l.ar || l.en : l.en || l.ar) || fallback;
  // The current page's inputs must be valid before "Continue".
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const next = () => {
    const page = pageRefs.current[at];
    const inputs = page ? [...page.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input, textarea, select")] : [];
    const bad = inputs.find((el) => !el.checkValidity());
    if (bad) { bad.reportValidity(); return; }
    setAt((i) => Math.min(i + 1, live.length - 1));
  };

  return (
    <form className="auth-form" action={action} ref={formRef} onKeyDown={(e) => { if (e.key === "Enter" && !last && (e.target as HTMLElement).tagName === "INPUT") { e.preventDefault(); next(); } }}>
      <input type="hidden" name="timezone" value={timeZone} />
      <input type="hidden" name="knowledge_json" value={knowledge} />
      <input type="hidden" name="customer_json" value={customer} />
      {live.length > 1 && (
        <div className="onb-progress" aria-label={fmt(o.stepOf, { n: String(at + 1), total: String(live.length) })}>
          <span className="onb-progress-text">{fmt(o.stepOf, { n: String(at + 1), total: String(live.length) })}</span>
          <span className="onb-progress-track"><span style={{ width: `${((at + 1) / live.length) * 100}%` }} /></span>
        </div>
      )}
      {step && step.kind !== "company" && (
        <div className="onb-step-head">
          <h2>{pick(step.title, step.kind === "source" ? src.question : "")}</h2>
          {pick(step.lead, "") && <p className="auth-lead">{pick(step.lead, "")}</p>}
        </div>
      )}

      {live.map((s, i) => (
        <div key={s.id} ref={(el) => { pageRefs.current[i] = el; }} hidden={i !== at} className="onb-page">
          {s.kind === "company" && (
            <>
              {isOwner && (
                <div className="field">
                  <label htmlFor="website">{o.websiteFirst}</label>
                  <p className="field-note">{o.websiteFirstNote}</p>
                  <input id="website" name="website" dir="ltr" className="form-input" placeholder={o.websitePlaceholder} value={website} onChange={(e) => setWebsite(e.target.value)} autoComplete="url" required={!manual} autoFocus />
                  <AnalyzeWebsite compact initialUrl={website} url={website} onUrl={setWebsite} onResult={fill} context="onboarding" />
                  {analyzed != null && <p className="field-note">{fmt(t.ws.ai.knowledge.analyze.done, { count: analyzed })}</p>}
                  {!manual && analyzed == null && <button type="button" className="link-button onboarding-no-site" onClick={() => { setManual(true); setWebsite(""); }}>{o.noWebsite}</button>}
                </div>
              )}
              <div className="field" hidden={!showFields}>
                <label htmlFor="full_name">{o.name}</label>
                <input id="full_name" name="full_name" className="form-input" placeholder={o.namePlaceholder} defaultValue={v("full_name")} autoComplete="name" required autoFocus={!isOwner} />
              </div>
              {isOwner && (
                <div hidden={!showFields} className="onboarding-fields">
                  <div className="field">
                    <label htmlFor="company_name">{o.company}</label>
                    <input id="company_name" name="company_name" className="form-input" placeholder={o.companyPlaceholder} defaultValue={v("company_name")} autoComplete="organization" required={showFields} />
                  </div>
                  <div className="field">
                    <label htmlFor="industry">{o.industry}</label>
                    <input id="industry" name="industry" className="form-input" placeholder={o.industryPlaceholder} defaultValue={v("industry")} maxLength={120} required={showFields} />
                  </div>
                  <div className="field">
                    <label htmlFor="offering">{o.offering}</label>
                    <textarea id="offering" name="offering" className="form-input" placeholder={o.offeringPlaceholder} defaultValue={v("offering")} rows={3} maxLength={2000} required={showFields} />
                  </div>
                  <div className="field">
                    <label htmlFor="ideal_customer">{o.idealCustomer} <span className="field-optional">{o.optional}</span></label>
                    <textarea id="ideal_customer" name="ideal_customer" className="form-input" placeholder={o.idealCustomerPlaceholder} defaultValue={v("ideal_customer")} rows={3} maxLength={2000} />
                  </div>
                  <div className="field">
                    <label htmlFor="target_markets">{o.targetMarkets}</label>
                    <input id="target_markets" name="target_markets" className="form-input" placeholder={o.targetMarketsPlaceholder} defaultValue={v("target_markets")} maxLength={300} required={showFields} />
                  </div>
                </div>
              )}
            </>
          )}
          {s.kind === "source" && (
            <div className="field">
              <label htmlFor="acquisition_source" className="sr-only">{src.question}</label>
              <select id="acquisition_source" name="acquisition_source" className="form-select" value={source} onChange={(e) => setSource(e.target.value)}>
                <option value="">{src.placeholder}</option>
                {ACQUISITION_SOURCES.map((k) => <option key={k} value={k}>{src.options[k]}</option>)}
              </select>
              {source === "other" && (
                <input name="acquisition_source_other" className="form-input source-other" aria-label={src.otherLabel} placeholder={src.otherPlaceholder} defaultValue={v("acquisition_source_other")} maxLength={120} required={i === at} />
              )}
            </div>
          )}
          {s.kind === "custom" && s.fields.map((f) => {
            const name = `q_${s.id}_${f.key}`;
            const label = pick(f.label, f.key);
            return (
              <div className="field" key={f.key}>
                <label htmlFor={name}>{label}{!f.required && <> <span className="field-optional">{o.optional}</span></>}</label>
                {f.type === "text" && <input id={name} name={name} className="form-input" maxLength={300} required={f.required} />}
                {f.type === "textarea" && <textarea id={name} name={name} className="form-input" rows={3} maxLength={2000} required={f.required} />}
                {f.type === "select" && (
                  <select id={name} name={name} className="form-select" required={f.required} defaultValue="">
                    <option value="" disabled={f.required}>{o.choose}</option>
                    {f.options.map((opt) => { const val = opt.ar || opt.en; return <option key={val} value={val}>{pick(opt, val)}</option>; })}
                  </select>
                )}
                {f.type === "multi" && (
                  <div className="onb-multi" role="group" aria-labelledby={name}>
                    {f.options.map((opt) => { const val = opt.ar || opt.en; return <label key={val} className="onb-chip"><input type="checkbox" name={name} value={val} />{pick(opt, val)}</label>; })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {state.error && <p className="form-error" role="alert">{state.error}</p>}
      <div className="onb-nav" hidden={!showFields}>
        {at > 0 && <button type="button" className="btn-secondary" onClick={() => setAt((i) => i - 1)}>{o.back}</button>}
        {last
          ? <button className="btn-primary auth-submit" type="submit" disabled={pending}>{pending ? t.common.saving : o.submit}</button>
          : <button className="btn-primary auth-submit" type="button" onClick={next}>{o.continue}</button>}
      </div>
    </form>
  );
}
