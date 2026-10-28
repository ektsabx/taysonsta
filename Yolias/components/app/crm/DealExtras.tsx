"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckSquare, ShieldCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { formatNumber } from "@/lib/format";
import { setTaskDone } from "@/app/(app)/crm/actions";
import { PendingApprovals, type Approval } from "@/components/app/ws/PendingApprovals";

export type DealTask = { id: string; title: string; leadId: string; leadName: string; dueAt: string | null };

// Tasks and approvals belong to deals (owner, 2026-10-29): reminders Yolias set
// for a lead, and agent actions (e.g. moving a stage) waiting for you. They
// live on the CRM page; Conversations shows conversations only.
/** The CRM page header with its Tasks and Approvals buttons, and the panel each one opens. */
export function DealExtrasButtons({ title, subtitle, tasks, approvals, timeZone }: { title: string; subtitle: string; tasks: DealTask[]; approvals: Approval[]; timeZone: string | null }) {
  const { t, locale } = useI18n();
  const x = t.sdr.inbox;
  const [panel, setPanel] = useState<"tasks" | "approvals" | null>(null);
  const n = (v: number) => formatNumber(v, locale);
  return (
    <>
      <header className="sdr-head">
        <div><h2>{title}</h2><p>{subtitle}</p></div>
        <div className="sdr-head-actions">
        <button type="button" className="sdr-btn" aria-expanded={panel === "tasks"} onClick={() => setPanel(panel === "tasks" ? null : "tasks")}><CheckSquare />{x.tasks}{tasks.length > 0 && <span className="sdr-count">{n(tasks.length)}</span>}</button>
        <button type="button" className="sdr-btn" aria-expanded={panel === "approvals"} onClick={() => setPanel(panel === "approvals" ? null : "approvals")}><ShieldCheck />{x.approvals}{approvals.length > 0 && <span className="sdr-count">{n(approvals.length)}</span>}</button>
        </div>
      </header>
      {panel === "approvals" && <div className="sdr-panel deal-extras"><div className="sdr-panel-head"><div className="sdr-panel-title">{x.approvalsTitle}</div></div><div className="sdr-panel-body pad"><PendingApprovals timeZone={timeZone} approvals={approvals} /></div></div>}
      {panel === "tasks" && (
        <div className="sdr-panel deal-extras"><div className="sdr-panel-head"><div className="sdr-panel-title">{x.tasksTitle}</div></div>
          <div className="sdr-panel-body pad">{!tasks.length ? <p className="sdr-panel-sub">{x.tasksEmpty}</p> : <TaskList tasks={tasks} />}</div></div>
      )}
    </>
  );
}

function TaskList({ tasks }: { tasks: DealTask[] }) {
  const { locale } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <ul className="sdr-tasks">
      {tasks.map((k) => (
        <li key={k.id}>
          <input type="checkbox" disabled={pending} aria-label={k.title} onChange={() => start(async () => { await setTaskDone(k.id, true); router.refresh(); })} />
          <span><span dir="auto">{k.title}</span><Link className="sdr-cell-sub" href={`/crm/${k.leadId}`}>{k.leadName}{k.dueAt ? ` · ${new Intl.DateTimeFormat(locale === "ar" ? "ar-EG-u-nu-latn" : "en-US", { month: "short", day: "numeric" }).format(new Date(k.dueAt))}` : ""}</Link></span>
        </li>
      ))}
    </ul>
  );
}
