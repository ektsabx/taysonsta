import "server-only";
import { db, type Tables } from "@/lib/bos/db";
import type { BosUser } from "@/lib/bos/auth";
import { audit } from "@/lib/bos/audit";
import { NotFoundError, ValidationError } from "@/lib/bos/errors";
import { addDays } from "@/lib/bos/format";

// Scheduling system (docs/bos/28 §12–13): schedules with per-day hours,
// assignments at company / department / team / employee level, date shifts,
// public/company holidays and custom days off. Attendance, leave duration
// and absences read the same rules in SQL (bos_resolve_schedule_id,
// bos_schedule_day, bos_day_off_reason).

export type WorkSchedule = Tables<"work_schedules">;
export type ScheduleDay = Tables<"work_schedule_days">;

export const weekdayNames = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
// Display order starting Saturday (regional working week).
export const weekOrder = [6, 0, 1, 2, 3, 4, 5];

export async function listSchedules(includeInactive = true) {
  let q = db().from("work_schedules").select("*, work_schedule_days(*)").order("is_default", { ascending: false }).order("name");
  if (!includeInactive) q = q.eq("is_active", true);
  const { data } = await q;
  return (data ?? []).map((s) => ({ ...s, days: ((s.work_schedule_days as ScheduleDay[]) ?? []).sort((a, b) => a.weekday - b.weekday) }));
}

export interface ScheduleInput {
  name: string;
  schedule_type: WorkSchedule["schedule_type"];
  timezone: string;
  grace_minutes: number;
  half_day_minutes: number;
  overtime_after_minutes: number;
  required_minutes: number | null;
  description: string | null;
  color: string | null;
  is_active: boolean;
  days: { weekday: number; is_working: boolean; start_time: string; end_time: string; break_minutes: number }[];
}

function validTimezone(tz: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function validate(input: ScheduleInput) {
  if (!validTimezone(input.timezone)) throw new ValidationError("المنطقة الزمنية غير صالحة.", { timezone: "غير صالحة" });
  if (input.days.length !== 7 || new Set(input.days.map((d) => d.weekday)).size !== 7) throw new ValidationError("حدد الأيام السبعة.");
  if (!input.days.some((d) => d.is_working)) throw new ValidationError("حدد يوم عمل واحداً على الأقل.");
  if (input.schedule_type === "flexible" && !input.required_minutes) throw new ValidationError("الجدول المرن يحتاج عدد الساعات المطلوبة يومياً.", { required_minutes: "مطلوب" });
  for (const d of input.days.filter((x) => x.is_working)) {
    if (!/^\d{2}:\d{2}/.test(d.start_time) || !/^\d{2}:\d{2}/.test(d.end_time)) throw new ValidationError(`أوقات ${weekdayNames[d.weekday]} غير صالحة.`);
    if (d.start_time.slice(0, 5) === d.end_time.slice(0, 5)) throw new ValidationError(`البداية والنهاية متساويتان يوم ${weekdayNames[d.weekday]}.`);
    // end < start is allowed only for night schedules (crosses midnight).
    if (d.end_time.slice(0, 5) < d.start_time.slice(0, 5) && input.schedule_type !== "night") throw new ValidationError(`نهاية دوام ${weekdayNames[d.weekday]} قبل بدايته؛ اختر نوع «وردية ليلية» للدوام الذي يعبر منتصف الليل.`);
  }
}

export async function saveSchedule(bos: BosUser, id: string | null, input: ScheduleInput) {
  validate(input);
  const working = input.days.filter((d) => d.is_working).sort((a, b) => ((a.weekday + 1) % 7) - ((b.weekday + 1) % 7));
  const summary = {
    name: input.name,
    schedule_type: input.schedule_type,
    timezone: input.timezone,
    grace_minutes: input.grace_minutes,
    half_day_minutes: input.half_day_minutes,
    overtime_after_minutes: input.overtime_after_minutes,
    required_minutes: input.required_minutes,
    description: input.description,
    color: input.color,
    is_active: input.is_active,
    work_days: working.map((d) => d.weekday).sort(),
    start_time: working[0].start_time,
    end_time: working[0].end_time,
    break_minutes: working[0].break_minutes,
  };
  let scheduleId = id;
  if (id) {
    const { data: before } = await db().from("work_schedules").select("id, is_default").eq("id", id).maybeSingle();
    if (!before) throw new NotFoundError();
    if (before.is_default && !input.is_active) throw new ValidationError("لا يمكن تعطيل الجدول الافتراضي للشركة.");
    const { error } = await db().from("work_schedules").update(summary).eq("id", id);
    if (error) throw error;
  } else {
    const { data, error } = await db().from("work_schedules").insert(summary).select("id").single();
    if (error) throw error;
    scheduleId = data.id;
  }
  const { error: daysError } = await db().from("work_schedule_days").upsert(
    input.days.map((d) => ({ schedule_id: scheduleId as string, weekday: d.weekday, is_working: d.is_working, start_time: d.start_time, end_time: d.end_time, break_minutes: d.break_minutes })),
    { onConflict: "schedule_id,weekday" },
  );
  if (daysError) throw daysError;
  await audit({ actorId: bos.userId, action: id ? "schedule.updated" : "schedule.created", entityType: "work_schedule", entityId: scheduleId as string, newValue: { ...summary, days: input.days } });
  return scheduleId as string;
}

export async function setDefaultSchedule(bos: BosUser, id: string) {
  const { data } = await db().from("work_schedules").select("id, is_active").eq("id", id).maybeSingle();
  if (!data) throw new NotFoundError();
  if (!data.is_active) throw new ValidationError("فعّل الجدول أولاً.");
  await db().from("work_schedules").update({ is_default: false }).neq("id", id);
  await db().from("work_schedules").update({ is_default: true }).eq("id", id);
  await audit({ actorId: bos.userId, action: "schedule.default_changed", entityType: "work_schedule", entityId: id });
}

export async function deleteSchedule(bos: BosUser, id: string) {
  const { data: s } = await db().from("work_schedules").select("id, name, is_default").eq("id", id).maybeSingle();
  if (!s) throw new NotFoundError();
  if (s.is_default) throw new ValidationError("لا يمكن حذف الجدول الافتراضي.");
  const [{ count: emps }, { count: records }, { count: assigns }, { count: shifts }] = await Promise.all([
    db().from("employees").select("id", { count: "exact", head: true }).eq("work_schedule_id", id),
    db().from("attendance_records").select("id", { count: "exact", head: true }).eq("schedule_id", id),
    db().from("schedule_assignments").select("id", { count: "exact", head: true }).eq("schedule_id", id),
    db().from("shift_assignments").select("id", { count: "exact", head: true }).eq("schedule_id", id),
  ]);
  // Used schedules are deactivated, never deleted, so attendance history keeps its rules.
  if ((emps ?? 0) + (records ?? 0) + (assigns ?? 0) + (shifts ?? 0) > 0) {
    await db().from("work_schedules").update({ is_active: false }).eq("id", id);
    await audit({ actorId: bos.userId, action: "schedule.deactivated", entityType: "work_schedule", entityId: id, reason: "In use — deactivated instead of deleted" });
    return "deactivated" as const;
  }
  await db().from("work_schedules").delete().eq("id", id);
  await audit({ actorId: bos.userId, action: "schedule.deleted", entityType: "work_schedule", entityId: id, oldValue: { name: s.name } });
  return "deleted" as const;
}

// ---------------------------------------------------------------------------
// Assignments (company / department / team / employee) and date shifts
// ---------------------------------------------------------------------------

export async function listAssignments() {
  const { data } = await db().from("schedule_assignments").select("*, work_schedules(id, name), departments(id, name), teams(id, name), employees(id, full_name)").order("scope").order("effective_from", { ascending: false });
  return data ?? [];
}

export interface AssignmentInput {
  schedule_id: string;
  scope: "company" | "department" | "team" | "employee";
  target_id: string | null;
  effective_from: string;
  effective_to: string | null;
  notes: string | null;
}

export async function assignSchedule(bos: BosUser, input: AssignmentInput) {
  if (input.scope !== "company" && !input.target_id) throw new ValidationError("اختر القسم / الفريق / الموظف.", { target_id: "مطلوب" });
  if (input.effective_to && input.effective_to < input.effective_from) throw new ValidationError("تاريخ النهاية قبل البداية.", { effective_to: "غير صالح" });
  const row = {
    schedule_id: input.schedule_id,
    scope: input.scope,
    department_id: input.scope === "department" ? input.target_id : null,
    team_id: input.scope === "team" ? input.target_id : null,
    employee_id: input.scope === "employee" ? input.target_id : null,
    effective_from: input.effective_from,
    effective_to: input.effective_to,
    notes: input.notes,
    created_by: bos.userId,
  };
  const { data, error } = await db().from("schedule_assignments").insert(row).select("id").single();
  if (error) throw error;
  await audit({ actorId: bos.userId, action: "schedule.assigned", entityType: "work_schedule", entityId: input.schedule_id, newValue: row });
  return data.id;
}

export async function removeAssignment(bos: BosUser, id: string) {
  const { data } = await db().from("schedule_assignments").select("*").eq("id", id).maybeSingle();
  if (!data) throw new NotFoundError();
  await db().from("schedule_assignments").delete().eq("id", id);
  await audit({ actorId: bos.userId, action: "schedule.unassigned", entityType: "work_schedule", entityId: data.schedule_id, oldValue: data });
}

export async function setShifts(bos: BosUser, input: { employee_ids: string[]; from: string; to: string; schedule_id: string | null; weekdays: number[] | null; notes: string | null }) {
  if (input.to < input.from) throw new ValidationError("تاريخ النهاية قبل البداية.", { to: "غير صالح" });
  const days: string[] = [];
  for (let d = input.from; d <= input.to && days.length <= 92; d = addDays(d, 1)) {
    const dow = new Date(`${d}T00:00:00Z`).getUTCDay();
    if (!input.weekdays?.length || input.weekdays.includes(dow)) days.push(d);
  }
  if (days.length > 92) throw new ValidationError("الحد الأقصى 92 يوماً في المرة الواحدة.");
  if (!input.employee_ids.length) throw new ValidationError("اختر موظفاً واحداً على الأقل.", { employee_ids: "مطلوب" });
  if (input.schedule_id === null) {
    await db().from("shift_assignments").delete().in("employee_id", input.employee_ids).in("work_date", days);
  } else {
    const rows = input.employee_ids.flatMap((employee_id) => days.map((work_date) => ({ employee_id, work_date, schedule_id: input.schedule_id as string, notes: input.notes, created_by: bos.userId })));
    const { error } = await db().from("shift_assignments").upsert(rows, { onConflict: "employee_id,work_date" });
    if (error) throw error;
  }
  await audit({ actorId: bos.userId, action: input.schedule_id ? "shift.assigned" : "shift.cleared", entityType: "work_schedule", entityId: input.schedule_id ?? "00000000-0000-0000-0000-000000000000", newValue: { employees: input.employee_ids.length, days: days.length, from: input.from, to: input.to } });
  return days.length * input.employee_ids.length;
}

// ---------------------------------------------------------------------------
// Holidays and custom days off
// ---------------------------------------------------------------------------

export async function listHolidays(from: string, to: string) {
  const { data } = await db().from("holidays").select("*").gte("date", from).lte("date", to).order("date");
  return data ?? [];
}

export async function saveHoliday(bos: BosUser, id: string | null, input: { date: string; name: string; kind: "public" | "company"; country: string | null; is_paid: boolean; notes: string | null; end_date?: string | null }) {
  if (id) {
    const { error } = await db().from("holidays").update({ date: input.date, name: input.name, kind: input.kind, country: input.country, is_paid: input.is_paid, notes: input.notes }).eq("id", id);
    if (error) throw error.code === "23505" ? new ValidationError("توجد عطلة في نفس التاريخ لنفس الدولة.") : error;
    await audit({ actorId: bos.userId, action: "holiday.updated", entityType: "holiday", entityId: id, newValue: input });
    return 1;
  }
  // A range (e.g. Eid) creates one holiday row per day.
  const end = input.end_date && input.end_date >= input.date ? input.end_date : input.date;
  const rows = [];
  for (let d = input.date; d <= end && rows.length < 31; d = addDays(d, 1)) rows.push({ date: d, name: input.name, kind: input.kind, country: input.country, is_paid: input.is_paid, notes: input.notes });
  const { data, error } = await db().from("holidays").insert(rows).select("id");
  if (error) throw error.code === "23505" ? new ValidationError("توجد عطلة في أحد هذه الأيام لنفس الدولة.") : error;
  await audit({ actorId: bos.userId, action: "holiday.created", entityType: "holiday", entityId: data[0].id, newValue: { ...input, days: rows.length } });
  await recalcRange(input.date, end);
  return rows.length;
}

export async function deleteHoliday(bos: BosUser, id: string) {
  const { data } = await db().from("holidays").select("*").eq("id", id).maybeSingle();
  if (!data) throw new NotFoundError();
  await db().from("holidays").delete().eq("id", id);
  await audit({ actorId: bos.userId, action: "holiday.deleted", entityType: "holiday", entityId: id, oldValue: data });
  await recalcRange(data.date, data.date);
}

export async function listDaysOff(from: string, to: string) {
  const { data } = await db().from("employee_days_off").select("*, employees(id, full_name), teams(id, name), departments(id, name)").gte("date", from).lte("date", to).order("date");
  return data ?? [];
}

export async function addDaysOff(bos: BosUser, input: { scope: "employee" | "team" | "department"; target_id: string; from: string; to: string; reason: string }) {
  if (input.to < input.from) throw new ValidationError("تاريخ النهاية قبل البداية.", { to: "غير صالح" });
  const rows = [];
  for (let d = input.from; d <= input.to && rows.length < 62; d = addDays(d, 1)) {
    rows.push({ scope: input.scope, employee_id: input.scope === "employee" ? input.target_id : null, team_id: input.scope === "team" ? input.target_id : null, department_id: input.scope === "department" ? input.target_id : null, date: d, reason: input.reason, created_by: bos.userId });
  }
  const { error } = await db().from("employee_days_off").insert(rows);
  if (error) throw error;
  await audit({ actorId: bos.userId, action: "day_off.created", entityType: "employee_day_off", entityId: input.target_id, newValue: input });
  await recalcRange(input.from, input.to);
  return rows.length;
}

export async function removeDayOff(bos: BosUser, id: string) {
  const { data } = await db().from("employee_days_off").select("*").eq("id", id).maybeSingle();
  if (!data) throw new NotFoundError();
  await db().from("employee_days_off").delete().eq("id", id);
  await audit({ actorId: bos.userId, action: "day_off.deleted", entityType: "employee_day_off", entityId: id, oldValue: data });
  await recalcRange(data.date, data.date);
}

// Stored attendance days in a range follow new holiday / day-off rules.
async function recalcRange(from: string, to: string) {
  const { data } = await db().from("attendance_records").select("id").gte("work_date", from).lte("work_date", to);
  for (const r of data ?? []) await db().rpc("bos_recalc_attendance_day", { p_record: r.id });
}

// ---------------------------------------------------------------------------
// Weekly roster: resolved schedule per employee per day (read model)
// ---------------------------------------------------------------------------

export async function getRoster(employees: { id: string; user_id: string | null; full_name: string; team_id: string | null; department_id: string | null; country: string | null; photo_updated_at?: string | null }[], weekStart: string) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekEnd = days[6];
  const [schedules, { data: assigns }, { data: shifts }, { data: holidays }, { data: daysOff }, { data: leaves }, { data: base }] = await Promise.all([
    listSchedules(true),
    db().from("schedule_assignments").select("*").lte("effective_from", weekEnd).or(`effective_to.is.null,effective_to.gte.${weekStart}`),
    employees.length ? db().from("shift_assignments").select("*").in("employee_id", employees.map((e) => e.id)).gte("work_date", weekStart).lte("work_date", weekEnd) : Promise.resolve({ data: [] as Tables<"shift_assignments">[] }),
    db().from("holidays").select("*").gte("date", weekStart).lte("date", weekEnd),
    db().from("employee_days_off").select("*").gte("date", weekStart).lte("date", weekEnd),
    employees.length ? db().from("leave_requests").select("user_id, start_date, end_date, status, half_day, leave_types(name)").in("user_id", employees.map((e) => e.user_id).filter(Boolean) as string[]).eq("status", "approved").lte("start_date", weekEnd).gte("end_date", weekStart) : Promise.resolve({ data: [] as { user_id: string; start_date: string; end_date: string; status: string; half_day: boolean; leave_types: unknown }[] }),
    employees.length ? db().from("employees").select("id, work_schedule_id").in("id", employees.map((e) => e.id)) : Promise.resolve({ data: [] as { id: string; work_schedule_id: string | null }[] }),
  ]);
  const byId = new Map(schedules.map((s) => [s.id, s]));
  const defaultId = schedules.find((s) => s.is_default)?.id ?? null;
  const direct = new Map((base ?? []).map((e) => [e.id, e.work_schedule_id]));
  const active = (a: Tables<"schedule_assignments">, d: string) => a.effective_from <= d && (!a.effective_to || a.effective_to >= d);
  const latest = (list: Tables<"schedule_assignments">[]) => list.sort((a, b) => (b.effective_from.localeCompare(a.effective_from)) || b.created_at.localeCompare(a.created_at))[0]?.schedule_id ?? null;

  const rows = employees.map((e) => ({
    employee: e,
    days: days.map((d) => {
      const dow = new Date(`${d}T00:00:00Z`).getUTCDay();
      const a = (assigns ?? []) as Tables<"schedule_assignments">[];
      const scheduleId =
        (shifts ?? []).find((s) => s.employee_id === e.id && s.work_date === d)?.schedule_id ??
        latest(a.filter((x) => x.scope === "employee" && x.employee_id === e.id && active(x, d))) ??
        direct.get(e.id) ??
        (e.team_id ? latest(a.filter((x) => x.scope === "team" && x.team_id === e.team_id && active(x, d))) : null) ??
        (e.department_id ? latest(a.filter((x) => x.scope === "department" && x.department_id === e.department_id && active(x, d))) : null) ??
        latest(a.filter((x) => x.scope === "company" && active(x, d))) ??
        defaultId;
      const sched = scheduleId ? byId.get(scheduleId) ?? null : null;
      const day = sched?.days.find((x) => x.weekday === dow) ?? null;
      const holiday = (holidays ?? []).find((h) => h.date === d && (!h.country || h.country === e.country)) ?? null;
      const off = (daysOff ?? []).find((o) => o.date === d && ((o.scope === "employee" && o.employee_id === e.id) || (o.scope === "team" && o.team_id === e.team_id) || (o.scope === "department" && o.department_id === e.department_id))) ?? null;
      const leave = e.user_id ? (leaves ?? []).find((l) => l.user_id === e.user_id && l.start_date <= d && l.end_date >= d) ?? null : null;
      const shift = (shifts ?? []).some((s) => s.employee_id === e.id && s.work_date === d);
      return {
        date: d,
        schedule: sched ? { id: sched.id, name: sched.name, type: sched.schedule_type, color: sched.color } : null,
        working: !!day?.is_working && !holiday && !off,
        start: day?.start_time?.slice(0, 5) ?? null,
        end: day?.end_time?.slice(0, 5) ?? null,
        holiday: holiday?.name ?? null,
        dayOff: off?.reason ?? null,
        leave: leave ? ((leave.leave_types as { name: string } | null)?.name ?? "إجازة") : null,
        shift,
      };
    }),
  }));
  return { days, rows };
}
