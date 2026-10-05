import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { requirePermission } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { db } from "@/lib/bos/db";
import { getSystemTime } from "@/lib/bos/system-time";
import { peopleScope } from "@/services/bos/team-scope";
import { getRoster, listSchedules, weekdayNames } from "@/services/bos/hr/schedules";
import { listDepartments, listTeams } from "@/services/bos/shared";
import { PageHeader, Card, EmptyState, UserAvatar } from "@/components/bos/ui";
import { FilterBar } from "@/components/bos/FilterBar";
import { addDays, formatDate } from "@/lib/bos/format";
import { ShiftsButton } from "../HrControls";

// Weekly roster (docs/bos/28 §12–13): resolved schedule per person per day,
// with shifts, holidays, custom days off and approved leave.
export default async function RosterPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos } = await requirePermission("attendance.read");
  const sp = await readParams(searchParams);
  const { today } = await getSystemTime();
  const base = sp.week && /^\d{4}-\d{2}-\d{2}$/.test(sp.week) ? sp.week : today;
  const dow = new Date(`${base}T00:00:00Z`).getUTCDay();
  const weekStart = addDays(base, -((dow + 1) % 7)); // weeks start Saturday
  const { users } = await peopleScope(bos, "attendance.read");
  let q = db().from("employees").select("id, user_id, full_name, team_id, department_id, country, photo_updated_at, position").is("archived_at", null).in("lifecycle_status", ["active", "on_leave", "onboarding", "pending_onboarding", "offboarding"]).order("full_name");
  if (users) q = q.in("user_id", users.length ? users : ["00000000-0000-0000-0000-000000000000"]);
  if (sp.department) q = q.eq("department_id", sp.department);
  if (sp.team) q = q.eq("team_id", sp.team);
  const [{ data: emps }, schedules, departments, teams] = await Promise.all([q, listSchedules(false), listDepartments(), listTeams()]);
  const roster = await getRoster(emps ?? [], weekStart);
  const canManage = bos.permissions.get("attendance.manage") === "all" || bos.isSuperAdmin;
  return (
    <>
      <PageHeader title="جدول العمل الأسبوعي" subtitle={`${formatDate(weekStart)} → ${formatDate(addDays(weekStart, 6))}`}
        actions={canManage ? <ShiftsButton schedules={schedules.map((s) => ({ value: s.id, label: s.name }))} employees={(emps ?? []).map((e) => ({ value: e.id, label: e.full_name }))} /> : null} />
      <div className="bos-row" style={{ gap: 8, marginBottom: 10 }}>
        <Link className="admin-btn small ghost" href={`/admin/team/schedules?week=${addDays(weekStart, -7)}`}><Tx>الأسبوع السابق</Tx></Link>
        <Link className="admin-btn small ghost" href="/admin/team/schedules"><Tx>هذا الأسبوع</Tx></Link>
        <Link className="admin-btn small ghost" href={`/admin/team/schedules?week=${addDays(weekStart, 7)}`}><Tx>الأسبوع التالي</Tx></Link>
      </div>
      <FilterBar filters={[{ key: "department", label: "القسم", type: "select", options: departments.map((d) => ({ value: d.id, label: d.name })) }, { key: "team", label: "الفريق", type: "select", options: teams.map((t) => ({ value: t.id, label: t.name })) }]} />
      <Card flush>
        {roster.rows.length ? (
          <div className="bos-table-scroll">
            <table className="bos-roster">
              <thead>
                <tr>
                  <th><Tx>الموظف</Tx></th>
                  {roster.days.map((d) => <th key={d} style={d === today ? { color: "var(--bos-accent)" } : undefined}>{weekdayNames[new Date(`${d}T00:00:00Z`).getUTCDay()]}<br /><span className="bos-faint">{d.slice(5)}</span></th>)}
                </tr>
              </thead>
              <tbody>
                {roster.rows.map((r) => (
                  <tr key={r.employee.id}>
                    <td><Link href={`/admin/team/employees/${r.employee.id}?tab=schedule`} className="bos-row" style={{ gap: 8 }}><UserAvatar name={r.employee.full_name} employeeId={r.employee.id} version={r.employee.photo_updated_at} />{r.employee.full_name}</Link></td>
                    {r.days.map((d) => {
                      const cls = d.leave ? "leave" : d.holiday ? "holiday" : !d.working ? "off" : "";
                      return (
                        <td key={d.date}>
                          <span className={`cell ${cls}${d.shift ? " shift" : ""}`} title={d.schedule?.name ?? ""}>
                            {d.leave ? d.leave : d.holiday ? d.holiday : d.dayOff ? `راحة` : d.working ? (d.schedule?.type === "flexible" ? "مرن" : `${d.start}–${d.end}`) : "راحة"}
                            <small><Tx>{d.dayOff ?? d.schedule?.name ?? ""}</Tx></small>
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState title="لا يوجد موظفون" />}
      </Card>
      <p className="bos-faint" style={{ fontSize: 12 }}><Tx>الإطار المتقطع = وردية محددة لهذا اليوم. الأولوية: وردية اليوم ← تعيين الموظف ← الفريق ← القسم ← الشركة ← الجدول الافتراضي.</Tx></p>
    </>
  );
}
