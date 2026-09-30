import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import { requirePermission } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { getAttendanceReport } from "@/services/bos/attendance";
import { peopleScope } from "@/services/bos/team-scope";
import { PageHeader, Card, EmptyState, Tabs } from "@/components/bos/ui";
import { FilterBar } from "@/components/bos/FilterBar";
import { formatMinutes, todayIn, addDays, startOfMonth } from "@/lib/bos/format";

// Attendance reports (§33): daily, weekly, monthly, by employee, by department.
export default async function AttendanceReportsPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos } = await requirePermission("attendance.read");
  const sp = await readParams(searchParams);
  const { users } = await peopleScope(bos, "attendance.read");
  const today = todayIn(bos.employee.timezone);
  const range = sp.range ?? "month";
  const presets: Record<string, [string, string]> = {
    day: [today, today],
    week: [addDays(today, -new Date(`${today}T00:00:00Z`).getUTCDay()), today],
    month: [startOfMonth(today), today],
  };
  const [from, to] = sp.from && sp.to ? [sp.from, sp.to] : presets[range] ?? presets.month;
  const group = (sp.group as "employee" | "department" | "day") ?? "employee";
  const rows = await getAttendanceReport(users, from, to, group);
  const totals = rows.reduce((t, r) => ({ worked: t.worked + r.worked, overtime: t.overtime + r.overtime, late: t.late + r.lateMinutes, absent: t.absent + r.absences, present: t.present + r.present }), { worked: 0, overtime: 0, late: 0, absent: 0, present: 0 });
  return (
    <>
      <PageHeader title="تقارير الحضور" subtitle={`${from} → ${to}`} />
      <Tabs param="range" active={sp.from ? "custom" : range} baseHref={`/admin/team/attendance/reports?group=${group}`} tabs={[{ key: "day", label: "يومي" }, { key: "week", label: "أسبوعي" }, { key: "month", label: "شهري" }]} />
      <FilterBar
        filters={[
          { key: "group", label: "التجميع", type: "select", options: [{ value: "employee", label: "حسب الموظف" }, { value: "department", label: "حسب القسم" }, { value: "day", label: "حسب اليوم" }] },
          { key: "from", label: "من", type: "date" },
          { key: "to", label: "إلى", type: "date" },
        ]}
      />
      <Card flush>
        {rows.length ? (
          <div className="bos-table-scroll">
            <BosTable className="bos-table responsive">
              <thead><tr><th><Tx>{group === "employee" ? "الموظف" : group === "department" ? "القسم" : "اليوم"}</Tx></th><th><Tx>أيام مسجلة</Tx></th><th><Tx>حضور</Tx></th><th><Tx>تأخير (أيام)</Tx></th><th><Tx>دقائق التأخير</Tx></th><th><Tx>غياب</Tx></th><th><Tx>إجازات</Tx></th><th><Tx>نصف يوم</Tx></th><th><Tx>ساعات العمل</Tx></th><th><Tx>المتوقع</Tx></th><th><Tx>إضافي</Tx></th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key}>
                    <td className="cell-primary" data-label="البند"><Tx>{r.label}</Tx></td>
                    <td data-label="أيام">{r.days}</td>
                    <td data-label="حضور"><Tx>{r.present}</Tx></td>
                    <td data-label="تأخير"><Tx>{r.lateDays}</Tx></td>
                    <td data-label="دقائق التأخير"><Tx>{r.lateMinutes}</Tx></td>
                    <td data-label="غياب"><Tx>{r.absences}</Tx></td>
                    <td data-label="إجازات"><Tx>{r.leave}</Tx></td>
                    <td data-label="نصف يوم"><Tx>{r.halfDays}</Tx></td>
                    <td data-label="العمل">{formatMinutes(r.worked)}</td>
                    <td data-label="المتوقع">{formatMinutes(r.expected)}</td>
                    <td data-label="إضافي">{formatMinutes(r.overtime)}</td>
                  </tr>
                ))}
                <tr style={{ fontWeight: 700 }}>
                  <td><Tx>الإجمالي</Tx></td><td /><td><Tx>{totals.present}</Tx></td><td /><td><Tx>{totals.late}</Tx></td><td><Tx>{totals.absent}</Tx></td><td /><td /><td>{formatMinutes(totals.worked)}</td><td /><td>{formatMinutes(totals.overtime)}</td>
                </tr>
              </tbody>
            </BosTable>
          </div>
        ) : <EmptyState title="لا توجد بيانات في هذه الفترة" />}
      </Card>
    </>
  );
}
