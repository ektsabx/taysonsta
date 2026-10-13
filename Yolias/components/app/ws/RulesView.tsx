"use client";

import { useState } from "react";
import { Info, ShieldCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { saveAiSettings } from "@/app/(app)/ai/actions";
import { AGENTS, AGENT_ACTIONS, ESCALATIONS, FORCED_ESCALATIONS, MODES, type AiSettings, type Limits, type Mode } from "@/lib/ai-workspace/settings";
import { useRun } from "./bits";

const NUMBER_LIMITS = ["max_messages_per_lead", "daily_send_limit", "min_gap_hours", "no_recontact_days"] as const;
const BOOL_LIMITS = ["stop_on_reply", "stop_on_meeting"] as const;
const RANGES: Record<(typeof NUMBER_LIMITS)[number], [number, number]> = { max_messages_per_lead: [1, 10], daily_send_limit: [1, 500], min_gap_hours: [1, 720], no_recontact_days: [0, 365] };

export function RulesView({ settings, manage }: { settings: AiSettings; manage: boolean }) {
  const { t } = useI18n();
  const r = t.ws.ai.rules;
  const { run, pending } = useRun();
  const [perms, setPerms] = useState(settings.permissions);
  const [limits, setLimits] = useState<Limits>(settings.limits);
  const [esc, setEsc] = useState(settings.escalation);
  const [guidelines, setGuidelines] = useState(settings.guidelines);
  const dis = !manage || pending;

  return (
    <>
      {!manage && <div className="ws-note"><Info /><span>{t.ws.common.onlyManagers}</span></div>}
      <section className="ws-section">
        <div className="ws-section-head"><h3>{r.matrix}</h3></div>
        <div className="agent-grid">
          {AGENTS.map((ag) => (
            <article key={ag} className="agent-card">
              <strong className="ws-label">{t.ws.ai.agents.list[ag].name}</strong>
              {AGENT_ACTIONS[ag].map((act) => (
                <div key={act} className="perm-row">
                  <label htmlFor={`perm-${ag}-${act}`}>{r.actions[act]}</label>
                  <select id={`perm-${ag}-${act}`} className="form-select" disabled={dis} value={perms[ag][act] ?? "approve"}
                    onChange={(e) => setPerms({ ...perms, [ag]: { ...perms[ag], [act]: e.target.value as Mode } })}>
                    {MODES.map((m) => <option key={m} value={m}>{r.modes[m]}</option>)}
                  </select>
                </div>
              ))}
            </article>
          ))}
        </div>
        <p className="ws-hint" style={{ marginTop: 8 }}>{r.sendNote}</p>
      </section>

      <section className="ws-section">
        <div className="ws-section-head"><h3>{r.limits}</h3></div>
        <div className="ws-card ws-form">
          <div className="ws-grid-2">
            {NUMBER_LIMITS.map((k) => (
              <div key={k} className="ws-field">
                <label className="ws-label" htmlFor={`lim-${k}`}>{r.limitFields[k]}</label>
                <input id={`lim-${k}`} type="number" className="form-input" min={RANGES[k][0]} max={RANGES[k][1]} disabled={dis} value={limits[k]}
                  onChange={(e) => setLimits({ ...limits, [k]: Math.min(RANGES[k][1], Math.max(RANGES[k][0], Math.round(Number(e.target.value) || 0))) })} />
              </div>
            ))}
          </div>
          {BOOL_LIMITS.map((k) => (
            <label key={k} className="ws-check"><input type="checkbox" disabled={dis} checked={limits[k]} onChange={(e) => setLimits({ ...limits, [k]: e.target.checked })} /> {r.limitFields[k]}</label>
          ))}
          <div className="ws-note" style={{ marginBottom: 0 }}><ShieldCheck /><span>{r.optOut}</span></div>
        </div>
      </section>

      <section className="ws-section">
        <div className="ws-section-head"><h3>{r.escalation}</h3></div>
        <div className="ws-card ws-form">
          {ESCALATIONS.map((e) => (
            <label key={e} className="ws-check">
              <input type="checkbox" disabled={dis || FORCED_ESCALATIONS.includes(e)} checked={esc[e]} onChange={(ev) => setEsc({ ...esc, [e]: ev.target.checked })} /> {r.escalations[e]}
            </label>
          ))}
        </div>
      </section>

      <section className="ws-section">
        <div className="ws-section-head"><div><h3>{r.guidelines}</h3><p>{r.guidelinesHint}</p></div></div>
        <div className="ws-card">
          <textarea className="form-input" style={{ width: "100%" }} rows={6} maxLength={6000} disabled={dis} placeholder={r.guidelinesPh} aria-label={r.guidelines} value={guidelines} onChange={(e) => setGuidelines(e.target.value)} dir="auto" />
        </div>
      </section>

      {manage && (
        <div className="ws-actions">
          <button className="btn-primary" type="button" disabled={pending} onClick={() => run(() => saveAiSettings({ permissions: perms, limits, escalation: esc, guidelines }), { success: t.ws.common.saved })}>{t.ws.common.save}</button>
        </div>
      )}
    </>
  );
}
