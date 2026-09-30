import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { requirePermission } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { db } from "@/lib/bos/db";
import { getSystemTime } from "@/lib/bos/system-time";
import { listDaysOff, listHolidays, weekdayNames } from "@/services/bos/hr/schedules";
import { listDepartments, listTeams } from "@/services/bos/shared";
import { PageHeader, Card, EmptyState, StatusBadge } from "@/components/bos/ui";
import { formatDate } from "@/lib/bos/format";
import { DayOffButton, DeleteHolidayButton, HolidayButton, RemoveDayOffButton } from "../../HrControls";

// Public / company holidays, weekends (from schedules) and custom days off (§13).
export default async function HolidaysPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos } = await requirePermission("attendance.read");
  const sp = await readParams(searchParams);
  const { today } = await getSystemTime();
  const year = sp.year && /^\d{4}$/.test(sp.year) ? sp.year : today.slice(0, 4);
  const [holidays, daysOff, departments, teams, { data: employees }] = await Promise.all([
    listHolidays(`${year}-01-01`, `${year}-12-31`),
    listDaysOff(`${year}-01-01`, `${year}-12-31`),
    listDepartments(),
    listTeams(),
    db().from("employees").select("id, full_name").is("archived_at", null).order("full_name"),
  ]);
  const canManage = bos.permissions.get("attendance.manage") === "all" || bos.isSuperAdmin;
  return (
    <>
      <PageHeader title="العطلات وأيام الراحة" subtitle={<Tx vars={{ year }}>{"سنة {year} — الحضور يعتبر هذه الأيام راحة وليست غياباً"}</Tx>}
        actions={canManage ? <span className="bos-row" style={{ gap: 6 }}><HolidayButton /><DayOffButton departments={departments.map((d) => ({ value: d.id, label: d.name }))} teams={teams.map((t) => ({ value: t.id, label: t.name }))} employees={(employees ?? []).map((e) => ({ value: e.id, label: e.full_name }))} /></span> : null} />
      <div className="bos-row" style={{ gap: 8, marginBottom: 10 }}>
        <Link className="admin-btn small ghost" href={`/admin/team/schedules/holidays?year=${Number(year) - 1}`}>{Number(year) - 1}</Link>
        <Link className="admin-btn small ghost" href={`/admin/team/schedules/holidays?year=${Number(year) + 1}`}>{Number(year) + 1}</Link>
      </div>
      <div className="bos-grid cols-2" style={{ gap: 12 }}>
        <Card title={<Tx vars={{ holidays_count: holidays.length }}>{"العطلات ({holidays_count})"}</Tx>}>
          {holidays.length ? (
            <BosTable className="bos-table">
              <tbody>
                {holidays.map((h) => (
                  <tr key={h.id}>
                    <td>{formatDate(h.date)}<span className="cell-sub">{weekdayNames[new Date(`${h.date}T00:00:00Z`).getUTCDay()]}</span></td>
                    <td>{h.name}{h.notes ? <span className="cell-sub">{h.notes}</span> : null}</td>
                    <td><StatusBadge tone={h.kind === "public" ? "warning" : "accent"} label={h.kind === "public" ? "رسمية" : "شركة"} />{!h.is_paid ? <span className="cell-sub"><Tx>غير مدفوعة</Tx></span> : null}</td>
                    <td><Tx>{h.country ?? "الكل"}</Tx></td>
                    <td>{canManage ? <span className="bos-row" style={{ gap: 4 }}><HolidayButton initial={h} /><DeleteHolidayButton id={h.id} /></span> : null}</td>
                  </tr>
                ))}
              </tbody>
            </BosTable>
          ) : <EmptyState title="لا توجد عطلات" />}
        </Card>
        <Card title={<Tx vars={{ daysOff_count: daysOff.length }}>{"أيام راحة مخصصة ({daysOff_count})"}</Tx>}>
          {daysOff.length ? (
            <BosTable className="bos-table">
              <tbody>
                {daysOff.map((o) => (
                  <tr key={o.id}>
                    <td>{formatDate(o.date)}</td>
                    <td>{o.scope === "employee" ? (o.employees as { full_name: string } | null)?.full_name : o.scope === "team" ? `فريق ${(o.teams as { name: string } | null)?.name ?? ""}` : `قسم ${(o.departments as { name: string } | null)?.name ?? ""}`}</td>
                    <td>{o.reason}</td>
                    <td>{canManage ? <RemoveDayOffButton id={o.id} /> : null}</td>
                  </tr>
                ))}
              </tbody>
            </BosTable>
          ) : <EmptyState title="لا توجد أيام راحة مخصصة" />}
          <p className="bos-faint" style={{ fontSize: 12, marginTop: 8 }}><Tx>عطلات نهاية الأسبوع تأتي من أيام الراحة في كل جدول عمل.</Tx></p>
        </Card>
      </div>
    </>
  );
}
