import { nowIso, nowMs } from "@/lib/bos/clock";
import "server-only";
import { db, type Tables } from "@/lib/bos/db";
import type { BosUser } from "@/lib/bos/auth";
import { dispatchPendingEvents } from "@/lib/bos/events";
import { todayIn } from "@/lib/bos/format";
import { audit } from "@/lib/bos/audit";
import { emitEvent } from "@/lib/bos/events";
import { getSetting } from "@/lib/bos/settings";
import { requestApproval } from "@/services/bos/approvals";
import { NotFoundError, ValidationError } from "@/lib/bos/errors";

export interface ClockState {
  openSessionId: string | null;
  clockInAt: string | null;
  onBreak: boolean;
  record: Tables<"attendance_records"> | null;
  staleOpenSession: boolean;
  timezone: string;
}

export async function getClockState(bos: BosUser): Promise<ClockState> {
  const client = db();
  const { data: schedule } = await client.rpc("bos_employee_schedule", { p_user: bos.userId });
  const tz = (schedule as Tables<"work_schedules"> | null)?.timezone ?? bos.employee.timezone ?? "Africa/Cairo";
  const today = todayIn(tz);

  const [{ data: open }, { data: record }] = await Promise.all([
    client.from("attendance_sessions").select("id, clock_in_at, record_id").eq("user_id", bos.userId).is("clock_out_at", null).maybeSingle(),
    client.from("attendance_records").select("*").eq("user_id", bos.userId).eq("work_date", today).maybeSingle(),
  ]);

  let onBreak = false;
  let stale = false;
  if (open) {
    const { data: brk } = await client.from("attendance_breaks").select("id").eq("session_id", open.id).is("ended_at", null).maybeSingle();
    onBreak = !!brk;
    stale = open.record_id !== record?.id;
  }

  return {
    openSessionId: open?.id ?? null,
    clockInAt: open?.clock_in_at ?? null,
    onBreak,
    record: record ?? null,
    staleOpenSession: stale,
    timezone: tz,
  };
}

async function rpcOrThrow(fn: () => PromiseLike<{ error: unknown }>) {
  const { error } = await fn();
  if (error) throw error;
  await dispatchPendingEvents();
}

export function clockIn(bos: BosUser, source: "web" | "mobile", clientTz: string | null) {
  return rpcOrThrow(() => db().rpc("bos_clock_in", { p_user: bos.userId, p_source: source, p_client_tz: (clientTz ?? null) as string }));
}

export function clockOut(bos: BosUser, source: "web" | "mobile") {
  return rpcOrThrow(() => db().rpc("bos_clock_out", { p_user: bos.userId, p_source: source }));
}

export function startBreak(bos: BosUser) {
  return rpcOrThrow(() => db().rpc("bos_start_break", { p_user: bos.userId }));
}

export function endBreak(bos: BosUser) {
  return rpcOrThrow(() => db().rpc("bos_end_break", { p_user: bos.userId }));
}

// Operational activity signal (§34) — throttled to one write per minute.
export async function touchLastActivity(bos: BosUser): Promise<void> {
  const last = bos.employee.last_activity_at ? new Date(bos.employee.last_activity_at).getTime() : 0;
  if (nowMs() - last < 60_000) return;
  const now = nowIso();
  await db().from("employees").update({ last_activity_at: now }).eq("id", bos.employee.id);
  const { data: open } = await db().from("attendance_sessions").select("record_id").eq("user_id", bos.userId).is("clock_out_at", null).maybeSingle();
  if (open) {
    await db().from("attendance_records").update({ last_system_activity_at: now }).eq("id", open.record_id);
  }
}

// ---------------------------------------------------------------------------
// Views (§33): Today, My attendance, Team grid, Timesheets, Reports
// ---------------------------------------------------------------------------

type AttendanceRecord = Tables<"attendance_records">;

async function employeesInScope(users: string[] | null, f: { department?: string; team?: string; branchIds?: string[] | null } = {}) {
  let q = db().from("employees").select("id, user_id, full_name, position, timezone, department_id, team_id, work_schedule_id, last_activity_at, lifecycle_status, departments(name)").not("user_id", "is", null).is("archived_at", null).in("lifecycle_status", ["active", "onboarding", "on_leave", "pending_onboarding", "offboarding"]).order("full_name");
  if (users) q = q.in("user_id", users.length ? users : ["00000000-0000-0000-0000-000000000000"]);
  if (f.department) q = q.eq("department_id", f.department);
  if (f.team) q = q.eq("team_id", f.team);
  if (f.branchIds) q = q.in("branch_id", f.branchIds.length ? f.branchIds : ["00000000-0000-0000-0000-000000000000"]);
  const { data } = await q;
  return data ?? [];
}

export interface DayInfo {
  schedule_id: string | null;
  schedule_name: string | null;
  schedule_type: string | null;
  is_working: boolean;
  start_time: string | null;
  end_time: string | null;
  flexible: boolean;
  off_reason: "holiday" | "custom" | null;
  leave: string | null;
}

// Today per employee (docs/bos/28 §11): record + scheduled start/end; people
// without a record are "leave", "holiday", "day_off" or "not_clocked_in".
export async function getToday(users: string[] | null, f: { department?: string; team?: string; status?: string; branchIds?: string[] | null }) {
  const emps = await employeesInScope(users, f);
  const userIds = emps.map((e) => e.user_id as string);
  const dates = [...new Set(emps.map((e) => todayIn(e.timezone)))];
  const [{ data: records }, { data: open }, infos] = await Promise.all([
    userIds.length ? db().from("attendance_records").select("*").in("user_id", userIds).in("work_date", dates) : Promise.resolve({ data: [] as AttendanceRecord[] }),
    userIds.length ? db().from("attendance_sessions").select("user_id, clock_in_at, attendance_breaks(ended_at)").in("user_id", userIds).is("clock_out_at", null) : Promise.resolve({ data: [] as { user_id: string; clock_in_at: string; attendance_breaks: unknown }[] }),
    Promise.all(emps.map(async (e) => (await db().rpc("bos_employee_day_info", { p_user: e.user_id as string, p_date: todayIn(e.timezone) })).data as unknown as DayInfo | null)),
  ]);
  const rows = emps.map((e, i) => {
    const rec = (records ?? []).find((r) => r.user_id === e.user_id && r.work_date === todayIn(e.timezone)) ?? null;
    const session = (open ?? []).find((s) => s.user_id === e.user_id) ?? null;
    const onBreak = !!session && ((session.attendance_breaks as { ended_at: string | null }[]) ?? []).some((b) => !b.ended_at);
    const info = infos[i];
    const noRecord = info?.leave ? "leave" : info?.off_reason === "holiday" ? "holiday" : info && !info.is_working ? "day_off" : "not_clocked_in";
    const status: string = onBreak ? "on_break" : rec ? rec.status : noRecord;
    return { employee: e, record: rec, openSince: session?.clock_in_at ?? null, onBreak, status, schedule: info };
  });
  return f.status ? rows.filter((r) => r.status === f.status) : rows;
}

export async function getAttendanceRange(userId: string, from: string, to: string) {
  const { data } = await db().from("attendance_records").select("*, attendance_sessions(id, clock_in_at, clock_out_at, source, auto_closed, closed_reason)").eq("user_id", userId).gte("work_date", from).lte("work_date", to).order("work_date", { ascending: false });
  return data ?? [];
}

export function summarize(records: Pick<AttendanceRecord, "status" | "worked_minutes" | "overtime_minutes" | "late_minutes" | "expected_minutes">[]) {
  return {
    worked: records.reduce((s, r) => s + r.worked_minutes, 0),
    expected: records.reduce((s, r) => s + r.expected_minutes, 0),
    overtime: records.reduce((s, r) => s + r.overtime_minutes, 0),
    lateDays: records.filter((r) => r.late_minutes > 0).length,
    lateMinutes: records.reduce((s, r) => s + r.late_minutes, 0),
    absences: records.filter((r) => r.status === "absent").length,
    leave: records.filter((r) => r.status === "leave").length,
    present: records.filter((r) => ["present", "late", "overtime", "remote", "half_day", "on_break"].includes(r.status)).length,
    halfDays: records.filter((r) => r.status === "half_day").length,
  };
}

export async function getTeamGrid(users: string[] | null, from: string, to: string, f: { department?: string; team?: string; branchIds?: string[] | null } = {}) {
  const emps = await employeesInScope(users, f);
  const ids = emps.map((e) => e.user_id as string);
  const { data } = ids.length ? await db().from("attendance_records").select("user_id, work_date, status, worked_minutes, late_minutes, overtime_minutes, requires_review").in("user_id", ids).gte("work_date", from).lte("work_date", to) : { data: [] };
  return { employees: emps, records: data ?? [] };
}

export async function getTimesheets(users: string[] | null, from: string, to: string, userFilter?: string) {
  const target = userFilter ? [userFilter] : users;
  let s = db().from("attendance_sessions").select("id, user_id, clock_in_at, clock_out_at, source, auto_closed, attendance_records!inner(work_date)").gte("attendance_records.work_date", from).lte("attendance_records.work_date", to).order("clock_in_at", { ascending: false }).limit(2000);
  let t = db().from("time_entries").select("id, user_id, started_at, ended_at, duration_minutes, description, billable, source, projects(id, name), tasks(id, title)").gte("started_at", `${from}T00:00:00Z`).lte("started_at", `${to}T23:59:59Z`).order("started_at", { ascending: false }).limit(2000);
  if (target) {
    s = s.in("user_id", target.length ? target : ["00000000-0000-0000-0000-000000000000"]);
    t = t.in("user_id", target.length ? target : ["00000000-0000-0000-0000-000000000000"]);
  }
  const [{ data: sessions }, { data: entries }] = await Promise.all([s, t]);
  return { sessions: sessions ?? [], entries: entries ?? [] };
}

export async function getAttendanceReport(users: string[] | null, from: string, to: string, groupBy: "employee" | "department" | "day") {
  const emps = await employeesInScope(users);
  const ids = emps.map((e) => e.user_id as string);
  const { data } = ids.length ? await db().from("attendance_records").select("user_id, work_date, status, worked_minutes, expected_minutes, overtime_minutes, late_minutes").in("user_id", ids).gte("work_date", from).lte("work_date", to) : { data: [] };
  const records = data ?? [];
  const empByUser = new Map(emps.map((e) => [e.user_id as string, e]));
  const groups = new Map<string, { key: string; label: string; records: typeof records }>();
  for (const r of records) {
    const e = empByUser.get(r.user_id);
    const key = groupBy === "employee" ? r.user_id : groupBy === "department" ? e?.department_id ?? "none" : r.work_date;
    const label = groupBy === "employee" ? e?.full_name ?? "—" : groupBy === "department" ? (e?.departments as { name: string } | null)?.name ?? "بدون قسم" : r.work_date;
    const g = groups.get(key) ?? { key, label, records: [] };
    g.records.push(r);
    groups.set(key, g);
  }
  return [...groups.values()].map((g) => ({ key: g.key, label: g.label, ...summarize(g.records), days: g.records.length })).sort((a, b) => (groupBy === "day" ? (a.key < b.key ? 1 : -1) : a.label.localeCompare(b.label)));
}

// ---------------------------------------------------------------------------
// Corrections (§36), HR edits, overtime (§35)
// ---------------------------------------------------------------------------

async function assertNotLocked(workDate: string) {
  const policy = await getSetting("attendance_policy");
  const lock = (policy as { lock_before_date?: string | null }).lock_before_date;
  if (lock && workDate < lock) throw new ValidationError(`فترة الحضور قبل ${lock} مقفلة ولا يمكن تعديلها.`);
}

export async function requestCorrection(bos: BosUser, input: { work_date: string; requested_clock_in: string | null; requested_clock_out: string | null; reason: string; session_id: string | null }) {
  if (!input.reason.trim()) throw new ValidationError("السبب مطلوب.", { reason: "مطلوب" });
  if (!input.requested_clock_in && !input.requested_clock_out) throw new ValidationError("أدخل وقت الدخول أو الخروج المطلوب.", { requested_clock_in: "مطلوب" });
  if (input.requested_clock_in && input.requested_clock_out && input.requested_clock_out <= input.requested_clock_in) throw new ValidationError("وقت الخروج يجب أن يكون بعد وقت الدخول.", { requested_clock_out: "غير صالح" });
  await assertNotLocked(input.work_date);
  // Requested times must fall within 36h of the work date (§36 validation).
  const base = new Date(`${input.work_date}T00:00:00Z`).getTime();
  for (const t of [input.requested_clock_in, input.requested_clock_out]) {
    if (!t) continue;
    const ms = new Date(t).getTime();
    if (ms < base - 12 * 3600_000 || ms > base + 36 * 3600_000) throw new ValidationError("الأوقات المطلوبة يجب أن تكون ضمن يوم العمل المحدد.", { requested_clock_in: "خارج اليوم" });
  }
  const { data: record } = await db().from("attendance_records").select("*").eq("user_id", bos.userId).eq("work_date", input.work_date).maybeSingle();
  let session = null as Tables<"attendance_sessions"> | null;
  if (input.session_id) {
    const { data } = await db().from("attendance_sessions").select("*").eq("id", input.session_id).eq("user_id", bos.userId).maybeSingle();
    if (!data) throw new ValidationError("الجلسة غير موجودة.");
    session = data;
  }
  const { data: pending } = await db().from("attendance_corrections").select("id").eq("user_id", bos.userId).eq("work_date", input.work_date).eq("status", "pending").maybeSingle();
  if (pending) throw new ValidationError("يوجد طلب تصحيح قيد المراجعة لهذا اليوم.");

  const original = session
    ? { session_id: session.id, clock_in_at: session.clock_in_at, clock_out_at: session.clock_out_at, auto_closed: session.auto_closed }
    : record
      ? { first_clock_in: record.first_clock_in, last_clock_out: record.last_clock_out, status: record.status }
      : {};
  const { data, error } = await db()
    .from("attendance_corrections")
    .insert({ record_id: record?.id ?? null, session_id: session?.id ?? null, user_id: bos.userId, work_date: input.work_date, original, requested_clock_in: input.requested_clock_in, requested_clock_out: input.requested_clock_out, reason: input.reason.trim() })
    .select("*")
    .single();
  if (error) throw error;
  await audit({ actorId: bos.userId, action: "attendance.correction_requested", entityType: "attendance_correction", entityId: data.id, oldValue: original, newValue: { requested_clock_in: input.requested_clock_in, requested_clock_out: input.requested_clock_out }, reason: input.reason });
  const policies = await getSetting("approval_policies");
  const approver = (policies as { attendance_correction?: { approver?: string } }).attendance_correction?.approver ?? "manager";
  await requestApproval({ type: "attendance_correction", entityType: "attendance_correction", entityId: data.id, title: `${bos.employee.full_name} — تصحيح حضور ${input.work_date}`, requestedBy: bos.userId, steps: [approver], links: [{ type: "employee", id: bos.employee.id }] });
  await emitEvent({ type: "attendance.correction_requested", entityType: "employee", entityId: bos.employee.id, summary: `Attendance correction requested for ${input.work_date}`, actorId: bos.userId, payload: { correction_id: data.id, employee_user_id: bos.userId } });
  return data;
}

export async function listCorrections(users: string[] | null, f: { mine?: string; status?: string; userId: string }) {
  let q = db().from("attendance_corrections").select("*").order("submitted_at", { ascending: false }).limit(300);
  if (f.mine === "1") q = q.eq("user_id", f.userId);
  else if (users) q = q.in("user_id", users);
  if (f.status) q = q.eq("status", f.status as "pending");
  const { data } = await q;
  return data ?? [];
}

// HR direct edit: always audited with the reason (§36).
export async function hrEditSession(bos: BosUser, input: { user_id: string; work_date: string; session_id: string | null; clock_in_at: string; clock_out_at: string | null; reason: string }) {
  if (!input.reason.trim()) throw new ValidationError("السبب مطلوب لتعديل الحضور.", { reason: "مطلوب" });
  if (input.clock_out_at && input.clock_out_at <= input.clock_in_at) throw new ValidationError("وقت الخروج يجب أن يكون بعد الدخول.", { clock_out_at: "غير صالح" });
  await assertNotLocked(input.work_date);
  const c = db();
  const { data: sched } = await c.rpc("bos_employee_schedule", { p_user: input.user_id });
  const schedule = sched as Tables<"work_schedules"> | null;
  const { data: emp } = await c.from("employees").select("id, timezone, is_remote").eq("user_id", input.user_id).single();
  const { data: record } = await c.from("attendance_records").upsert({ user_id: input.user_id, work_date: input.work_date, schedule_id: schedule?.id ?? null, timezone: schedule?.timezone ?? emp?.timezone ?? "Africa/Cairo", is_remote: emp?.is_remote ?? true }, { onConflict: "user_id,work_date" }).select("*").single();
  if (!record) throw new ValidationError("تعذر إنشاء سجل الحضور.");
  let old: Record<string, unknown> = {};
  if (input.session_id) {
    const { data: s } = await c.from("attendance_sessions").select("*").eq("id", input.session_id).eq("user_id", input.user_id).single();
    if (!s) throw new NotFoundError();
    old = { clock_in_at: s.clock_in_at, clock_out_at: s.clock_out_at };
    const { error } = await c.from("attendance_sessions").update({ clock_in_at: input.clock_in_at, clock_out_at: input.clock_out_at, source: "hr", closed_reason: "hr_edit" }).eq("id", s.id);
    if (error) throw error;
  } else {
    const { error } = await c.from("attendance_sessions").insert({ record_id: record.id, user_id: input.user_id, clock_in_at: input.clock_in_at, clock_out_at: input.clock_out_at, source: "hr", closed_reason: "hr_edit" });
    if (error) {
      if (error.code === "23505") throw new ValidationError("لدى الموظف جلسة مفتوحة بالفعل.");
      throw error;
    }
  }
  await c.from("attendance_records").update({ requires_review: false, review_reason: null }).eq("id", record.id);
  await c.rpc("bos_recalc_attendance_day", { p_record: record.id });
  await audit({ actorId: bos.userId, action: "attendance.hr_edit", entityType: "attendance_record", entityId: record.id, oldValue: old, newValue: { clock_in_at: input.clock_in_at, clock_out_at: input.clock_out_at }, reason: input.reason, metadata: { employee_user_id: input.user_id, work_date: input.work_date } });
}

export async function requestOvertime(bos: BosUser, input: { work_date: string; minutes: number; reason: string }) {
  if (input.minutes <= 0 || input.minutes > 16 * 60) throw new ValidationError("عدد الدقائق غير صالح.", { minutes: "غير صالح" });
  if (!input.reason.trim()) throw new ValidationError("السبب مطلوب.", { reason: "مطلوب" });
  await assertNotLocked(input.work_date);
  // Actual overtime from attendance and the day type (workday / day off /
  // holiday) drive the rate used by payroll (docs/bos/28 §15).
  const [{ data: record }, { data: offReason }, { data: isWorkDay }] = await Promise.all([
    db().from("attendance_records").select("overtime_minutes").eq("user_id", bos.userId).eq("work_date", input.work_date).maybeSingle(),
    db().rpc("bos_day_off_reason", { p_employee: bos.employee.id, p_date: input.work_date }),
    db().rpc("bos_is_work_day", { p_user: bos.userId, p_date: input.work_date }),
  ]);
  const dayType = offReason === "holiday" ? "holiday" : isWorkDay ? "workday" : "day_off";
  const { data, error } = await db().from("overtime_requests").insert({ user_id: bos.userId, work_date: input.work_date, minutes: input.minutes, reason: input.reason.trim(), actual_minutes: record?.overtime_minutes ?? null, day_type: dayType }).select("*").single();
  if (error) throw error;
  await audit({ actorId: bos.userId, action: "overtime.requested", entityType: "overtime_request", entityId: data.id, newValue: input });
  await emitEvent({ type: "overtime.requested", entityType: "employee", entityId: bos.employee.id, summary: `Overtime requested: ${input.work_date} (${Math.round(input.minutes / 6) / 10}h)`, actorId: bos.userId, payload: { overtime_id: data.id, employee_user_id: bos.userId, actual_minutes: record?.overtime_minutes ?? null } });
  const policies = await getSetting("approval_policies");
  const approver = (policies as { overtime?: { approver?: string } }).overtime?.approver ?? "manager";
  await requestApproval({ type: "overtime", entityType: "overtime_request", entityId: data.id, title: `${bos.employee.full_name} — عمل إضافي ${input.work_date} (${Math.round(input.minutes / 6) / 10} س)`, requestedBy: bos.userId, steps: [approver], links: [{ type: "employee", id: bos.employee.id }] });
  return data;
}

export async function listOvertime(users: string[] | null, f: { mine?: string; status?: string; userId: string; from?: string; to?: string }) {
  let q = db().from("overtime_requests").select("*").order("work_date", { ascending: false }).limit(300);
  if (f.mine === "1") q = q.eq("user_id", f.userId);
  else if (users) q = q.in("user_id", users);
  if (f.status) q = q.eq("status", f.status);
  if (f.from) q = q.gte("work_date", f.from);
  if (f.to) q = q.lte("work_date", f.to);
  const { data } = await q;
  return data ?? [];
}

// HR / approver adjusts the approved minutes before payroll (e.g. approved
// less than requested). Paid overtime is locked.
export async function setOvertimeApprovedMinutes(bos: BosUser, id: string, minutes: number, reason: string) {
  const { data: ot } = await db().from("overtime_requests").select("*").eq("id", id).maybeSingle();
  if (!ot) throw new NotFoundError();
  if (ot.status !== "approved") throw new ValidationError("التعديل متاح للعمل الإضافي المعتمد فقط.");
  if (ot.payslip_id || ot.compensation_status === "paid") throw new ValidationError("تم صرف هذا العمل الإضافي في الرواتب.");
  if (minutes < 0 || minutes > 16 * 60) throw new ValidationError("عدد الدقائق غير صالح.", { minutes: "غير صالح" });
  if (!reason.trim()) throw new ValidationError("السبب مطلوب.", { reason: "مطلوب" });
  await db().from("overtime_requests").update({ approved_minutes: minutes }).eq("id", id);
  await audit({ actorId: bos.userId, action: "overtime.approved_minutes_changed", entityType: "overtime_request", entityId: id, oldValue: { approved_minutes: ot.approved_minutes }, newValue: { approved_minutes: minutes }, reason });
}

export async function setOvertimeCompensation(bos: BosUser, id: string, status: "pending" | "paid" | "time_off" | "not_applicable") {
  const { data: ot } = await db().from("overtime_requests").select("*").eq("id", id).maybeSingle();
  if (!ot) throw new NotFoundError();
  if (ot.status !== "approved") throw new ValidationError("التعويض متاح فقط للعمل الإضافي المعتمد.");
  await db().from("overtime_requests").update({ compensation_status: status }).eq("id", id);
  await audit({ actorId: bos.userId, action: "overtime.compensation_changed", entityType: "overtime_request", entityId: id, oldValue: { compensation_status: ot.compensation_status }, newValue: { compensation_status: status } });
}
