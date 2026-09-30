import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { requirePermission } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { db } from "@/lib/bos/db";
import { listCorrections } from "@/services/bos/attendance";
import { peopleScope } from "@/services/bos/team-scope";
import { canDecide } from "@/services/bos/approvals";
import { userNameMap } from "@/services/bos/shared";
import { PageHeader, Card, StatusBadge, EmptyState, Tabs } from "@/components/bos/ui";
import { ApprovalDecision } from "@/components/bos/ApprovalDecision";
import { formatDate, formatDateTime } from "@/lib/bos/format";
import { AttendanceNav } from "../AttendanceNav";
import { CorrectionButton } from "../../TeamControls";

// Correction requests: mine / team queue (§36). Decisions go through the
// approval engine; approval applies the change with a full audit record.
export default async function CorrectionsPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos } = await requirePermission("attendance.read");
  const sp = await readParams(searchParams);
  const { users, manages } = await peopleScope(bos, "attendance.read");
  const canQueue = manages || bos.permissions.get("attendance.approve") === "all";
  const view = canQueue ? sp.view ?? "queue" : "mine";
  const rows = await listCorrections(view === "mine" ? null : users, { mine: view === "mine" ? "1" : undefined, status: sp.status ?? (view === "queue" ? "pending" : undefined), userId: bos.userId });
  const [names, { data: approvals }] = await Promise.all([
    userNameMap(),
    rows.length ? db().from("approvals").select("*").eq("entity_type", "attendance_correction").in("entity_id", rows.map((r) => r.id)).eq("status", "pending") : Promise.resolve({ data: [] }),
  ]);
  const decidable = new Map<string, string>();
  for (const a of approvals ?? []) if (await canDecide(bos, a)) decidable.set(a.entity_id, a.id);
  const { data: emps } = await db().from("employees").select("user_id, timezone").in("user_id", [...new Set(rows.map((r) => r.user_id))]);
  const tzOf = new Map((emps ?? []).map((e) => [e.user_id, e.timezone]));
  return (
    <>
      <PageHeader title="تصحيحات الحضور" breadcrumbs={[{ label: "الفريق" }, { label: "الحضور", href: "/admin/team/attendance" }, { label: "التصحيحات" }]} actions={<CorrectionButton label="+ طلب تصحيح" />} />
      <AttendanceNav active="corrections" />
      {canQueue ? <Tabs param="view" active={view} baseHref="/admin/team/attendance/corrections" tabs={[{ key: "queue", label: "بانتظار قراري / الفريق" }, { key: "all", label: "كل طلبات الفريق" }, { key: "mine", label: "طلباتي" }]} /> : null}
      <Card flush>
        {rows.length ? (
          <div className="bos-table-scroll">
            <table className="bos-table responsive">
              <thead><tr>{view !== "mine" ? <th><Tx>الموظف</Tx></th> : null}<th><Tx>اليوم</Tx></th><th><Tx>الأصل</Tx></th><th><Tx>المطلوب</Tx></th><th><Tx>السبب</Tx></th><th><Tx>الحالة</Tx></th><th /></tr></thead>
              <tbody>
                {rows.map((c) => {
                  const tz = tzOf.get(c.user_id) ?? "Africa/Cairo";
                  const o = (c.original ?? {}) as Record<string, string | null>;
                  return (
                    <tr key={c.id}>
                      {view !== "mine" ? <td className="cell-primary" data-label="الموظف">{names.get(c.user_id) ?? "—"}</td> : null}
                      <td data-label="اليوم">{formatDate(c.work_date)}<span className="cell-sub"><Tx vars={{ v: formatDateTime(c.submitted_at) }}>{"قُدّم {v}"}</Tx></span></td>
                      <td data-label="الأصل" style={{ fontSize: 12.5 }}>
                        {o.clock_in_at || o.first_clock_in ? `دخول ${formatDateTime((o.clock_in_at ?? o.first_clock_in) as string, tz)}` : "—"}
                        {o.clock_out_at || o.last_clock_out ? <div><Tx vars={{ v: formatDateTime((o.clock_out_at ?? o.last_clock_out) as string, tz) }}>{"خروج {v}"}</Tx></div> : <div className="bos-faint"><Tx>بدون خروج</Tx></div>}
                        {o.auto_closed ? <span className="bos-badge tone-danger plain"><Tx>إغلاق تلقائي</Tx></span> : null}
                      </td>
                      <td data-label="المطلوب" style={{ fontSize: 12.5 }}>
                        {c.requested_clock_in ? `دخول ${formatDateTime(c.requested_clock_in, tz)}` : ""}
                        {c.requested_clock_out ? <div><Tx vars={{ v: formatDateTime(c.requested_clock_out, tz) }}>{"خروج {v}"}</Tx></div> : null}
                      </td>
                      <td data-label="السبب" style={{ maxWidth: 240 }}>{c.reason}</td>
                      <td data-label="الحالة"><StatusBadge map="correction_status" value={c.status} />{c.reviewed_by ? <span className="cell-sub">{names.get(c.reviewed_by)} · {formatDate(c.reviewed_at)}</span> : null}{c.review_comment ? <span className="cell-sub"><Tx>{c.review_comment}</Tx></span> : null}</td>
                      <td className="col-actions">{decidable.get(c.id) ? <ApprovalDecision approvalId={decidable.get(c.id) as string} /> : null}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <EmptyState title="لا توجد طلبات تصحيح" />}
      </Card>
      <p className="bos-faint" style={{ fontSize: 12, marginTop: 8 }}><Tx>عند الموافقة يُطبّق التصحيح ويُعاد حساب اليوم، ويُسجل في التدقيق: من، متى، ماذا تغير، القيمة القديمة والجديدة، والسبب.</Tx> <Link className="bos-link" href="/admin/approvals"><Tx>كل الموافقات</Tx></Link></p>
    </>
  );
}
