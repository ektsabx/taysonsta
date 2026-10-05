import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { requirePermission } from "@/lib/bos/auth";
import { db } from "@/lib/bos/db";
import { getSystemTime } from "@/lib/bos/system-time";
import { listCurrencies } from "@/services/bos/shared";
import { listExpenseClaims, listHrRequests, listLoans, listRequestTypes } from "@/services/bos/hr/requests";
import { listLeaveRequests } from "@/services/bos/leave";
import { listOvertime } from "@/services/bos/attendance";
import { PageHeader, Card, KpiCard, StatusBadge, EmptyState } from "@/components/bos/ui";
import { formatDate } from "@/lib/bos/format";
import { ExpenseClaimButton, HrRequestButton, LoanButton } from "../HrControls";
import { LeaveRequestButton } from "../TeamControls";
import { listLeaveTypes } from "@/services/bos/leave";

// Expenses & Requests (docs/bos/28 §5 #9, §26): one place for an employee to
// raise every request, and for managers/HR to see what is pending.
export default async function RequestsHubPage() {
  const { bos } = await requirePermission("hr_requests.read");
  const { today } = await getSystemTime();
  const [claims, requests, loans, leave, overtime, types, leaveTypes, currencies, { data: categories }] = await Promise.all([
    listExpenseClaims({ userId: bos.userId }),
    listHrRequests({ userId: bos.userId }),
    listLoans({ userId: bos.userId }),
    listLeaveRequests(bos, "own", { view: "mine" }),
    listOvertime(null, { mine: "1", userId: bos.userId }),
    listRequestTypes(),
    listLeaveTypes(),
    listCurrencies(),
    db().from("expense_categories").select("id, name").eq("is_active", true).order("name"),
  ]);
  const { count: approvals } = await db().from("approvals").select("id", { count: "exact", head: true }).eq("status", "pending").eq("approver_user_id", bos.userId);
  const pending = (s: string) => s === "pending";
  return (
    <>
      <PageHeader title="المصروفات والطلبات" subtitle="قدّم طلباتك وتابع حالتها" actions={<Link className="admin-btn small secondary" href="/admin/approvals"><Tx vars={{ approvals: approvals ?? 0 }}>{"موافقاتي ({approvals})"}</Tx></Link>} />
      <Card title="طلب جديد">
        <div className="bos-row" style={{ gap: 8, flexWrap: "wrap" }}>
          <LeaveRequestButton types={leaveTypes.map((t) => ({ value: t.id, label: t.name }))} />
          <Link className="admin-btn small" href="/admin/team/overtime"><Tx>طلب عمل إضافي</Tx></Link>
          <LoanButton employees={[]} fixedEmployeeId={bos.employee.id} currencies={currencies} defaultPeriod={today.slice(0, 7)} />
          <ExpenseClaimButton employees={[]} fixedEmployeeId={bos.employee.id} categories={(categories ?? []).map((c) => ({ value: c.id, label: c.name }))} currencies={currencies} label="تقديم مصروف" />
          <HrRequestButton employees={[]} fixedEmployeeId={bos.employee.id} types={types.map((t) => ({ value: t.id, label: t.name }))} label="طلب آخر (شهادة، خطاب، معدات…)" />
        </div>
      </Card>
      <div className="bos-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 14 }}>
        <KpiCard label="إجازات معلقة" value={leave.filter((x) => pending(x.status)).length} href="/admin/team/leave" />
        <KpiCard label="عمل إضافي معلق" value={overtime.filter((x) => pending(x.status)).length} href="/admin/team/overtime" />
        <KpiCard label="مصروفات بانتظار" value={claims.filter((x) => pending(x.approval_status) || x.reimbursement_status === "pending").length} href="/admin/team/requests/expenses" />
        <KpiCard label="سلف / قروض" value={loans.filter((x) => ["pending", "approved", "active"].includes(x.status)).length} href="/admin/team/payroll/loans" />
        <KpiCard label="طلبات أخرى مفتوحة" value={requests.filter((x) => ["pending", "approved", "in_progress"].includes(x.status)).length} href="/admin/team/requests/other" />
      </div>
      <Card title="آخر طلباتي">
        {[...leave.slice(0, 5).map((x) => ({ key: `l${x.id}`, date: x.created_at, kind: "إجازة", title: `${(x.leave_types as { name: string } | null)?.name ?? ""} ${x.start_date} → ${x.end_date}`, status: <StatusBadge map="leave_status" value={x.status} /> })),
          ...claims.slice(0, 5).map((x) => ({ key: `e${x.id}`, date: x.created_at, kind: "مصروف", title: `${x.description} (${x.amount} ${x.currency})`, status: <StatusBadge map="simple_approval" value={x.approval_status} /> })),
          ...loans.slice(0, 5).map((x) => ({ key: `n${x.id}`, date: x.created_at, kind: x.loan_type === "advance" ? "سلفة" : "قرض", title: `${x.amount} ${x.currency}`, status: <StatusBadge map="loan_status" value={x.status} /> })),
          ...requests.slice(0, 5).map((x) => ({ key: `r${x.id}`, date: x.created_at, kind: (x.hr_request_types as { name: string } | null)?.name ?? "طلب", title: x.subject, status: <StatusBadge map="hr_request_status" value={x.status} /> })),
          ...overtime.slice(0, 5).map((x) => ({ key: `o${x.id}`, date: x.created_at, kind: "عمل إضافي", title: `${x.work_date} (${Math.round(x.minutes / 6) / 10} س)`, status: <StatusBadge map="overtime_status" value={x.status} /> })),
        ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15).map((r) => (
          <div key={r.key} className="bos-row" style={{ justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--bos-border)", fontSize: 13, gap: 8 }}>
            <span><span className="bos-faint">{r.kind}:</span> <Tx>{r.title}</Tx></span>
            <span className="bos-row" style={{ gap: 8 }}><Tx>{r.status}</Tx><span className="bos-faint" style={{ fontSize: 12 }}>{formatDate(r.date)}</span></span>
          </div>
        ))}
        {!leave.length && !claims.length && !loans.length && !requests.length && !overtime.length ? <EmptyState title="لا توجد طلبات بعد" /> : null}
      </Card>
    </>
  );
}
