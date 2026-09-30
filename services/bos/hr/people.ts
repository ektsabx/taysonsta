import "server-only";
import { nowIso } from "@/lib/bos/clock";
import { db, dec, type Tables } from "@/lib/bos/db";
import type { BosUser } from "@/lib/bos/auth";
import { audit } from "@/lib/bos/audit";
import { emitEvent } from "@/lib/bos/events";
import { NotFoundError, ValidationError } from "@/lib/bos/errors";
import { requestApproval } from "@/services/bos/approvals";
import { refreshEmployeeOnboardingSafe } from "@/services/bos/employees";
import { approvalSteps } from "@/services/bos/hr/policy";

// Employee 360 data (docs/bos/28 §6–7, §25, §30): private/legal/bank data,
// compensation history, salary components, job history, profile photo.

export type EmployeePrivate = Tables<"employee_private">;
export type Compensation = Tables<"employee_compensation">;

// ---------------------------------------------------------------------------
// Private data (view_sensitive or self — enforced by the caller)
// ---------------------------------------------------------------------------

export async function getEmployeePrivate(employeeId: string): Promise<EmployeePrivate | null> {
  const { data } = await db().from("employee_private").select("*").eq("employee_id", employeeId).maybeSingle();
  return data;
}

export type PrivateInput = Omit<EmployeePrivate, "employee_id" | "updated_at" | "updated_by">;

const privateFields: (keyof PrivateInput)[] = [
  "date_of_birth", "gender", "nationality", "marital_status", "address", "national_id", "national_id_expiry", "passport_number", "passport_expiry",
  "tax_id", "insurance_number", "insurance_start_date", "bank_name", "bank_account_name", "bank_account_number", "bank_iban",
  "emergency_contact_name", "emergency_contact_relation", "emergency_contact_phone", "hr_notes",
];
const maskedInAudit = new Set(["national_id", "passport_number", "tax_id", "insurance_number", "bank_account_number", "bank_iban"]);

export async function saveEmployeePrivate(bos: BosUser, employeeId: string, input: Partial<PrivateInput>, opts: { self: boolean }) {
  const { data: emp } = await db().from("employees").select("id").eq("id", employeeId).maybeSingle();
  if (!emp) throw new NotFoundError();
  // Employees update their own contact/bank/emergency data; HR notes are HR-only.
  const allowedSelf = new Set(["address", "marital_status", "bank_name", "bank_account_name", "bank_account_number", "bank_iban", "emergency_contact_name", "emergency_contact_relation", "emergency_contact_phone"]);
  const before = await getEmployeePrivate(employeeId);
  const row: Record<string, unknown> = { employee_id: employeeId, updated_by: bos.userId };
  const changed: string[] = [];
  for (const key of privateFields) {
    if (!(key in input)) continue;
    if (opts.self && !allowedSelf.has(key)) continue;
    const value = input[key] ?? null;
    row[key] = value;
    if ((before?.[key] ?? null) !== value) changed.push(key);
  }
  const { error } = await db().from("employee_private").upsert(row as EmployeePrivate, { onConflict: "employee_id" });
  if (error) throw error;
  if (changed.length) {
    await audit({
      actorId: bos.userId,
      action: "employee.private_updated",
      entityType: "employee",
      entityId: employeeId,
      newValue: Object.fromEntries(changed.map((k) => [k, maskedInAudit.has(k) ? "***" : row[k]])),
    });
  }
  await refreshEmployeeOnboardingSafe(employeeId, bos.userId);
}

// ---------------------------------------------------------------------------
// Compensation (effective dated) + salary components
// ---------------------------------------------------------------------------

export async function listCompensation(employeeId: string) {
  const { data } = await db().from("employee_compensation").select("*").eq("employee_id", employeeId).order("effective_from", { ascending: false }).order("created_at", { ascending: false });
  return data ?? [];
}

export async function currentCompensation(employeeId: string, onDate: string): Promise<Compensation | null> {
  const { data } = await db().from("employee_compensation").select("*").eq("employee_id", employeeId).eq("approval_status", "approved").lte("effective_from", onDate).order("effective_from", { ascending: false }).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return data;
}

export interface CompensationInput {
  effective_from: string;
  basic_salary: string;
  currency: string;
  change_type: "initial" | "adjustment" | "promotion" | "correction";
  reason: string | null;
  review_id?: string | null;
}

// First salary is recorded directly; later changes (adjustment, promotion)
// go through the salary-adjustment approval (Finance by default).
export async function addCompensation(bos: BosUser, employeeId: string, input: CompensationInput, opts: { skipApproval?: boolean } = {}) {
  const { data: emp } = await db().from("employees").select("id, full_name, user_id").eq("id", employeeId).maybeSingle();
  if (!emp) throw new NotFoundError();
  const existing = await listCompensation(employeeId);
  const hasApproved = existing.some((c) => c.approval_status === "approved");
  if (!hasApproved && input.change_type !== "initial" && input.change_type !== "correction") input.change_type = "initial";
  if (hasApproved && input.change_type === "initial") throw new ValidationError("يوجد راتب مسجل بالفعل؛ استخدم «تعديل راتب» أو «ترقية».", { change_type: "غير صالح" });
  if (existing.some((c) => c.approval_status === "pending")) throw new ValidationError("يوجد تعديل راتب بانتظار الاعتماد لهذا الموظف.");
  if (["adjustment", "promotion"].includes(input.change_type) && !input.reason) throw new ValidationError("سبب التعديل مطلوب.", { reason: "مطلوب" });

  const steps = await approvalSteps("salary_adjustment", ["role:finance"]);
  const needsApproval = hasApproved && input.change_type !== "correction" && !opts.skipApproval && steps.length > 0;
  const { data, error } = await db()
    .from("employee_compensation")
    .insert({
      employee_id: employeeId,
      effective_from: input.effective_from,
      basic_salary: dec(input.basic_salary) as unknown as number,
      currency: input.currency,
      change_type: input.change_type,
      reason: input.reason,
      review_id: input.review_id ?? null,
      approval_status: needsApproval ? "pending" : "approved",
      created_by: bos.userId,
      decided_by: needsApproval ? null : bos.userId,
      decided_at: needsApproval ? null : nowIso(),
    })
    .select("*")
    .single();
  if (error) throw error;
  await audit({ actorId: bos.userId, action: "compensation.created", entityType: "employee", entityId: employeeId, newValue: { effective_from: input.effective_from, change_type: input.change_type, basic_salary: "***", currency: input.currency, status: data.approval_status } });
  if (needsApproval) {
    await requestApproval({
      type: "salary_adjustment",
      entityType: "employee",
      entityId: employeeId,
      title: `${emp.full_name} — ${input.change_type === "promotion" ? "ترقية وتعديل راتب" : "تعديل راتب"} من ${input.effective_from}`,
      requestedBy: bos.userId,
      steps,
      payload: { compensation_id: data.id },
      links: [{ type: "employee", id: employeeId }],
    });
  } else {
    await afterCompensationApproved(bos.userId, data);
  }
  return data;
}

export async function afterCompensationApproved(actorId: string | null, comp: Compensation) {
  const { data: emp } = await db().from("employees").select("id, user_id, full_name, position, department_id, team_id, manager_id").eq("id", comp.employee_id).maybeSingle();
  if (!emp) return;
  if (comp.change_type !== "initial" && comp.change_type !== "correction") {
    await db().from("employee_job_history").insert({
      employee_id: emp.id,
      effective_date: comp.effective_from,
      change_type: comp.change_type === "promotion" ? "promotion" : "salary_adjustment",
      from_position: emp.position,
      to_position: emp.position,
      compensation_id: comp.id,
      review_id: comp.review_id,
      reason: comp.reason,
      created_by: actorId,
    });
  }
  await db().rpc("bos_sync_hourly_cost", { p_employee: emp.id });
  await emitEvent({ type: "compensation.changed", entityType: "employee", entityId: emp.id, summary: `Compensation updated for ${emp.full_name} (effective ${comp.effective_from})`, actorId, payload: { employee_user_id: emp.user_id, change_type: comp.change_type } });
  await refreshEmployeeOnboardingSafe(emp.id, actorId);
}

export async function listSalaryComponents(activeOnly = true) {
  let q = db().from("salary_components").select("*").order("sort_order");
  if (activeOnly) q = q.eq("is_active", true);
  const { data } = await q;
  return data ?? [];
}

export async function listEmployeeComponents(employeeId: string) {
  const { data } = await db().from("employee_salary_components").select("*, salary_components(id, key, name, kind, category, calc_type, taxable)").eq("employee_id", employeeId).order("effective_from", { ascending: false });
  return data ?? [];
}

export async function setEmployeeComponent(bos: BosUser, input: { employee_id: string; component_id: string; amount: string; effective_from: string; effective_to: string | null; notes: string | null }) {
  const { data: comp } = await db().from("salary_components").select("id, name, calc_type").eq("id", input.component_id).maybeSingle();
  if (!comp) throw new ValidationError("البند غير موجود.", { component_id: "غير موجود" });
  if (comp.calc_type === "percent_of_basic" && Number(input.amount) > 100) throw new ValidationError("النسبة لا تتجاوز 100%.", { amount: "غير صالح" });
  // A new value for the same component closes the open one the day before.
  const { data: open } = await db().from("employee_salary_components").select("id, effective_from").eq("employee_id", input.employee_id).eq("component_id", input.component_id).is("effective_to", null);
  for (const row of open ?? []) {
    if (row.effective_from >= input.effective_from) throw new ValidationError("يوجد قيمة لنفس البند تبدأ في نفس التاريخ أو بعده.", { effective_from: "تداخل" });
    const d = new Date(`${input.effective_from}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    await db().from("employee_salary_components").update({ effective_to: d.toISOString().slice(0, 10) }).eq("id", row.id);
  }
  const { error } = await db().from("employee_salary_components").insert({ ...input, amount: dec(input.amount) as unknown as number, created_by: bos.userId });
  if (error) throw error;
  await audit({ actorId: bos.userId, action: "compensation.component_set", entityType: "employee", entityId: input.employee_id, newValue: { component: comp.name, amount: "***", effective_from: input.effective_from, effective_to: input.effective_to } });
  await db().rpc("bos_sync_hourly_cost", { p_employee: input.employee_id });
}

export async function endEmployeeComponent(bos: BosUser, id: string, effectiveTo: string) {
  const { data: row } = await db().from("employee_salary_components").select("*").eq("id", id).maybeSingle();
  if (!row) throw new NotFoundError();
  if (effectiveTo < row.effective_from) throw new ValidationError("تاريخ الانتهاء قبل تاريخ البدء.");
  await db().from("employee_salary_components").update({ effective_to: effectiveTo }).eq("id", id);
  await audit({ actorId: bos.userId, action: "compensation.component_ended", entityType: "employee", entityId: row.employee_id, newValue: { component_id: row.component_id, effective_to: effectiveTo } });
  await db().rpc("bos_sync_hourly_cost", { p_employee: row.employee_id });
}

// ---------------------------------------------------------------------------
// Job history, promotion (§25)
// ---------------------------------------------------------------------------

export async function listJobHistory(employeeId: string) {
  const { data } = await db().from("employee_job_history").select("*").eq("employee_id", employeeId).order("effective_date", { ascending: false }).order("created_at", { ascending: false });
  return data ?? [];
}

export interface PromotionInput {
  to_position: string;
  department_id: string | null;
  team_id: string | null;
  manager_id: string | null;
  effective_date: string;
  reason: string;
  new_basic_salary: string | null;
  currency: string | null;
  review_id: string | null;
}

export async function promoteEmployee(bos: BosUser, employeeId: string, input: PromotionInput) {
  const { data: emp } = await db().from("employees").select("*").eq("id", employeeId).maybeSingle();
  if (!emp) throw new NotFoundError();
  if (!["active", "on_leave", "onboarding"].includes(emp.lifecycle_status)) throw new ValidationError("الترقية متاحة للموظفين النشطين فقط.");
  if (input.manager_id === employeeId) throw new ValidationError("لا يمكن أن يكون الموظف مديراً لنفسه.", { manager_id: "غير مسموح" });
  await db().from("employees").update({ position: input.to_position, department_id: input.department_id ?? emp.department_id, team_id: input.team_id ?? emp.team_id, manager_id: input.manager_id ?? emp.manager_id }).eq("id", employeeId);
  await db().from("employee_job_history").insert({
    employee_id: employeeId,
    effective_date: input.effective_date,
    change_type: "promotion",
    from_position: emp.position,
    to_position: input.to_position,
    from_department_id: emp.department_id,
    to_department_id: input.department_id ?? emp.department_id,
    from_team_id: emp.team_id,
    to_team_id: input.team_id ?? emp.team_id,
    from_manager_id: emp.manager_id,
    to_manager_id: input.manager_id ?? emp.manager_id,
    review_id: input.review_id,
    reason: input.reason,
    created_by: bos.userId,
  });
  await audit({ actorId: bos.userId, action: "employee.promoted", entityType: "employee", entityId: employeeId, oldValue: { position: emp.position }, newValue: { position: input.to_position }, reason: input.reason });
  await emitEvent({ type: "employee.promoted", entityType: "employee", entityId: employeeId, summary: `${emp.full_name} promoted to ${input.to_position}`, actorId: bos.userId, payload: { employee_user_id: emp.user_id } });
  if (input.new_basic_salary && input.currency) {
    await addCompensation(bos, employeeId, { effective_from: input.effective_date, basic_salary: input.new_basic_salary, currency: input.currency, change_type: "promotion", reason: input.reason, review_id: input.review_id });
  }
}

// ---------------------------------------------------------------------------
// Profile photo (§30): private bucket, served through /api/bos/avatar
// ---------------------------------------------------------------------------

const PHOTO_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const PHOTO_MAX_BYTES = 5 * 1024 * 1024;

export async function createPhotoUpload(employeeId: string, mime: string, size: number) {
  const ext = PHOTO_TYPES[mime];
  if (!ext) throw new ValidationError("الصورة يجب أن تكون JPG أو PNG أو WEBP.");
  if (size <= 0 || size > PHOTO_MAX_BYTES) throw new ValidationError("الحد الأقصى لحجم الصورة 5MB.");
  const path = `employee-photos/${employeeId}/${crypto.randomUUID()}.${ext}`;
  const { data, error } = await db().storage.from("bos-files").createSignedUploadUrl(path);
  if (error || !data) throw error ?? new Error("Could not create upload URL");
  return { path, token: data.token };
}

export async function finalizePhoto(bos: BosUser, employeeId: string, path: string) {
  if (!path.startsWith(`employee-photos/${employeeId}/`)) throw new ValidationError("مسار الصورة غير صالح.");
  const folder = path.split("/").slice(0, -1).join("/");
  const name = path.split("/").pop()!;
  const { data: objects } = await db().storage.from("bos-files").list(folder, { search: name });
  if (!objects?.some((o) => o.name === name)) throw new ValidationError("لم يكتمل رفع الصورة. حاول مرة أخرى.");
  const { data: emp } = await db().from("employees").select("photo_path").eq("id", employeeId).maybeSingle();
  await db().from("employees").update({ photo_path: path, photo_updated_at: nowIso() }).eq("id", employeeId);
  if (emp?.photo_path && emp.photo_path !== path) await db().storage.from("bos-files").remove([emp.photo_path]);
  await audit({ actorId: bos.userId, action: "employee.photo_updated", entityType: "employee", entityId: employeeId });
}

export async function removePhoto(bos: BosUser, employeeId: string) {
  const { data: emp } = await db().from("employees").select("photo_path").eq("id", employeeId).maybeSingle();
  if (!emp?.photo_path) return;
  await db().storage.from("bos-files").remove([emp.photo_path]);
  await db().from("employees").update({ photo_path: null, photo_updated_at: nowIso() }).eq("id", employeeId);
  await audit({ actorId: bos.userId, action: "employee.photo_removed", entityType: "employee", entityId: employeeId });
}

export async function listEmployeeCategories(activeOnly = true) {
  let q = db().from("employee_categories").select("*").order("sort_order").order("name");
  if (activeOnly) q = q.eq("is_active", true);
  const { data } = await q;
  return data ?? [];
}
