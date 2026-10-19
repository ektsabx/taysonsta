"use client";

import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/client";
import { callAction, isNetworkFailure } from "@/lib/action-client";
import { updateOrganization } from "@/app/(app)/settings/actions";

export interface CompanyProfileValues { name: string; website: string; industry: string; offering: string; ideal_customer: string; target_markets: string }

// The company details from onboarding (D-139), now under AI Workspace →
// Company Knowledge (moved from Settings → Organization, same data on
// workspaces). Owners and admins edit them.
// `onChange` reports edits to a parent that saves more than this form (Company Knowledge → Save everything).
export function CompanyProfileForm({ initial, manage, onChange }: { initial: CompanyProfileValues; manage: boolean; onChange?: (v: CompanyProfileValues) => void }) {
  const { t } = useI18n();
  const o = t.settings.organization;
  const [form, setForm] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const save = () => start(async () => {
    setError(null);
    const r = await callAction(() => updateOrganization(form));
    if (isNetworkFailure(r)) setError(t.feedback.errors.network);
    else if (!r.ok) setError(r.error);
    else setSaved(true);
  });
  const set = (k: keyof CompanyProfileValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { setSaved(false); const next = { ...form, [k]: e.target.value }; setForm(next); onChange?.(next); };
  const row = (k: keyof CompanyProfileValues, label: string, desc: string, input: React.ReactNode) => (
    <div className="ws-field" key={k}>
      <label className="ws-label" htmlFor={`cp-${k}`}>{label}</label>
      <p className="ws-hint">{desc}</p>
      {input}
    </div>
  );
  return (
    <div className="ws-form">
      <div className="ws-grid-2">
        {row("name", o.name, o.nameDesc, <input id="cp-name" className="form-input" value={form.name} maxLength={160} disabled={!manage} onChange={set("name")} />)}
        {row("website", o.website, o.websiteDesc, <input id="cp-website" className="form-input" dir="ltr" value={form.website} maxLength={200} disabled={!manage} onChange={set("website")} />)}
        {row("industry", o.industry, o.industryDesc, <input id="cp-industry" className="form-input" value={form.industry} maxLength={120} disabled={!manage} onChange={set("industry")} />)}
        {row("target_markets", o.targetMarkets, o.targetMarketsDesc, <input id="cp-target_markets" className="form-input" value={form.target_markets} maxLength={300} disabled={!manage} onChange={set("target_markets")} />)}
      </div>
      {row("offering", o.offering, o.offeringDesc, <textarea id="cp-offering" className="form-input" rows={3} value={form.offering} maxLength={2000} disabled={!manage} onChange={set("offering")} />)}
      {row("ideal_customer", o.idealCustomer, o.idealCustomerDesc, <textarea id="cp-ideal_customer" className="form-input" rows={3} value={form.ideal_customer} maxLength={2000} disabled={!manage} onChange={set("ideal_customer")} />)}
      {manage ? (
        <div className="setting-actions">
          {error && <p className="form-error" role="alert">{error}</p>}
          {saved && !error && <span className="setting-desc">{o.saved}</span>}
          <button className="btn-primary" type="button" disabled={pending} onClick={save}>{o.save}</button>
        </div>
      ) : <p className="setting-desc">{o.onlyAdmins}</p>}
    </div>
  );
}
