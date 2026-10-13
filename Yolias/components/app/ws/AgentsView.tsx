"use client";

import { useState } from "react";
import Link from "next/link";
import { Bot, Check, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { saveAiSettings } from "@/app/(app)/ai/actions";
import { decideApproval } from "@/app/(app)/crm/actions";
import { AGENTS, AGENT_ACTIONS, type AgentKey, type AiSettings } from "@/lib/ai-workspace/settings";
import { useRun } from "./bits";
import { dateTime } from "./format";
import type { Json } from "@/types/database";

// Which agents use an LLM (they need Yolias AI connected) and which also
// depend on an integration Yolias doesn't have (sending, calendars).
const NEEDS_AI: Record<AgentKey, boolean> = { research: true, outreach: true, replies: true, follow_up: false, meeting: true, crm: false };
const NEEDS_INTEGRATION: Record<AgentKey, boolean> = { research: false, outreach: true, replies: true, follow_up: false, meeting: true, crm: false };

export function AgentsView({ settings, manage, aiConnected, approvals, timeZone }: {
  settings: AiSettings; manage: boolean; aiConnected: boolean; timeZone: string | null;
  approvals: { id: string; leadId: string; leadName: string; agent: string | null; tool: string; input: Json; summary: string; createdAt: string }[];
}) {
  const { t, locale } = useI18n();
  const a = t.ws.ai.agents;
  const { run, pending } = useRun();
  const [instructions, setInstructions] = useState(Object.fromEntries(AGENTS.map((k) => [k, settings.agents[k].instructions])) as Record<AgentKey, string>);

  return (
    <>
      <section className="ws-section">
        <div className="ws-section-head"><h3>{a.pending}</h3></div>
        {!approvals.length ? <div className="ws-empty">{a.noPending}</div> : (
          <div className="ws-card ws-list">
            {approvals.map((x) => (
              <div key={x.id} className="ws-list-row">
                <div>
                  <Link className="ws-link" href={`/crm/${x.leadId}`}>{x.leadName}</Link>
                  <span className="cell-sub">
                    {x.tool === "crm.set_stage" ? `${t.ws.crm.moveTo}: ${t.ws.stages[(x.input as { stage?: string })?.stage as keyof typeof t.ws.stages] ?? ""}` : x.tool}
                    {" · "}{x.agent && x.agent !== "automation" ? a.list[x.agent as AgentKey]?.name : t.ws.nav.automations} · {dateTime(x.createdAt, locale, timeZone)}
                  </span>
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

      <div className="agent-grid">
        {AGENTS.map((k) => {
          const info = a.list[k];
          const on = settings.agents[k].enabled;
          return (
            <article key={k} className={`agent-card${on ? "" : " off"}`}>
              <div className="agent-card-head">
                <strong><Bot /> {info.name}</strong>
                <label className="switch" title={on ? a.enabled : a.disabled}>
                  <input type="checkbox" checked={on} disabled={!manage || pending} aria-label={info.name}
                    onChange={(e) => run(() => saveAiSettings({ agents: { [k]: { enabled: e.target.checked, instructions: instructions[k] } } }), { success: t.ws.common.saved })} />
                  <span className="slider" />
                </label>
              </div>
              <p>{info.desc}</p>
              <dl className="agent-io">
                <dt>{a.inputs}</dt><dd>{info.inputs}</dd>
                <dt>{a.outputs}</dt><dd>{info.outputs}</dd>
                <dt>{a.actions}</dt>
                <dd>{AGENT_ACTIONS[k].map((act) => `${t.ws.ai.rules.actions[act]} (${t.ws.ai.rules.modes[settings.permissions[k][act] ?? "approve"]})`).join(" · ")}</dd>
              </dl>
              <div className="ws-inline">
                {NEEDS_AI[k] && !aiConnected ? <span className="ws-chip red">{a.status.needsAi}</span> : <span className="ws-chip green">{a.status.live}</span>}
                {NEEDS_INTEGRATION[k] && <span className="ws-chip">{a.status.needsIntegration}</span>}
              </div>
              <div className="ws-field">
                <label className="ws-label" htmlFor={`ag-${k}`}>{a.instructions}</label>
                <textarea id={`ag-${k}`} className="form-input" rows={2} maxLength={2000} disabled={!manage} placeholder={a.instructionsPh} value={instructions[k]} onChange={(e) => setInstructions({ ...instructions, [k]: e.target.value })} dir="auto" />
              </div>
              <div className="ws-actions">
                <Link className="ws-link ws-muted" href="/ai/rules">{a.permissionsLink}</Link>
                {manage && <button className="btn-secondary ws-btn-sm" type="button" disabled={pending || instructions[k] === settings.agents[k].instructions}
                  onClick={() => run(() => saveAiSettings({ agents: { [k]: { enabled: on, instructions: instructions[k] } } }), { success: t.ws.common.saved })}>{t.ws.common.save}</button>}
              </div>
            </article>
          );
        })}
      </div>
      {!manage && <p className="ws-muted" style={{ marginTop: 12 }}>{t.ws.common.onlyManagers}</p>}
    </>
  );
}
