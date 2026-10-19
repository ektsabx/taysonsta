"use client";

import Link from "next/link";
import { Check, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { decideApproval } from "@/app/(app)/crm/actions";
import { useRun } from "./bits";
import { dateTime } from "./format";
import type { Json } from "@/types/database";

export interface Approval { id: string; leadId: string; leadName: string; tool: string; input: Json; summary: string; createdAt: string }

// What the agent wants to do and waits for the member's OK (e.g. move a lead
// to a stage after a reply). Shown at the top of the Inbox (D-233: the AI
// Agent settings page left the member's app; the approvals stayed with them).
export function PendingApprovals({ approvals, timeZone }: { approvals: Approval[]; timeZone: string | null }) {
  const { t, locale } = useI18n();
  const a = t.ws.ai.agents;
  const { run, pending } = useRun();
  if (!approvals.length) return null;
  return (
    <section className="ws-section pending-approvals">
      <div className="ws-section-head"><h3>{a.pending}</h3></div>
      <div className="ws-card ws-list">
        {approvals.map((x) => (
          <div key={x.id} className="ws-list-row">
            <div>
              <Link className="ws-link" href={`/crm/${x.leadId}`}>{x.leadName}</Link>
              <span className="cell-sub">{x.tool === "crm.set_stage" ? `${t.ws.crm.moveTo}: ${t.ws.stages[(x.input as { stage?: string })?.stage as keyof typeof t.ws.stages] ?? ""}` : x.tool} · {dateTime(x.createdAt, locale, timeZone)}</span>
              <span className="cell-sub">{x.summary}</span>
            </div>
            <span className="ws-inline">
              <button className="btn-primary ws-btn-sm" type="button" disabled={pending} onClick={() => run(() => decideApproval(x.id, true), { success: a.approved })}><Check size={13} /> {t.ws.crm.detail.approve}</button>
              <button className="btn-secondary ws-btn-sm" type="button" disabled={pending} onClick={() => run(() => decideApproval(x.id, false), { success: a.rejected })}><X size={13} /> {t.ws.crm.detail.reject}</button>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
