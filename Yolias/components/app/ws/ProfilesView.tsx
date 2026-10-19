"use client";

import { useState } from "react";
import { Plus, Star, Trash2 } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { deleteProfile, saveProfile, setDefaultProfile } from "@/app/(app)/ai/actions";
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

export function ProfilesView({ profiles }: { profiles: CustomerProfileRow[] }) {
  const { t } = useI18n();
  const p = t.ws.ai.profiles;
  const f = p.fields;
  const { run, pending } = useRun();
  const [form, setForm] = useState<Form | null>(profiles[0] ? toForm(profiles[0]) : null);
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
    <div className="lead-layout profiles-layout">
      <aside>
        <div className="ws-card ws-list">
          <button className="btn-primary" type="button" style={{ marginBottom: 10 }} onClick={() => setForm({ ...empty })}><Plus size={14} /> {p.new}</button>
          {!profiles.length && <p className="ws-muted">{p.empty}</p>}
          {profiles.map((x) => (
            <button key={x.id} type="button" className={`menu-item${form?.id === x.id ? " selected" : ""}`} onClick={() => setForm(toForm(x))}>
              <span>{x.name}</span>
              {x.is_default && <span className="ws-chip green"><Star /> {p.default}</span>}
            </button>
          ))}
        </div>
        <p className="ws-hint" style={{ marginTop: 10 }}>{p.usedIn}</p>
      </aside>
      {form ? (
        <div className="ws-form">
          <div className="ws-card ws-form">
            {input("name", f.name, undefined, { maxLength: 120, placeholder: p.namePh })}
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
            {form.id && !profiles.find((x) => x.id === form.id)?.is_default && <button className="btn-secondary" type="button" disabled={pending} onClick={() => run(() => setDefaultProfile(form.id!), { success: t.ws.common.saved })}><Star size={14} /> {p.makeDefault}</button>}
            {form.id && <button className="btn-danger-ghost" type="button" disabled={pending} onClick={() => { if (confirm(t.ws.common.confirmDelete)) run(() => deleteProfile(form.id!), { onOk: () => setForm(null) }); }}><Trash2 size={13} /> {t.ws.common.delete}</button>}
            <button className="btn-primary" type="button" disabled={pending || !form.name.trim()} onClick={save}>{t.ws.common.save}</button>
          </div>
        </div>
      ) : <div className="ws-empty">{p.empty}</div>}
    </div>
  );
}
