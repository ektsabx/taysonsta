"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { saveOutreachCampaign } from "@/app/(app)/outreach/actions";
import { channels, languageLabels, messageLanguages, objectives, tones } from "@/lib/outreach/channels";
import { useRun } from "./bits";
import type { MessageChannel, MessageObjective, MessageTone } from "@/types/database";

export interface CampaignFormValues {
  id?: string; name: string; goal: string; description: string; channel: MessageChannel; language: string; tone: MessageTone;
  customer_profile_id: string | null; offer_id: string | null; steps: { delay_days: number; objective: MessageObjective; instruction: string }[];
  /** New campaigns: the search campaign to start from (owner brief 2026-10-19). */
  source_campaign_id?: string | null;
}

export function CampaignForm({ initial, profiles, offers, maxSteps, onSaved, searchCampaigns = [] }: {
  initial: CampaignFormValues; profiles: { id: string; name: string; is_default: boolean }[]; offers: { id: string; name: string }[]; maxSteps: number; onSaved?: () => void;
  searchCampaigns?: { id: string; name: string }[];
}) {
  const { t } = useI18n();
  const o = t.ws.outreach;
  const f = o.form;
  const router = useRouter();
  const { run, pending } = useRun();
  const [v, setV] = useState(initial);
  const set = <K extends keyof CampaignFormValues>(k: K, val: CampaignFormValues[K]) => setV({ ...v, [k]: val });
  const setStep = (i: number, patch: Partial<CampaignFormValues["steps"][number]>) => set("steps", v.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  const save = () => run(() => saveOutreachCampaign(v), {
    success: v.id || !v.source_campaign_id ? t.ws.common.saved : undefined,
    onOk: (r) => { if (!v.id) router.push(`/outreach/${r.id}`); onSaved?.(); },
    // A new campaign opens its own page; a refresh here would cancel that navigation.
    refresh: Boolean(v.id),
  });

  return (
    <div className="ws-form">
      <div className="ws-card ws-form">
        {!v.id && searchCampaigns.length > 0 && (
          <div className="ws-field">
            <label className="ws-label" htmlFor="oc-source">{o.source}</label>
            <select id="oc-source" className="form-select" value={v.source_campaign_id ?? ""} onChange={(e) => {
              const id = e.target.value || null;
              const picked = searchCampaigns.find((c) => c.id === id);
              setV({ ...v, source_campaign_id: id, name: v.name.trim() || !picked ? v.name : picked.name });
            }}>
              <option value="">{o.sourceNone}</option>
              {searchCampaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <p className="field-note">{o.sourceHint}</p>
          </div>
        )}
        <div className="ws-grid-2">
          <div className="ws-field"><label className="ws-label" htmlFor="oc-name">{f.name}</label><input id="oc-name" className="form-input" value={v.name} maxLength={160} onChange={(e) => set("name", e.target.value)} /></div>
          <div className="ws-field"><label className="ws-label" htmlFor="oc-goal">{f.goal}</label><input id="oc-goal" className="form-input" placeholder={f.goalPh} value={v.goal} maxLength={1000} onChange={(e) => set("goal", e.target.value)} /></div>
        </div>
        <div className="ws-field"><label className="ws-label" htmlFor="oc-desc">{f.description} <span className="field-optional">{t.ws.common.optional}</span></label><textarea id="oc-desc" className="form-input" rows={2} value={v.description} maxLength={3000} onChange={(e) => set("description", e.target.value)} /></div>
        <div className="ws-grid-3">
          <div className="ws-field">
            <label className="ws-label" htmlFor="oc-channel">{f.channel}</label>
            <select id="oc-channel" className="form-select" value={v.channel} onChange={(e) => set("channel", e.target.value as MessageChannel)}>
              {channels.map((c) => <option key={c} value={c}>{o.channels[c]}</option>)}
            </select>
          </div>
          <div className="ws-field">
            <label className="ws-label" htmlFor="oc-lang">{f.language}</label>
            <select id="oc-lang" className="form-select" value={v.language} onChange={(e) => set("language", e.target.value)}>
              {(Object.keys(messageLanguages) as (keyof typeof messageLanguages)[]).map((l) => <option key={l} value={l}>{languageLabels[l]}</option>)}
            </select>
          </div>
          <div className="ws-field">
            <label className="ws-label" htmlFor="oc-tone">{f.tone}</label>
            <select id="oc-tone" className="form-select" value={v.tone} onChange={(e) => set("tone", e.target.value as MessageTone)}>
              {tones.map((x) => <option key={x} value={x}>{o.tones[x]}</option>)}
            </select>
          </div>
        </div>
        <div className="ws-grid-2">
          <div className="ws-field">
            <label className="ws-label" htmlFor="oc-profile">{f.profile}</label>
            <select id="oc-profile" className="form-select" value={v.customer_profile_id ?? ""} onChange={(e) => set("customer_profile_id", e.target.value || null)}>
              <option value="">{f.noProfile}</option>
              {profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="ws-field">
            <label className="ws-label" htmlFor="oc-offer">{f.offer}</label>
            <select id="oc-offer" className="form-select" value={v.offer_id ?? ""} onChange={(e) => set("offer_id", e.target.value || null)}>
              <option value="">{f.noOffer}</option>
              {offers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="ws-card">
        <div className="ws-section-head">
          <div><h3>{f.steps}</h3><p>{fmt(f.maxSteps, { count: maxSteps })}</p></div>
          <button className="btn-secondary ws-btn-sm" type="button" disabled={v.steps.length >= maxSteps}
            onClick={() => set("steps", [...v.steps, { delay_days: 3, objective: "follow_up", instruction: "" }])}><Plus size={13} /> {f.addStep}</button>
        </div>
        {v.steps.map((s, i) => (
          <div key={i} className="automation-action" style={{ gridTemplateColumns: "minmax(0, 1fr) auto" }}>
            <div className="ws-form">
              <strong className="ws-label">{fmt(f.step, { n: i + 1 })} · {i === 0 ? f.firstMessage : f.followUp}</strong>
              <div className="ws-grid-2">
                {i > 0 && (
                  <div className="ws-field"><label className="ws-label" htmlFor={`st-d-${i}`}>{f.delay}</label>
                    <input id={`st-d-${i}`} type="number" min={0} max={90} className="form-input" value={s.delay_days} onChange={(e) => setStep(i, { delay_days: Math.max(0, Math.min(90, Number(e.target.value) || 0)) })} /></div>
                )}
                <div className="ws-field"><label className="ws-label" htmlFor={`st-o-${i}`}>{f.objective}</label>
                  <select id={`st-o-${i}`} className="form-select" value={s.objective} onChange={(e) => setStep(i, { objective: e.target.value as MessageObjective })}>
                    {objectives.map((x) => <option key={x} value={x}>{o.objectives[x]}</option>)}
                  </select></div>
              </div>
              <div className="ws-field"><label className="ws-label" htmlFor={`st-i-${i}`}>{f.instruction}</label>
                <textarea id={`st-i-${i}`} className="form-input" rows={2} placeholder={f.instructionPh} value={s.instruction} maxLength={1000} onChange={(e) => setStep(i, { instruction: e.target.value })} /></div>
            </div>
            {i > 0 && <button className="ws-icon-btn" type="button" aria-label={f.removeStep} title={f.removeStep} onClick={() => set("steps", v.steps.filter((_, j) => j !== i))}><Trash2 /></button>}
          </div>
        ))}
      </div>

      <div className="ws-actions">
        <button className="btn-primary" type="button" disabled={pending || !v.name.trim()} onClick={save}>{pending ? t.ws.common.saving : v.id ? t.ws.common.save : t.ws.common.create}</button>
      </div>
    </div>
  );
}
