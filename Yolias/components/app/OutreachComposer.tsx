"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Copy, Mail, Send, Sparkles, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { useToast } from "@/components/Toast";
import { approveAndSend, backToDraft, cancelMessage, prepareMessage, saveDraft } from "@/app/(app)/outreach/actions";
import type { OutreachMessageRow } from "@/types/database";

interface Mailbox {
  id: string;
  provider: "gmail" | "outlook";
  email: string;
  status: string;
}

interface Props {
  prospectId: string;
  canEmail: boolean;
  mailboxes: Mailbox[];
  /** The prospect's latest message (a draft is opened for editing). */
  latest: OutreachMessageRow | null;
}

// Outreach for one person (final spec phase 8): Yolias writes a personal
// email, the member edits it and approves it; it's sent from their own
// mailbox. Without a mailbox: copy it or open it in the email app.
export function OutreachComposer({ prospectId, canEmail, mailboxes, latest }: Props) {
  const { t, locale } = useI18n();
  const o = t.outreach;
  const toast = useToast();
  const router = useRouter();
  const [msg, setMsg] = useState<OutreachMessageRow | null>(latest);
  const [instruction, setInstruction] = useState("");
  const [language, setLanguage] = useState<"en" | "ar">(locale === "ar" ? "ar" : "en");
  const [subject, setSubject] = useState(latest?.subject ?? "");
  const [body, setBody] = useState(latest?.body ?? "");
  const connected = mailboxes.filter((m) => m.status === "connected");
  const [from, setFrom] = useState(connected[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const editable = !msg || msg.status === "draft";

  const run = (fn: () => Promise<void>) => start(async () => {
    setError(null);
    await fn();
  });

  const prepare = () => run(async () => {
    const r = await prepareMessage(prospectId, instruction, language);
    if (!r.ok) return setError(r.error);
    setMsg(r.message);
    setSubject(r.message.subject);
    setBody(r.message.body);
  });

  return (
    <section className="detail-card outreach-composer">
      <h3><Mail /> {t.nav.outreach}</h3>
      {!canEmail ? <p className="cell-sub">{o.errors.no_email}</p> : (
        <>
          {(!msg || msg.status === "canceled" || msg.status === "sent") && (
            <div className="outreach-prepare">
              <label className="field">
                <span>{o.instruction}</span>
                <textarea className="form-input" rows={2} value={instruction} maxLength={1000} placeholder={o.instructionPlaceholder} onChange={(e) => setInstruction(e.target.value)} />
              </label>
              <div className="outreach-row">
                <label className="field inline">
                  <span>{o.language}</span>
                  <select className="form-select" value={language} onChange={(e) => setLanguage(e.target.value as "en" | "ar")}>
                    <option value="en">English</option>
                    <option value="ar">العربية</option>
                  </select>
                </label>
                <button className="btn-primary" type="button" disabled={pending} onClick={prepare}><Sparkles /> {pending ? o.preparing : o.prepare}</button>
              </div>
            </div>
          )}

          {msg && msg.status !== "canceled" && (
            <div className="outreach-draft">
              <div className="outreach-meta">
                <span className={`status-pill outreach-${msg.status}`}>{o.statusLabel[msg.status]}</span>
                {msg.to_email && <span className="cell-sub" dir="ltr">{o.to}: {msg.to_email}</span>}
                {msg.status === "failed" && msg.error && <span className="form-error">{o.failedReason[msg.error as keyof typeof o.failedReason] ?? msg.error}</span>}
              </div>
              <label className="field">
                <span>{o.subject}</span>
                <input className="form-input" dir="auto" value={subject} maxLength={300} readOnly={!editable} onChange={(e) => setSubject(e.target.value)} />
              </label>
              <label className="field">
                <span>{o.body}</span>
                <textarea className="form-input" dir="auto" rows={9} value={body} maxLength={10000} readOnly={!editable} onChange={(e) => setBody(e.target.value)} />
              </label>
              <p className="cell-sub">{o.note}</p>

              <div className="outreach-actions">
                {editable && (
                  <button className="btn-secondary" type="button" disabled={pending} onClick={() => run(async () => {
                    const r = await saveDraft(msg.id, { subject, body });
                    if (r.ok) toast(o.saved);
                    else setError(r.error);
                  })}>{o.save}</button>
                )}
                {editable && connected.length > 0 && (
                  <>
                    <label className="field inline">
                      <span>{o.sendFrom}</span>
                      <select className="form-select" value={from} onChange={(e) => setFrom(e.target.value)}>
                        {connected.map((m) => <option key={m.id} value={m.id}>{m.email}</option>)}
                      </select>
                    </label>
                    <button className="btn-primary" type="button" disabled={pending || !from} onClick={() => run(async () => {
                      const saved = await saveDraft(msg.id, { subject, body });
                      if (!saved.ok) return setError(saved.error);
                      const r = await approveAndSend(msg.id, from);
                      if (!r.ok) return setError(r.error);
                      toast(o.approved);
                      setMsg({ ...msg, status: "approved" });
                      router.refresh();
                    })}><Send /> {o.approve}</button>
                  </>
                )}
                {editable && connected.length === 0 && <Link className="btn-secondary" href="/outreach">{fmt(o.connect, { provider: "Gmail / Outlook" })}</Link>}
                <button className="btn-secondary" type="button" onClick={() => {
                  void navigator.clipboard.writeText(`${subject}\n\n${body}`).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  });
                }}>{copied ? <Check /> : <Copy />} {copied ? o.copied : o.copy}</button>
                {msg.to_email && <a className="btn-secondary" href={`mailto:${msg.to_email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}>{o.openMail}</a>}
                {(msg.status === "approved" || msg.status === "failed") && (
                  <button className="btn-secondary" type="button" disabled={pending} onClick={() => run(async () => {
                    const r = await backToDraft(msg.id);
                    if (r.ok) setMsg({ ...msg, status: "draft" });
                  })}>{o.backToDraft}</button>
                )}
                {(msg.status === "draft" || msg.status === "approved" || msg.status === "failed") && (
                  <button className="btn-danger-ghost" type="button" disabled={pending} onClick={() => run(async () => {
                    const r = await cancelMessage(msg.id);
                    if (r.ok) setMsg({ ...msg, status: "canceled" });
                  })}><X /> {o.cancel}</button>
                )}
              </div>
            </div>
          )}
          {error && <p className="form-error" role="alert">{error}</p>}
        </>
      )}
    </section>
  );
}
