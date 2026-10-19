"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/client";
import { saveProfile } from "@/app/(app)/ai/actions";
import { AnalyzeWebsite } from "./KnowledgeView";
import type { WebsiteAnalysis } from "@/lib/website-analysis";
import { useRun } from "./bits";
import type { CustomerProfileRow, CustomerType } from "@/types/database";

type Form = {
  id?: string; name: string; problems: string; benefits: string; usp: string; goals: string; success_stories: string;
  include_keywords: string; exclude_keywords: string; industries: string; job_titles: string; countries: string;
  company_size_min: string; company_size_max: string; regions: string; budget: string; customer_type: CustomerType; extra_criteria: string;
};
const empty: Form = { name: "", problems: "", benefits: "", usp: "", goals: "", success_stories: "", include_keywords: "", exclude_keywords: "", industries: "", job_titles: "", countries: "", company_size_min: "", company_size_max: "", regions: "", budget: "", customer_type: "b2b", extra_criteria: "" };
const toForm = (p: CustomerProfileRow): Form => ({
  id: p.id, name: p.name, problems: p.problems ?? "", benefits: p.benefits ?? "", usp: p.usp ?? "", goals: p.goals ?? "", success_stories: p.success_stories ?? "",
  include_keywords: p.include_keywords.join(", "), exclude_keywords: p.exclude_keywords.join(", "), industries: p.industries.join(", "), job_titles: p.job_titles.join(", "),
  countries: p.countries.join(", "), company_size_min: p.company_size_min?.toString() ?? "", company_size_max: p.company_size_max?.toString() ?? "",
  regions: p.regions ?? "", budget: p.budget ?? "", customer_type: p.customer_type, extra_criteria: p.extra_criteria ?? "",
});
const split = (s: string) => s.split(/[,،\n]/).map((x) => x.trim()).filter(Boolean);
const num = (s: string) => (s.trim() === "" ? null : Math.max(0, Math.round(Number(s))) || 0);

// Customer Profiles (owner brief 2026-10-19, D-241): one form, like the
// Company tab: the workspace's ideal customer. "Analyze website" writes it
// from what the company sells; the member reviews and saves.
export function ProfilesView({ profiles, website, manage }: { profiles: CustomerProfileRow[]; website: string; manage: boolean }) {
  const { t } = useI18n();
  const p = t.ws.ai.profiles;
  const f = p.fields;
  const { run, pending } = useRun();
  const [form, setForm] = useState<Form | null>(profiles[0] ? toForm(profiles[0]) : { ...empty, name: p.defaultName });
  const [analyzed, setAnalyzed] = useState(false);
  const fromAnalysis = (a: WebsiteAnalysis) => {
    const c = a.customer;
    setForm((cur) => {
      const f0 = cur ?? { ...empty, name: p.defaultName };
      const keep = (v: string | null, old: string) => (v ? v : old);
      const join = (v: string[], old: string) => (v.length ? v.join(", ") : old);
      return { ...f0, problems: keep(c.problems, f0.problems), benefits: keep(c.benefits, f0.benefits), goals: keep(c.goals, f0.goals), industries: join(c.industries, f0.industries), job_titles: join(c.job_titles, f0.job_titles), countries: join(c.countries, f0.countries), company_size_min: c.company_size_min?.toString() ?? f0.company_size_min, company_size_max: c.company_size_max?.toString() ?? f0.company_size_max, customer_type: c.customer_type ?? f0.customer_type };
    });
    setAnalyzed(true);
  };
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => form && setForm({ ...form, [k]: e.target.value });
  const area = (k: keyof Form, label: string, hint?: string, rows = 3) => (
    <div className="ws-field">
      <label className="ws-label" htmlFor={`cp-${k}`}>{label}</label>
      {hint && <p className="ws-hint">{hint}</p>}
      <textarea id={`cp-${k}`} className="form-input" rows={rows} value={String(form?.[k] ?? "")} onChange={set(k)} dir="auto" />
    </div>
  );
  const input = (k: keyof Form, label: string, hint?: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="ws-field">
      <label className="ws-label" htmlFor={`cp-${k}`}>{label}</label>
      {hint && <p className="ws-hint">{hint}</p>}
      <input id={`cp-${k}`} className="form-input" value={String(form?.[k] ?? "")} onChange={set(k)} {...extra} />
    </div>
  );
  const save = () => form && run(() => saveProfile({
    id: form.id, name: form.name, problems: form.problems, benefits: form.benefits, usp: form.usp, goals: form.goals, success_stories: form.success_stories,
    include_keywords: split(form.include_keywords), exclude_keywords: split(form.exclude_keywords), industries: split(form.industries), job_titles: split(form.job_titles),
    countries: split(form.countries), company_size_min: num(form.company_size_min), company_size_max: num(form.company_size_max),
    regions: form.regions, budget: form.budget, customer_type: form.customer_type, extra_criteria: form.extra_criteria,
  }), { success: t.ws.common.saved, onOk: (r) => setForm({ ...form, id: r.id }) });

  return (
    <div className="profiles-single">
      {manage && <AnalyzeWebsite initialUrl={website} onResult={fromAnalysis} />}
      {analyzed && <div className="ws-card analyze-result" role="status"><p>{p.analyzed}</p></div>}
      {form ? (
        <div className="ws-form">
          <div className="ws-card ws-form">
            <div className="ws-grid-2">
              {area("problems", f.problems)}
              {area("benefits", f.benefits)}
              {area("usp", f.usp)}
              {area("goals", f.goals)}
            </div>
            {area("success_stories", f.success_stories, p.hints.success, 4)}
            <div className="ws-grid-2">
              {input("include_keywords", f.include_keywords, p.hints.keywords)}
              {input("exclude_keywords", f.exclude_keywords, p.hints.keywords)}
            </div>
          </div>
          <div className="ws-card ws-form">
            <h3 className="ws-label">{f.icp}</h3>
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
                <select id="cp-type" className="form-select" value={form.customer_type} onChange={set("customer_type")}>
                  {(["b2b", "b2c", "both"] as const).map((x) => <option key={x} value={x}>{p.types[x]}</option>)}
                </select>
              </div>
            </div>
            <div className="ws-grid-2">
              {input("budget", f.budget)}
              {area("extra_criteria", f.extra_criteria, undefined, 2)}
            </div>
          </div>
          <div className="ws-actions">
            <button className="btn-primary" type="button" disabled={pending || !manage || !form.name.trim()} onClick={() => { setAnalyzed(false); save(); }}>{t.ws.common.save}</button>
          </div>
        </div>
      ) : <div className="ws-empty">{p.empty}</div>}
    </div>
  );
}
