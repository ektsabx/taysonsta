"use client";

import { Tx, useT } from "@/components/bos/I18n";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { decideApprovalAction } from "@/app/admin/_actions/common";

// Approve / reject (reason required) / request changes (what to change).
export function ApprovalDecision({ approvalId }: { approvalId: string }) {
  const t = useT();
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function decide(decision: "approved" | "rejected" | "changes_requested") {
    if (decision === "rejected" && !comment.trim()) {
      setError("اكتب سبب الرفض.");
      return;
    }
    if (decision === "changes_requested" && !comment.trim()) {
      setError("اكتب التعديلات المطلوبة.");
      return;
    }
    startTransition(async () => {
      const result = await decideApprovalAction(approvalId, decision, comment.trim() || undefined);
      if (!result.ok) setError(result.error);
      else {
        setError(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="bos-stack" style={{ gap: 6, marginTop: 8 }}>
      <div className="bos-field">
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t("تعليق (مطلوب عند الرفض أو طلب التعديلات)")} style={{ minHeight: 56 }} />
      </div>
      <div className="bos-row">
        <button type="button" className="admin-btn small success" disabled={pending} aria-busy={pending} onClick={() => decide("approved")}>
          <Tx>موافقة</Tx>
        </button>
        <button type="button" className="admin-btn small secondary" disabled={pending} onClick={() => decide("changes_requested")}>
          <Tx>طلب تعديلات</Tx>
        </button>
        <button type="button" className="admin-btn small danger" disabled={pending} onClick={() => decide("rejected")}>
          <Tx>رفض</Tx>
        </button>
      </div>
      {error ? <span className="bos-field-error"><Tx>{error}</Tx></span> : null}
    </div>
  );
}
