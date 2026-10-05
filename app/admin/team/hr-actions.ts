"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authorize, can, requireBosUserForAction, type BosUser } from "@/lib/bos/auth";
import { handleAction, parseForm, zf, type ActionState } from "@/lib/bos/action";
import { ForbiddenError, ValidationError } from "@/lib/bos/errors";
import { db } from "@/lib/bos/db";
import type { PermissionKey } from "@/lib/bos/permissions";
import { canSeeEmployee, managedEmployeeIds } from "@/services/bos/team-scope";
import { updateEmployeeChecklistItem } from "@/services/bos/onboarding";
import { addBalanceAdjustment } from "@/services/bos/leave";
import { setOvertimeApprovedMinutes } from "@/services/bos/attendance";
import { saveEmployeePrivate, addCompensation, setEmployeeComponent, endEmployeeComponent, promoteEmployee, createPhotoUpload, finalizePhoto, removePhoto } from "@/services/bos/hr/people";
import { createDocument, updateDocument, verifyDocument, archiveDocument, createContract, updateContract, contractAction, renewContract, type ContractAction } from "@/services/bos/hr/documents";
import { saveSchedule, setDefaultSchedule, deleteSchedule, assignSchedule, removeAssignment, setShifts, saveHoliday, deleteHoliday, addDaysOff, removeDayOff } from "@/services/bos/hr/schedules";
import { createRun, calculateRun, submitRun, publishPayslips, markRunPaid, cancelRun, addManualLine, removeManualLine } from "@/services/bos/hr/payroll";
import { requestBonus, cancelBonus, requestLoan, disburseLoan, settleInstallmentManually, cancelLoan, submitExpenseClaim, reimburseDirectly, submitHrRequest, progressHrRequest } from "@/services/bos/hr/requests";
import { saveGoal, updateGoalProgress, saveCycle, setCycleStatus, submitSelfAssessment, requestFeedback, submitFeedback } from "@/services/bos/hr/performance";

// HR & Workforce server actions (docs/bos/28). Every action authorizes the
// permission and the record scope (own / managed / all) before the service.

const all = (bos: BosUser, key: PermissionKey) => bos.permissions.get(key) === "all" || bos.isSuperAdmin;

async function employeeRef(employeeId: string) {
  const { data } = await db().from("employees").select("id, user_id, full_name").eq("id", employeeId).maybeSingle();
  if (!data) throw new ValidationError("الموظف غير موجود.");
  return data;
}

async function isManagerOf(bos: BosUser, employeeId: string) {
  return (await managedEmployeeIds(bos)).includes(employeeId);
}

function refresh(employeeId?: string, ...paths: string[]) {
  revalidatePath("/admin/team", "layout");
  if (employeeId) revalidatePath(`/admin/team/employees/${employeeId}`);
  for (const p of paths) revalidatePath(p);
}

const date = () => z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ غير صالح");
const month = () => z.string().regex(/^\d{4}-\d{2}$/, "الشهر غير صالح");

// ---------------------------------------------------------------------------
// Employee 360: private data, photo, compensation, promotion, exit interview
// ---------------------------------------------------------------------------

const privateSchema = z.object({
  date_of_birth: zf.optionalDate(),
  gender: z.preprocess((v) => (v === "" ? null : v), z.enum(["male", "female"]).nullable().optional()),
  nationality: zf.optionalText(100),
  marital_status: z.preprocess((v) => (v === "" ? null : v), z.enum(["single", "married", "divorced", "widowed"]).nullable().optional()),
  address: zf.optionalText(500),
  national_id: zf.optionalText(50),
  national_id_expiry: zf.optionalDate(),
  passport_number: zf.optionalText(50),
  passport_expiry: zf.optionalDate(),
  tax_id: zf.optionalText(50),
  insurance_number: zf.optionalText(50),
  insurance_start_date: zf.optionalDate(),
  bank_name: zf.optionalText(120),
  bank_account_name: zf.optionalText(200),
  bank_account_number: zf.optionalText(60),
  bank_iban: zf.optionalText(60),
  emergency_contact_name: zf.optionalText(200),
  emergency_contact_relation: zf.optionalText(100),
  emergency_contact_phone: zf.optionalText(50),
  hr_notes: zf.optionalText(5000),
});

export async function savePrivateAction(employeeId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("savePrivate", async () => {
    const bos = await requireBosUserForAction();
    const emp = await employeeRef(employeeId);
    const self = emp.user_id === bos.userId;
    const hr = can(bos, "employees.view_sensitive") && all(bos, "employees.update");
    if (!self && !hr) throw new ForbiddenError();
    const v = parseForm(privateSchema, formData);
    const input = Object.fromEntries(Object.entries(v).filter(([k]) => formData.has(k)).map(([k, val]) => [k, val ?? null]));
    await saveEmployeePrivate(bos, employeeId, input, { self: self && !hr });
    refresh(employeeId);
    return { ok: true, message: "تم حفظ البيانات" };
  }, "تعذر حفظ البيانات.");
}

async function assertPhotoAccess(bos: BosUser, employeeId: string) {
  const emp = await employeeRef(employeeId);
  if (emp.user_id === bos.userId) return;
  if (!(can(bos, "employees.update") && (all(bos, "employees.update") || (await canSeeEmployee(bos, "employees.update", emp))))) throw new ForbiddenError();
}

export async function createPhotoUploadAction(employeeId: string, mime: string, size: number): Promise<ActionState<{ path: string; token: string }>> {
  return handleAction("createPhotoUpload", async () => {
    const bos = await requireBosUserForAction();
    await assertPhotoAccess(bos, employeeId);
    return { ok: true, data: await createPhotoUpload(employeeId, mime, size) };
  }, "تعذر بدء رفع الصورة.");
}

export async function finalizePhotoAction(employeeId: string, path: string): Promise<ActionState> {
  return handleAction("finalizePhoto", async () => {
    const bos = await requireBosUserForAction();
    await assertPhotoAccess(bos, employeeId);
    await finalizePhoto(bos, employeeId, path);
    refresh(employeeId);
    return { ok: true, message: "تم تحديث الصورة" };
  });
}

export async function removePhotoAction(employeeId: string): Promise<ActionState> {
  return handleAction("removePhoto", async () => {
    const bos = await requireBosUserForAction();
    await assertPhotoAccess(bos, employeeId);
    await removePhoto(bos, employeeId);
    refresh(employeeId);
    return { ok: true, message: "تمت إزالة الصورة" };
  });
}

const compensationSchema = z.object({
  employee_id: zf.uuid("الموظف"),
  effective_from: date(),
  basic_salary: zf.money("الراتب الأساسي"),
  currency: zf.currency(),
  change_type: z.enum(["initial", "adjustment", "promotion", "correction"]),
  reason: zf.optionalText(1000),
});

export async function addCompensationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("addCompensation", async () => {
    const { bos } = await authorize("payroll.update", "all");
    const v = parseForm(compensationSchema, formData);
    const row = await addCompensation(bos, v.employee_id, { ...v, reason: v.reason ?? null });
    refresh(v.employee_id);
    return { ok: true, message: row.approval_status === "pending" ? "تم إرسال تعديل الراتب للاعتماد" : "تم حفظ الراتب" };
  }, "تعذر حفظ الراتب.");
}

const componentSchema = z.object({
  employee_id: zf.uuid("الموظف"),
  component_id: zf.uuid("البند"),
  amount: zf.money("القيمة"),
  effective_from: date(),
  effective_to: zf.optionalDate(),
  notes: zf.optionalText(500),
});

export async function setComponentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("setComponent", async () => {
    const { bos } = await authorize("payroll.update", "all");
    const v = parseForm(componentSchema, formData);
    await setEmployeeComponent(bos, { ...v, notes: v.notes ?? null });
    refresh(v.employee_id);
    return { ok: true, message: "تم حفظ البند" };
  }, "تعذر حفظ البند.");
}

export async function endComponentAction(id: string, effectiveTo: string): Promise<ActionState> {
  return handleAction("endComponent", async () => {
    const { bos } = await authorize("payroll.update", "all");
    await endEmployeeComponent(bos, id, effectiveTo);
    refresh();
    return { ok: true, message: "تم إيقاف البند" };
  });
}

const promotionSchema = z.object({
  employee_id: zf.uuid("الموظف"),
  to_position: zf.required("المسمى الجديد", 200),
  department_id: zf.optionalUuid(),
  team_id: zf.optionalUuid(),
  manager_id: zf.optionalUuid(),
  effective_date: date(),
  reason: zf.required("السبب", 1000),
  new_basic_salary: zf.optionalMoney(),
  currency: z.preprocess((v) => (v === "" ? null : v), zf.currency().nullable()),
  review_id: zf.optionalUuid(),
});

export async function promoteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("promote", async () => {
    const { bos } = await authorize("employees.update", "all");
    const v = parseForm(promotionSchema, formData);
    if (v.new_basic_salary && !all(bos, "payroll.update")) throw new ValidationError("تعديل الراتب يتطلب صلاحية الرواتب.");
    await promoteEmployee(bos, v.employee_id, { ...v, new_basic_salary: v.new_basic_salary ?? null });
    refresh(v.employee_id);
    return { ok: true, message: "تم تسجيل الترقية" };
  }, "تعذر تسجيل الترقية.");
}

const exitSchema = z.object({
  employee_id: zf.uuid("الموظف"),
  exit_interview_at: zf.optionalDateTime(),
  exit_interview_notes: zf.optionalText(5000),
  rehire_eligible: z.preprocess((v) => (v === "" || v === undefined ? null : v === "yes"), z.boolean().nullable()),
  last_working_day: zf.optionalDate(),
});

export async function saveExitInterviewAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("saveExitInterview", async () => {
    const { bos } = await authorize("employees.update", "all");
    const v = parseForm(exitSchema, formData);
    const { data: sep } = await db().from("employee_separations").select("id").eq("employee_id", v.employee_id).neq("status", "cancelled").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!sep) throw new ValidationError("لا يوجد إجراء إنهاء خدمة لهذا الموظف.");
    await db().from("employee_separations").update({ exit_interview_at: v.exit_interview_at ? new Date(v.exit_interview_at).toISOString() : null, exit_interview_notes: v.exit_interview_notes ?? null, exit_interview_by: bos.userId, rehire_eligible: v.rehire_eligible, ...(v.last_working_day ? { last_working_day: v.last_working_day } : {}) }).eq("id", sep.id);
    const { audit } = await import("@/lib/bos/audit");
    await audit({ actorId: bos.userId, action: "employee.exit_interview", entityType: "employee", entityId: v.employee_id, newValue: { rehire_eligible: v.rehire_eligible, last_working_day: v.last_working_day } });
    const { refreshEmployeeOnboardingSafe } = await import("@/services/bos/employees");
    await refreshEmployeeOnboardingSafe(v.employee_id, bos.userId);
    refresh(v.employee_id, "/admin/team/offboarding");
    return { ok: true, message: "تم حفظ مقابلة الخروج" };
  }, "تعذر الحفظ.");
}

// ---------------------------------------------------------------------------
// Checklist task details (onboarding / offboarding)
// ---------------------------------------------------------------------------

export async function updateChecklistItemAction(employeeId: string, itemId: string, patch: { status?: string; assignee_user_id?: string | null; due_date?: string | null; notes?: string | null }): Promise<ActionState> {
  return handleAction("updateChecklistItem", async () => {
    const { bos } = await authorize("onboarding.read");
    const emp = await employeeRef(employeeId);
    const { data: item } = await db().from("onboarding_items").select("assignee_user_id").eq("id", itemId).maybeSingle();
    if (item?.assignee_user_id !== bos.userId && !(await canSeeEmployee(bos, "onboarding.read", emp))) throw new ForbiddenError();
    await updateEmployeeChecklistItem(bos, itemId, patch, { canManage: can(bos, "onboarding.update") || can(bos, "onboarding.manage") });
    refresh(employeeId, `/admin/team/onboarding/${employeeId}`, "/admin/team/offboarding");
    return { ok: true };
  });
}

// ---------------------------------------------------------------------------
// Employee file: documents
// ---------------------------------------------------------------------------

const documentSchema = z.object({
  employee_id: zf.uuid("الموظف"),
  document_type_id: zf.uuid("نوع المستند"),
  title: zf.required("العنوان", 200),
  document_number: zf.optionalText(80),
  issue_date: zf.optionalDate(),
  expiry_date: zf.optionalDate(),
  confidential: zf.checkbox().optional(),
  notes: zf.optionalText(2000),
});

export async function createDocumentAction(_prev: ActionState, formData: FormData): Promise<ActionState<{ id: string }>> {
  return handleAction("createDocument", async () => {
    const bos = await requireBosUserForAction();
    const v = parseForm(documentSchema, formData);
    const emp = await employeeRef(v.employee_id);
    const byEmployee = emp.user_id === bos.userId && !all(bos, "hr_documents.create");
    if (!byEmployee && !all(bos, "hr_documents.create")) throw new ForbiddenError();
    const doc = await createDocument(bos, { ...v, document_number: v.document_number ?? null, notes: v.notes ?? null, confidential: Boolean(v.confidential) }, { byEmployee });
    refresh(v.employee_id, "/admin/team/documents");
    return { ok: true, data: { id: doc.id }, message: "تم إنشاء المستند — ارفع الملف الآن" };
  }, "تعذر إنشاء المستند.");
}

export async function updateDocumentAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("updateDocument", async () => {
    const { bos } = await authorize("hr_documents.update", "all");
    const v = parseForm(documentSchema.omit({ employee_id: true, document_type_id: true }), formData);
    await updateDocument(bos, id, { ...v, document_number: v.document_number ?? null, notes: v.notes ?? null, confidential: Boolean(v.confidential) });
    refresh(undefined, "/admin/team/documents");
    return { ok: true, message: "تم الحفظ" };
  }, "تعذر الحفظ.");
}

export async function verifyDocumentAction(id: string, decision: "valid" | "rejected", reason?: string): Promise<ActionState> {
  return handleAction("verifyDocument", async () => {
    const { bos } = await authorize("hr_documents.approve", "all");
    await verifyDocument(bos, id, decision, reason?.trim() || null);
    refresh(undefined, "/admin/team/documents");
    return { ok: true, message: decision === "valid" ? "تم اعتماد المستند" : "تم رفض المستند" };
  });
}

export async function archiveDocumentAction(id: string, reason?: string): Promise<ActionState> {
  return handleAction("archiveDocument", async () => {
    const { bos } = await authorize("hr_documents.update", "all");
    await archiveDocument(bos, id, reason?.trim() || "Archived");
    refresh(undefined, "/admin/team/documents");
    return { ok: true, message: "تمت الأرشفة" };
  });
}

// ---------------------------------------------------------------------------
// Employee contracts
// ---------------------------------------------------------------------------

const contractSchema = z.object({
  employee_id: zf.uuid("الموظف"),
  contract_type: z.enum(["employment", "renewal", "amendment", "probation", "freelance", "internship", "nda", "other"]),
  title: zf.required("العنوان", 200),
  start_date: date(),
  end_date: zf.optionalDate(),
  position_title: zf.optionalText(200),
  basic_salary: zf.optionalMoney(),
  currency: z.preprocess((v) => (v === "" ? null : v), zf.currency().nullable()),
  notice_period_days: z.preprocess((v) => (v === "" || v === undefined ? null : v), z.coerce.number().int().min(0).max(365).nullable()),
  terms: zf.optionalText(10000),
  notes: zf.optionalText(3000),
  parent_id: zf.optionalUuid(),
});

export async function createContractAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("createContract", async () => {
    const { bos } = await authorize("hr_documents.update", "all");
    const v = parseForm(contractSchema, formData);
    const k = await createContract(bos, { ...v, basic_salary: v.basic_salary ?? null, position_title: v.position_title ?? null, terms: v.terms ?? null, notes: v.notes ?? null });
    refresh(v.employee_id, "/admin/team/documents/contracts");
    redirect(`/admin/team/documents/contracts/${k.id}`);
  }, "تعذر إنشاء العقد.");
}

export async function updateContractAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("updateContract", async () => {
    const { bos } = await authorize("hr_documents.update", "all");
    const v = parseForm(contractSchema.omit({ employee_id: true, contract_type: true, parent_id: true }), formData);
    await updateContract(bos, id, { ...v, basic_salary: v.basic_salary ?? null, position_title: v.position_title ?? null, terms: v.terms ?? null, notes: v.notes ?? null });
    refresh(undefined, `/admin/team/documents/contracts/${id}`);
    return { ok: true, message: "تم حفظ العقد" };
  }, "تعذر حفظ العقد.");
}

export async function contractStepAction(id: string, step: ContractAction, reason?: string): Promise<ActionState> {
  return handleAction("contractStep", async () => {
    const bos = await requireBosUserForAction();
    if (step === "sign_employee") {
      const { data: k } = await db().from("employee_contracts").select("employees(user_id)").eq("id", id).maybeSingle();
      const own = (k?.employees as unknown as { user_id: string | null } | null)?.user_id === bos.userId;
      if (!own && !all(bos, "hr_documents.update")) throw new ForbiddenError();
    } else if (!all(bos, "hr_documents.update")) throw new ForbiddenError();
    await contractAction(bos, id, step, reason?.trim() || null);
    refresh(undefined, `/admin/team/documents/contracts/${id}`, "/admin/team/documents/contracts");
    return { ok: true, message: "تم تحديث العقد" };
  }, "تعذر تحديث العقد.");
}

const renewSchema = z.object({
  parent_id: zf.uuid("العقد"),
  kind: z.enum(["renewal", "amendment"]),
  title: zf.optionalText(200),
  start_date: date(),
  end_date: zf.optionalDate(),
  basic_salary: zf.optionalMoney(),
  currency: z.preprocess((v) => (v === "" ? null : v), zf.currency().nullable()),
  terms: zf.optionalText(10000),
  notes: zf.optionalText(3000),
});

export async function renewContractAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("renewContract", async () => {
    const { bos } = await authorize("hr_documents.update", "all");
    const v = parseForm(renewSchema, formData);
    const k = await renewContract(bos, v.parent_id, v.kind, { title: v.title ?? null, start_date: v.start_date, end_date: v.end_date, basic_salary: v.basic_salary ?? null, currency: v.currency, terms: v.terms ?? null, notes: v.notes ?? null });
    refresh(undefined, "/admin/team/documents/contracts");
    redirect(`/admin/team/documents/contracts/${k.id}`);
  }, "تعذر إنشاء النسخة الجديدة.");
}

// ---------------------------------------------------------------------------
// Schedules, shifts, holidays, days off
// ---------------------------------------------------------------------------

const scheduleSchema = z.object({
  id: zf.optionalUuid(),
  name: zf.required("الاسم", 120),
  schedule_type: z.enum(["fixed", "shift", "night", "flexible", "remote"]),
  timezone: zf.required("المنطقة الزمنية", 64),
  grace_minutes: zf.int(0, 240),
  half_day_minutes: zf.int(0, 1440),
  overtime_after_minutes: zf.int(0, 1440),
  required_minutes: z.preprocess((v) => (v === "" || v === undefined ? null : v), z.coerce.number().int().min(0).max(1440).nullable()),
  description: zf.optionalText(1000),
  color: zf.optionalText(20),
  is_active: zf.checkbox().optional(),
  days: z.string().min(2),
});

export async function saveScheduleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("saveSchedule", async () => {
    const { bos } = await authorize("attendance.manage", "all");
    const v = parseForm(scheduleSchema, formData);
    const days = z.array(z.object({ weekday: z.number().int().min(0).max(6), is_working: z.boolean(), start_time: z.string(), end_time: z.string(), break_minutes: z.coerce.number().int().min(0).max(600) })).parse(JSON.parse(v.days));
    await saveSchedule(bos, v.id, { ...v, description: v.description ?? null, color: v.color ?? null, is_active: v.is_active !== false, days });
    refresh(undefined, "/admin/team/schedules/list");
    return { ok: true, message: "تم حفظ الجدول" };
  }, "تعذر حفظ الجدول.");
}

export async function setDefaultScheduleAction(id: string): Promise<ActionState> {
  return handleAction("setDefaultSchedule", async () => {
    const { bos } = await authorize("attendance.manage", "all");
    await setDefaultSchedule(bos, id);
    refresh(undefined, "/admin/team/schedules/list");
    return { ok: true, message: "أصبح الجدول الافتراضي للشركة" };
  });
}

export async function deleteScheduleAction(id: string): Promise<ActionState> {
  return handleAction("deleteSchedule", async () => {
    const { bos } = await authorize("attendance.manage", "all");
    const r = await deleteSchedule(bos, id);
    refresh(undefined, "/admin/team/schedules/list");
    return { ok: true, message: r === "deleted" ? "تم حذف الجدول" : "الجدول مستخدم — تم تعطيله للحفاظ على السجل" };
  });
}

const assignmentSchema = z.object({
  schedule_id: zf.uuid("الجدول"),
  scope: z.enum(["company", "department", "team", "employee"]),
  target_id: zf.optionalUuid(),
  effective_from: date(),
  effective_to: zf.optionalDate(),
  notes: zf.optionalText(500),
});

export async function assignScheduleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("assignSchedule", async () => {
    const { bos } = await authorize("attendance.manage", "all");
    const v = parseForm(assignmentSchema, formData);
    await assignSchedule(bos, { ...v, notes: v.notes ?? null });
    refresh(undefined, "/admin/team/schedules/assignments");
    return { ok: true, message: "تم تعيين الجدول" };
  }, "تعذر التعيين.");
}

export async function removeAssignmentAction(id: string): Promise<ActionState> {
  return handleAction("removeAssignment", async () => {
    const { bos } = await authorize("attendance.manage", "all");
    await removeAssignment(bos, id);
    refresh(undefined, "/admin/team/schedules/assignments");
    return { ok: true, message: "تمت الإزالة" };
  });
}

const shiftSchema = z.object({
  employee_ids: z.array(z.string().uuid()).min(1, "اختر موظفاً"),
  from: date(),
  to: date(),
  schedule_id: zf.optionalUuid(),
  weekdays: z.array(z.coerce.number().int().min(0).max(6)).optional(),
  notes: zf.optionalText(300),
});

export async function setShiftsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("setShifts", async () => {
    const { bos } = await authorize("attendance.manage", "all");
    const v = parseForm(shiftSchema, formData);
    const n = await setShifts(bos, { employee_ids: v.employee_ids, from: v.from, to: v.to, schedule_id: v.schedule_id, weekdays: v.weekdays?.length ? v.weekdays : null, notes: v.notes ?? null });
    refresh(undefined, "/admin/team/schedules");
    return { ok: true, message: v.schedule_id ? `تم تعيين ${n} وردية` : "تمت إزالة الورديات" };
  }, "تعذر حفظ الورديات.");
}

const holidaySchema = z.object({
  id: zf.optionalUuid(),
  date: date(),
  end_date: zf.optionalDate(),
  name: zf.required("الاسم", 120),
  kind: z.enum(["public", "company"]),
  country: zf.optionalText(100),
  is_paid: zf.checkbox().optional(),
  notes: zf.optionalText(500),
});

export async function saveHolidayAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("saveHoliday", async () => {
    const { bos } = await authorize("attendance.manage", "all");
    const v = parseForm(holidaySchema, formData);
    const n = await saveHoliday(bos, v.id, { date: v.date, end_date: v.end_date, name: v.name, kind: v.kind, country: v.country ?? null, is_paid: v.is_paid !== false, notes: v.notes ?? null });
    refresh(undefined, "/admin/team/schedules/holidays");
    return { ok: true, message: n > 1 ? `تمت إضافة ${n} يوم عطلة` : "تم الحفظ" };
  }, "تعذر حفظ العطلة.");
}

export async function deleteHolidayAction(id: string): Promise<ActionState> {
  return handleAction("deleteHoliday", async () => {
    const { bos } = await authorize("attendance.manage", "all");
    await deleteHoliday(bos, id);
    refresh(undefined, "/admin/team/schedules/holidays");
    return { ok: true, message: "تم الحذف" };
  });
}

const dayOffSchema = z.object({ scope: z.enum(["employee", "team", "department"]), target_id: zf.uuid("الهدف"), from: date(), to: date(), reason: zf.required("السبب", 300) });

export async function addDaysOffAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("addDaysOff", async () => {
    const { bos } = await authorize("attendance.manage", "all");
    const v = parseForm(dayOffSchema, formData);
    const n = await addDaysOff(bos, v);
    refresh(undefined, "/admin/team/schedules/holidays");
    return { ok: true, message: `تمت إضافة ${n} يوم راحة` };
  }, "تعذر الحفظ.");
}

export async function removeDayOffAction(id: string): Promise<ActionState> {
  return handleAction("removeDayOff", async () => {
    const { bos } = await authorize("attendance.manage", "all");
    await removeDayOff(bos, id);
    refresh(undefined, "/admin/team/schedules/holidays");
    return { ok: true, message: "تم الحذف" };
  });
}

// ---------------------------------------------------------------------------
// Leave balances, overtime approved minutes
// ---------------------------------------------------------------------------

const adjustmentSchema = z.object({
  user_id: zf.uuid("الموظف"),
  leave_type_id: zf.uuid("نوع الإجازة"),
  year: zf.int(2000, 2100),
  days: z.coerce.number().min(-365).max(365),
  kind: z.enum(["adjustment", "carry_forward", "allowance_override"]),
  reason: zf.required("السبب", 500),
});

export async function addBalanceAdjustmentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("addBalanceAdjustment", async () => {
    const { bos } = await authorize("leave.update", "all");
    const v = parseForm(adjustmentSchema, formData);
    await addBalanceAdjustment(bos, v);
    refresh(undefined, "/admin/team/leave/balances");
    return { ok: true, message: "تم تعديل الرصيد" };
  }, "تعذر تعديل الرصيد.");
}

export async function setOvertimeMinutesAction(id: string, minutes: number, reason: string): Promise<ActionState> {
  return handleAction("setOvertimeMinutes", async () => {
    const { bos } = await authorize("overtime.update", "all");
    await setOvertimeApprovedMinutes(bos, id, minutes, reason);
    refresh(undefined, "/admin/team/overtime");
    return { ok: true, message: "تم تعديل الدقائق المعتمدة" };
  });
}

// ---------------------------------------------------------------------------
// Payroll
// ---------------------------------------------------------------------------

const runSchema = z.object({
  run_type: z.enum(["regular", "off_cycle", "final_settlement"]),
  period: month(),
  pay_date: zf.optionalDate(),
  department_id: zf.optionalUuid(),
  employee_id: zf.optionalUuid(),
  notes: zf.optionalText(1000),
});

export async function createRunAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("createRun", async () => {
    const { bos } = await authorize("payroll.update", "all");
    const v = parseForm(runSchema, formData);
    const run = await createRun(bos, { ...v, notes: v.notes ?? null });
    await calculateRun(bos, run.id);
    refresh(undefined, "/admin/team/payroll");
    redirect(`/admin/team/payroll/runs/${run.id}`);
  }, "تعذر إنشاء دورة الرواتب.");
}

export async function payrollRunAction(runId: string, step: "calculate" | "submit" | "publish" | "cancel", reason?: string): Promise<ActionState> {
  return handleAction("payrollRun", async () => {
    const { bos } = await authorize("payroll.update", "all");
    let message = "تم";
    if (step === "calculate") {
      const r = await calculateRun(bos, runId);
      message = `تم الحساب لـ ${r.count} موظف${r.missing.length ? ` — ${r.missing.length} بدون راتب معتمد` : ""}`;
    } else if (step === "submit") {
      await submitRun(bos, runId);
      message = "تم إرسال الدورة للاعتماد";
    } else if (step === "publish") {
      message = `تم نشر ${await publishPayslips(bos, runId)} قسيمة للموظفين`;
    } else {
      await cancelRun(bos, runId, reason?.trim() ?? "");
      message = "تم إلغاء الدورة";
    }
    refresh(undefined, `/admin/team/payroll/runs/${runId}`, "/admin/team/payroll");
    return { ok: true, message };
  }, "تعذر تنفيذ العملية.");
}

export async function markRunPaidAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("markRunPaid", async () => {
    const bos = await requireBosUserForAction();
    if (!all(bos, "payroll.approve") && !all(bos, "payroll.manage")) throw new ForbiddenError("تسجيل صرف الرواتب من صلاحية المالية.");
    const v = parseForm(z.object({ run_id: zf.uuid("الدورة"), paid_on: date(), reference: zf.optionalText(200) }), formData);
    await markRunPaid(bos, v.run_id, { paid_on: v.paid_on, reference: v.reference ?? null });
    refresh(undefined, `/admin/team/payroll/runs/${v.run_id}`, "/admin/team/payroll", "/admin/finance/expenses");
    return { ok: true, message: "تم تسجيل الصرف وترحيل التكلفة إلى المالية" };
  }, "تعذر تسجيل الصرف.");
}

export async function addManualLineAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("addManualLine", async () => {
    const { bos } = await authorize("payroll.update", "all");
    const v = parseForm(z.object({ payslip_id: zf.uuid("القسيمة"), kind: z.enum(["earning", "deduction"]), label: zf.required("البيان", 200), amount: zf.money(), taxable: zf.checkbox().optional() }), formData);
    await addManualLine(bos, v.payslip_id, { kind: v.kind, label: v.label, amount: v.amount, taxable: Boolean(v.taxable) });
    refresh(undefined, "/admin/team/payroll");
    return { ok: true, message: "تمت الإضافة وإعادة الحساب" };
  }, "تعذر الإضافة.");
}

export async function removeManualLineAction(lineId: string): Promise<ActionState> {
  return handleAction("removeManualLine", async () => {
    const { bos } = await authorize("payroll.update", "all");
    await removeManualLine(bos, lineId);
    refresh(undefined, "/admin/team/payroll");
    return { ok: true, message: "تم الحذف وإعادة الحساب" };
  });
}

// ---------------------------------------------------------------------------
// Bonuses, loans / advances
// ---------------------------------------------------------------------------

const bonusSchema = z.object({
  employee_id: zf.uuid("الموظف"),
  bonus_type: z.enum(["one_time", "performance", "sales", "annual", "custom"]),
  title: zf.required("البيان", 200),
  amount: zf.money(),
  currency: zf.currency(),
  reason: zf.required("السبب", 1000),
  pay_period: month(),
});

export async function requestBonusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("requestBonus", async () => {
    const bos = await requireBosUserForAction();
    const v = parseForm(bonusSchema, formData);
    if (!all(bos, "payroll.create") && !(await isManagerOf(bos, v.employee_id))) throw new ForbiddenError("طلب المكافأة للمدير المباشر أو الموارد البشرية.");
    await requestBonus(bos, v);
    refresh(v.employee_id, "/admin/team/payroll/bonuses");
    return { ok: true, message: "تم إرسال المكافأة للاعتماد" };
  }, "تعذر إرسال المكافأة.");
}

export async function cancelBonusAction(id: string, reason?: string): Promise<ActionState> {
  return handleAction("cancelBonus", async () => {
    const { bos } = await authorize("payroll.update", "all");
    await cancelBonus(bos, id, reason?.trim() || "Cancelled");
    refresh(undefined, "/admin/team/payroll/bonuses");
    return { ok: true, message: "تم الإلغاء" };
  });
}

const loanSchema = z.object({
  employee_id: zf.uuid("الموظف"),
  loan_type: z.enum(["advance", "loan"]),
  amount: zf.money(),
  currency: zf.currency(),
  installments: zf.int(1, 120),
  start_period: month(),
  reason: zf.required("السبب", 1000),
});

export async function requestLoanAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("requestLoan", async () => {
    const { bos } = await authorize("payroll.create");
    const v = parseForm(loanSchema, formData);
    const emp = await employeeRef(v.employee_id);
    if (emp.user_id !== bos.userId && !all(bos, "payroll.create")) throw new ForbiddenError("يمكنك طلب سلفة لنفسك فقط.");
    await requestLoan(bos, v);
    refresh(v.employee_id, "/admin/team/payroll/loans");
    return { ok: true, message: "تم إرسال الطلب للاعتماد" };
  }, "تعذر إرسال الطلب.");
}

export async function loanStepAction(id: string, step: "disburse" | "cancel", note?: string): Promise<ActionState> {
  return handleAction("loanStep", async () => {
    const bos = await requireBosUserForAction();
    if (step === "disburse") {
      if (!all(bos, "payroll.approve") && !all(bos, "payroll.manage")) throw new ForbiddenError("صرف السلف من صلاحية المالية.");
      await disburseLoan(bos, id, note?.trim() || null);
    } else {
      const { data: l } = await db().from("employee_loans").select("user_id").eq("id", id).maybeSingle();
      if (l?.user_id !== bos.userId && !all(bos, "payroll.update")) throw new ForbiddenError();
      await cancelLoan(bos, id, note?.trim() || "Cancelled");
    }
    refresh(undefined, "/admin/team/payroll/loans");
    return { ok: true, message: step === "disburse" ? "تم تسجيل الصرف — ستُخصم الأقساط من الرواتب" : "تم الإلغاء" };
  });
}

export async function settleInstallmentAction(id: string, mode: "paid_manually" | "waived" | "skipped", note?: string): Promise<ActionState> {
  return handleAction("settleInstallment", async () => {
    const bos = await requireBosUserForAction();
    if (!all(bos, "payroll.approve") && !all(bos, "payroll.manage")) throw new ForbiddenError();
    await settleInstallmentManually(bos, id, mode, note?.trim() ?? "");
    refresh(undefined, "/admin/team/payroll/loans");
    return { ok: true, message: "تم تحديث القسط" };
  });
}

// ---------------------------------------------------------------------------
// Expense claims and other requests
// ---------------------------------------------------------------------------

const claimSchema = z.object({
  employee_id: zf.uuid("الموظف"),
  category_id: zf.uuid("الفئة"),
  description: zf.required("الوصف", 300),
  amount: zf.money(),
  currency: zf.currency(),
  expense_date: date(),
  expense_kind: zf.optionalText(60),
  client_id: zf.optionalUuid(),
});

export async function submitExpenseClaimAction(_prev: ActionState, formData: FormData): Promise<ActionState<{ id: string }>> {
  return handleAction("submitExpenseClaim", async () => {
    const { bos } = await authorize("hr_requests.create");
    const v = parseForm(claimSchema, formData);
    const emp = await employeeRef(v.employee_id);
    if (emp.user_id !== bos.userId && !all(bos, "hr_requests.create")) throw new ForbiddenError();
    const e = await submitExpenseClaim(bos, { ...v, expense_kind: v.expense_kind ?? null });
    refresh(undefined, "/admin/team/requests/expenses", "/admin/finance/expenses");
    return { ok: true, data: { id: e.id }, message: "تم إرسال المصروف — أرفق الإيصال" };
  }, "تعذر إرسال المصروف.");
}

export async function reimburseAction(id: string, reference?: string): Promise<ActionState> {
  return handleAction("reimburse", async () => {
    const bos = await requireBosUserForAction();
    if (!all(bos, "expenses.approve") && !all(bos, "payroll.approve")) throw new ForbiddenError();
    await reimburseDirectly(bos, id, reference?.trim() || null);
    refresh(undefined, "/admin/team/requests/expenses", "/admin/finance/expenses");
    return { ok: true, message: "تم تسجيل الاسترداد" };
  });
}

const hrRequestSchema = z.object({ employee_id: zf.uuid("الموظف"), type_id: zf.uuid("نوع الطلب"), subject: zf.required("الموضوع", 200), details: zf.optionalText(5000), due_date: zf.optionalDate() });

export async function submitHrRequestAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("submitHrRequest", async () => {
    const { bos } = await authorize("hr_requests.create");
    const v = parseForm(hrRequestSchema, formData);
    const emp = await employeeRef(v.employee_id);
    if (emp.user_id !== bos.userId && !all(bos, "hr_requests.create")) throw new ForbiddenError();
    await submitHrRequest(bos, { ...v, details: v.details ?? null });
    refresh(undefined, "/admin/team/requests/other", "/admin/team/requests");
    return { ok: true, message: "تم إرسال الطلب" };
  }, "تعذر إرسال الطلب.");
}

export async function progressHrRequestAction(id: string, to: "in_progress" | "completed" | "cancelled", response?: string): Promise<ActionState> {
  return handleAction("progressHrRequest", async () => {
    const bos = await requireBosUserForAction();
    const { data: r } = await db().from("hr_requests").select("user_id").eq("id", id).maybeSingle();
    const own = r?.user_id === bos.userId;
    if (!(all(bos, "hr_requests.update") || (own && to === "cancelled"))) throw new ForbiddenError();
    await progressHrRequest(bos, id, to, response?.trim() || null);
    refresh(undefined, "/admin/team/requests/other", "/admin/team/requests");
    return { ok: true, message: "تم تحديث الطلب" };
  });
}

// ---------------------------------------------------------------------------
// Performance: goals, cycles, self assessment, 360 feedback
// ---------------------------------------------------------------------------

const goalSchema = z.object({
  id: zf.optionalUuid(),
  user_id: zf.uuid("الموظف"),
  title: zf.required("الهدف", 300),
  description: zf.optionalText(3000),
  metric: zf.optionalText(200),
  unit: zf.optionalText(40),
  target_value: zf.optionalMoney(),
  weight: zf.optionalMoney(),
  start_date: zf.optionalDate(),
  due_date: zf.optionalDate(),
  kpi_id: zf.optionalUuid(),
  cycle_id: zf.optionalUuid(),
});

async function assertCanManageGoalsFor(bos: BosUser, userId: string) {
  if (userId === bos.userId || all(bos, "performance.update")) return;
  const { data: emp } = await db().from("employees").select("id").eq("user_id", userId).maybeSingle();
  if (!emp || !(await isManagerOf(bos, emp.id))) throw new ForbiddenError();
}

export async function saveGoalAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("saveGoal", async () => {
    const { bos } = await authorize("performance.read");
    const v = parseForm(goalSchema, formData);
    await assertCanManageGoalsFor(bos, v.user_id);
    await saveGoal(bos, v.id, { ...v, description: v.description ?? null, metric: v.metric ?? null, unit: v.unit ?? null, target_value: v.target_value ?? null, weight: v.weight ?? null });
    refresh(undefined, "/admin/team/performance/goals");
    return { ok: true, message: "تم حفظ الهدف" };
  }, "تعذر حفظ الهدف.");
}

export async function goalProgressAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("goalProgress", async () => {
    const { bos } = await authorize("performance.read");
    const v = parseForm(z.object({ id: zf.uuid("الهدف"), current_value: zf.optionalMoney(), progress: zf.int(0, 100), status: z.enum(["not_started", "on_track", "at_risk", "off_track", "completed", "cancelled"]) }), formData);
    const { data: g } = await db().from("performance_goals").select("user_id").eq("id", v.id).maybeSingle();
    if (!g) throw new ValidationError("الهدف غير موجود.");
    await assertCanManageGoalsFor(bos, g.user_id);
    await updateGoalProgress(bos, v.id, { current_value: v.current_value ?? null, progress: v.progress, status: v.status });
    refresh(undefined, "/admin/team/performance/goals");
    return { ok: true, message: "تم تحديث التقدم" };
  }, "تعذر التحديث.");
}

export async function saveCycleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("saveCycle", async () => {
    const { bos } = await authorize("performance.manage", "all");
    const v = parseForm(z.object({ id: zf.optionalUuid(), name: zf.required("الاسم", 200), cycle_type: z.enum(["annual", "semi_annual", "quarterly", "probation", "ad_hoc"]), period_start: date(), period_end: date(), self_assessment: zf.checkbox().optional(), peer_feedback: zf.checkbox().optional() }), formData);
    await saveCycle(bos, v.id, { name: v.name, cycle_type: v.cycle_type, period_start: v.period_start, period_end: v.period_end, self_assessment: Boolean(v.self_assessment), peer_feedback: Boolean(v.peer_feedback) });
    refresh(undefined, "/admin/team/performance/reviews");
    return { ok: true, message: "تم حفظ الدورة" };
  }, "تعذر حفظ الدورة.");
}

export async function setCycleStatusAction(id: string, status: "draft" | "active" | "closed"): Promise<ActionState> {
  return handleAction("setCycleStatus", async () => {
    const { bos } = await authorize("performance.manage", "all");
    const { data: emps } = await db().from("employees").select("user_id, manager_id").in("lifecycle_status", ["active", "on_leave"]).not("user_id", "is", null);
    const { data: managers } = await db().from("employees").select("id, user_id");
    const mgr = new Map((managers ?? []).map((m) => [m.id, m.user_id]));
    const n = await setCycleStatus(bos, id, status, (emps ?? []).map((e) => ({ user_id: e.user_id as string, manager_user_id: e.manager_id ? mgr.get(e.manager_id) ?? null : null })));
    refresh(undefined, "/admin/team/performance/reviews");
    return { ok: true, message: status === "active" ? `تم تفعيل الدورة وإنشاء ${n} مراجعة` : "تم تحديث الدورة" };
  });
}

export async function selfAssessmentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("selfAssessment", async () => {
    const bos = await requireBosUserForAction();
    const v = parseForm(z.object({ review_id: zf.uuid("المراجعة"), self_assessment: zf.required("التقييم الذاتي", 10000), self_rating: z.preprocess((x) => (x === "" || x === undefined ? null : x), z.coerce.number().min(1).max(5).nullable()) }), formData);
    await submitSelfAssessment(bos, v.review_id, { self_assessment: v.self_assessment, self_rating: v.self_rating });
    refresh(undefined, "/admin/team/performance/reviews");
    return { ok: true, message: "تم إرسال التقييم الذاتي" };
  }, "تعذر الإرسال.");
}

export async function requestFeedbackAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("requestFeedback", async () => {
    const { bos } = await authorize("performance.read");
    const v = parseForm(z.object({ subject_user_id: zf.uuid("الموظف"), from_user_ids: z.array(z.string().uuid()).min(1, "اختر شخصاً"), relationship: z.enum(["manager", "peer", "direct_report", "self", "other"]), cycle_id: zf.optionalUuid(), review_id: zf.optionalUuid() }), formData);
    await assertCanManageGoalsFor(bos, v.subject_user_id);
    const n = await requestFeedback(bos, v);
    refresh(undefined, "/admin/team/performance/feedback");
    return { ok: true, message: `تم إرسال ${n} طلب تقييم` };
  }, "تعذر الإرسال.");
}

export async function submitPerformanceFeedbackAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("submitPerformanceFeedback", async () => {
    const bos = await requireBosUserForAction();
    const v = parseForm(z.object({ id: zf.uuid("الطلب"), rating: z.preprocess((x) => (x === "" || x === undefined ? null : x), z.coerce.number().min(1).max(5).nullable()), strengths: zf.optionalText(5000), improvements: zf.optionalText(5000), comments: zf.optionalText(5000), is_anonymous: zf.checkbox().optional(), decline: zf.checkbox().optional() }), formData);
    await submitFeedback(bos, v.id, { rating: v.rating, strengths: v.strengths ?? null, improvements: v.improvements ?? null, comments: v.comments ?? null, is_anonymous: Boolean(v.is_anonymous), decline: Boolean(v.decline) });
    refresh(undefined, "/admin/team/performance/feedback");
    return { ok: true, message: v.decline ? "تم الاعتذار" : "تم إرسال التقييم" };
  }, "تعذر الإرسال.");
}
