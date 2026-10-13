"use client";

import { useState } from "react";
import { MessageSquareReply, Sparkles } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { draftReplyAction, logReplyAction, saveManualDraft } from "@/app/(app)/inbox/actions";
import { channels } from "@/lib/outreach/channels";
import { useRun } from "./bits";
import { fromLocalInput } from "./format";
import type { MessageChannel } from "@/types/database";

// Under a conversation: log a reply that arrived in the member's own inbox
// (Yolias can't receive yet) and ask the Replies Agent for a reply draft.
export function ReplyTools({ leadId, channel, seed, doNotContact }: { leadId: string; channel: MessageChannel; seed?: string; doNotContact: boolean }) {
  const { t } = useI18n();
  const r = t.ws.inbox.reply;
  const { run, pending } = useRun();
  const [tab, setTab] = useState<"log" | "draft">("log");
  const [body, setBody] = useState("");
  const [ch, setCh] = useState<MessageChannel>(channel);
  const [at, setAt] = useState("");
  const [from, setFrom] = useState("");
  const [instruction, setInstruction] = useState(seed ?? "");
  const [seedSeen, setSeedSeen] = useState(seed);
  if (seed !== seedSeen) { setSeedSeen(seed); if (seed) { setTab("draft"); setInstruction(seed); } }

  return (
    <div className="ws-card">
      <div className="ws-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "log"} className={tab === "log" ? "active" : ""} onClick={() => setTab("log")}><MessageSquareReply size={13} /> {r.logTitle}</button>
        {!doNotContact && <button type="button" role="tab" aria-selected={tab === "draft"} className={tab === "draft" ? "active" : ""} onClick={() => setTab("draft")}><Sparkles size={13} /> {r.draftTitle}</button>}
      </div>
      {tab === "log" ? (
        <div className="ws-form">
          <p className="ws-hint">{r.logHint}</p>
          <textarea className="form-input" rows={5} aria-label={r.body} placeholder={r.body} value={body} maxLength={10000} onChange={(e) => setBody(e.target.value)} dir="auto" />
          <div className="ws-grid-3">
            <div className="ws-field">
              <label className="ws-label" htmlFor={`rc-${leadId}`}>{r.channel}</label>
              <select id={`rc-${leadId}`} className="form-select" value={ch} onChange={(e) => setCh(e.target.value as MessageChannel)}>
                {channels.map((c) => <option key={c} value={c}>{t.ws.outreach.channels[c]}</option>)}
              </select>
            </div>
            <div className="ws-field">
              <label className="ws-label" htmlFor={`ra-${leadId}`}>{r.receivedAt}</label>
              <input id={`ra-${leadId}`} type="datetime-local" className="form-input" value={at} onChange={(e) => setAt(e.target.value)} />
            </div>
            <div className="ws-field">
              <label className="ws-label" htmlFor={`rf-${leadId}`}>{r.from}</label>
              <input id={`rf-${leadId}`} className="form-input" dir="ltr" value={from} maxLength={320} onChange={(e) => setFrom(e.target.value)} />
            </div>
          </div>
          <div className="ws-actions">
            <button className="btn-primary" type="button" disabled={pending || !body.trim()}
              onClick={() => run(() => logReplyAction({ leadId, body, channel: ch, receivedAt: fromLocalInput(at), from: from || null }), { success: r.logged, onOk: () => { setBody(""); setAt(""); setFrom(""); } })}>
              {r.save}
            </button>
          </div>
        </div>
      ) : (
        <div className="ws-form">
          <textarea className="form-input" rows={5} aria-label={r.instruction} placeholder={r.instruction} value={instruction} maxLength={3000} onChange={(e) => setInstruction(e.target.value)} dir="auto" />
          <p className="ws-hint">{r.manualHint}</p>
          <div className="ws-actions">
            <button className="btn-secondary" type="button" disabled={pending || !instruction.trim()} onClick={() => run(() => saveManualDraft(leadId, instruction), { success: t.ws.common.saved, onOk: () => setInstruction("") })}>
              {r.saveDraft}
            </button>
            <button className="btn-primary" type="button" disabled={pending} onClick={() => run(() => draftReplyAction(leadId, instruction), { success: r.drafted, onOk: () => setInstruction("") })}>
              <Sparkles size={14} /> {pending ? r.drafting : r.draftAi}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
