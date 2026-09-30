import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { requirePermission } from "@/lib/bos/auth";
import { db } from "@/lib/bos/db";
import { listAssignments, listSchedules } from "@/services/bos/hr/schedules";
import { listDepartments, listTeams } from "@/services/bos/shared";
import { PageHeader, Card, EmptyState } from "@/components/bos/ui";
import { SubNav } from "@/components/bos/SubNav";
import { hrSection } from "@/lib/bos/hr-nav";
import { formatDate } from "@/lib/bos/format";
import { AssignScheduleButton, RemoveAssignmentButton } from "../../HrControls";

const scopeLabels: Record<string, string> = { company: "الشركة", department: "قسم", team: "فريق", employee: "موظف" };

// Schedule assignments at company / department / team / employee level (§12).
export default async function ScheduleAssignmentsPage() {
  const { bos } = await requirePermission("attendance.manage", "all");
  const [rows, schedules, departments, teams, { data: employees }, { data: direct }] = await Promise.all([
    listAssignments(),
    listSchedules(false),
    listDepartments(),
    listTeams(),
    db().from("employees").select("id, full_name").is("archived_at", null).order("full_name"),
    db().from("employees").select("id, full_name, work_schedules(name)").not("work_schedule_id", "is", null).is("archived_at", null).order("full_name"),
  ]);
  return (
    <>
      <PageHeader title="تعيين الجداول" subtitle="الأولوية: وردية يوم محدد ← الموظف ← الفريق ← القسم ← الشركة ← الجدول الافتراضي" breadcrumbs={[{ label: "الفريق" }, { label: "الجداول", href: "/admin/team/schedules" }, { label: "التعيينات" }]}
        actions={<AssignScheduleButton schedules={schedules.map((s) => ({ value: s.id, label: s.name }))} departments={departments.map((d) => ({ value: d.id, label: d.name }))} teams={teams.map((t) => ({ value: t.id, label: t.name }))} employees={(employees ?? []).map((e) => ({ value: e.id, label: e.full_name }))} />} />
      <SubNav items={hrSection(bos, "schedules")} active="assignments" label="الجداول" />
      <Card title="التعيينات (بتواريخ سريان)" flush>
        {rows.length ? (
          <table className="bos-table responsive">
            <thead><tr><th><Tx>المستوى</Tx></th><th><Tx>الهدف</Tx></th><th><Tx>الجدول</Tx></th><th><Tx>من</Tx></th><th><Tx>حتى</Tx></th><th><Tx>ملاحظات</Tx></th><th /></tr></thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}>
                  <td><Tx>{scopeLabels[a.scope]}</Tx></td>
                  <td>{a.scope === "company" ? "كل الشركة" : a.scope === "department" ? (a.departments as { name: string } | null)?.name : a.scope === "team" ? (a.teams as { name: string } | null)?.name : <Link href={`/admin/team/employees/${a.employee_id}?tab=schedule`}>{(a.employees as { full_name: string } | null)?.full_name}</Link>}</td>
                  <td>{(a.work_schedules as { name: string } | null)?.name}</td>
                  <td>{formatDate(a.effective_from)}</td>
                  <td><Tx>{a.effective_to ? formatDate(a.effective_to) : "مفتوح"}</Tx></td>
                  <td>{a.notes ?? "—"}</td>
                  <td><RemoveAssignmentButton id={a.id} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <EmptyState title="لا توجد تعيينات" description="بدون تعيينات يطبق الجدول الافتراضي للشركة على الجميع." />}
      </Card>
      <Card title="جدول محدد في ملف الموظف (دائم)">
        {(direct ?? []).length ? (direct ?? []).map((e) => <div key={e.id} style={{ fontSize: 13, marginBottom: 4 }}><Link href={`/admin/team/employees/${e.id}`}>{e.full_name}</Link> — {(e.work_schedules as { name: string } | null)?.name}</div>) : <div className="bos-faint" style={{ fontSize: 13 }}><Tx>لا يوجد — كل الموظفين يرثون الجدول.</Tx></div>}
      </Card>
    </>
  );
}
