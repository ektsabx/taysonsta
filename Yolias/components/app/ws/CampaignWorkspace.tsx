"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArrowLeft, CircleCheck, CircleX, Loader2, Mail, Pencil, Send, UserPlus, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { enrollInCampaign, setOutreachStatus, writeNextEmails } from "@/app/(app)/outreach/actions";
import { sendNow, updateDraft } from "@/app/(app)/inbox/actions";
import { openSettingsTab } from "@/components/app/open-settings";
import { LinkedInIcon } from "@/components/app/ConnectorIcons";
import { LaunchPanel, type MailboxOption } from "./LaunchPanel";
import { CampaignForm } from "./CampaignForm";
import { useRun } from "./bits";
import { dateTime } from "./format";
import type { CampaignWorkspace, LaunchSummary, OutreachDetail } from "@/services/outreach-campaigns";
import type { LeadStage, MessageObjective } from "@/types/database";

type Lead = CampaignWorkspace["leads"][number];

interface Props {
  detail: OutreachDetail;
  work: CampaignWorkspace;
  options: { profiles: { id: string; name: string; is_default: boolean }[]; offers: { id: string; name: string }[] };
  maxSteps: number;
  candidates: { id: string; name: string; company_name: string | null; stage: LeadStage; do_not_contact: boolean }[];
  timeZone: string | null;
  launch: LaunchSummary;
  mailboxes: MailboxOption[];
  mailboxName: string | null;
  dailyLimit: number;
}

const initials = (name: string) => name.replace(/[^\p{L}\s]/gu, " ").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "·";

// The Outreach campaign page (owner brief 2026-10-19, D-239): every person in
// the campaign on the left with their email and how it was found; the email
// Yolias wrote for the selected person on the right, editable and ready to
// send from the member's mailbox. Yolias writes the emails by itself as soon
// as the page opens (a mailbox must be connected), then the member approves
// sending the whole campaign. "Sent" lists what went out, when and from where.
export function CampaignWorkspaceView({ detail, work, options, maxSteps, candidates, timeZone, launch, mailboxes, mailboxName, dailyLimit }: Props) {
  const { t } = useI18n();
  const o = t.ws.outreach;
  const w = o.workspace;
  const router = useRouter();
  const { run, pending } = useRun();
  const c = detail.campaign;
  const archived = c.status === "archived";
  const hasMailbox = mailboxes.length > 0;
  const [tab, setTab] = useState<"emails" | "sent" | "sequence">("emails");
  const [selected, setSelected] = useState<string | null>(work.leads[0]?.enrollmentId ?? null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [writing, setWriting] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);
  const toWrite = work.leads.filter((l) => l.status === "active" && l.step === 0 && !l.message).length;
  const done = work.leads.length - toWrite;

  // Yolias writes the emails while the page is open, two at a time.
  const started = useRef(false);
  useEffect(() => {
    if (!hasMailbox || archived || !toWrite || started.current) return;
    started.current = true;
    let stop = false;
    (async () => {
      setWriting(true);
      for (let i = 0; i < 300 && !stop; i++) {
        const r = await writeNextEmails(c.id).catch(() => null);
        if (stop) break;
        if (!r || !r.ok) { setWriteError(r && !r.ok ? r.error : t.ws.common.error); break; }
        router.refresh();
        if (r.remaining === 0) break;
      }
      setWriting(false);
      started.current = false;
    })();
    return () => { stop = true; };
  }, [hasMailbox, archived, toWrite, c.id, router, t.ws.common.error]);

  const lead = work.leads.find((l) => l.enrollmentId === selected) ?? null;
  const stats = detail.stats;

  return (
    <div className="page-view">
      <header className="view-header">
        <div className="view-title-group">
          <Link className="detail-back" href="/conversations?tab=campaigns"><ArrowLeft className="flip-rtl" /> {o.title}</Link>
          <h2>{c.name}</h2>
          <p>{[o.status[c.status], fmt(w.people, { count: work.leads.length }), c.goal].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="view-actions">
          {!archived && <button className="btn-secondary" type="button" onClick={() => setAdding(true)}><UserPlus size={14} /> {o.actions.addLeads}</button>}
          {!archived && <button className="btn-secondary" type="button" disabled={pending} onClick={() => { if (confirm(t.ws.common.confirmDelete)) run(() => setOutreachStatus(c.id, "archived")); }}><Archive size={14} /> {o.actions.archive}</button>}
        </div>
      </header>

      <div className="view-content-padding">
        {!hasMailbox ? (
          <section className="ws-card ow-gate">
            <Mail />
            <div>
              <h3>{w.noMailboxTitle}</h3>
              <p className="ws-muted">{w.noMailbox}</p>
            </div>
            <button className="btn-primary" type="button" onClick={() => openSettingsTab("integration")}>{w.connect}</button>
          </section>
        ) : (
          <LaunchPanel summary={launch} mailboxes={mailboxes} mailboxName={mailboxName} dailyLimit={dailyLimit} />
        )}

        {(writing || writeError || (hasMailbox && toWrite > 0)) && (
          <div className={`ow-progress${writeError ? " error" : ""}`} role="status">
            {writeError ? <CircleX /> : <Loader2 className="spin" />}
            <span>{writeError ?? fmt(w.writing, { done, total: work.leads.length })}</span>
            {!writeError && <span className="ow-progress-bar"><span style={{ width: `${work.leads.length ? Math.round((done / work.leads.length) * 100) : 0}%` }} /></span>}
          </div>
        )}

        <div className="ow-stats">
          {(["leads", "sent", "replies", "interested", "bounced", "meetings"] as const).map((k) => (
            <div key={k}><span>{o.stats[k]}</span><strong>{stats[k]}</strong></div>
          ))}
        </div>

        <div className="ws-tabs ow-tabs" role="tablist">
          {(["emails", "sent", "sequence"] as const).map((k) => k === "sent" ? (
            // Sent emails and replies live in one place, Conversations, filtered to this campaign (D-252).
            <Link key={k} role="tab" aria-selected={false} href={`/conversations?campaign=${c.id}`}>
              {t.ws.conversations.tabs.threads}{work.sent.length ? ` (${work.sent.length})` : ""}
            </Link>
          ) : (
            <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? "active" : ""} onClick={() => setTab(k)}>
              {w.tabs[k]}
            </button>
          ))}
        </div>

        {tab === "emails" && (
          !work.leads.length ? <div className="ws-empty">{o.noLeads}</div> : (
            <div className="ow-split">
              <aside className="ow-leads" aria-label={o.leadsTitle}>
                {work.leads.map((l) => (
                  <button key={l.enrollmentId} type="button" className={`ow-lead${l.enrollmentId === selected ? " active" : ""}`} onClick={() => setSelected(l.enrollmentId)}>
                    <span className="ow-avatar" aria-hidden="true">{initials(l.name)}</span>
                    <span className="ow-lead-main">
                      <strong>{l.name}</strong>
                      <span className="ow-lead-sub">{[l.title, l.domain ?? l.company].filter(Boolean).join(" · ") || "-"}</span>
                      <span className={`ow-find ${l.finding}`}>
                        {l.finding === "finding" ? <Loader2 className="spin" /> : l.finding === "none" ? <CircleX /> : <CircleCheck />}
                        {w.emailStatus[l.finding]}
                      </span>
                      {l.email && <span className="ow-lead-email" dir="ltr">{l.email}</span>}
                    </span>
                    <LeadState lead={l} />
                  </button>
                ))}
              </aside>
              <section className="ow-composer">
                {lead ? <Composer key={`${lead.enrollmentId}:${lead.message?.id ?? ""}:${lead.message?.status ?? ""}`} lead={lead} hasMailbox={hasMailbox} writing={!archived && lead.status === "active"} timeZone={timeZone} /> : <div className="ws-empty">{w.selectLead}</div>}
              </section>
            </div>
          )
        )}

        {tab === "sequence" && (
          <section className="ws-section">
            {editing ? (
              <CampaignForm profiles={options.profiles} offers={options.offers} maxSteps={maxSteps} onSaved={() => setEditing(false)}
                initial={{
                  id: c.id, name: c.name, goal: c.goal ?? "", description: c.description ?? "", channel: c.channel, language: c.language, tone: c.tone,
                  customer_profile_id: c.customer_profile_id, offer_id: c.offer_id,
                  steps: detail.steps.map((s) => ({ delay_days: s.delay_days, objective: s.objective as MessageObjective, instruction: s.instruction ?? "" })),
                }} />
            ) : (
              <div className="ws-card">
                <div className="ws-section-head">
                  <h3 className="ws-label">{o.form.steps}</h3>
                  {!archived && <button className="btn-secondary ws-btn-sm" type="button" onClick={() => setEditing(true)}><Pencil size={13} /> {t.ws.common.edit}</button>}
                </div>
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
            )}
          </section>
        )}
      </div>
      {adding && <AddLeadsDialog campaignId={c.id} candidates={candidates} onClose={() => setAdding(false)} />}
    </div>
  );
}

function LeadState({ lead }: { lead: Lead }) {
  const { t } = useI18n();
  const w = t.ws.outreach.workspace;
  if (lead.replied) return <span className="ws-chip blue">{w.sentStatus.replied}</span>;
  if (lead.message?.status === "sent") return <span className="ws-chip green">{w.sentStatus.sent}</span>;
  if (lead.message?.status === "failed") return <span className="ws-chip red">{w.sentStatus.failed}</span>;
  if (lead.message) return <CircleCheck className="ow-ready" aria-hidden="true" />;
  return null;
}

function Composer({ lead, hasMailbox, writing, timeZone }: { lead: Lead; hasMailbox: boolean; writing: boolean; timeZone: string | null }) {
  const { t, locale } = useI18n();
  const w = t.ws.outreach.workspace;
  const { run, pending } = useRun();
  const m = lead.message;
  const editable = Boolean(m && (m.status === "draft" || m.status === "approved" || m.status === "failed"));
  const [subject, setSubject] = useState(m?.subject ?? "");
  const [body, setBody] = useState(m?.body ?? "");
  const [editing, setEditing] = useState(false);
  const changed = Boolean(m) && (subject !== m!.subject || body !== m!.body);

  return (
    <div className="ow-compose">
      <div className="ow-compose-head">
        <span className="ow-avatar lg" aria-hidden="true">{initials(lead.name)}</span>
        <div>
          <h3>{lead.name} {lead.linkedin && <a className="ow-social" href={lead.linkedin} target="_blank" rel="noopener noreferrer" aria-label={`${w.social}: LinkedIn`} title={w.social}><LinkedInIcon /></a>}</h3>
          <p className="ws-muted">{[lead.title, lead.domain ?? lead.company].filter(Boolean).join(" · ")}</p>
        </div>
      </div>
      {!lead.email ? (
        <div className="ws-empty">{lead.finding === "finding" ? w.emailStatus.finding : w.noEmailLead}</div>
      ) : !m ? (
        !hasMailbox ? <div className="ws-empty">{w.noMailbox}</div>
          : writing ? <div className="ws-empty"><Loader2 className="spin" /> {w.noDraft}</div>
          : <div className="ws-empty">-</div>
      ) : (
        <div className="ow-mail">
          <div className="ow-mail-row"><span>{w.to}</span><span dir="ltr">{m.to ?? lead.email}</span></div>
          <div className="ow-mail-row">
            <span>{w.subject}</span>
            {editable ? <input className="ow-subject" dir="auto" value={subject} maxLength={300} aria-label={w.subject} onChange={(e) => setSubject(e.target.value)} /> : <strong dir="auto">{m.subject}</strong>}
          </div>
          {editable && editing ? (
            <textarea className="ow-body" dir="auto" rows={14} value={body} aria-label={t.ws.messages.body} onChange={(e) => setBody(e.target.value)} />
          ) : (
            <div className={`ow-body-view${editable ? " editable" : ""}`} dir="auto" role={editable ? "button" : undefined} tabIndex={editable ? 0 : undefined}
              onClick={() => editable && setEditing(true)} onKeyDown={(e) => { if (editable && (e.key === "Enter" || e.key === " ")) setEditing(true); }}>
              {body}
              {editable && <span className="ow-edit-hint">{w.clickEdit}</span>}
            </div>
          )}
          {m.error && m.status === "failed" && <p className="form-error">{m.error}</p>}
          <div className="ow-mail-foot">
            {m.status === "sent" ? (
              <span className="ws-chip green">{w.sentStatus.sent} · {dateTime(m.sentAt, locale, timeZone)}</span>
            ) : editable ? (
              <>
                {changed && <button className="btn-secondary" type="button" disabled={pending} onClick={() => run(() => updateDraft(m.id, subject, body), { success: t.ws.common.saved, onOk: () => setEditing(false) })}>{t.ws.common.save}</button>}
                <button className="btn-primary" type="button" disabled={pending || !hasMailbox || changed} title={changed ? t.ws.common.save : undefined}
                  onClick={() => run(() => sendNow(m.id), { success: w.sent })}><Send size={14} /> {pending ? w.sending : w.send}</button>
              </>
            ) : <span className="ws-chip">{t.ws.messages.status[m.status as keyof typeof t.ws.messages.status] ?? m.status}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

/** Adds CRM leads to the campaign. */
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
