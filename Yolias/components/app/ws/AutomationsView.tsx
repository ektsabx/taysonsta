"use client";

import { useState } from "react";
import Link from "next/link";
import { Info, Pencil, Plus, Trash2, Workflow } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { deleteAutomation, saveAutomation, setAutomationEnabled } from "@/app/(app)/ai/actions";
import { ACTION_TYPES, REPLY_KINDS, STAGES, TEMPLATES, actionSchema, conditionsSchema, type AutomationAction, type AutomationInput, type Conditions } from "@/lib/automations/schema";
import { useRun } from "./bits";
import { dateTime } from "./format";
import type { AutomationRow, AutomationRunRow, AutomationTrigger } from "@/types/database";

type Editing = AutomationInput & { id?: string };

export function AutomationsView({ manage, automations, runs, timeZone }: {
  manage: boolean; automations: AutomationRow[]; runs: (AutomationRunRow & { leadName: string | null })[]; timeZone: string | null;
}) {
  const { t, locale } = useI18n();
  const a = t.ws.ai.automations;
  const { run, pending } = useRun();
  const [editing, setEditing] = useState<Editing | null>(null);
  const live = automations.filter((x) => !x.deleted_at);
  const names = new Map(automations.map((x) => [x.id, x.name]));
  const describe = (x: AutomationRow) => {
    const acts = (Array.isArray(x.actions) ? x.actions : []).map((r) => actionSchema.safeParse(r)).filter((r) => r.success).map((r) => a.actionTypes[r.data!.type]);
    return `${a.triggers[x.trigger]} → ${acts.join(", ")}`;
  };

  return (
    <>
      {!manage && <div className="ws-note"><Info /><span>{t.ws.common.onlyManagers}</span></div>}
      <section className="ws-section">
        <div className="ws-section-head">
          <h3>{a.title}</h3>
          {manage && !editing && <button className="btn-primary ws-btn-sm" type="button" onClick={() => setEditing({ name: "", trigger: "lead.stage_changed", conditions: {}, actions: [{ type: "create_task", title: "", due_in_days: 1, kind: "follow_up" }], enabled: true })}><Plus size={13} /> {a.new}</button>}
        </div>
        {editing && <Editor value={editing} onCancel={() => setEditing(null)} onSaved={() => setEditing(null)} />}
        {!live.length && !editing ? <div className="ws-empty">{a.empty}</div> : (
          <div className="ws-card ws-list">
            {live.map((x) => {
              const count = runs.filter((r) => r.automation_id === x.id).length;
              const last = runs.find((r) => r.automation_id === x.id);
              return (
                <div key={x.id} className="ws-list-row">
                  <div>
                    <strong><Workflow size={13} /> {x.name}</strong>
                    <span className="cell-sub">{describe(x)}</span>
                    <span className="cell-sub">{a.runs}: {count}{last ? ` · ${a.lastRun}: ${a.runStatus[last.status]} · ${dateTime(last.created_at, locale, timeZone)}` : ""}</span>
                  </div>
                  <span className="ws-inline">
                    <label className="switch" title={a.enabled}>
                      <input type="checkbox" checked={x.enabled} disabled={!manage || pending} aria-label={`${a.enabled}: ${x.name}`} onChange={(e) => run(() => setAutomationEnabled(x.id, e.target.checked))} />
                      <span className="slider" />
                    </label>
                    {manage && <button className="ws-icon-btn" type="button" aria-label={t.ws.common.edit} onClick={() => setEditing({ id: x.id, name: x.name, trigger: x.trigger, conditions: conditionsSchema.safeParse(x.conditions ?? {}).data ?? {}, actions: (x.actions as unknown as AutomationAction[]) ?? [], enabled: x.enabled })}><Pencil /></button>}
                    {manage && <button className="ws-icon-btn" type="button" aria-label={t.ws.common.delete} disabled={pending} onClick={() => { if (confirm(t.ws.common.confirmDelete)) run(() => deleteAutomation(x.id), { success: a.deleted }); }}><Trash2 /></button>}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {manage && (
        <section className="ws-section">
          <div className="ws-section-head"><h3>{a.templates}</h3></div>
          <div className="agent-grid">
            {TEMPLATES.map((tpl) => (
              <article key={tpl.key} className="agent-card">
                <strong>{a.templateNames[tpl.key as keyof typeof a.templateNames]}</strong>
                <p>{a.triggers[tpl.input.trigger]}{tpl.input.conditions.to_stages ? ` (${tpl.input.conditions.to_stages.map((s) => t.ws.stages[s]).join(", ")})` : ""} → {tpl.input.actions.map((x) => a.actionTypes[x.type]).join(", ")}</p>
                <div className="ws-actions"><button className="btn-secondary ws-btn-sm" type="button" onClick={() => setEditing({ ...structuredClone(tpl.input), name: a.templateNames[tpl.key as keyof typeof a.templateNames] })}>{a.useTemplate}</button></div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="ws-section">
        <div className="ws-section-head"><h3>{a.history}</h3></div>
        <div className="data-table-card">
          <div className="data-table-scroll">
            <table className="data-table">
              <thead><tr><th>{a.name}</th><th>{t.ws.crm.cols.name}</th><th>{a.trigger}</th><th>{t.ws.outreach.colStatus}</th><th>{t.ws.crm.cols.lastActivity}</th></tr></thead>
              <tbody>
                {!runs.length && <tr><td colSpan={5} className="empty-cell">{a.noRuns}</td></tr>}
                {runs.map((r) => (
                  <tr key={r.id}>
                    <td>{names.get(r.automation_id) ?? "—"}</td>
                    <td>{r.lead_id && r.leadName ? <Link className="ws-link" href={`/crm/${r.lead_id}`}>{r.leadName}</Link> : "—"}</td>
                    <td className="cell-sub">{a.triggers[r.trigger]}</td>
                    <td><span className={`ws-chip ${r.status === "succeeded" ? "green" : r.status === "failed" ? "red" : ""}`}>{a.runStatus[r.status]}</span>{r.error && <span className="cell-sub">{r.error}</span>}</td>
                    <td className="cell-sub">{dateTime(r.created_at, locale, timeZone)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </>
  );
}

function Editor({ value, onCancel, onSaved }: { value: Editing; onCancel: () => void; onSaved: () => void }) {
  const { t } = useI18n();
  const a = t.ws.ai.automations;
  const { run, pending } = useRun();
  const [v, setV] = useState<Editing>(value);
  const setCond = (patch: Partial<Conditions>) => setV({ ...v, conditions: { ...v.conditions, ...patch } });
  const setAction = (i: number, next: AutomationAction) => setV({ ...v, actions: v.actions.map((x, j) => (j === i ? next : x)) });
  const blank = (type: AutomationAction["type"]): AutomationAction =>
    type === "create_task" ? { type, title: "", due_in_days: 1, kind: "follow_up" } : type === "notify" ? { type, title: "" } : type === "add_note" ? { type, text: "" } : type === "set_stage" ? { type, stage: "interested" } : { type };
  const toggle = <T extends string>(list: T[] | undefined, item: T) => (list?.includes(item) ? list.filter((x) => x !== item) : [...(list ?? []), item]);
  const stageTrigger = v.trigger === "lead.stage_changed";

  return (
    <div className="ws-card ws-form" style={{ marginBottom: 12 }}>
      <div className="ws-grid-2">
        <div className="ws-field"><label className="ws-label" htmlFor="au-name">{a.name}</label><input id="au-name" className="form-input" maxLength={160} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></div>
        <div className="ws-field">
          <label className="ws-label" htmlFor="au-trigger">{a.trigger}</label>
          <select id="au-trigger" className="form-select" value={v.trigger} onChange={(e) => setV({ ...v, trigger: e.target.value as AutomationTrigger, conditions: {} })}>
            {(Object.keys(a.triggers) as AutomationTrigger[]).map((x) => <option key={x} value={x}>{a.triggers[x]}</option>)}
          </select>
        </div>
      </div>
      <div className="ws-field">
        <span className="ws-label">{a.conditions} <span className="field-optional">{t.ws.common.optional}</span></span>
        {stageTrigger && (
          <>
            <span className="ws-hint">{a.cond.to_stages}</span>
            <div className="chip-toggle">{STAGES.map((s) => <button key={s} type="button" className={v.conditions.to_stages?.includes(s) ? "on" : ""} aria-pressed={Boolean(v.conditions.to_stages?.includes(s))} onClick={() => setCond({ to_stages: toggle(v.conditions.to_stages, s) })}>{t.ws.stages[s]}</button>)}</div>
            <span className="ws-hint">{a.cond.from_stages}</span>
            <div className="chip-toggle">{STAGES.map((s) => <button key={s} type="button" className={v.conditions.from_stages?.includes(s) ? "on" : ""} aria-pressed={Boolean(v.conditions.from_stages?.includes(s))} onClick={() => setCond({ from_stages: toggle(v.conditions.from_stages, s) })}>{t.ws.stages[s]}</button>)}</div>
            <label className="ws-hint" htmlFor="au-min">{a.cond.min_deal_value}</label>
            <input id="au-min" type="number" min={0} className="form-input" style={{ maxWidth: 200 }} value={v.conditions.min_deal_value ?? ""} onChange={(e) => setCond({ min_deal_value: e.target.value === "" ? undefined : Math.max(0, Number(e.target.value)) })} />
          </>
        )}
        {v.trigger === "reply.received" && (
          <>
            <span className="ws-hint">{a.cond.reply_kinds}</span>
            <div className="chip-toggle">{REPLY_KINDS.map((k) => <button key={k} type="button" className={v.conditions.reply_kinds?.includes(k) ? "on" : ""} aria-pressed={Boolean(v.conditions.reply_kinds?.includes(k))} onClick={() => setCond({ reply_kinds: toggle(v.conditions.reply_kinds, k) })}>{t.ws.inbox.reply.kind[k]}</button>)}</div>
          </>
        )}
        {!stageTrigger && v.trigger !== "reply.received" && <span className="ws-muted">—</span>}
      </div>
      <div className="ws-field">
        <span className="ws-label">{a.actionsLabel}</span>
        {v.actions.map((act, i) => (
          <div key={i} className="automation-action">
            <select className="form-select" aria-label={a.actionsLabel} value={act.type} onChange={(e) => setAction(i, blank(e.target.value as AutomationAction["type"]))}>
              {ACTION_TYPES.map((x) => <option key={x} value={x}>{a.actionTypes[x]}</option>)}
            </select>
            <div className="ws-inline">
              {(act.type === "create_task" || act.type === "notify") && <input className="form-input" style={{ flex: 1, minWidth: 160 }} aria-label={a.actionFields.title} placeholder={a.actionFields.title} maxLength={300} value={act.title} onChange={(e) => setAction(i, { ...act, title: e.target.value })} />}
              {act.type === "create_task" && <input type="number" min={0} max={90} className="form-input" style={{ width: 110 }} aria-label={a.actionFields.due} title={a.actionFields.due} value={act.due_in_days} onChange={(e) => setAction(i, { ...act, due_in_days: Math.max(0, Math.min(90, Number(e.target.value) || 0)) })} />}
              {act.type === "add_note" && <input className="form-input" style={{ flex: 1, minWidth: 160 }} aria-label={a.actionFields.text} placeholder={a.actionFields.text} maxLength={1000} value={act.text} onChange={(e) => setAction(i, { ...act, text: e.target.value })} />}
              {act.type === "set_stage" && (
                <>
                  <select className="form-select" aria-label={a.actionFields.stage} value={act.stage} onChange={(e) => setAction(i, { ...act, stage: e.target.value as typeof act.stage })}>{STAGES.map((s) => <option key={s} value={s}>{t.ws.stages[s]}</option>)}</select>
                  <span className="ws-hint">{a.setStageNote}</span>
                </>
              )}
            </div>
            <button className="ws-icon-btn" type="button" aria-label={t.ws.common.delete} disabled={v.actions.length <= 1} onClick={() => setV({ ...v, actions: v.actions.filter((_, j) => j !== i) })}><Trash2 /></button>
          </div>
        ))}
        {v.actions.length < 5 && <button className="btn-secondary ws-btn-sm" type="button" style={{ alignSelf: "flex-start" }} onClick={() => setV({ ...v, actions: [...v.actions, blank("create_task")] })}><Plus size={13} /> {a.addAction}</button>}
      </div>
      <label className="ws-check"><input type="checkbox" checked={v.enabled} onChange={(e) => setV({ ...v, enabled: e.target.checked })} /> {a.enabled}</label>
      <div className="ws-actions">
        <button className="btn-secondary" type="button" onClick={onCancel}>{t.ws.common.cancel}</button>
        <button className="btn-primary" type="button" disabled={pending} onClick={() => run(() => saveAutomation(v), { success: t.ws.common.saved, onOk: onSaved })}>{t.ws.common.save}</button>
      </div>
    </div>
  );
}
