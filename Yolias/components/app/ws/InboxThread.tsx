"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCheck, RotateCcw, Archive } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { markThreadRead, setThreadStatus } from "@/app/(app)/inbox/actions";
import { setTaskDone } from "@/app/(app)/crm/actions";
import { StageSelect, useRun } from "./bits";
import { MessageCard, type CardMessage } from "./MessageCard";
import { ReplyTools } from "./ReplyTools";
import { dateTime, money } from "./format";
import type { InboxThread } from "@/services/inbox";
import type { MessageChannel } from "@/types/database";

export function InboxThreadView({ thread, backHref, timeZone }: { thread: InboxThread; backHref: string; timeZone: string | null }) {
  const { t, locale } = useI18n();
  const w = t.ws.inbox;
  const { run, pending } = useRun();
  const { lead } = thread;
  const [seed, setSeed] = useState<string | undefined>(undefined);
  // Opening an unread conversation marks it read.
  useEffect(() => { if (lead.unread) void markThreadRead(lead.id); }, [lead.id, lead.unread]);
  const channel = (thread.messages.at(-1)?.channel ?? "email") as MessageChannel;
  const status = lead.thread_status ?? "open";

  return (
    <>
      <div className="inbox-thread-head">
        <div>
          <Link className="detail-back inbox-back" href={backHref}><ArrowLeft className="flip-rtl" /> {w.title}</Link>
          <h3>{lead.name}</h3>
          <p className="ws-muted">{[lead.job_title, lead.company_name !== lead.name ? lead.company_name : null, lead.email].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="ws-inline">
          <StageSelect leadId={lead.id} stage={lead.stage} label={w.stage} />
          {status === "open" ? (
            <>
              <button className="btn-secondary ws-btn-sm" type="button" disabled={pending} onClick={() => run(() => setThreadStatus(lead.id, "done"))}><CheckCheck size={13} /> {w.thread.markDone}</button>
              <button className="btn-secondary ws-btn-sm" type="button" disabled={pending} onClick={() => run(() => setThreadStatus(lead.id, "other"))}><Archive size={13} /> {w.thread.markOther}</button>
            </>
          ) : (
            <button className="btn-secondary ws-btn-sm" type="button" disabled={pending} onClick={() => run(() => setThreadStatus(lead.id, "open"))}><RotateCcw size={13} /> {w.thread.reopen}</button>
          )}
          <Link className="btn-secondary ws-btn-sm" href={`/crm/${lead.id}`}>{w.thread.openCrm}</Link>
        </div>
      </div>
      <div className="inbox-thread-body">
        <div>
          {!thread.messages.length && <div className="ws-empty">{w.thread.noMessages}</div>}
          {thread.messages.map((m) => <MessageCard key={m.id} m={m as unknown as CardMessage} timeZone={timeZone} onUseSuggestion={setSeed} />)}
          <div style={{ marginTop: 12 }}><ReplyTools leadId={lead.id} channel={channel} seed={seed} doNotContact={lead.do_not_contact} /></div>
        </div>
        <aside className="inbox-side">
          <div className="ws-card">
            <dl className="ws-kv">
              <dt>{t.ws.crm.cols.company}</dt><dd>{lead.company_name ?? "—"}</dd>
              {lead.email && <><dt>{t.setup.contactNames.email}</dt><dd dir="ltr">{lead.email}</dd></>}
              {lead.phone && <><dt>{t.setup.contactNames.phone}</dt><dd dir="ltr">{lead.phone}</dd></>}
              <dt>{t.ws.crm.cols.value}</dt><dd dir="ltr">{money(lead.deal_value, lead.deal_currency, locale)}</dd>
              <dt>{t.ws.crm.cols.meeting}</dt><dd>{dateTime(lead.next_meeting_at, locale, timeZone)}</dd>
            </dl>
            {lead.do_not_contact && <p className="ws-chip red" style={{ marginTop: 10 }}>{t.ws.crm.detail.dnc}</p>}
          </div>
          <div className="ws-card">
            <h4 className="ws-label" style={{ marginBottom: 8 }}>{w.thread.campaign}</h4>
            {!thread.campaigns.length ? <p className="ws-muted">{t.ws.crm.detail.noCampaigns}</p> : thread.campaigns.map((c) => (
              <div key={c.id} className="ws-list-row">
                <Link className="ws-link" href={`/outreach/${c.id}`}>{c.name}</Link>
                <span className="ws-chip">{t.ws.outreach.enrollStatus[c.status as keyof typeof t.ws.outreach.enrollStatus]}</span>
              </div>
            ))}
          </div>
          <div className="ws-card">
            <h4 className="ws-label" style={{ marginBottom: 8 }}>{w.reminders}</h4>
            {!thread.tasks.length ? <p className="ws-muted">{t.ws.crm.detail.noTasks}</p> : thread.tasks.map((k) => (
              <label key={k.id} className="ws-list-row ws-check" style={{ justifyContent: "flex-start" }}>
                <input type="checkbox" disabled={pending} onChange={() => run(() => setTaskDone(k.id, true))} />
                <span>{k.title}<span className="cell-sub">{dateTime(k.due_at, locale, timeZone)}</span></span>
              </label>
            ))}
          </div>
        </aside>
      </div>
    </>
  );
}
