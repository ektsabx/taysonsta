"use client";

import { useState } from "react";
import { CalendarClock, Pencil, Send, Sparkles, Trash2 } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { discardMessage, sendNow, updateDraft } from "@/app/(app)/inbox/actions";
import { useRun } from "./bits";
import { dateTime } from "./format";
import type { Json, MessageChannel, OutreachStatus } from "@/types/database";

export interface CardMessage {
  id: string; direction: "outbound" | "inbound"; status: OutreachStatus; channel: MessageChannel; subject: string; body: string; language: string;
  prospect_id: string | null; company_id: string | null; created_at: string; sent_at: string | null; received_at: string | null; opened_at: string | null;
  to_email?: string | null; scheduled_for: string | null; step_position: number | null; sent_via?: string | null; delivery_status?: string | null; error?: string | null; instruction?: string | null; from_address: string | null; analysis: Json | null; personalization: string[] | null;
}

type Analysis = { kind: string; summary: string; suggested_stage: string | null; suggested_reply: string | null; by: "ai" | "rules" };

// One message in a conversation (Inbox, lead page). Drafts can be edited and
// sent from the member's connected mailbox (D-239); replies show what the
// Replies Agent read in them.
export function MessageCard({ m, timeZone, onUseSuggestion, mailboxEmail, leadEmail }: { m: CardMessage; timeZone: string | null; onUseSuggestion?: (text: string) => void; mailboxEmail?: string | null; leadEmail?: string | null }) {
  const { t, locale } = useI18n();
  const w = t.ws.messages;
  const { run, pending } = useRun();
  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState(m.subject);
  const [body, setBody] = useState(m.body);
  const draft = m.status === "draft" || m.status === "approved" || m.status === "failed";
  const inbound = m.direction === "inbound";
  const analysis = inbound && m.analysis && typeof m.analysis === "object" ? (m.analysis as unknown as Analysis) : null;
  // Shown like an email (owner 2026-10-21): from, to, subject, then the message.
  const from = inbound ? m.from_address : m.from_address ?? mailboxEmail ?? null;
  const to = inbound ? mailboxEmail ?? null : m.to_email ?? leadEmail ?? null;

  return (
    <article className={`lead-msg${inbound ? " inbound" : ""}`}>
      <div className="lead-msg-head">
        <span className="ws-inline">
          {m.status === "failed" && <span className="ws-chip red">{w.status.failed}</span>}
          {!inbound && m.delivery_status === "bounced" && <span className="ws-chip red">{t.ws.inbox.bounced}</span>}
          {!inbound && m.instruction === "auto-reply" && <span className="ws-chip blue">{t.ws.inbox.autoReply}</span>}
          {m.scheduled_for && draft && <span className="ws-chip blue"><CalendarClock />{fmt(w.scheduledFor, { date: dateTime(m.scheduled_for, locale, timeZone) })}</span>}
        </span>
        <time className="ws-muted">{dateTime(m.received_at ?? m.sent_at ?? m.created_at, locale, timeZone)}</time>
      </div>
      {m.channel === "email" && (from || to) && (
        <dl className="lead-msg-meta">
          {from && <><dt>{w.from}</dt><dd dir="ltr">{from}</dd></>}
          {to && <><dt>{w.to}</dt><dd dir="ltr">{to}</dd></>}
        </dl>
      )}
      {!inbound && m.status === "failed" && m.error && <p className="form-error">{m.error}</p>}
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
          {m.subject && <div className="lead-msg-subject"><span className="ws-muted">{w.subject}: </span>{m.subject}</div>}
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
        <div className="lead-msg-actions">
          <button className="btn-secondary ws-btn-sm" type="button" onClick={() => setEditing(true)}><Pencil size={13} /> {w.edit}</button>
          {m.channel === "email" && <button className="btn-primary ws-btn-sm" type="button" disabled={pending} onClick={() => run(() => sendNow(m.id), { success: t.ws.outreach.workspace.sent })}><Send size={13} /> {pending ? t.ws.outreach.workspace.sending : t.ws.inbox.composer.send}</button>}
          <button className="ws-icon-btn" type="button" aria-label={w.cancel} title={w.cancel} disabled={pending} onClick={() => run(() => discardMessage(m.id))}><Trash2 /></button>
        </div>
      )}
    </article>
  );
}
