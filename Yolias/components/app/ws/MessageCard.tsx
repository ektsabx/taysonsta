"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Check, Copy, ExternalLink, Mail, Pencil, Sparkles, Trash2 } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { useToast } from "@/components/Toast";
import { openMessage } from "@/app/(app)/prospects/message-actions";
import { discardMessage, markMessageSent, scheduleMessage, updateDraft } from "@/app/(app)/inbox/actions";
import { composeUrl, isMessageLanguage, DEFAULT_LANGUAGE } from "@/lib/outreach/channels";
import { useRun } from "./bits";
import { dateTime, fromLocalInput, toLocalInput } from "./format";
import type { Json, MessageChannel, OutreachStatus } from "@/types/database";

export interface CardMessage {
  id: string; direction: "outbound" | "inbound"; status: OutreachStatus; channel: MessageChannel; subject: string; body: string; language: string;
  prospect_id: string | null; company_id: string | null; created_at: string; sent_at: string | null; received_at: string | null; opened_at: string | null;
  scheduled_for: string | null; step_position: number | null; from_address: string | null; analysis: Json | null; personalization: string[] | null;
}

type Analysis = { kind: string; summary: string; suggested_stage: string | null; suggested_reply: string | null; by: "ai" | "rules" };

// One message in a conversation (Inbox, lead page, Outreach). Drafts can be
// edited, opened in the member's own app, given a planned send time and
// confirmed as sent; replies show what the Replies Agent read in them.
export function MessageCard({ m, timeZone, onUseSuggestion }: { m: CardMessage; timeZone: string | null; onUseSuggestion?: (text: string) => void }) {
  const { t, locale } = useI18n();
  const w = t.ws.messages;
  const toast = useToast();
  const router = useRouter();
  const { run, pending } = useRun();
  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState(m.subject);
  const [body, setBody] = useState(m.body);
  const [planning, setPlanning] = useState(false);
  const [when, setWhen] = useState(toLocalInput(m.scheduled_for));
  const [opening, startOpen] = useTransition();
  const draft = m.status === "draft";
  const inbound = m.direction === "inbound";
  const target = m.prospect_id ? { kind: "person" as const, id: m.prospect_id } : m.company_id ? { kind: "company" as const, id: m.company_id } : null;
  const analysis = inbound && m.analysis && typeof m.analysis === "object" ? (m.analysis as unknown as Analysis) : null;
  const statusCls = m.status === "sent" ? "green" : inbound ? "blue" : m.status === "canceled" || m.status === "failed" ? "red" : "";

  const open = (via: "gmail" | "outlook" | "mail_app" | "linkedin" | "copy") => {
    if (!target) return;
    const tab = via === "mail_app" || via === "copy" ? null : window.open("about:blank", "_blank");
    if (tab) tab.opener = null;
    if (via === "copy" || m.channel === "linkedin") void navigator.clipboard?.writeText(m.channel === "email" ? `${subject}\n\n${body}` : body).then(() => toast(w.copied), () => {});
    startOpen(async () => {
      const res = await openMessage({ target, channel: m.channel, via, messageId: m.id, subject, body, language: isMessageLanguage(m.language) ? m.language : DEFAULT_LANGUAGE });
      if (!res.ok) { tab?.close(); toast(res.error, "error"); return; }
      if (m.channel === "email" && via !== "copy" && res.email) {
        const url = composeUrl(via as "gmail" | "outlook" | "mail_app", res.email, subject, body);
        if (tab) tab.location.href = url; else window.location.href = url;
      } else if (via !== "copy" && res.url && tab) tab.location.href = res.url;
      else tab?.close();
      router.refresh();
    });
  };

  return (
    <article className={`lead-msg${inbound ? " inbound" : ""}`}>
      <div className="lead-msg-head">
        <span className="ws-inline">
          <span className={`ws-chip ${statusCls}`}>{w.status[m.status]}</span>
          <span className="ws-chip">{t.ws.outreach.channels[m.channel]}</span>
          {m.step_position && <span className="ws-chip">{fmt(t.ws.outreach.form.step, { n: m.step_position })}</span>}
          {m.scheduled_for && draft && <span className="ws-chip blue"><CalendarClock />{fmt(w.scheduledFor, { date: dateTime(m.scheduled_for, locale, timeZone) })}</span>}
        </span>
        <time className="ws-muted">{dateTime(m.received_at ?? m.sent_at ?? m.created_at, locale, timeZone)}</time>
      </div>
      {inbound && m.from_address && <p className="ws-muted" dir="ltr">{m.from_address}</p>}
      {editing ? (
        <div className="ws-form">
          {m.channel === "email" && <input className="form-input" aria-label={w.subject} value={subject} maxLength={300} onChange={(e) => setSubject(e.target.value)} />}
          <textarea className="form-input" aria-label={w.body} rows={8} value={body} onChange={(e) => setBody(e.target.value)} />
          <div className="ws-actions">
            <button className="btn-secondary ws-btn-sm" type="button" onClick={() => { setEditing(false); setSubject(m.subject); setBody(m.body); }}>{t.ws.common.cancel}</button>
            <button className="btn-primary ws-btn-sm" type="button" disabled={pending} onClick={() => run(() => updateDraft(m.id, subject, body), { onOk: () => setEditing(false), success: t.ws.common.saved })}>{t.ws.common.save}</button>
          </div>
        </div>
      ) : (
        <>
          {m.subject && <div className="lead-msg-subject">{m.subject}</div>}
          <div className="lead-msg-body" dir="auto">{m.body}</div>
        </>
      )}

      {analysis && (
        <div className="ws-note" style={{ marginTop: 10, marginBottom: 0 }}>
          <Sparkles />
          <div>
            <strong>{t.ws.inbox.reply.analysis}: {t.ws.inbox.reply.kind[analysis.kind as keyof typeof t.ws.inbox.reply.kind] ?? analysis.kind}</strong>
            <div>{analysis.summary}</div>
            {analysis.suggested_stage && <div>{fmt(t.ws.inbox.reply.suggestedStage, { stage: t.ws.stages[analysis.suggested_stage as keyof typeof t.ws.stages] ?? analysis.suggested_stage })}</div>}
            {analysis.by === "rules" && <div className="ws-muted">{t.ws.inbox.reply.byRules}</div>}
            {analysis.suggested_reply && onUseSuggestion && (
              <button className="btn-secondary ws-btn-sm" type="button" style={{ marginTop: 8 }} onClick={() => onUseSuggestion(analysis.suggested_reply!)}>{t.ws.inbox.reply.useSuggestion}</button>
            )}
          </div>
        </div>
      )}

      {draft && !editing && (
        <>
          <div className="lead-msg-actions">
            <button className="btn-secondary ws-btn-sm" type="button" onClick={() => setEditing(true)}><Pencil size={13} /> {w.edit}</button>
            {target && m.channel === "email" && (
              <>
                <button className="btn-secondary ws-btn-sm" type="button" disabled={opening} onClick={() => open("gmail")}><Mail size={13} /> {w.openGmail}</button>
                <button className="btn-secondary ws-btn-sm" type="button" disabled={opening} onClick={() => open("outlook")}><Mail size={13} /> {w.openOutlook}</button>
                <button className="btn-secondary ws-btn-sm" type="button" disabled={opening} onClick={() => open("mail_app")}><ExternalLink size={13} /> {w.openMail}</button>
              </>
            )}
            {target && m.channel === "linkedin" && <button className="btn-secondary ws-btn-sm" type="button" disabled={opening} onClick={() => open("linkedin")}><ExternalLink size={13} /> LinkedIn</button>}
            <button className="btn-secondary ws-btn-sm" type="button" onClick={() => open("copy")}><Copy size={13} /> {w.copy}</button>
            <button className="btn-secondary ws-btn-sm" type="button" onClick={() => setPlanning((p) => !p)}><CalendarClock size={13} /> {w.schedule}</button>
            <button className="btn-primary ws-btn-sm" type="button" disabled={pending} title={w.markSentHint} onClick={() => run(() => markMessageSent(m.id), { success: w.status.sent })}><Check size={13} /> {w.markSent}</button>
            <button className="btn-secondary ws-btn-sm" type="button" disabled title={t.ws.common.mailboxNotConnected}>{w.sendDisabled}</button>
            <button className="ws-icon-btn" type="button" aria-label={w.cancel} title={w.cancel} disabled={pending} onClick={() => run(() => discardMessage(m.id))}><Trash2 /></button>
          </div>
          {m.opened_at && <p className="ws-muted" style={{ marginTop: 6 }}>{w.markSentHint}</p>}
          {planning && (
            <div className="ws-inline" style={{ marginTop: 10 }}>
              <input type="datetime-local" className="form-input" value={when} onChange={(e) => setWhen(e.target.value)} aria-label={w.schedule} />
              <button className="btn-secondary ws-btn-sm" type="button" disabled={pending || !when} onClick={() => run(() => scheduleMessage(m.id, fromLocalInput(when)), { onOk: () => setPlanning(false), success: t.ws.common.saved })}>{t.ws.common.save}</button>
              {m.scheduled_for && <button className="btn-secondary ws-btn-sm" type="button" disabled={pending} onClick={() => run(() => scheduleMessage(m.id, null), { onOk: () => { setWhen(""); setPlanning(false); } })}>{w.clearSchedule}</button>}
              <p className="ws-hint" style={{ flexBasis: "100%" }}>{w.scheduleHint}</p>
            </div>
          )}
        </>
      )}
    </article>
  );
}
