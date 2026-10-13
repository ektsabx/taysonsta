"use client";

import { useState } from "react";
import Link from "next/link";
import { Bot, Check, ChevronDown, Info, ShieldCheck, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { saveAiSettings } from "@/app/(app)/ai/actions";
import { decideApproval } from "@/app/(app)/crm/actions";
import { AGENTS, AGENT_ACTIONS, ESCALATIONS, FORCED_ESCALATIONS, MODES, type AgentKey, type AiSettings, type Limits, type Mode } from "@/lib/ai-workspace/settings";
import { useRun } from "./bits";
import { dateTime } from "./format";
import type { Json } from "@/types/database";

// AI Workspace → AI Agent (D-205): ONE agent the member works with and gives a
// customer-acquisition goal. Research, outreach, replies, follow-up, meetings
// and CRM are its capabilities — each can be switched off, given its own
// instructions and permissions — and the rules (limits, escalation,
// guidelines) are part of the agent's settings, not a separate page.
// Everything is enforced on the server (lib/ai-workspace/settings.ts).

const NEEDS_AI: Record<AgentKey, boolean> = { research: true, outreach: true, replies: true, follow_up: false, meeting: true, crm: false };
const NEEDS_INTEGRATION: Record<AgentKey, boolean> = { research: false, outreach: true, replies: true, follow_up: false, meeting: true, crm: false };
const NUMBER_LIMITS = ["max_messages_per_lead", "daily_send_limit", "min_gap_hours", "no_recontact_days"] as const;
const BOOL_LIMITS = ["stop_on_reply", "stop_on_meeting"] as const;
const RANGES: Record<(typeof NUMBER_LIMITS)[number], [number, number]> = { max_messages_per_lead: [1, 10], daily_send_limit: [1, 500], min_gap_hours: [1, 720], no_recontact_days: [0, 365] };

export interface Approval { id: string; leadId: string; leadName: string; tool: string; input: Json; summary: string; createdAt: string }

export function AgentSettingsView({ settings, manage, aiConnected, approvals, timeZone }: { settings: AiSettings; manage: boolean; aiConnected: boolean; approvals: Approval[]; timeZone: string | null }) {
  const { t, locale } = useI18n();
  const a = t.ws.ai.agents;
  const r = t.ws.ai.rules;
  const { run, pending } = useRun();
  const [goal, setGoal] = useState(settings.goal);
  const [guidelines, setGuidelines] = useState(settings.guidelines);
  const [caps, setCaps] = useState(settings.agents);
  const [perms, setPerms] = useState(settings.permissions);
  const [limits, setLimits] = useState<Limits>(settings.limits);
  const [esc, setEsc] = useState(settings.escalation);
  const dis = !manage || pending;
  const save = () => run(() => saveAiSettings({ goal, guidelines, agents: caps, permissions: perms, limits, escalation: esc }), { success: t.ws.common.saved });

  return (
    <>
      {!manage && <div className="ws-note"><Info /><span>{t.ws.common.onlyManagers}</span></div>}

      <section className="ws-section">
        <div className="ws-card ws-form">
          <div className="agent-card-head">
            <strong className="agent-main-title"><Bot /> {a.mainName}</strong>
            {aiConnected ? <span className="ws-chip green">{a.status.live}</span> : <span className="ws-chip red">{a.status.needsAi}</span>}
          </div>
          <p className="ws-hint">{a.mainDesc}</p>
          <div className="ws-field">
            <label className="ws-label" htmlFor="agent-goal">{a.goal}</label>
            <p className="ws-hint">{a.goalHint}</p>
            <textarea id="agent-goal" className="form-input" rows={3} maxLength={2000} disabled={dis} placeholder={a.goalPh} value={goal} onChange={(e) => setGoal(e.target.value)} dir="auto" />
          </div>
          <div className="ws-field">
            <label className="ws-label" htmlFor="agent-guidelines">{r.guidelines}</label>
            <p className="ws-hint">{r.guidelinesHint}</p>
            <textarea id="agent-guidelines" className="form-input" rows={4} maxLength={6000} disabled={dis} placeholder={r.guidelinesPh} value={guidelines} onChange={(e) => setGuidelines(e.target.value)} dir="auto" />
          </div>
        </div>
      </section>

      <section className="ws-section">
        <div className="ws-section-head"><h3>{a.pending}</h3></div>
        {!approvals.length ? <div className="ws-empty">{a.noPending}</div> : (
          <div className="ws-card ws-list">
            {approvals.map((x) => (
              <div key={x.id} className="ws-list-row">
                <div>
                  <Link className="ws-link" href={`/crm/${x.leadId}`}>{x.leadName}</Link>
                  <span className="cell-sub">{x.tool === "crm.set_stage" ? `${t.ws.crm.moveTo}: ${t.ws.stages[(x.input as { stage?: string })?.stage as keyof typeof t.ws.stages] ?? ""}` : x.tool} · {dateTime(x.createdAt, locale, timeZone)}</span>
                  <span className="cell-sub">{x.summary}</span>
                </div>
                <span className="ws-inline">
                  <button className="btn-primary ws-btn-sm" type="button" disabled={pending} onClick={() => run(() => decideApproval(x.id, true), { success: a.approved })}><Check size={13} /> {t.ws.crm.detail.approve}</button>
                  <button className="btn-secondary ws-btn-sm" type="button" disabled={pending} onClick={() => run(() => decideApproval(x.id, false), { success: a.rejected })}><X size={13} /> {t.ws.crm.detail.reject}</button>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="ws-section">
        <div className="ws-section-head"><div><h3>{a.capabilities}</h3><p>{a.capabilitiesHint}</p></div></div>
        <div className="ws-card ws-list capability-list">
          {AGENTS.map((k) => {
            const info = a.list[k];
            const on = caps[k].enabled;
            return (
              <details key={k} className={`capability${on ? "" : " off"}`}>
                <summary>
                  <span className="capability-name"><ChevronDown className="capability-chevron" aria-hidden="true" /><strong>{info.name}</strong></span>
                  <span className="ws-inline">
                    {NEEDS_AI[k] && !aiConnected && <span className="ws-chip red">{a.status.needsAi}</span>}
                    {NEEDS_INTEGRATION[k] && <span className="ws-chip">{a.status.needsIntegration}</span>}
                    <label className="switch" title={on ? a.enabled : a.disabled} onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={on} disabled={dis} aria-label={info.name} onChange={(e) => setCaps({ ...caps, [k]: { ...caps[k], enabled: e.target.checked } })} />
                      <span className="slider" />
                    </label>
                  </span>
                </summary>
                <div className="capability-body">
                  <p className="ws-hint">{info.desc}</p>
                  <dl className="agent-io">
                    <dt>{a.inputs}</dt><dd>{info.inputs}</dd>
                    <dt>{a.outputs}</dt><dd>{info.outputs}</dd>
                  </dl>
                  {AGENT_ACTIONS[k].map((act) => (
                    <div key={act} className="perm-row">
                      <label htmlFor={`perm-${k}-${act}`}>{r.actions[act]}</label>
                      <select id={`perm-${k}-${act}`} className="form-select" disabled={dis} value={perms[k][act] ?? "approve"}
                        onChange={(e) => setPerms({ ...perms, [k]: { ...perms[k], [act]: e.target.value as Mode } })}>
                        {MODES.map((m) => <option key={m} value={m}>{r.modes[m]}</option>)}
                      </select>
                    </div>
                  ))}
                  <div className="ws-field">
                    <label className="ws-label" htmlFor={`cap-${k}`}>{a.instructions} <span className="field-optional">{t.ws.common.optional}</span></label>
                    <textarea id={`cap-${k}`} className="form-input" rows={2} maxLength={2000} disabled={dis} placeholder={a.instructionsPh} value={caps[k].instructions} onChange={(e) => setCaps({ ...caps, [k]: { ...caps[k], instructions: e.target.value } })} dir="auto" />
                  </div>
                </div>
              </details>
            );
          })}
        </div>
        <p className="ws-hint" style={{ marginTop: 8 }}>{r.sendNote}</p>
      </section>

      <section className="ws-section" id="rules">
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

      {manage && (
        <div className="ws-actions agent-save">
          <button className="btn-primary" type="button" disabled={pending} onClick={save}>{t.ws.common.save}</button>
        </div>
      )}
    </>
  );
}
