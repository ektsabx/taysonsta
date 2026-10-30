"use client";

import { useI18n } from "@/lib/i18n/client";
import type { WebsiteAnalysis } from "@/lib/website-analysis";
import type { CustomerProfileRow, CustomerType } from "@/types/database";

export type CustomerForm = {
  id?: string; name: string; problems: string; benefits: string; usp: string; goals: string; success_stories: string;
  include_keywords: string; exclude_keywords: string; industries: string; job_titles: string; countries: string;
  company_size_min: string; company_size_max: string; regions: string; budget: string; customer_type: CustomerType; extra_criteria: string;
};
export const emptyCustomer: CustomerForm = { name: "", problems: "", benefits: "", usp: "", goals: "", success_stories: "", include_keywords: "", exclude_keywords: "", industries: "", job_titles: "", countries: "", company_size_min: "", company_size_max: "", regions: "", budget: "", customer_type: "b2b", extra_criteria: "" };
export const toCustomerForm = (p: CustomerProfileRow): CustomerForm => ({
  id: p.id, name: p.name, problems: p.problems ?? "", benefits: p.benefits ?? "", usp: p.usp ?? "", goals: p.goals ?? "", success_stories: p.success_stories ?? "",
  include_keywords: p.include_keywords.join(", "), exclude_keywords: p.exclude_keywords.join(", "), industries: p.industries.join(", "), job_titles: p.job_titles.join(", "),
  countries: p.countries.join(", "), company_size_min: p.company_size_min?.toString() ?? "", company_size_max: p.company_size_max?.toString() ?? "",
  regions: p.regions ?? "", budget: p.budget ?? "", customer_type: p.customer_type, extra_criteria: p.extra_criteria ?? "",
});
const split = (s: string) => s.split(/[,،\n]/).map((x) => x.trim()).filter(Boolean);
const num = (s: string) => (s.trim() === "" ? null : Math.max(0, Math.round(Number(s))) || 0);

/** What "Analyze website" found about the ideal customer, written into the form (fields it found; the rest stays). */
export function customerFromAnalysis(cur: CustomerForm, c: WebsiteAnalysis["customer"]): CustomerForm {
  const keep = (v: string | null, old: string) => (v ? v : old);
  const join = (v: string[], old: string) => (v.length ? v.join(", ") : old);
  return { ...cur, problems: keep(c.problems, cur.problems), benefits: keep(c.benefits, cur.benefits), goals: keep(c.goals, cur.goals), industries: join(c.industries, cur.industries), job_titles: join(c.job_titles, cur.job_titles), countries: join(c.countries, cur.countries) };
}

/** The saveProfile payload for a form. */
export function customerPayload(form: CustomerForm) {
  return {
    id: form.id, name: form.name, problems: form.problems, benefits: form.benefits, usp: form.usp, goals: form.goals, success_stories: form.success_stories,
    include_keywords: split(form.include_keywords), exclude_keywords: split(form.exclude_keywords), industries: split(form.industries), job_titles: split(form.job_titles),
    countries: split(form.countries), company_size_min: num(form.company_size_min), company_size_max: num(form.company_size_max),
    regions: form.regions, budget: form.budget, customer_type: form.customer_type, extra_criteria: form.extra_criteria,
  };
}

// The ideal customer (D-241), a section of the one Company Knowledge page
// (owner, 2026-10-30, D-269): the page holds the state and the one Save.
export function IdealCustomerFields({ form, onChange, manage }: { form: CustomerForm; onChange: (f: CustomerForm) => void; manage: boolean }) {
  const { t } = useI18n();
  const p = t.ws.ai.profiles;
  const f = p.fields;
  const set = (k: keyof CustomerForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => onChange({ ...form, [k]: e.target.value });
  const area = (k: keyof CustomerForm, label: string, hint?: string, rows = 3) => (
    <div className="ws-field">
      <label className="ws-label" htmlFor={`cp-${k}`}>{label}</label>
      {hint && <p className="ws-hint">{hint}</p>}
      <textarea id={`cp-${k}`} className="form-input" rows={rows} disabled={!manage} value={String(form[k] ?? "")} onChange={set(k)} dir="auto" />
    </div>
  );
  const input = (k: keyof CustomerForm, label: string, hint?: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="ws-field">
      <label className="ws-label" htmlFor={`cp-${k}`}>{label}</label>
      {hint && <p className="ws-hint">{hint}</p>}
      <input id={`cp-${k}`} className="form-input" disabled={!manage} value={String(form[k] ?? "")} onChange={set(k)} {...extra} />
    </div>
  );
  return (
    <div className="ws-card ws-form">
      <div className="ws-grid-2">
        {input("industries", f.industries, p.hints.keywords)}
        {input("job_titles", f.job_titles, p.hints.keywords)}
        {input("countries", f.countries, p.hints.countries)}
        {input("regions", f.regions)}
      </div>
      <div className="ws-grid-3">
        {input("company_size_min", `${f.size} · ${f.sizeMin}`, undefined, { type: "number", min: 0, inputMode: "numeric" })}
        {input("company_size_max", `${f.size} · ${f.sizeMax}`, undefined, { type: "number", min: 0, inputMode: "numeric" })}
        <div className="ws-field">
          <label className="ws-label" htmlFor="cp-type">{f.customer_type}</label>
          <select id="cp-type" className="form-select" disabled={!manage} value={form.customer_type} onChange={set("customer_type")}>
            {(["b2b", "b2c", "both"] as const).map((x) => <option key={x} value={x}>{p.types[x]}</option>)}
          </select>
        </div>
      </div>
      <div className="ws-grid-2">
        {area("problems", f.problems)}
        {area("benefits", f.benefits)}
        {area("goals", f.goals)}
        {area("usp", f.usp)}
      </div>
      {area("success_stories", f.success_stories, p.hints.success, 3)}
      <div className="ws-grid-2">
        {input("include_keywords", f.include_keywords, p.hints.keywords)}
        {input("exclude_keywords", f.exclude_keywords, p.hints.keywords)}
        {input("budget", f.budget)}
        {area("extra_criteria", f.extra_criteria, undefined, 2)}
      </div>
    </div>
  );
}
