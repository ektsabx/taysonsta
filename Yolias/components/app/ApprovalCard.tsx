"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock, ShieldCheck, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { decideAgentAction } from "@/app/(app)/agent-actions";

type Status = "pending" | "approved" | "rejected" | "expired" | "failed";

// Human-in-the-loop card under a Yolias AI reply (D-141): the action runs
// only after Approve; Reject cancels it.
export function ApprovalCard({ id, summary, status }: { id: string; summary: string; status: Status }) {
  const { t } = useI18n();
  const a = t.agent.approval;
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const decide = (approve: boolean) =>
    start(async () => {
      setError(null);
      const r = await decideAgentAction(id, approve);
      if (!r.ok) setError(r.error ?? null);
      router.refresh();
    });
  const done = status !== "pending";
  return (
    <div className={`approval-card${done ? ` decided ${status}` : ""}`}>
      <div className="approval-head">
        {done ? status === "approved" ? <Check /> : status === "expired" ? <Clock /> : <X /> : <ShieldCheck />}
        <span>{done ? a[status] : a.title}</span>
      </div>
      <p className="approval-summary" dir="auto">{summary}</p>
      {!done && (
        <div className="approval-actions">
          <button type="button" className="btn-primary" disabled={pending} onClick={() => decide(true)}><Check /> {a.approve}</button>
          <button type="button" className="btn-secondary" disabled={pending} onClick={() => decide(false)}><X /> {a.reject}</button>
        </div>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  );
}
