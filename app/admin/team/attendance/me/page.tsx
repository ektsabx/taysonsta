import { BosTable } from "@/components/bos/BosTable";
import { DateRangeInputs } from "@/components/bos/DateRangeField";
import { Tx } from "@/components/bos/I18n";
import { requirePermission, can } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { getAttendanceRange, getClockState, summarize, listCorrections } from "@/services/bos/attendance";
import { PageHeader, Card, Summary, StatusBadge, EmptyState } from "@/components/bos/ui";
import { ClockCard } from "@/components/bos/ClockWidget";
import { formatDate, formatDateTime, formatMinutes, todayIn, addDays, startOfMonth } from "@/lib/bos/format";
import { AttendanceTable } from "../../TeamViews";
import { CorrectionButton, OvertimeButton } from "../../TeamControls";

// My Attendance (§33): START WORK / END WORK, today, week, month, history.
export default async function MyAttendancePage({ searchParams }: { searchParams: SearchParams }) {
  const { bos } = await requirePermission("attendance.create");
  const sp = await readParams(searchParams);
  const state = await getClockState(bos);
  const today = todayIn(state.timezone);
  const d = new Date(`${today}T00:00:00Z`);
  const weekStart = addDays(today, -d.getUTCDay());
  const from = sp.from ?? startOfMonth(today);
  const to = sp.to ?? today;
  const [week, month, history, corrections] = await Promise.all([
    getAttendanceRange(bos.userId, weekStart, today),
    getAttendanceRange(bos.userId, startOfMonth(today), today),
    getAttendanceRange(bos.userId, from, to),
    listCorrections(null, { mine: "1", userId: bos.userId }),
  ]);
  const w = summarize(week);
  const m = summarize(month);
  return (
    <>
      <PageHeader title="حضوري" subtitle={<Tx vars={{ timezone: state.timezone }}>{"بتوقيت {timezone}"}</Tx>} actions={<>{can(bos, "overtime.create") ? <OvertimeButton /> : null}<CorrectionButton /></>} />
      <div className="bos-grid main-side">
        <div>
          <ClockCard clockInAt={state.clockInAt} onBreak={state.onBreak} staleOpenSession={state.staleOpenSession} workedMinutesToday={state.record?.worked_minutes ?? 0} />
          {state.record ? (
            <Card title="سجل اليوم">
              <Summary
                items={[
                  { label: "الحالة", value: <StatusBadge map="attendance_status" value={state.onBreak ? "on_break" : state.record.status} /> },
                  { label: "الدخول", value: state.record.first_clock_in ? formatDateTime(state.record.first_clock_in, state.timezone) : "—" },
                  { label: "المتوقع", value: formatMinutes(state.record.expected_minutes) },
                  { label: "تأخير", value: state.record.late_minutes ? `${state.record.late_minutes} د` : "—" },
                ]}
              />
              {state.record.requires_review ? <div className="bos-alert warning"><Tx>{state.record.review_reason ?? "هذا اليوم يحتاج مراجعة — قدّم طلب تصحيح."}</Tx></div> : null}
            </Card>
          ) : null}
        </div>
        <div>
          <Card title="هذا الأسبوع"><Summary items={[{ label: "ساعات العمل", value: formatMinutes(w.worked) }, { label: "المتوقع", value: formatMinutes(w.expected) }, { label: "إضافي", value: formatMinutes(w.overtime) }, { label: "تأخير", value: `${w.lateDays} يوم` }]} /></Card>
          <Card title="هذا الشهر"><Summary items={[{ label: "ساعات العمل", value: formatMinutes(m.worked) }, { label: "أيام التأخير", value: m.lateDays }, { label: "الغياب", value: m.absences }, { label: "إضافي", value: formatMinutes(m.overtime) }, { label: "إجازات", value: m.leave }]} /></Card>
        </div>
      </div>
      <Card title="السجل">
        <form className="bos-row" style={{ gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
          <DateRangeInputs defaultFrom={from} defaultTo={to} submitOnApply />
          <button className="admin-btn small secondary" type="submit"><Tx>عرض</Tx></button>
        </form>
        <AttendanceTable
          rows={history}
          actions={(r) => <CorrectionButton workDate={r.work_date} label="تصحيح" sessions={((r.attendance_sessions as { id: string; clock_in_at: string; clock_out_at: string | null }[]) ?? []).map((s) => ({ value: s.id, label: `${formatDateTime(s.clock_in_at, r.timezone)} → ${s.clock_out_at ? formatDateTime(s.clock_out_at, r.timezone) : "مفتوحة"}` }))} />}
        />
      </Card>
      <Card title="طلبات التصحيح">
        {corrections.length ? (
          <BosTable className="bos-table responsive">
            <tbody>
              {corrections.map((c) => (
                <tr key={c.id}>
                  <td className="cell-primary">{formatDate(c.work_date)}<span className="cell-sub">{c.reason}</span></td>
                  <td>{c.requested_clock_in ? `دخول ${formatDateTime(c.requested_clock_in, state.timezone)}` : ""} {c.requested_clock_out ? `· خروج ${formatDateTime(c.requested_clock_out, state.timezone)}` : ""}</td>
                  <td><StatusBadge map="correction_status" value={c.status} />{c.review_comment ? <span className="cell-sub"><Tx>{c.review_comment}</Tx></span> : null}</td>
                </tr>
              ))}
            </tbody>
          </BosTable>
        ) : <EmptyState title="لا توجد طلبات تصحيح" />}
      </Card>
    </>
  );
}
