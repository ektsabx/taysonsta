"use client";

import { useState } from "react";
import { PenLine, Send } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { draftReplyAction, sendReply } from "@/app/(app)/inbox/actions";
import { useRun } from "./bits";

// Under a conversation (D-239): write a reply and send it from the member's
// own mailbox, or let the Replies Agent write it. Replies arrive by
// themselves from the connected mailbox; nothing is logged by hand.
export function ReplyTools({ leadId, seed, doNotContact, hasMailbox }: { leadId: string; seed?: string; doNotContact: boolean; hasMailbox: boolean }) {
  const { t } = useI18n();
  const c = t.ws.inbox.composer;
  const { run, pending } = useRun();
  const [body, setBody] = useState(seed ?? "");
  const [seedSeen, setSeedSeen] = useState(seed);
  if (seed !== seedSeen) { setSeedSeen(seed); if (seed) setBody(seed); }
  if (doNotContact) return null;

  return (
    <div className="ws-card inbox-composer">
      {!hasMailbox && <p className="ws-hint">{c.noMailbox}</p>}
      <textarea className="form-input" rows={5} aria-label={c.placeholder} placeholder={c.placeholder} value={body} maxLength={5000} onChange={(e) => setBody(e.target.value)} dir="auto" />
      <div className="ws-actions">
        <button className="btn-secondary" type="button" disabled={pending} onClick={() => run(() => draftReplyAction(leadId, body), { success: c.draftReady, onOk: () => setBody("") })}>
          <PenLine size={14} /> {pending ? c.suggesting : c.suggest}
        </button>
        <button className="btn-primary" type="button" disabled={pending || !body.trim() || !hasMailbox} onClick={() => run(() => sendReply(leadId, body), { success: c.sent, onOk: () => setBody("") })}>
          <Send size={14} /> {pending ? c.sending : c.send}
        </button>
      </div>
    </div>
  );
}
