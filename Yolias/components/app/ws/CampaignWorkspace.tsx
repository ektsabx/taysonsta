"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Send, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { enrollInCampaign } from "@/app/(app)/outreach/actions";
import { sendNow, updateDraft } from "@/app/(app)/inbox/actions";
import { LinkedInIcon } from "@/components/app/ConnectorIcons";
import { useRun } from "./bits";
import { dateTime } from "./format";
import type { CampaignWorkspace } from "@/services/outreach-campaigns";
import type { LeadStage } from "@/types/database";

type Lead = CampaignWorkspace["leads"][number];

type Candidate = { id: string; name: string; company_name: string | null; stage: LeadStage; do_not_contact: boolean };

const initials = (name: string) => name.replace(/[^\p{L}\s]/gu, " ").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "·";

// Pieces of the old campaign page kept for the new one (D-256): the email
// Yolias wrote for one lead (editable, sent from the member's mailbox) and
// the dialog that adds CRM leads to a campaign.
export function Composer({ lead, hasMailbox, writing, timeZone }: { lead: Lead; hasMailbox: boolean; writing: boolean; timeZone: string | null }) {
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
export function AddLeadsDialog({ campaignId, candidates, onClose }: { campaignId: string; candidates: Candidate[]; onClose: () => void }) {
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
