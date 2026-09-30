import { RelTime } from "@/components/bos/RelTime";
import { getT } from "@/lib/bos/i18n/server";
import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { requirePermission, can } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { getToday } from "@/services/bos/attendance";
import { peopleScope } from "@/services/bos/team-scope";
import { listDepartments, listTeams } from "@/services/bos/shared";
import { PageHeader, StatusBadge, EmptyState, Card, KpiCard, UserAvatar } from "@/components/bos/ui";
import { FilterBar } from "@/components/bos/FilterBar";
import { LiveTimer } from "@/components/bos/LiveTimer";
import { formatMinutes, formatTime } from "@/lib/bos/format";
import { statusOptions } from "@/lib/bos/labels";
import { AttendanceNav } from "./AttendanceNav";
import { branchFilter } from "@/lib/bos/branch";

// Attendance → Today (§33).
export default async function AttendanceTodayPage({ searchParams }: { searchParams: SearchParams }) {
  const t = await getT();
  const { bos } = await requirePermission("attendance.read");
  const params = await readParams(searchParams);
  const { users, manages } = await peopleScope(bos, "attendance.read");
  const [rows, departments, teams] = await Promise.all([getToday(users, { ...params, branchIds: await branchFilter(bos) }), listDepartments(), listTeams()]);
  const count = (s: string | string[]) => rows.filter((r) => (Array.isArray(s) ? s.includes(r.status) : r.status === s)).length;
  return (
    <>
      <PageHeader title="الحضور — اليوم" subtitle={users && users.length === 1 ? "حضورك اليوم" : `${rows.length} موظف`} breadcrumbs={[{ label: "الفريق" }, { label: "الحضور" }]} actions={<Link href="/admin/team/attendance/me" className="admin-btn small"><Tx>حضوري</Tx></Link>} />
      <AttendanceNav active="today" hide={manages || bos.permissions.get("attendance.read") === "all" ? [] : ["employees", "reports"]} />
      <div className="bos-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 14 }}>
        <KpiCard label="حاضر" value={count(["present", "remote", "overtime"])} />
        <KpiCard label="متأخر" value={count("late")} />
        <KpiCard label="في استراحة" value={count("on_break")} />
        <KpiCard label="لم يسجل الحضور" value={count("not_clocked_in")} />
        <KpiCard label="إجازة" value={count("leave")} />
        <KpiCard label="يوم راحة / عطلة" value={count(["day_off", "holiday"])} />
        <KpiCard label="غائب" value={count("absent")} />
      </div>
      <FilterBar
        filters={[
          { key: "department", label: "القسم", type: "select", options: departments.map((d) => ({ value: d.id, label: d.name })) },
          { key: "team", label: "الفريق", type: "select", options: teams.map((t) => ({ value: t.id, label: t.name })) },
          { key: "status", label: "الحالة", type: "select", options: statusOptions("attendance_status") },
        ]}
      />
      <Card flush>
        {rows.length ? (
          <div className="bos-table-scroll">
            <table className="bos-table responsive">
              <thead>
                <tr>
                  <th><Tx>الموظف</Tx></th>
                  <th><Tx>الحالة</Tx></th>
                  <th><Tx>الدوام المجدول</Tx></th>
                  <th><Tx>آخر دخول</Tx></th>
                  <th><Tx>آخر خروج</Tx></th>
                  <th><Tx>الجلسة الحالية</Tx></th>
                  <th><Tx>العمل</Tx></th>
                  <th><Tx>المتوقع</Tx></th>
                  <th><Tx>إضافي</Tx></th>
                  <th><Tx>تأخير</Tx></th>
                  <th title={t("آخر إجراء مسجل في النظام — ليس دليلاً على العمل المتواصل")}><Tx>آخر نشاط في النظام</Tx></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ employee: e, record: r, openSince, status, schedule }) => (
                  <tr key={e.id}>
                    <td className="cell-primary cell-primary-mobile" data-label="الموظف">
                      <Link href={`/admin/team/employees/${e.id}?tab=attendance`} className="bos-row" style={{ gap: 8 }}><UserAvatar name={e.full_name} employeeId={e.id} />{e.full_name}</Link>
                      <span className="cell-sub">{e.position ?? ""}</span>
                      {r?.requires_review ? <span className="bos-badge tone-warning plain"><Tx>يحتاج مراجعة</Tx></span> : null}
                    </td>
                    <td data-label="الحالة"><StatusBadge map="attendance_status" value={status} />{schedule?.leave ? <span className="cell-sub"><Tx>{schedule.leave}</Tx></span> : null}</td>
                    <td data-label="الدوام المجدول">{schedule?.is_working ? (schedule.flexible ? "مرن" : `${schedule.start_time} → ${schedule.end_time}`) : <span className="bos-faint"><Tx>راحة</Tx></span>}<span className="cell-sub"><Tx>{schedule?.schedule_name ?? ""}</Tx></span></td>
                    <td data-label="الدخول">{r?.first_clock_in ? formatTime(r.first_clock_in, r.timezone) : "—"}</td>
                    <td data-label="الخروج">{r?.last_clock_out ? formatTime(r.last_clock_out, r.timezone) : "—"}</td>
                    <td data-label="الجلسة الحالية">{openSince ? <LiveTimer since={openSince} /> : "—"}</td>
                    <td data-label="العمل">{r ? formatMinutes(r.worked_minutes) : "—"}</td>
                    <td data-label="المتوقع">{r ? formatMinutes(r.expected_minutes) : "—"}</td>
                    <td data-label="إضافي">{r?.overtime_minutes ? formatMinutes(r.overtime_minutes) : "—"}</td>
                    <td data-label="تأخير">{r?.late_minutes ? formatMinutes(r.late_minutes) : "—"}</td>
                    <td data-label="آخر نشاط" className="bos-faint">{e.last_activity_at ? <RelTime value={e.last_activity_at} /> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState title="لا يوجد موظفون في هذا العرض" />}
      </Card>
      <p className="bos-faint" style={{ fontSize: 12, marginTop: 8 }}>
        <Tx>{"«آخر نشاط في النظام» هو آخر إجراء مسجل داخل نظام تايسونستا فقط، وليس دليلاً على العمل المتواصل. لا توجد لقطات شاشة أو تتبع لوحة مفاتيح أو مراقبة للأجهزة."}</Tx>
        {can(bos, "attendance.export") ? (
          <>
            {" · "}
            {/* CSV download from an API route — a plain anchor, not client navigation. */}
            <a className="bos-link" href="/api/bos/export/attendance" download><Tx>تصدير</Tx></a>
          </>
        ) : null}
      </p>
    </>
  );
}
