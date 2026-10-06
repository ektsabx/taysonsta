"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/client";
import { useToast } from "@/components/Toast";
import { disconnectMailbox, setMailboxLimit } from "@/app/(app)/outreach/actions";

/** Daily limit and disconnect for one of the member's mailboxes. */
export function MailboxControls({ id, limit }: { id: string; limit: number }) {
  const { t } = useI18n();
  const o = t.outreach;
  const toast = useToast();
  const router = useRouter();
  const [value, setValue] = useState(String(limit));
  const [pending, start] = useTransition();
  return (
    <span className="mailbox-controls">
      <label className="field inline">
        <span>{o.dailyLimit}</span>
        <input className="form-input" type="number" min={1} max={500} value={value} onChange={(e) => setValue(e.target.value)} onBlur={() => start(async () => {
          if (Number(value) === limit) return;
          const r = await setMailboxLimit(id, Number(value));
          if (!r.ok) toast(r.error);
          router.refresh();
        })} />
      </label>
      <button className="btn-danger-ghost" type="button" disabled={pending} onClick={() => start(async () => {
        await disconnectMailbox(id);
        router.refresh();
      })}>{o.disconnect}</button>
    </span>
  );
}
