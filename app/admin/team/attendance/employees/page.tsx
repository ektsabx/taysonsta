import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { requirePermission } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { getTeamGrid } from "@/services/bos/attendance";
import { peopleScope } from "@/services/bos/team-scope";
import { listDepartments, listTeams } from "@/services/bos/shared";
import { PageHeader, Card, EmptyState } from "@/components/bos/ui";
import { FilterBar } from "@/components/bos/FilterBar";
import { todayIn, addDays, formatMinutes } from "@/lib/bos/format";
import { statusDef } from "@/lib/bos/labels";

const short: Record<string, string> = { present: "ح", late: "م", absent: "غ", half_day: "½", leave: "إ", holiday: "ع", overtime: "+", remote: "ح", on_break: "س" };

// Team attendance grid: employee × day (§33 Employees).
export default async function AttendanceEmployeesPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos } = await requirePermission("attendance.read");
  const sp = await readParams(searchParams);
  const { users } = await peopleScope(bos, "attendance.read");
  const today = todayIn(bos.employee.timezone);
  const to = sp.to ?? today;
  const from = sp.from ?? addDays(to, -13);
  const days: string[] = [];
  for (let d = from; d <= to && days.length < 62; d = addDays(d, 1)) days.push(d);
  const [{ employees, records }, departments, teams] = await Promise.all([getTeamGrid(users, from, to, sp), listDepartments(), listTeams()]);
  const byKey = new Map(records.map((r) => [`${r.user_id}|${r.work_date}`, r]));
  return (
    <>
      <PageHeader title="حضور الموظفين" subtitle={`${from} → ${to}`} />
      <FilterBar
        filters={[
          { key: "from", label: "من", type: "date" },
          { key: "to", label: "إلى", type: "date" },
          { key: "department", label: "القسم", type: "select", options: departments.map((d) => ({ value: d.id, label: d.name })) },
          { key: "team", label: "الفريق", type: "select", options: teams.map((t) => ({ value: t.id, label: t.name })) },
        ]}
      />
      <Card flush>
        {employees.length ? (
          <div className="bos-table-scroll">
            <BosTable className="bos-table bos-att-grid">
              <thead>
                <tr>
                  <th><Tx>الموظف</Tx></th>
                  {days.map((d) => <th key={d} title={d} style={{ textAlign: "center", fontSize: 11 }}>{d.slice(8)}<div className="bos-faint" style={{ fontSize: 10 }}>{["ح", "ن", "ث", "ر", "خ", "ج", "س"][new Date(`${d}T00:00:00Z`).getUTCDay()]}</div></th>)}
                  <th><Tx>العمل</Tx></th>
                </tr>
              </thead>
              <tbody>
                {employees.map((e) => {
                  const recs = days.map((d) => byKey.get(`${e.user_id}|${d}`));
                  return (
                    <tr key={e.id}>
                      <td style={{ whiteSpace: "nowrap" }}><Link href={`/admin/team/employees/${e.id}?tab=attendance&from=${from}&to=${to}`}>{e.full_name}</Link></td>
                      {recs.map((r, i) => {
                        if (!r) return <td key={i} style={{ textAlign: "center" }} className="bos-faint">·</td>;
                        const def = statusDef("attendance_status", r.status);
                        return (
                          <td key={i} style={{ textAlign: "center" }} title={`${def.label} · ${formatMinutes(r.worked_minutes)}${r.late_minutes ? ` · تأخير ${r.late_minutes}د` : ""}`}>
                            <span className={`bos-badge tone-${def.tone} plain`} style={{ minWidth: 22, justifyContent: "center", outline: r.requires_review ? "1px solid var(--bos-warning)" : undefined }}><Tx>{short[r.status] ?? "?"}</Tx></span>
                          </td>
                        );
                      })}
                      <td className="bos-num">{formatMinutes(recs.reduce((s, r) => s + (r?.worked_minutes ?? 0), 0))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </BosTable>
          </div>
        ) : <EmptyState title="لا يوجد موظفون" />}
      </Card>
      <p className="bos-faint" style={{ fontSize: 12, marginTop: 8 }}><Tx>ح حاضر · م متأخر · غ غائب · ½ نصف يوم · إ إجازة · ع عطلة · + عمل إضافي · س استراحة · الإطار الأصفر = يحتاج مراجعة</Tx></p>
    </>
  );
}
