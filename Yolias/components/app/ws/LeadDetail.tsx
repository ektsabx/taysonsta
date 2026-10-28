"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarPlus, Check, FileText, Inbox, PenLine, ShieldAlert, Trash2, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { addNote, addTask, decideApproval, prepareMeetingBrief, removeLead, saveMeeting, setTaskDone, updateLead } from "@/app/(app)/crm/actions";
import { StageSelect, useRun } from "./bits";
import { dateTime, fromLocalInput, money, toLocalInput } from "./format";
import type { LeadDetail } from "@/services/crm";
import type { Fit } from "@/lib/agents/research";
import type { LeadActivityRow, MeetingRow, MeetingStatus } from "@/types/database";

interface Props {
  detail: LeadDetail;
  fit: (Fit & { profileName: string }) | null;
  members: { id: string; name: string }[];
  canDelete: boolean;
  timeZone: string | null;
}

/** "Add to Google Calendar" for a meeting (owner, 2026-10-29): opens a prefilled event, no calendar connection needed. */
function googleCalendarUrl(m: MeetingRow, leadName: string): string {
  const f = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const end = m.ends_at ?? new Date(Date.parse(m.starts_at) + 30 * 60_000).toISOString();
  const q = new URLSearchParams({ action: "TEMPLATE", text: m.title || leadName, dates: `${f(m.starts_at)}/${f(end)}`, details: [leadName, m.url ?? "", m.notes ?? ""].filter(Boolean).join("\n") });
  if (m.url) q.set("location", m.url);
  return `https://calendar.google.com/calendar/render?${q}`;
}

export function LeadDetailView({ detail, fit, members, canDelete, timeZone }: Props) {
  const { t, locale } = useI18n();
  const c = t.ws.crm;
  const d = c.detail;
  const router = useRouter();
  const { run, pending } = useRun();
  const { lead } = detail;
  const [value, setValue] = useState(lead.deal_value == null ? "" : String(lead.deal_value));
  const [currency, setCurrency] = useState(lead.deal_currency);
  const [closeAt, setCloseAt] = useState(lead.expected_close_at ?? "");
  const [note, setNote] = useState("");
  const [task, setTask] = useState("");
  const [due, setDue] = useState("");
  const [meeting, setMeeting] = useState<Partial<MeetingRow> | null>(null);
  const [brief, setBrief] = useState<string | null>(null);
  const activityText = (a: LeadActivityRow) => {
    const meta = (a.meta ?? {}) as Record<string, unknown>;
    if (a.kind === "stage_changed") return fmt(c.activity.stage_changed, { from: t.ws.stages[meta.from as keyof typeof t.ws.stages] ?? "", to: t.ws.stages[meta.to as keyof typeof t.ws.stages] ?? "" });
    if (a.kind === "deal_updated") return fmt(c.activity.deal_updated, { value: money(meta.value as number | null, String(meta.currency ?? "USD"), locale) });
    return c.activity[a.kind];
  };

  return (
    <div className="page-view">
      <header className="view-header">
        <div className="view-title-group">
          <Link className="detail-back" href="/crm"><ArrowLeft className="flip-rtl" /> {c.title}</Link>
          <h2>{lead.name}</h2>
          <p>{[lead.job_title, lead.company_name !== lead.name ? lead.company_name : null].filter(Boolean).join(" · ") || c.sources[lead.source]}</p>
        </div>
        <div className="view-actions">
          {lead.do_not_contact && <span className="ws-chip red"><ShieldAlert /> {d.dnc}</span>}
          <StageSelect leadId={lead.id} stage={lead.stage} />
          <Link className="btn-secondary" href={`/inbox?lead=${lead.id}`}><Inbox size={14} /> {d.openInInbox}</Link>
          <Link className="btn-secondary" href={`/crm/${lead.id}/quote`}><FileText size={14} /> {t.quote.open}</Link>
        </div>
      </header>
      <div className="view-content-padding">
        <div className="lead-layout">
          <div>
            {detail.approvals.length > 0 && (
              <section className="ws-card">
                <h3 className="ws-label">{d.approvals}</h3>
                {detail.approvals.map((a) => (
                  <div key={a.id} className="ws-list-row">
                    <div>
                      <strong>{a.tool === "crm.set_stage" ? `${c.moveTo}: ${t.ws.stages[(a.input as { stage?: string })?.stage as keyof typeof t.ws.stages] ?? ""}` : a.tool}</strong>
                      <span className="cell-sub">{a.summary}</span>
                    </div>
                    <span className="ws-inline">
                      <button className="btn-primary ws-btn-sm" type="button" disabled={pending} onClick={() => run(() => decideApproval(a.id, true), { success: t.ws.ai.agents.approved })}><Check size={13} /> {d.approve}</button>
                      <button className="btn-secondary ws-btn-sm" type="button" disabled={pending} onClick={() => run(() => decideApproval(a.id, false), { success: t.ws.ai.agents.rejected })}><X size={13} /> {d.reject}</button>
                    </span>
                  </div>
                ))}
              </section>
            )}

            {/* The CRM manages the deal (owner, 2026-10-21, D-252): the conversation
                itself stays in Conversations, linked from here, never copied. */}
            <section className="ws-section" style={{ marginTop: detail.approvals.length ? 16 : 0 }}>
              <div className="ws-section-head"><h3>{d.summary}</h3></div>
              <div className="ws-card lead-summary">
                <div><span className="ws-label">{c.cols.stage}</span><strong>{t.ws.stages[lead.stage]}{lead.stage === "lost" && lead.lost_reason ? ` · ${c.lostReasons[lead.lost_reason as keyof typeof c.lostReasons] ?? lead.lost_reason}` : ""}</strong></div>
                <div><span className="ws-label">{d.value}</span><strong dir="ltr">{money(lead.deal_value, lead.deal_currency, locale)}</strong></div>
                <div><span className="ws-label">{d.lastContact}</span><strong>{lead.thread_last_message_at ? dateTime(lead.thread_last_message_at, locale, timeZone) : "-"}</strong></div>
                <div><span className="ws-label">{d.nextStep}</span><strong>{lead.next_meeting_at ? `${d.meetings}: ${dateTime(lead.next_meeting_at, locale, timeZone)}` : lead.next_follow_up_at ? `${c.cols.followUp}: ${dateTime(lead.next_follow_up_at, locale, timeZone)}` : "-"}</strong></div>
              </div>
              <div className="ws-card lead-conversation">
                <div>
                  <strong>{d.conversation}</strong>
                  <span className="cell-sub">{detail.messages.length
                    ? fmt(d.conversationCounts, { sent: detail.messages.filter((m) => m.direction === "outbound" && m.status === "sent").length, replies: detail.messages.filter((m) => m.direction === "inbound").length })
                    : d.noMessages}</span>
                </div>
                <Link className="btn-secondary ws-btn-sm" href={`/inbox?lead=${lead.id}`}><Inbox size={13} /> {d.openConversation}</Link>
              </div>
              {/* One page per lead (owner, 2026-10-29): the latest messages are here; replying happens in Conversations. */}
              {detail.messages.length > 0 && (
                <ol className="lead-thread">
                  {detail.messages.filter((m) => m.status !== "canceled" && m.status !== "draft").slice(-4).map((m) => (
                    <li key={m.id} className={m.direction === "inbound" ? "in" : "out"}>
                      <span className="lead-thread-who">{m.direction === "inbound" ? lead.name : d.you} · {dateTime(m.received_at ?? m.sent_at ?? m.created_at, locale, timeZone)}</span>
                      <p dir="auto">{(m.body ?? "").slice(0, 400)}{(m.body ?? "").length > 400 ? "…" : ""}</p>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <section className="ws-section">
              <div className="ws-section-head"><h3>{d.notes}</h3></div>
              <div className="ws-card ws-form">
                <textarea className="form-input" rows={3} placeholder={d.notePh} aria-label={d.addNote} value={note} maxLength={4000} onChange={(e) => setNote(e.target.value)} dir="auto" />
                <div className="ws-actions"><button className="btn-primary" type="button" disabled={pending || !note.trim()} onClick={() => run(() => addNote(lead.id, note), { onOk: () => setNote(""), success: t.ws.common.saved })}>{d.addNote}</button></div>
              </div>
            </section>

            <section className="ws-section">
              <div className="ws-section-head"><h3>{d.timeline}</h3></div>
              <div className="ws-card">
                {!detail.activities.length ? <p className="ws-muted">{d.noTimeline}</p> : (
                  <ol className="ws-timeline">
                    {detail.activities.map((a) => (
                      <li key={a.id}>
                        <strong>{activityText(a)}</strong> <span className="ws-muted">· {t.ws.common.by[a.actor_kind]}</span>
                        {a.body && <div className="ws-tl-body" dir="auto">{a.body}</div>}
                        <time>{dateTime(a.created_at, locale, timeZone)}</time>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </section>
          </div>

          <aside>
            <section className="ws-card">
              <h3 className="ws-label" style={{ marginBottom: 10 }}>{d.deal}</h3>
              <div className="ws-form">
                <div className="ws-grid-2">
                  <div className="ws-field">
                    <label className="ws-label" htmlFor="deal-value">{d.value}</label>
                    <input id="deal-value" className="form-input" inputMode="decimal" dir="ltr" value={value} onChange={(e) => setValue(e.target.value)} />
                  </div>
                  <div className="ws-field">
                    <label className="ws-label" htmlFor="deal-cur">{d.currency}</label>
                    <input id="deal-cur" className="form-input" dir="ltr" maxLength={3} value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} />
                  </div>
                </div>
                <div className="ws-field">
                  <label className="ws-label" htmlFor="deal-close">{d.expectedClose}</label>
                  <input id="deal-close" type="date" className="form-input" dir="ltr" value={closeAt} onChange={(e) => setCloseAt(e.target.value)} />
                </div>
                <div className="ws-actions">
                  <button className="btn-secondary ws-btn-sm" type="button" disabled={pending}
                    onClick={() => run(() => updateLead(lead.id, { deal_value: value.trim() === "" ? null : Number(value.replace(/,/g, "")), deal_currency: currency, expected_close_at: closeAt || null }), { success: t.ws.common.saved })}>{t.ws.common.save}</button>
                </div>
                <div className="ws-field">
                  <label className="ws-label" htmlFor="lead-owner">{d.owner}</label>
                  <select id="lead-owner" className="form-select" value={lead.owner_id ?? ""} disabled={pending} onChange={(e) => run(() => updateLead(lead.id, { owner_id: e.target.value || null }))}>
                    <option value="">{c.unassigned}</option>
                    {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div className="ws-field">
                  <label className="ws-label" htmlFor="lead-profile">{d.profile}</label>
                  <select id="lead-profile" className="form-select" value={lead.customer_profile_id ?? ""} disabled={pending} onChange={(e) => run(() => updateLead(lead.id, { customer_profile_id: e.target.value || null }))}>
                    <option value="">{t.ws.outreach.form.noProfile}</option>
                    {detail.profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <label className="ws-check">
                  <input type="checkbox" checked={lead.do_not_contact} disabled={pending} onChange={(e) => run(() => updateLead(lead.id, { do_not_contact: e.target.checked }))} />
                  {d.dnc}
                </label>
                <p className="ws-hint">{d.dncHint}</p>
              </div>
            </section>

            <section className="ws-card">
              <h3 className="ws-label" style={{ marginBottom: 10 }}>{d.fit}</h3>
              {!fit ? <p className="ws-muted">{d.noFit} <Link className="ws-link" href="/ai/knowledge?tab=profiles">{t.ws.nav.profiles}</Link></p> : (
                <>
                  <p className="ws-muted" style={{ marginBottom: 6 }}>{fit.profileName}</p>
                  <strong>{fit.score == null ? d.fitUnknown : fmt(d.fitScore, { score: fit.score })}</strong>
                  {fit.checks.map((ch) => (
                    <div key={ch.key} className="fit-row">
                      <span>{d.fitChecks[ch.key]}{ch.detail ? ` · ${ch.detail}` : ""}</span>
                      <span className={`ws-chip ${ch.result === "match" ? "green" : ch.result === "miss" ? "red" : ""}`}>{d.fitResult[ch.result]}</span>
                    </div>
                  ))}
                </>
              )}
              {lead.match_score != null && <p className="ws-muted" style={{ marginTop: 8 }}>{d.matchScore}: {lead.match_score}%</p>}
            </section>

            <section className="ws-card">
              <h3 className="ws-label" style={{ marginBottom: 10 }}>{d.tasks}</h3>
              <div className="ws-list">
                {!detail.tasks.length && <p className="ws-muted">{d.noTasks}</p>}
                {detail.tasks.map((k) => (
                  <label key={k.id} className="ws-list-row ws-check" style={{ justifyContent: "flex-start" }}>
                    <input type="checkbox" checked={Boolean(k.done_at)} disabled={pending} onChange={(e) => run(() => setTaskDone(k.id, e.target.checked))} />
                    <span style={{ textDecoration: k.done_at ? "line-through" : undefined }}>
                      {k.title}
                      <span className="cell-sub">{k.due_at ? `${d.due}: ${dateTime(k.due_at, locale, timeZone)}` : ""}{k.source !== "user" ? ` · ${t.ws.common.by[k.source]}` : ""}</span>
                    </span>
                  </label>
                ))}
              </div>
              <div className="ws-form" style={{ marginTop: 10 }}>
                <input className="form-input" placeholder={d.taskTitle} aria-label={d.taskTitle} value={task} maxLength={300} onChange={(e) => setTask(e.target.value)} />
                <input type="datetime-local" className="form-input" aria-label={d.due} value={due} onChange={(e) => setDue(e.target.value)} />
                <div className="ws-actions"><button className="btn-secondary ws-btn-sm" type="button" disabled={pending || !task.trim()} onClick={() => run(() => addTask(lead.id, task, fromLocalInput(due)), { onOk: () => { setTask(""); setDue(""); } })}>{d.addTask}</button></div>
              </div>
            </section>

            <section className="ws-card">
              <div className="ws-section-head" style={{ marginBottom: 6 }}>
                <h3 className="ws-label">{d.meetings}</h3>
                <button className="btn-secondary ws-btn-sm" type="button" onClick={() => setMeeting({ title: "", status: "scheduled" })}><CalendarPlus size={13} /> {d.addMeeting}</button>
              </div>
              {!detail.meetings.length && <p className="ws-muted">{d.noMeetings}</p>}
              <div className="ws-list">
                {detail.meetings.map((m) => (
                  <div key={m.id} className="ws-list-row">
                    <div>
                      <strong>{m.title}</strong>
                      <span className="cell-sub">{dateTime(m.starts_at, locale, timeZone)} · {c.meeting.statuses[m.status]}</span>
                      {m.url && <a className="ws-link cell-sub" href={m.url} target="_blank" rel="noopener noreferrer" dir="ltr">{m.url.replace(/^https?:\/\//, "").slice(0, 40)}</a>}
                      {m.status === "scheduled" && <a className="ws-link cell-sub" href={googleCalendarUrl(m, lead.name)} target="_blank" rel="noopener noreferrer">{d.addToCalendar}</a>}
                    </div>
                    <span className="ws-inline">
                      <button className="btn-secondary ws-btn-sm" type="button" onClick={() => setMeeting(m)}>{t.ws.common.edit}</button>
                      <button className="btn-secondary ws-btn-sm" type="button" disabled={pending} onClick={() => run(() => prepareMeetingBrief(m.id), { onOk: (r) => setBrief(r.brief) })}><PenLine size={13} /> {pending ? c.meeting.briefing : c.meeting.brief}</button>
                    </span>
                  </div>
                ))}
              </div>
              {brief && <div className="ws-note" style={{ marginTop: 10, whiteSpace: "pre-wrap" }}><PenLine /><div dir="auto">{brief}</div></div>}
            </section>

            <section className="ws-card">
              <h3 className="ws-label" style={{ marginBottom: 10 }}>{d.campaigns}</h3>
              {!detail.enrollments.length ? <p className="ws-muted">{d.noCampaigns}</p> : detail.enrollments.map((e) => (
                <div key={e.id} className="ws-list-row">
                  {e.campaign ? <Link className="ws-link" href={`/outreach/${e.campaign.id}`}>{e.campaign.name}</Link> : <span>-</span>}
                  <span className="ws-chip">{t.ws.outreach.enrollStatus[e.status]}</span>
                </div>
              ))}
            </section>

            {detail.people.length > 0 && (
              <section className="ws-card">
                <h3 className="ws-label" style={{ marginBottom: 10 }}>{d.people}</h3>
                <div className="ws-list">
                  {detail.people.map((p) => (
                    <Link key={p.id} className="ws-list-row" href={`/prospects/person/${p.id}`}>
                      <span><strong dir="auto">{p.full_name}</strong>{p.title && <span className="cell-sub" dir="auto">{p.title}</span>}</span>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            <section className="ws-card">
              <h3 className="ws-label" style={{ marginBottom: 10 }}>{d.contact}</h3>
              <dl className="ws-kv">
                {lead.email && <><dt>{t.setup.contactNames.email}</dt><dd dir="ltr">{lead.email}</dd></>}
                {lead.phone && <><dt>{t.setup.contactNames.phone}</dt><dd dir="ltr">{lead.phone}</dd></>}
                {lead.linkedin_url && <><dt>LinkedIn</dt><dd><a className="ws-link" href={lead.linkedin_url} target="_blank" rel="noopener noreferrer">LinkedIn</a></dd></>}
                {detail.company?.website && <><dt>{t.ws.ai.knowledge.competitor.website}</dt><dd dir="ltr">{detail.company.website}</dd></>}
                {detail.company?.industry && <><dt>{d.fitChecks.industry}</dt><dd>{detail.company.industry}</dd></>}
                {detail.company?.employee_count != null && <><dt>{d.fitChecks.size}</dt><dd>{detail.company.employee_count}</dd></>}
                <dt>{c.cols.source}</dt><dd>{c.sources[lead.source]}</dd>
                <dt>{c.cols.added}</dt><dd>{dateTime(lead.created_at, locale, timeZone)}</dd>
              </dl>
              {(lead.prospect_id || lead.company_id) && (
                <p style={{ marginTop: 10 }}><Link className="ws-link" href={lead.prospect_id ? `/prospects/person/${lead.prospect_id}` : `/prospects/company/${lead.company_id}`}>{t.ws.common.open} →</Link></p>
              )}
            </section>

            {canDelete && (
              <section className="ws-card">
                <p className="ws-hint" style={{ marginBottom: 8 }}>{d.deleteHint}</p>
                <button className="btn-danger-ghost" type="button" disabled={pending} onClick={() => { if (confirm(t.ws.common.confirmDelete)) run(() => removeLead(lead.id), { onOk: () => router.push("/crm"), refresh: false }); }}><Trash2 size={13} /> {d.deleteLead}</button>
              </section>
            )}
          </aside>
        </div>
      </div>
      {meeting && <MeetingDialog leadId={lead.id} meeting={meeting} onClose={() => setMeeting(null)} />}
    </div>
  );
}

function MeetingDialog({ leadId, meeting, onClose }: { leadId: string; meeting: Partial<MeetingRow>; onClose: () => void }) {
  const { t } = useI18n();
  const m = t.ws.crm.meeting;
  const { run, pending } = useRun();
  const [f, setF] = useState({
    title: meeting.title ?? "", starts: toLocalInput(meeting.starts_at), ends: toLocalInput(meeting.ends_at), url: meeting.url ?? "",
    status: (meeting.status ?? "scheduled") as MeetingStatus, notes: meeting.notes ?? "",
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ws-modal" role="dialog" aria-modal="true" aria-labelledby="meeting-title">
        <div className="ws-modal-head">
          <h3 id="meeting-title">{meeting.id ? t.ws.common.edit : t.ws.crm.detail.addMeeting}</h3>
          <button className="modal-close-btn" type="button" aria-label={t.common.close} onClick={onClose}><X /></button>
        </div>
        <div className="ws-form">
          <div className="ws-field"><label className="ws-label" htmlFor="mt-title">{m.title}</label><input id="mt-title" className="form-input" placeholder={m.titlePh} value={f.title} maxLength={200} onChange={set("title")} /></div>
          <div className="ws-grid-2">
            <div className="ws-field"><label className="ws-label" htmlFor="mt-start">{m.startsAt}</label><input id="mt-start" type="datetime-local" className="form-input" value={f.starts} onChange={set("starts")} /></div>
            <div className="ws-field"><label className="ws-label" htmlFor="mt-end">{m.endsAt}</label><input id="mt-end" type="datetime-local" className="form-input" value={f.ends} onChange={set("ends")} /></div>
          </div>
          <div className="ws-field"><label className="ws-label" htmlFor="mt-url">{m.url}</label><input id="mt-url" className="form-input" dir="ltr" placeholder={m.urlPh} value={f.url} onChange={set("url")} /><p className="ws-hint">{m.linkHint}</p></div>
          <div className="ws-field">
            <label className="ws-label" htmlFor="mt-status">{m.status}</label>
            <select id="mt-status" className="form-select" value={f.status} onChange={set("status")}>
              {(["scheduled", "completed", "canceled", "no_show"] as const).map((s) => <option key={s} value={s}>{m.statuses[s]}</option>)}
            </select>
          </div>
          <div className="ws-field"><label className="ws-label" htmlFor="mt-notes">{m.notes}</label><textarea id="mt-notes" className="form-input" rows={4} value={f.notes} maxLength={6000} onChange={set("notes")} dir="auto" /></div>
          <div className="ws-actions">
            <button className="btn-secondary" type="button" onClick={onClose}>{t.ws.common.cancel}</button>
            <button className="btn-primary" type="button" disabled={pending}
              onClick={() => run(() => saveMeeting({ id: meeting.id, lead_id: leadId, title: f.title, starts_at: fromLocalInput(f.starts) ?? "", ends_at: fromLocalInput(f.ends), url: f.url || null, status: f.status, notes: f.notes || null }), { success: m.saved, onOk: onClose })}>
              {t.ws.common.save}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
