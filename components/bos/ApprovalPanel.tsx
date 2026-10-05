import { Tx } from "@/components/bos/I18n";
import { listApprovalsForEntity, describeApprovers, canDecide } from "@/services/bos/approvals";
import type { BosUser } from "@/lib/bos/auth";
import { formatDateTime } from "@/lib/bos/format";
import { StatusBadge } from "@/components/bos/ui";
import { ApprovalDecision } from "@/components/bos/ApprovalDecision";
import { statusLabel } from "@/lib/bos/labels";

const typeLabels: Record<string, string> = {
  proposal: "مراجعة المقترح",
  contract: "موافقة العقد",
  design: "موافقة التصميم",
  scope: "موافقة النطاق",
  invoice: "موافقة الفاتورة",
  leave: "موافقة الإجازة",
  expense: "موافقة المصروف",
  attendance_correction: "تصحيح الحضور",
  overtime: "العمل الإضافي",
  payroll: "اعتماد الرواتب",
  loan: "سلفة / قرض",
  bonus: "مكافأة",
  hr_request: "طلب موارد بشرية",
  job_offer: "عرض عمل",
  salary_adjustment: "تعديل راتب",
};

export { typeLabels as approvalTypeLabels };

// Approval component (§98): current + historical approvals for an entity,
// with approve/reject for whoever is the current approver.
export async function ApprovalPanel({ entityType, entityId, bos }: { entityType: string; entityId: string; bos: BosUser }) {
  const approvals = await describeApprovers(await listApprovalsForEntity(entityType, entityId));
  if (!approvals.length) return <div className="bos-faint" style={{ fontSize: 13 }}><Tx>لا توجد طلبات موافقة.</Tx></div>;

  const decidable = new Map<string, boolean>();
  for (const a of approvals) decidable.set(a.id, await canDecide(bos, a));

  return (
    <div className="bos-stack" style={{ gap: 10 }}>
      {approvals.map((a) => (
        <div key={a.id} style={{ border: "1px solid rgba(var(--bos-fg-rgb), 0.08)", borderRadius: 8, padding: 10 }}>
          <div className="bos-row" style={{ justifyContent: "space-between" }}>
            <strong style={{ fontSize: 13 }}>
              {typeLabels[a.approval_type] ?? a.approval_type}
              {a.total_steps > 1 ? <span className="bos-faint"> <Tx vars={{ step: a.step, total_steps: a.total_steps }}>{"· خطوة {step}/{total_steps}"}</Tx></span> : null}
              {a.version > 1 ? <span className="bos-faint"> · v{a.version}</span> : null}
            </strong>
            <StatusBadge map="approval_status" value={a.status} />
          </div>
          <div className="bos-faint" style={{ fontSize: 12, marginTop: 4 }}>
            طلب: {a.requesterLabel} · {formatDateTime(a.requested_at)} — الموافِق: {a.approverLabel}
            {a.decided_at ? ` · القرار: ${a.deciderLabel ?? "—"} ${formatDateTime(a.decided_at)}` : ""}
          </div>
          {a.decision_comment ? <div className="bos-prose" style={{ fontSize: 12.5, marginTop: 6 }}>{a.decision_comment}</div> : null}
          {decidable.get(a.id) ? <ApprovalDecision approvalId={a.id} /> : null}
        </div>
      ))}
      <div className="bos-faint" style={{ fontSize: 11.5 }}>الحالات: {["pending", "approved", "rejected"].map((s) => statusLabel("approval_status", s)).join(" · ")}</div>
    </div>
  );
}
