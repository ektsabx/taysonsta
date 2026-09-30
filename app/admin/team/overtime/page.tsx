import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import { requirePermission, can } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { db } from "@/lib/bos/db";
import { listOvertime } from "@/services/bos/attendance";
import { peopleScope } from "@/services/bos/team-scope";
import { canDecide } from "@/services/bos/approvals";
import { userNameMap } from "@/services/bos/shared";
import { PageHeader, Card, StatusBadge, EmptyState, Tabs, Summary } from "@/components/bos/ui";
import { FilterBar } from "@/components/bos/FilterBar";
import { ApprovalDecision } from "@/components/bos/ApprovalDecision";
import { formatDate, formatMinutes } from "@/lib/bos/format";
import { OvertimeMinutesButton } from "../HrControls";
import { CompensationSelect, OvertimeButton } from "../TeamControls";

// Overtime (§35): date, employee, hours, reason, approval, approved by, compensation.
export default async function OvertimePage({ searchParams }: { searchParams: SearchParams }) {
  const { bos } = await requirePermission("overtime.read");
  const canAdjust = bos.permissions.get("overtime.update") === "all" || bos.isSuperAdmin;
  const canMoney = bos.permissions.get("payroll.read") === "all" || bos.isSuperAdmin;
  const sp = await readParams(searchParams);
  const { users, manages } = await peopleScope(bos, "overtime.read");
  const canTeam = manages || bos.permissions.get("overtime.read") === "all";
  const view = canTeam ? sp.view ?? "team" : "mine";
  const rows = await listOvertime(view === "mine" ? null : users, { mine: view === "mine" ? "1" : undefined, status: sp.status, userId: bos.userId, from: sp.from, to: sp.to });
  const [names, { data: approvals }] = await Promise.all([
    userNameMap(),
    rows.length ? db().from("approvals").select("*").eq("entity_type", "overtime_request").in("entity_id", rows.map((r) => r.id)).eq("status", "pending") : Promise.resolve({ data: [] }),
  ]);
  const decidable = new Map<string, string>();
  for (const a of approvals ?? []) if (await canDecide(bos, a)) decidable.set(a.entity_id, a.id);
  const canComp = can(bos, "overtime.manage");
  return (
    <>
      <PageHeader title="العمل الإضافي" actions={can(bos, "overtime.create") ? <OvertimeButton /> : null} />
      {canTeam ? <Tabs param="view" active={view} baseHref="/admin/team/overtime" tabs={[{ key: "team", label: "الفريق" }, { key: "mine", label: "طلباتي" }]} /> : null}
      <FilterBar filters={[{ key: "status", label: "الحالة", type: "select", options: [{ value: "pending", label: "بانتظار المراجعة" }, { value: "approved", label: "معتمد" }, { value: "rejected", label: "مرفوض" }] }, { key: "from", label: "من", type: "date" }, { key: "to", label: "إلى", type: "date" }]} />
      <Summary items={[{ label: "معتمد", value: formatMinutes(rows.filter((r) => r.status === "approved").reduce((s, r) => s + r.minutes, 0)) }, { label: "بانتظار", value: formatMinutes(rows.filter((r) => r.status === "pending").reduce((s, r) => s + r.minutes, 0)) }, { label: "بانتظار التعويض", value: rows.filter((r) => r.status === "approved" && r.compensation_status === "pending").length }]} />
      <Card flush>
        {rows.length ? (
          <BosTable className="bos-table responsive">
            <thead><tr><th><Tx>التاريخ</Tx></th>{view !== "mine" ? <th><Tx>الموظف</Tx></th> : null}<th><Tx>الفعلي (الحضور)</Tx></th><th><Tx>المطلوب</Tx></th><th><Tx>المعتمد</Tx></th><th><Tx>المعامل</Tx></th><th><Tx>السبب</Tx></th><th><Tx>الموافقة</Tx></th><th><Tx>اعتمده</Tx></th><th><Tx>التعويض</Tx></th><th /></tr></thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id}>
                  <td className="cell-primary" data-label="التاريخ">{formatDate(o.work_date)}</td>
                  {view !== "mine" ? <td data-label="الموظف">{names.get(o.user_id) ?? "—"}</td> : null}
                  <td data-label="الفعلي">{o.actual_minutes != null ? formatMinutes(o.actual_minutes) : "—"}<span className="cell-sub"><StatusBadge map="overtime_day_type" value={o.day_type} /></span></td>
                  <td data-label="المطلوب">{formatMinutes(o.minutes)}</td>
                  <td data-label="المعتمد">{o.approved_minutes != null ? formatMinutes(o.approved_minutes) : "—"}{canAdjust && o.status === "approved" && !o.payslip_id ? <OvertimeMinutesButton id={o.id} minutes={o.approved_minutes ?? o.minutes} /> : null}</td>
                  <td data-label="المعامل">{o.rate_multiplier ? `×${o.rate_multiplier}` : "—"}{o.amount != null && canMoney ? <span className="cell-sub">{Number(o.amount).toLocaleString("en-US")} {o.currency}</span> : null}</td>
                  <td data-label="السبب" style={{ maxWidth: 260 }}>{o.reason}</td>
                  <td data-label="الموافقة"><StatusBadge map="overtime_status" value={o.status} /></td>
                  <td data-label="اعتمده">{o.approved_by ? `${names.get(o.approved_by) ?? "—"} · ${formatDate(o.approved_at)}` : "—"}</td>
                  <td data-label="التعويض">{o.status === "approved" && canComp ? <CompensationSelect id={o.id} status={o.compensation_status} /> : <StatusBadge map="compensation_status" value={o.compensation_status} />}</td>
                  <td className="col-actions">{decidable.get(o.id) ? <ApprovalDecision approvalId={decidable.get(o.id) as string} /> : null}</td>
                </tr>
              ))}
            </tbody>
          </BosTable>
        ) : <EmptyState title="لا توجد طلبات عمل إضافي" />}
      </Card>
    </>
  );
}
