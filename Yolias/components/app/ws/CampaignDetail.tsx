"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Info, Pause, Play, Sparkles, Trash2, UserPlus, Archive, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { enrollInCampaign, prepareCampaignDrafts, removeEnrollment, setOutreachStatus } from "@/app/(app)/outreach/actions";
import { StageBadge, useRun } from "./bits";
import { CampaignForm } from "./CampaignForm";
import { dateTime } from "./format";
import type { OutreachDetail } from "@/services/outreach-campaigns";
import type { LeadStage, MessageObjective } from "@/types/database";

interface Props {
  detail: OutreachDetail;
  options: { profiles: { id: string; name: string; is_default: boolean }[]; offers: { id: string; name: string }[] };
  maxSteps: number;
  candidates: { id: string; name: string; company_name: string | null; stage: LeadStage; do_not_contact: boolean }[];
  timeZone: string | null;
}

export function CampaignDetailView({ detail, options, maxSteps, candidates, timeZone }: Props) {
  const { t, locale } = useI18n();
  const o = t.ws.outreach;
  const { run, pending } = useRun();
  const { campaign: c, stats } = detail;
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const archived = c.status === "archived";

  return (
    <div className="page-view">
      <header className="view-header">
        <div className="view-title-group">
          <Link className="detail-back" href="/outreach"><ArrowLeft className="flip-rtl" /> {o.title}</Link>
          <h2>{c.name}</h2>
          <p>{[o.status[c.status], o.channels[c.channel], c.goal].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="view-actions">
          {!archived && (c.status === "active"
            ? <button className="btn-secondary" type="button" disabled={pending} onClick={() => run(() => setOutreachStatus(c.id, "paused"))}><Pause size={14} /> {o.actions.pause}</button>
            : <button className="btn-primary" type="button" disabled={pending} onClick={() => run(() => setOutreachStatus(c.id, "active"))}><Play size={14} /> {c.status === "paused" ? o.actions.resume : o.actions.activate}</button>)}
          {!archived && <button className="btn-secondary" type="button" onClick={() => setEditing((e) => !e)}>{t.ws.common.edit}</button>}
          {!archived && <button className="btn-secondary" type="button" disabled={pending} onClick={() => { if (confirm(t.ws.common.confirmDelete)) run(() => setOutreachStatus(c.id, "archived")); }}><Archive size={14} /> {o.actions.archive}</button>}
        </div>
      </header>
      <div className="view-content-padding">
        <div className="ws-note"><Info /><span>{t.ws.common.mailboxNotConnected}</span></div>
        <div className="stat-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
          {(["leads", "drafts", "sent", "replies", "meetings"] as const).map((k) => (
            <div key={k} className="stat-card"><div className="stat-label">{o.stats[k]}</div><div className="stat-value">{stats[k]}</div></div>
          ))}
        </div>
        {stats.sent === 0 && <p className="ws-muted" style={{ marginTop: -12, marginBottom: 16 }}>{o.stats.noData}</p>}

        {editing && (
          <section className="ws-section">
            <CampaignForm profiles={options.profiles} offers={options.offers} maxSteps={maxSteps} onSaved={() => setEditing(false)}
              initial={{
                id: c.id, name: c.name, goal: c.goal ?? "", description: c.description ?? "", channel: c.channel, language: c.language, tone: c.tone,
                customer_profile_id: c.customer_profile_id, offer_id: c.offer_id,
                steps: detail.steps.map((s) => ({ delay_days: s.delay_days, objective: s.objective as MessageObjective, instruction: s.instruction ?? "" })),
              }} />
          </section>
        )}

        {!editing && (
          <section className="ws-section">
            <div className="ws-card">
              <h3 className="ws-label" style={{ marginBottom: 8 }}>{o.form.steps}</h3>
              <ol className="ws-timeline">
                {detail.steps.map((s) => (
                  <li key={s.id}>
                    <strong>{fmt(o.form.step, { n: s.position })} · {o.objectives[s.objective as MessageObjective]}</strong>
                    {s.position > 1 && <span className="ws-muted"> · +{s.delay_days} {o.form.delay}</span>}
                    {s.instruction && <div className="ws-tl-body">{s.instruction}</div>}
                  </li>
                ))}
              </ol>
            </div>
          </section>
        )}

        <section className="ws-section">
          <div className="ws-section-head">
            <h3>{o.leadsTitle}</h3>
            {!archived && (
              <div className="ws-inline">
                <button className="btn-secondary" type="button" onClick={() => setAdding(true)}><UserPlus size={14} /> {o.actions.addLeads}</button>
                <button className="btn-primary" type="button" disabled={pending || !detail.enrollments.length} onClick={() => run(() => prepareCampaignDrafts(c.id))}><Sparkles size={14} /> {pending ? o.actions.preparing : o.actions.prepare}</button>
              </div>
            )}
          </div>
          <div className="data-table-card">
            <div className="data-table-scroll">
              <table className="data-table">
                <thead><tr><th>{o.colLead}</th><th>{t.ws.crm.cols.stage}</th><th>{o.colStep}</th><th>{o.colEnroll}</th><th>{o.colLast}</th><th>{o.colNext}</th><th /></tr></thead>
                <tbody>
                  {!detail.enrollments.length && <tr><td colSpan={7} className="empty-cell">{o.noLeads}</td></tr>}
                  {detail.enrollments.map((e) => (
                    <tr key={e.id}>
                      <td>
                        {e.lead ? <Link className="entity-link" href={`/inbox?lead=${e.lead.id}`}><strong>{e.lead.name}</strong><span className="cell-sub">{e.lead.company_name !== e.lead.name ? e.lead.company_name : e.lead.email}</span></Link> : "—"}
                        {e.lead?.do_not_contact && <span className="ws-chip red">{t.ws.crm.detail.dnc}</span>}
                      </td>
                      <td>{e.lead ? <StageBadge stage={e.lead.stage} /> : "—"}</td>
                      <td>{e.current_step} / {detail.steps.length}</td>
                      <td><span className="ws-chip">{o.enrollStatus[e.status]}</span>{e.stop_reason && <span className="cell-sub">{e.stop_reason}</span>}</td>
                      <td className="cell-sub">{e.last ? `${t.ws.messages.status[e.last.status as keyof typeof t.ws.messages.status]} · ${dateTime(e.last.at, locale, timeZone)}` : "—"}</td>
                      <td className="cell-sub">{dateTime(e.next_step_at, locale, timeZone)}</td>
                      <td>{!archived && <button className="ws-icon-btn" type="button" aria-label={o.actions.remove} title={o.actions.remove} disabled={pending} onClick={() => run(() => removeEnrollment(e.id))}><Trash2 /></button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
      {adding && <AddLeadsDialog campaignId={c.id} candidates={candidates} onClose={() => setAdding(false)} />}
    </div>
  );
}

function AddLeadsDialog({ campaignId, candidates, onClose }: { campaignId: string; candidates: Props["candidates"]; onClose: () => void }) {
  const { t } = useI18n();
  const o = t.ws.outreach;
  const { run, pending } = useRun();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const shown = candidates.filter((c) => !q || `${c.name} ${c.company_name ?? ""}`.toLowerCase().includes(q.toLowerCase()));
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ws-modal" role="dialog" aria-modal="true" aria-labelledby="add-leads-title">
        <div className="ws-modal-head">
          <h3 id="add-leads-title">{o.addLeadsTitle}</h3>
          <button className="modal-close-btn" type="button" aria-label={t.common.close} onClick={onClose}><X /></button>
        </div>
        {!candidates.length ? <p className="ws-muted">{o.addLeadsEmpty} <Link className="ws-link" href="/prospects">{t.nav.prospects}</Link></p> : (
          <>
            <input className="form-input" placeholder={t.ws.common.search} aria-label={t.ws.common.search} value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="ws-pick-list">
              {shown.map((c) => (
                <label key={c.id}>
                  <input type="checkbox" checked={picked.has(c.id)} disabled={c.do_not_contact} onChange={() => toggle(c.id)} />
                  <span>{c.name}<span className="cell-sub">{[c.company_name !== c.name ? c.company_name : null, t.ws.stages[c.stage], c.do_not_contact ? t.ws.crm.detail.dnc : null].filter(Boolean).join(" · ")}</span></span>
                </label>
              ))}
            </div>
            <div className="ws-actions">
              <button className="btn-secondary" type="button" onClick={onClose}>{t.ws.common.cancel}</button>
              <button className="btn-primary" type="button" disabled={pending || !picked.size} onClick={() => run(() => enrollInCampaign(campaignId, [...picked]), { onOk: onClose })}>{fmt(o.addSelected, { count: picked.size })}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
