import { requirePortalSection } from "@/lib/bos/portal-auth";
import { portalApprovals } from "@/services/bos/portal";
import { formatDateTime } from "@/lib/bos/format";
import { PBadge, PEmpty, PTop } from "../ui";
import { ApprovalButtons } from "../PortalControls";

export default async function PortalApprovalsPage() {
  const p = await requirePortalSection("approvals");
  const all = await portalApprovals(p);
  const pending = all.filter((a) => a.status === "pending");
  const decided = all.filter((a) => a.status !== "pending");
  return (
    <>
      <PTop title="الموافقات" />
      <div className="portal-card">
        <h2>بانتظار القرار ({pending.length})</h2>
        {pending.length ? pending.map((a) => (
          <div key={a.id} style={{ borderBottom: "1px solid var(--p-border)", padding: "10px 0" }}>
            <strong>{a.title}</strong> {a.total_steps > 1 ? <span className="portal-muted">(خطوة {a.step}/{a.total_steps})</span> : null}
            <div className="portal-muted">{formatDateTime(a.requested_at)}</div>
            {a.canDecide ? <ApprovalButtons id={a.id} /> : <p className="portal-muted">بانتظار قرار جهة اتصال أخرى من فريقك.</p>}
          </div>
        )) : <PEmpty title="لا توجد موافقات معلقة" />}
      </div>
      <div className="portal-card">
        <h2>السابقة</h2>
        {decided.length ? (
          <table className="portal-table">
            <thead><tr><th>الطلب</th><th>القرار</th><th>التاريخ</th><th>التعليق</th></tr></thead>
            <tbody>{decided.map((a) => <tr key={a.id}><td>{a.title}</td><td><PBadge map="approval_status" value={a.status} /></td><td>{formatDateTime(a.decided_at)}</td><td>{a.decision_comment ?? "—"}</td></tr>)}</tbody>
          </table>
        ) : <PEmpty title="لا يوجد" />}
      </div>
    </>
  );
}
