"use server";
import { nowIso } from "@/lib/bos/clock";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authorize, can, type BosUser } from "@/lib/bos/auth";
import { handleAction, parseForm, zf, type ActionState } from "@/lib/bos/action";
import { ForbiddenError, ValidationError } from "@/lib/bos/errors";
import { db } from "@/lib/bos/db";
import { zonedToUtc } from "@/lib/bos/format";
import type { PermissionKey } from "@/lib/bos/permissions";
import { canSeeEmployee, canSeeUser } from "@/services/bos/team-scope";
import { changeLifecycleStatus, createBosLogin, createEmployee, setBosLoginDisabled, setEmployeeRoles, updateEmployee, refreshEmployeeOnboardingSafe, separationTypes, type EmployeeInput, type LifecycleStatus, type SeparationType } from "@/services/bos/employees";
import { setEmployeeChecklistItem } from "@/services/bos/onboarding";
import { cancelLeave, requestLeave } from "@/services/bos/leave";
import { hrEditSession, requestCorrection, requestOvertime, setOvertimeCompensation } from "@/services/bos/attendance";
import { computeAllKpis, createKpi, saveManualKpiValue, setKpiAssignment, updateKpi, type KpiInput } from "@/services/bos/kpis";
import { acknowledgeReview, saveReview } from "@/services/bos/performance";
import { addGrant, requestAccess, saveCompanyAccount, setAccessStatus, setMfaStatus, syncBosMfaStatus, type AccessStatus } from "@/services/bos/it-access";
import { assignDevice, confirmReceipt, returnDevice, saveDevice, updateSecurityCheck } from "@/services/bos/devices";

function refreshTeam(employeeId?: string) {
  revalidatePath("/admin/team", "layout");
  if (employeeId) revalidatePath(`/admin/team/employees/${employeeId}`);
}

async function employeeUser(employeeId: string) {
  const { data } = await db().from("employees").select("id, user_id").eq("id", employeeId).maybeSingle();
  if (!data) throw new ValidationError("الموظف غير موجود.");
  return data;
}

async function assertPeople(bos: BosUser, key: PermissionKey, userId: string | null) {
  if (bos.permissions.get(key) === "all") return;
  if (!userId || !(await canSeeUser(bos, key, userId))) throw new ForbiddenError();
}

// ---------------------------------------------------------------------------
// Employees
// ---------------------------------------------------------------------------

const employeeSchema = z.object({
  full_name: zf.required("الاسم", 200),
  employee_code: zf.optionalText(50),
  email: zf.optionalEmail(),
  personal_email: zf.optionalEmail(),
  phone: zf.optionalText(50),
  position: zf.optionalText(200),
  department_id: zf.optionalUuid(),
  team_id: zf.optionalUuid(),
  manager_id: zf.optionalUuid(),
  start_date: zf.optionalDate(),
  employment_type: z.enum(["full_time", "part_time", "contractor", "intern", "freelancer"]).default("full_time"),
  work_schedule_id: zf.optionalUuid(),
  country: zf.optionalText(100),
  timezone: zf.required("المنطقة الزمنية", 64),
  is_remote: zf.checkbox().optional(),
  hourly_cost: zf.optionalMoney(),
  cost_currency: z.preprocess((v) => (v === "" ? null : v), zf.currency().nullable()),
  role_ids: z.array(z.string().uuid()).optional(),
  create_login: zf.checkbox().optional(),
  career_application_id: zf.optionalUuid(),
  // HR profile (docs/bos/28 §6)
  work_location: zf.optionalText(200),
  category_id: zf.optionalUuid(),
  probation_end_date: zf.optionalDate(),
  probation_status: z.enum(["none", "in_probation", "passed", "extended", "failed"]).default("none"),
  skills: zf.optionalText(1000),
  certifications: zf.optionalText(3000),
  qualifications: zf.optionalText(3000),
  experience_years: z.preprocess((v) => (v === "" || v === undefined ? null : v), z.string().regex(/^\d{1,2}(\.\d)?$/, "رقم غير صالح").nullable()),
  profile_notes: zf.optionalText(3000),
  hourly_cost_source: z.enum(["manual", "salary"]).default("manual"),
  branch_id: zf.optionalUuid(),
});

function toEmployeeInput(v: z.infer<typeof employeeSchema>): EmployeeInput {
  return {
    full_name: v.full_name,
    employee_code: v.employee_code ?? null,
    email: v.email ?? null,
    personal_email: v.personal_email ?? null,
    phone: v.phone ?? null,
    position: v.position ?? null,
    department_id: v.department_id,
    team_id: v.team_id,
    manager_id: v.manager_id,
    start_date: v.start_date,
    employment_type: v.employment_type,
    work_schedule_id: v.work_schedule_id,
    country: v.country ?? null,
    timezone: v.timezone,
    is_remote: Boolean(v.is_remote),
    hourly_cost: v.hourly_cost ?? null,
    cost_currency: v.cost_currency ?? null,
    work_location: v.work_location ?? null,
    category_id: v.category_id,
    probation_end_date: v.probation_end_date,
    probation_status: v.probation_status,
    skills: (v.skills ?? "").split(/[,،\n]/).map((x) => x.trim()).filter(Boolean),
    certifications: v.certifications ?? null,
    qualifications: v.qualifications ?? null,
    experience_years: v.experience_years,
    profile_notes: v.profile_notes ?? null,
    hourly_cost_source: v.hourly_cost_source,
    ...(v.branch_id ? { branch_id: v.branch_id } : {}),
  };
}

export async function createEmployeeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("createEmployee", async () => {
    const { bos } = await authorize("employees.create");
    const v = parseForm(employeeSchema, formData);
    const input = toEmployeeInput(v);
    if (!can(bos, "employees.view_sensitive")) {
      input.hourly_cost = null;
      input.cost_currency = null;
    }
    const emp = await createEmployee(bos, input, { roleIds: can(bos, "roles.assign") || can(bos, "employees.manage") ? v.role_ids ?? [] : [], createLogin: Boolean(v.create_login), careerApplicationId: v.career_application_id });
    refreshTeam();
    redirect(`/admin/team/employees/${emp.id}`);
  }, "تعذر إنشاء الموظف.");
}

export async function updateEmployeeAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("updateEmployee", async () => {
    const { bos } = await authorize("employees.update");
    const emp = await employeeUser(id);
    await assertPeople(bos, "employees.update", emp.user_id);
    const v = parseForm(employeeSchema, formData);
    await updateEmployee(bos, id, toEmployeeInput(v), { canSensitive: can(bos, "employees.view_sensitive") });
    if (v.role_ids && emp.user_id && (can(bos, "roles.assign") || can(bos, "employees.manage"))) await setEmployeeRoles(bos, id, v.role_ids);
    refreshTeam(id);
    redirect(`/admin/team/employees/${id}`);
  }, "تعذر حفظ بيانات الموظف.");
}

export async function changeLifecycleAction(id: string, to: string, reason?: string, separation?: { separation_type: string; notice_date: string | null; last_working_day: string | null }): Promise<ActionState> {
  return handleAction("changeLifecycle", async () => {
    const { bos } = await authorize("employees.update", "all");
    const sep = separation && (separationTypes as readonly string[]).includes(separation.separation_type)
      ? { separation_type: separation.separation_type as SeparationType, notice_date: separation.notice_date || null, last_working_day: separation.last_working_day || null }
      : undefined;
    await changeLifecycleStatus(bos, id, to as LifecycleStatus, reason?.trim() || null, sep);
    refreshTeam(id);
    return { ok: true, message: "تم تحديث حالة الموظف" };
  });
}

export async function createLoginAction(id: string): Promise<ActionState> {
  return handleAction("createLogin", async () => {
    const { bos } = await authorize("employees.manage");
    const { data: roles } = await db().from("employees").select("user_id").eq("id", id).single();
    if (roles?.user_id) throw new ValidationError("لدى الموظف حساب بالفعل.");
    await createBosLogin(bos, id, []);
    refreshTeam(id);
    return { ok: true, message: "تم إرسال دعوة الدخول إلى البريد الرسمي" };
  }, "تعذر إنشاء حساب الدخول.");
}

export async function setLoginDisabledAction(id: string, disabled: boolean): Promise<ActionState> {
  return handleAction("setLoginDisabled", async () => {
    const { bos } = await authorize("employees.manage");
    await setBosLoginDisabled(bos, id, disabled);
    refreshTeam(id);
    return { ok: true, message: disabled ? "تم تعطيل الدخول" : "تم تفعيل الدخول" };
  });
}

// ---------------------------------------------------------------------------
// Onboarding / offboarding checklists
// ---------------------------------------------------------------------------

export async function toggleEmployeeChecklistItemAction(employeeId: string, itemId: string, done: boolean): Promise<ActionState> {
  return handleAction("toggleEmployeeChecklistItem", async () => {
    const { bos } = await authorize("onboarding.read");
    const emp = await employeeUser(employeeId);
    if (!(await canSeeEmployee(bos, "onboarding.read", emp))) throw new ForbiddenError();
    await setEmployeeChecklistItem(bos, itemId, done, { canManage: can(bos, "onboarding.update") || can(bos, "onboarding.manage") });
    refreshTeam(employeeId);
    revalidatePath(`/admin/team/onboarding/${employeeId}`);
    return { ok: true };
  });
}

export async function refreshOnboardingAction(employeeId: string): Promise<ActionState> {
  return handleAction("refreshOnboarding", async () => {
    const { bos } = await authorize("onboarding.read");
    await refreshEmployeeOnboardingSafe(employeeId, bos.userId);
    revalidatePath(`/admin/team/onboarding/${employeeId}`);
    return { ok: true, message: "تم تحديث البنود التلقائية" };
  });
}

// ---------------------------------------------------------------------------
// Leave
// ---------------------------------------------------------------------------

const leaveSchema = z.object({
  user_id: zf.optionalUuid(),
  leave_type_id: zf.uuid("نوع الإجازة"),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ غير صالح"),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ غير صالح"),
  half_day: zf.checkbox().optional(),
  reason: zf.optionalText(2000),
});

export async function requestLeaveAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("requestLeave", async () => {
    const { bos } = await authorize("leave.create");
    const v = parseForm(leaveSchema, formData);
    const target = v.user_id ?? bos.userId;
    if (target !== bos.userId && bos.permissions.get("leave.create") !== "all") throw new ValidationError("يمكنك طلب إجازة لنفسك فقط.");
    const { warning } = await requestLeave(bos, target, { leave_type_id: v.leave_type_id, start_date: v.start_date, end_date: v.end_date, half_day: Boolean(v.half_day), reason: v.reason ?? null });
    refreshTeam();
    return { ok: true, message: warning ? `تم إرسال الطلب. ${warning}` : "تم إرسال طلب الإجازة" };
  }, "تعذر إرسال طلب الإجازة.");
}

export async function cancelLeaveAction(id: string, reason?: string): Promise<ActionState> {
  return handleAction("cancelLeave", async () => {
    const { bos } = await authorize("leave.read");
    const { data: leave } = await db().from("leave_requests").select("user_id").eq("id", id).maybeSingle();
    if (!leave) throw new ValidationError("الطلب غير موجود.");
    if (leave.user_id !== bos.userId && !can(bos, "leave.manage")) throw new ForbiddenError();
    await cancelLeave(bos, id, reason?.trim() || null);
    refreshTeam();
    return { ok: true, message: "تم إلغاء الإجازة" };
  });
}

// ---------------------------------------------------------------------------
// Attendance corrections, HR edits, overtime
// ---------------------------------------------------------------------------

const correctionSchema = z.object({
  work_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ غير صالح"),
  clock_in_time: zf.optionalText(5),
  clock_out_time: zf.optionalText(5),
  clock_out_next_day: zf.checkbox().optional(),
  session_id: zf.optionalUuid(),
  reason: zf.required("السبب", 2000),
});

async function scheduleTz(userId: string, fallback: string) {
  const { data } = await db().rpc("bos_employee_schedule", { p_user: userId });
  return (data as { timezone?: string } | null)?.timezone ?? fallback;
}

function nextDay(date: string) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export async function requestCorrectionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("requestCorrection", async () => {
    const { bos } = await authorize("attendance.create");
    const v = parseForm(correctionSchema, formData);
    const tz = await scheduleTz(bos.userId, bos.employee.timezone);
    await requestCorrection(bos, {
      work_date: v.work_date,
      requested_clock_in: v.clock_in_time ? zonedToUtc(v.work_date, v.clock_in_time, tz) : null,
      requested_clock_out: v.clock_out_time ? zonedToUtc(v.clock_out_next_day ? nextDay(v.work_date) : v.work_date, v.clock_out_time, tz) : null,
      reason: v.reason,
      session_id: v.session_id,
    });
    refreshTeam();
    return { ok: true, message: "تم إرسال طلب التصحيح إلى مديرك" };
  }, "تعذر إرسال طلب التصحيح.");
}

const hrEditSchema = z.object({
  user_id: zf.uuid("الموظف"),
  work_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ غير صالح"),
  session_id: zf.optionalUuid(),
  clock_in_time: zf.required("وقت الدخول", 5),
  clock_out_time: zf.optionalText(5),
  clock_out_next_day: zf.checkbox().optional(),
  reason: zf.required("السبب", 2000),
});

export async function hrEditSessionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("hrEditSession", async () => {
    const { bos } = await authorize("attendance.update", "all");
    const v = parseForm(hrEditSchema, formData);
    const { data: emp } = await db().from("employees").select("timezone").eq("user_id", v.user_id).single();
    const tz = await scheduleTz(v.user_id, emp?.timezone ?? "Africa/Cairo");
    await hrEditSession(bos, {
      user_id: v.user_id,
      work_date: v.work_date,
      session_id: v.session_id,
      clock_in_at: zonedToUtc(v.work_date, v.clock_in_time, tz),
      clock_out_at: v.clock_out_time ? zonedToUtc(v.clock_out_next_day ? nextDay(v.work_date) : v.work_date, v.clock_out_time, tz) : null,
      reason: v.reason,
    });
    refreshTeam();
    return { ok: true, message: "تم تعديل الحضور وتسجيله في سجل التدقيق" };
  }, "تعذر تعديل الحضور.");
}

const overtimeSchema = z.object({
  work_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ غير صالح"),
  hours: z.coerce.number().positive("أدخل عدد الساعات").max(16),
  reason: zf.required("السبب", 2000),
});

export async function requestOvertimeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("requestOvertime", async () => {
    const { bos } = await authorize("overtime.create");
    const v = parseForm(overtimeSchema, formData);
    await requestOvertime(bos, { work_date: v.work_date, minutes: Math.round(v.hours * 60), reason: v.reason });
    refreshTeam();
    return { ok: true, message: "تم إرسال طلب العمل الإضافي" };
  }, "تعذر إرسال الطلب.");
}

export async function setOvertimeCompensationAction(id: string, status: string): Promise<ActionState> {
  return handleAction("setOvertimeCompensation", async () => {
    const { bos } = await authorize("overtime.manage");
    await setOvertimeCompensation(bos, id, status as "paid");
    refreshTeam();
    return { ok: true, message: "تم تحديث حالة التعويض" };
  });
}

// ---------------------------------------------------------------------------
// KPIs & performance
// ---------------------------------------------------------------------------

const kpiSchema = z.object({
  name: zf.required("اسم المؤشر", 200),
  description: zf.optionalText(2000),
  category: zf.optionalText(100),
  role_id: zf.optionalUuid(),
  department_id: zf.optionalUuid(),
  owner_id: zf.optionalUuid(),
  data_source: zf.required("مصدر البيانات", 100),
  calculation: z.enum(["count", "sum", "avg", "ratio", "manual"]).default("count"),
  unit: z.enum(["count", "currency", "percent", "hours", "score"]).default("count"),
  direction: z.enum(["higher_better", "lower_better"]).default("higher_better"),
  target: zf.money("المستهدف"),
  period: z.enum(["weekly", "monthly", "quarterly", "yearly"]).default("monthly"),
  weight: z.preprocess((v) => (v === "" ? null : v), z.coerce.number().min(0).max(100).nullable()),
  weight_enabled: zf.checkbox().optional(),
  is_active: zf.checkbox().optional(),
});

export async function saveKpiAction(id: string | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("saveKpi", async () => {
    const { bos } = await authorize(id ? "kpis.update" : "kpis.create", "all");
    const v = parseForm(kpiSchema, formData);
    const input: KpiInput = { ...v, description: v.description ?? null, category: v.category ?? null, weight: v.weight == null ? null : String(v.weight), weight_enabled: Boolean(v.weight_enabled), is_active: Boolean(v.is_active) };
    if (id) await updateKpi(bos, id, input);
    else await createKpi(bos, input);
    revalidatePath("/admin/team/kpis");
    return { ok: true, message: "تم حفظ المؤشر" };
  }, "تعذر حفظ المؤشر.");
}

export async function setKpiAssignmentAction(kpiId: string, userId: string, assigned: boolean, targetOverride?: string): Promise<ActionState> {
  return handleAction("setKpiAssignment", async () => {
    const { bos } = await authorize("kpis.assign");
    await assertPeople(bos, "kpis.assign", userId);
    await setKpiAssignment(bos, kpiId, userId, assigned, targetOverride?.trim() || null);
    revalidatePath("/admin/team/kpis");
    return { ok: true };
  });
}

const manualValueSchema = z.object({ kpi_id: zf.uuid("المؤشر"), user_id: zf.uuid("الموظف"), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), actual: zf.money("القيمة"), note: zf.optionalText(1000) });

export async function saveManualKpiValueAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("saveManualKpiValue", async () => {
    const { bos } = await authorize("kpis.update");
    const v = parseForm(manualValueSchema, formData);
    await assertPeople(bos, "kpis.update", v.user_id);
    await saveManualKpiValue(bos, v.kpi_id, v.user_id, v.date, v.actual, v.note ?? null);
    refreshTeam();
    return { ok: true, message: "تم حفظ القيمة" };
  });
}

export async function computeKpisAction(): Promise<ActionState> {
  return handleAction("computeKpis", async () => {
    await authorize("kpis.manage", "all");
    const n = await computeAllKpis(nowIso().slice(0, 10));
    revalidatePath("/admin/team", "layout");
    return { ok: true, message: `تم حساب ${n} قيمة` };
  });
}

const reviewSchema = z.object({
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ غير صالح"),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ غير صالح"),
  summary: zf.optionalText(10000),
  strengths: zf.optionalText(10000),
  improvements: zf.optionalText(10000),
  goals: zf.optionalText(10000),
  submit: zf.checkbox().optional(),
  // HR & Workforce (docs/bos/28 §25)
  cycle_id: zf.optionalUuid(),
  review_type: z.enum(["periodic", "annual", "probation", "ad_hoc"]).default("periodic"),
  overall_rating: z.preprocess((v) => (v === "" || v === undefined ? null : v), z.coerce.number().min(1).max(5).nullable()),
  manager_rating: z.preprocess((v) => (v === "" || v === undefined ? null : v), z.coerce.number().min(1).max(5).nullable()),
  recommendation: z.enum(["none", "promotion", "salary_increase", "bonus", "pip", "confirm_probation", "extend_probation", "termination"]).default("none"),
  competencies: z.string().optional(),
});

function parseCompetencies(raw: string | undefined) {
  if (!raw) return [];
  try {
    return z.array(z.object({ name: z.string().max(100), rating: z.number().min(1).max(5).nullable(), comment: z.string().max(1000).nullable() })).parse(JSON.parse(raw));
  } catch {
    return [];
  }
}

export async function saveReviewAction(userId: string, reviewId: string | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("saveReview", async () => {
    const { bos } = await authorize("performance.create");
    await assertPeople(bos, "performance.create", userId);
    const v = parseForm(reviewSchema, formData);
    await saveReview(bos, userId, { period_start: v.period_start, period_end: v.period_end, summary: v.summary ?? null, strengths: v.strengths ?? null, improvements: v.improvements ?? null, goals: v.goals ?? null, cycle_id: v.cycle_id, review_type: v.review_type, overall_rating: v.overall_rating, manager_rating: v.manager_rating, recommendation: v.recommendation, competencies: parseCompetencies(v.competencies) }, reviewId, Boolean(v.submit));
    revalidatePath("/admin/team/performance/reviews");
    revalidatePath(`/admin/team/performance/${userId}`);
    return { ok: true, message: v.submit ? "تم إرسال المراجعة للموظف" : "تم حفظ المسودة" };
  }, "تعذر حفظ المراجعة.");
}

export async function acknowledgeReviewAction(reviewId: string): Promise<ActionState> {
  return handleAction("acknowledgeReview", async () => {
    const { bos } = await authorize("performance.read");
    await acknowledgeReview(bos, reviewId);
    revalidatePath("/admin/team", "layout");
    return { ok: true, message: "تم تأكيد الاطلاع" };
  });
}

// ---------------------------------------------------------------------------
// IT & access
// ---------------------------------------------------------------------------

export async function setAccessStatusAction(employeeId: string, grantId: string, status: string, level?: string): Promise<ActionState> {
  return handleAction("setAccessStatus", async () => {
    const { bos } = await authorize("access.manage", "all");
    await setAccessStatus(bos, grantId, status as AccessStatus, level === undefined ? {} : { level: level || null });
    refreshTeam(employeeId);
    return { ok: true, message: "تم تحديث حالة الوصول" };
  });
}

const grantSchema = z.object({ employee_id: zf.uuid("الموظف"), app_id: zf.uuid("التطبيق"), access_level: zf.optionalText(50), is_required: zf.checkbox().optional() });

export async function addGrantAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("addGrant", async () => {
    const { bos } = await authorize("access.manage", "all");
    const v = parseForm(grantSchema, formData);
    await addGrant(bos, v.employee_id, v.app_id, v.access_level ?? null, Boolean(v.is_required));
    refreshTeam(v.employee_id);
    return { ok: true, message: "تمت الإضافة" };
  });
}

const accessRequestSchema = z.object({ employee_id: zf.uuid("الموظف"), app_id: zf.uuid("التطبيق"), access_level: zf.optionalText(50), reason: zf.required("السبب", 2000) });

export async function requestAccessAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("requestAccess", async () => {
    const { bos } = await authorize("access.create");
    const v = parseForm(accessRequestSchema, formData);
    const emp = await employeeUser(v.employee_id);
    if (!(await canSeeEmployee(bos, "access.create", emp))) throw new ForbiddenError();
    await requestAccess(bos, { employeeId: v.employee_id, appId: v.app_id, level: v.access_level ?? null, reason: v.reason });
    refreshTeam(v.employee_id);
    return { ok: true, message: "تم إرسال طلب الوصول للموافقة" };
  }, "تعذر إرسال طلب الوصول.");
}

export async function regenerateChecklistAction(employeeId: string): Promise<ActionState> {
  return handleAction("regenerateChecklist", async () => {
    const { bos } = await authorize("access.manage", "all");
    const { data, error } = await db().rpc("bos_generate_access_checklist", { p_employee: employeeId, p_actor: bos.userId });
    if (error) throw error;
    await refreshEmployeeOnboardingSafe(employeeId, bos.userId);
    refreshTeam(employeeId);
    return { ok: true, message: `تم تحديث قائمة الصلاحيات المطلوبة (${data ?? 0})` };
  });
}

export async function setMfaStatusAction(employeeId: string, status: string): Promise<ActionState> {
  return handleAction("setMfaStatus", async () => {
    const { bos } = await authorize("access.manage", "all");
    await setMfaStatus(bos, employeeId, status as "enabled");
    refreshTeam(employeeId);
    return { ok: true, message: "تم تحديث حالة 2FA" };
  });
}

export async function syncMfaAction(employeeId: string): Promise<ActionState> {
  return handleAction("syncMfa", async () => {
    const { bos } = await authorize("access.read");
    const emp = await employeeUser(employeeId);
    if (emp.user_id !== bos.userId) await assertPeople(bos, "access.read", emp.user_id);
    const status = await syncBosMfaStatus(employeeId);
    refreshTeam(employeeId);
    return { ok: true, message: `حالة 2FA: ${status}` };
  });
}

const companyAccountSchema = z.object({
  employee_id: zf.uuid("الموظف"),
  app_id: zf.optionalUuid(),
  account_type: z.enum(["email", "sso", "app", "other"]).default("app"),
  provider: zf.required("المزوّد", 100),
  identifier: zf.required("معرّف الحساب", 200),
  status: z.enum(["not_started", "requested", "pending", "provisioned", "active", "rejected", "revoked", "expired"]).default("not_started"),
  owner_user_id: zf.optionalUuid(),
  recovery_owner_user_id: zf.optionalUuid(),
  mfa_status: z.enum(["required", "not_configured", "pending", "enabled", "disabled", "recovery_required"]).default("required"),
  mfa_method: zf.optionalText(100),
  last_reviewed_at: zf.optionalDateTime(),
  notes: zf.optionalText(2000),
});

export async function saveCompanyAccountAction(id: string | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("saveCompanyAccount", async () => {
    const { bos } = await authorize("access.manage", "all");
    const v = parseForm(companyAccountSchema, formData);
    await saveCompanyAccount(bos, id, { ...v, mfa_method: v.mfa_method ?? null, notes: v.notes ?? null, last_reviewed_at: v.last_reviewed_at });
    revalidatePath("/admin/team/accounts");
    refreshTeam(v.employee_id);
    return { ok: true, message: "تم حفظ الحساب" };
  }, "تعذر حفظ الحساب.");
}

// ---------------------------------------------------------------------------
// Devices
// ---------------------------------------------------------------------------

const deviceSchema = z.object({
  asset_id: zf.required("رقم الأصل", 50),
  type: z.enum(["laptop", "desktop", "monitor", "mobile", "tablet", "headset", "office_equipment", "software_license", "loanable", "spare_part", "other"]),
  name: zf.optionalText(200),
  purchase_value: zf.optionalMoney(),
  currency: z.preprocess((v) => (v === "" || v == null ? null : String(v).toUpperCase()), z.string().regex(/^[A-Z]{3}$/, "عملة غير صالحة").nullable()),
  vendor_id: zf.optionalUuid(),
  branch_id: zf.optionalUuid(),
  next_maintenance_date: zf.optionalDate(),
  quantity: z.preprocess((v) => (v === "" || v == null ? 1 : v), z.coerce.number().int().min(0).max(1000000)),
  min_quantity: z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().int().min(0).nullable()),
  license_seats: z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().int().min(1).max(100000).nullable()),
  license_expiry: zf.optionalDate(),
  license_account: zf.optionalText(200),
  model: zf.optionalText(200),
  serial_number: zf.optionalText(100),
  os: zf.optionalText(100),
  purchase_date: zf.optionalDate(),
  warranty_until: zf.optionalDate(),
  condition: z.enum(["new", "good", "fair", "poor", "damaged"]).default("good"),
  location: zf.optionalText(200),
  mdm_provider: zf.optionalText(100),
  mdm_reference: zf.optionalText(200),
  notes: zf.optionalText(2000),
});

export async function saveDeviceAction(id: string | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("saveDevice", async () => {
    const { bos } = await authorize(id ? "devices.update" : "devices.create", "all");
    const v = parseForm(deviceSchema, formData);
    const deviceId = await saveDevice(bos, id, { ...v, model: v.model ?? null, serial_number: v.serial_number ?? null, os: v.os ?? null, location: v.location ?? null, mdm_provider: v.mdm_provider ?? null, mdm_reference: v.mdm_reference ?? null, notes: v.notes ?? null, name: v.name ?? null, purchase_value: v.purchase_value != null ? Number(v.purchase_value) : null, license_account: v.license_account ?? null, quantity: v.type === "spare_part" ? v.quantity : 1 });
    revalidatePath("/admin/team/devices");
    if (!id) redirect(`/admin/team/devices/${deviceId}`);
    revalidatePath(`/admin/team/devices/${id}`);
    return { ok: true, message: "تم حفظ الجهاز" };
  }, "تعذر حفظ الجهاز.");
}

export async function assignDeviceAction(deviceId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("assignDevice", async () => {
    const { bos } = await authorize("devices.manage", "all");
    const v = parseForm(z.object({ employee_id: zf.uuid("الموظف"), condition: zf.optionalText(20) }), formData);
    await assignDevice(bos, deviceId, v.employee_id, v.condition ?? null);
    revalidatePath(`/admin/team/devices/${deviceId}`);
    refreshTeam(v.employee_id);
    return { ok: true, message: "تم تسليم الجهاز" };
  }, "تعذر تسليم الجهاز.");
}

export async function confirmReceiptAction(deviceId: string): Promise<ActionState> {
  return handleAction("confirmReceipt", async () => {
    const { bos } = await authorize("devices.read");
    await confirmReceipt(bos, deviceId);
    refreshTeam();
    revalidatePath(`/admin/team/devices/${deviceId}`);
    return { ok: true, message: "تم تأكيد الاستلام" };
  });
}

export async function returnDeviceAction(deviceId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("returnDevice", async () => {
    const { bos } = await authorize("devices.manage", "all");
    const v = parseForm(z.object({ condition: z.enum(["new", "good", "fair", "poor", "damaged"]), next_status: z.enum(["in_stock", "in_repair", "retired", "lost"]) }), formData);
    await returnDevice(bos, deviceId, v.condition, v.next_status);
    revalidatePath(`/admin/team/devices/${deviceId}`);
    refreshTeam();
    return { ok: true, message: "تم تسجيل الاسترجاع" };
  }, "تعذر تسجيل الاسترجاع.");
}

const tri = z.preprocess((v) => (v === "yes" ? true : v === "no" ? false : null), z.boolean().nullable());

export async function securityCheckAction(deviceId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("securityCheck", async () => {
    const { bos } = await authorize("devices.update", "all");
    const v = parseForm(z.object({ os_updated: tri, encryption_enabled: tri, screen_lock_enabled: tri, antivirus_enabled: tri, company_account_configured: tri }), formData);
    await updateSecurityCheck(bos, deviceId, v);
    revalidatePath(`/admin/team/devices/${deviceId}`);
    revalidatePath("/admin/team/devices");
    return { ok: true, message: "تم حفظ فحص الأمان" };
  });
}
