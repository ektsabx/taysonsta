import { nowIso, nowMs } from "@/lib/bos/clock";
import "server-only";
import { db, dec } from "@/lib/bos/db";
import { scopeUserIds, type BosUser } from "@/lib/bos/auth";
import type { Scope } from "@/lib/bos/permissions";
import { audit, recordStatus } from "@/lib/bos/audit";
import { emitEvent } from "@/lib/bos/events";
import { getSetting } from "@/lib/bos/settings";
import { requestApproval } from "@/services/bos/approvals";
import { NotFoundError, ValidationError } from "@/lib/bos/errors";

// Leave (§39): Request → Manager Review → Approved / Rejected. Approval is
// decided through the generic engine (handlers/leave-approvals.ts).

export async function listLeaveTypes(activeOnly = true) {
  let q = db().from("leave_types").select("*").order("sort_order");
  if (activeOnly) q = q.eq("is_active", true);
  const { data } = await q;
  return data ?? [];
}

// Allowance = type allowance (or a per-employee override) + adjustments and
// carry-forward for the year (docs/bos/28 §14). Types restricted to a gender
// the employee does not match are hidden.
export async function getBalances(userId: string, year: number) {
  const [types, { data: requests }, { data: adjustments }, { data: emp }] = await Promise.all([
    listLeaveTypes(false),
    db().from("leave_requests").select("leave_type_id, duration_days, status").eq("user_id", userId).in("status", ["approved", "pending"]).gte("start_date", `${year}-01-01`).lte("start_date", `${year}-12-31`),
    db().from("leave_balance_adjustments").select("leave_type_id, days, kind").eq("user_id", userId).eq("year", year),
    db().from("employees").select("id").eq("user_id", userId).maybeSingle(),
  ]);
  const { data: priv } = emp ? await db().from("employee_private").select("gender").eq("employee_id", emp.id).maybeSingle() : { data: null };
  return types
    .filter((t) => !t.eligible_gender || !priv?.gender || t.eligible_gender === priv.gender)
    .map((t) => {
      const used = (requests ?? []).filter((r) => r.leave_type_id === t.id && r.status === "approved").reduce((s, r) => s + Number(r.duration_days), 0);
      const pending = (requests ?? []).filter((r) => r.leave_type_id === t.id && r.status === "pending").reduce((s, r) => s + Number(r.duration_days), 0);
      const adj = (adjustments ?? []).filter((a) => a.leave_type_id === t.id);
      const override = adj.filter((a) => a.kind === "allowance_override").at(-1);
      const base = override ? Number(override.days) : t.annual_allowance_days == null ? null : Number(t.annual_allowance_days);
      const extra = adj.filter((a) => a.kind !== "allowance_override").reduce((s, a) => s + Number(a.days), 0);
      const allowance = base == null ? null : base + extra;
      return { type: t, allowance, adjustments: extra, used, pending, remaining: allowance == null ? null : Math.max(0, allowance - used) };
    });
}

export async function addBalanceAdjustment(bos: BosUser, input: { user_id: string; leave_type_id: string; year: number; days: number; kind: "adjustment" | "carry_forward" | "allowance_override"; reason: string }) {
  if (!input.days) throw new ValidationError("عدد الأيام مطلوب.", { days: "مطلوب" });
  if (input.kind === "allowance_override" && input.days < 0) throw new ValidationError("الرصيد المخصص لا يكون سالباً.", { days: "غير صالح" });
  const { data: type } = await db().from("leave_types").select("id, name, carry_forward_max_days").eq("id", input.leave_type_id).maybeSingle();
  if (!type) throw new ValidationError("نوع الإجازة غير موجود.", { leave_type_id: "غير موجود" });
  if (input.kind === "carry_forward" && type.carry_forward_max_days != null && input.days > Number(type.carry_forward_max_days)) {
    throw new ValidationError(`الحد الأقصى للترحيل ${type.carry_forward_max_days} يوم.`, { days: "يتجاوز الحد" });
  }
  const { error } = await db().from("leave_balance_adjustments").insert({ ...input, created_by: bos.userId });
  if (error) throw error;
  const { data: emp } = await db().from("employees").select("id").eq("user_id", input.user_id).maybeSingle();
  await audit({ actorId: bos.userId, action: "leave.balance_adjusted", entityType: "employee", entityId: emp?.id ?? input.user_id, newValue: { type: type.name, ...input } });
}

export async function listBalanceAdjustments(userId: string, year: number) {
  const { data } = await db().from("leave_balance_adjustments").select("*, leave_types(name)").eq("user_id", userId).eq("year", year).order("created_at", { ascending: false });
  return data ?? [];
}

export async function listLeaveRequests(bos: BosUser, scope: Scope, f: { view?: string; status?: string; user?: string; type?: string; from?: string; to?: string }) {
  let q = db().from("leave_requests").select("*, leave_types(name, key, is_paid)").order("start_date", { ascending: false }).limit(300);
  if (f.view === "mine" || !f.view) q = q.eq("user_id", bos.userId);
  else {
    const users = await scopeUserIds(bos, scope);
    if (users) q = q.in("user_id", users);
    if (f.view === "team") q = q.neq("user_id", bos.userId);
  }
  if (f.status) q = q.eq("status", f.status as "pending");
  if (f.user) q = q.eq("user_id", f.user);
  if (f.type) q = q.eq("leave_type_id", f.type);
  if (f.from) q = q.gte("end_date", f.from);
  if (f.to) q = q.lte("start_date", f.to);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function getLeaveCalendar(bos: BosUser, scope: Scope, monthStart: string, monthEnd: string) {
  let q = db().from("leave_requests").select("id, user_id, start_date, end_date, half_day, status, leave_types(name, key)").in("status", ["approved", "pending"]).lte("start_date", monthEnd).gte("end_date", monthStart);
  const users = await scopeUserIds(bos, scope);
  if (users) q = q.in("user_id", users);
  const [{ data }, { data: holidays }] = await Promise.all([q, db().from("holidays").select("date, name, country").gte("date", monthStart).lte("date", monthEnd)]);
  return { leaves: data ?? [], holidays: holidays ?? [] };
}

export interface LeaveInput {
  leave_type_id: string;
  start_date: string;
  end_date: string;
  half_day: boolean;
  reason: string | null;
}

export async function requestLeave(bos: BosUser, userId: string, input: LeaveInput) {
  if (input.end_date < input.start_date) throw new ValidationError("تاريخ النهاية يجب أن يكون بعد البداية.", { end_date: "غير صالح" });
  if (input.half_day && input.start_date !== input.end_date) throw new ValidationError("نصف اليوم يكون ليوم واحد فقط.", { half_day: "يوم واحد" });
  const { data: type } = await db().from("leave_types").select("*").eq("id", input.leave_type_id).maybeSingle();
  if (!type || !type.is_active) throw new ValidationError("نوع الإجازة غير متاح.", { leave_type_id: "غير متاح" });
  if ((type.requires_reason || type.key === "unpaid") && !input.reason) throw new ValidationError("السبب مطلوب لهذا النوع من الإجازات.", { reason: "مطلوب" });
  if (type.eligible_gender) {
    const { data: emp } = await db().from("employees").select("id").eq("user_id", userId).maybeSingle();
    const { data: priv } = emp ? await db().from("employee_private").select("gender").eq("employee_id", emp.id).maybeSingle() : { data: null };
    if (priv?.gender && priv.gender !== type.eligible_gender) throw new ValidationError("هذا النوع من الإجازات غير متاح لهذا الموظف.", { leave_type_id: "غير متاح" });
  }
  if (type.min_notice_days && bos.userId === userId) {
    const minStart = new Date(nowMs() + type.min_notice_days * 86400000).toISOString().slice(0, 10);
    if (input.start_date < minStart) throw new ValidationError(`هذا النوع يتطلب إشعاراً مسبقاً ${type.min_notice_days} يوم على الأقل.`, { start_date: "إشعار غير كافٍ" });
  }

  const { data: days, error: durErr } = await db().rpc("bos_leave_duration", { p_user: userId, p_start: input.start_date, p_end: input.end_date, p_half: input.half_day });
  if (durErr) throw durErr;
  const duration = Number(days);
  if (!duration) throw new ValidationError("الفترة المختارة لا تحتوي أيام عمل (عطلة أو خارج جدول العمل).", { start_date: "لا أيام عمل" });
  if (type.max_consecutive_days && duration > Number(type.max_consecutive_days)) throw new ValidationError(`الحد الأقصى لهذا النوع ${type.max_consecutive_days} يوم متصل.`, { end_date: "يتجاوز الحد" });

  const balances = await getBalances(userId, Number(input.start_date.slice(0, 4)));
  const bal = balances.find((b) => b.type.id === type.id);
  const warning = bal && bal.remaining != null && duration > bal.remaining - bal.pending ? `تنبيه: الرصيد المتبقي (${bal.remaining - bal.pending} يوم) أقل من المطلوب (${duration}).` : null;

  const policies = await getSetting("approval_policies");
  const needsApproval = type.requires_approval && (policies as { leave?: { required?: boolean } }).leave?.required !== false;

  const { data, error } = await db()
    .from("leave_requests")
    .insert({ user_id: userId, leave_type_id: type.id, start_date: input.start_date, end_date: input.end_date, half_day: input.half_day, duration_days: dec(String(duration)), reason: input.reason, status: needsApproval ? "pending" : "approved", decided_at: needsApproval ? null : nowIso() })
    .select("*")
    .single();
  if (error) {
    if (error.code === "23P01") throw new ValidationError("تتداخل هذه الإجازة مع طلب إجازة آخر قيد الانتظار أو معتمد.", { start_date: "تداخل" });
    throw error;
  }
  await recordStatus("leave_request", data.id, null, data.status, bos.userId);
  await audit({ actorId: bos.userId, action: "leave.requested", entityType: "leave_request", entityId: data.id, newValue: { ...input, duration_days: duration, for_user: userId } });
  const { data: emp } = await db().from("employees").select("id, full_name").eq("user_id", userId).maybeSingle();
  if (needsApproval) {
    // Per-type approval rules win over the company leave approver.
    const approver = (policies as { leave?: { approver?: string } }).leave?.approver ?? "manager";
    const steps = type.approval_steps?.length ? type.approval_steps : [approver];
    await requestApproval({ type: "leave", entityType: "leave_request", entityId: data.id, title: `${emp?.full_name ?? ""} — ${type.name} (${input.start_date} → ${input.end_date}, ${duration}d)`, requestedBy: userId, steps, links: [{ type: "employee", id: emp?.id }] });
  } else {
    await db().rpc("bos_apply_leave", { p_leave: data.id });
  }
  await emitEvent({ type: "leave.requested", entityType: "employee", entityId: emp?.id ?? userId, summary: `Leave requested: ${type.name} ${input.start_date} → ${input.end_date}`, actorId: bos.userId, payload: { leave_id: data.id, employee_user_id: userId } });
  return { leave: data, warning };
}

export async function cancelLeave(bos: BosUser, leaveId: string, reason: string | null) {
  const { data: leave } = await db().from("leave_requests").select("*").eq("id", leaveId).maybeSingle();
  if (!leave) throw new NotFoundError();
  if (!["pending", "approved"].includes(leave.status)) throw new ValidationError("لا يمكن إلغاء هذا الطلب.");
  const today = nowIso().slice(0, 10);
  if (leave.status === "approved" && leave.start_date <= today && leave.user_id === bos.userId) throw new ValidationError("بدأت الإجازة بالفعل؛ تواصل مع الموارد البشرية لتعديلها.");
  await db().from("leave_requests").update({ status: "cancelled", decision_comment: reason }).eq("id", leaveId);
  await db().from("approvals").update({ status: "cancelled", decided_at: nowIso() }).eq("entity_type", "leave_request").eq("entity_id", leaveId).eq("status", "pending");
  await recordStatus("leave_request", leaveId, leave.status, "cancelled", bos.userId, reason);
  await audit({ actorId: bos.userId, action: "leave.cancelled", entityType: "leave_request", entityId: leaveId, oldValue: { status: leave.status }, reason });

  if (leave.status === "approved") {
    // Undo the attendance effect: leave-only days disappear, worked days are recalculated.
    const { data: records } = await db().from("attendance_records").select("id, work_date, attendance_sessions(id)").eq("user_id", leave.user_id).gte("work_date", leave.start_date).lte("work_date", leave.end_date);
    for (const r of records ?? []) {
      const sessions = (r.attendance_sessions as unknown as { id: string }[]) ?? [];
      if (!sessions.length && r.work_date >= today) await db().from("attendance_records").delete().eq("id", r.id);
      else await db().rpc("bos_recalc_attendance_day", { p_record: r.id });
    }
  }
}
