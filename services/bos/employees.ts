import { nowIso, nowMs } from "@/lib/bos/clock";
import "server-only";
import { branchFilter, withBranch } from "@/lib/bos/branch";
import { db, dec, type DbEnum, type Tables } from "@/lib/bos/db";
import { scopeUserIds, type BosUser } from "@/lib/bos/auth";
import type { Scope } from "@/lib/bos/permissions";
import { audit, diffFields, recordStatus } from "@/lib/bos/audit";
import { emitEvent } from "@/lib/bos/events";
import { getSetting } from "@/lib/bos/settings";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/bos/errors";
import { todayIn } from "@/lib/bos/format";
import { recordInvitation } from "@/services/bos/users";

// Employees (§29, IT §2): one record per person connecting role, org,
// schedule, attendance, KPIs, access and devices.

export type Employee = Tables<"employees">;
export type LifecycleStatus = DbEnum<"employee_lifecycle_status">;

// IT addendum validation: allowed lifecycle transitions.
export const lifecycleTransitions: Record<LifecycleStatus, LifecycleStatus[]> = {
  candidate: ["hired"],
  hired: ["pending_onboarding"],
  pending_onboarding: ["onboarding", "offboarding"],
  onboarding: ["active", "offboarding"],
  active: ["on_leave", "suspended", "offboarding"],
  on_leave: ["active", "suspended", "offboarding"],
  suspended: ["active", "offboarding"],
  // Offboarding ends in Terminated once the checklist is complete (docs/bos/28 §24, §42).
  offboarding: ["terminated"],
  terminated: ["archived"],
  archived: [],
};

export const separationTypes = ["resignation", "termination", "end_of_contract", "retirement", "mutual", "other"] as const;
export type SeparationType = (typeof separationTypes)[number];
export interface SeparationInput {
  separation_type: SeparationType;
  notice_date: string | null;
  last_working_day: string | null;
}

export interface EmployeeFilters {
  q?: string;
  department?: string;
  team?: string;
  status?: string;
  type?: string;
  manager?: string;
  location?: string;
  category?: string;
  branch?: string;
  archived?: string;
  page?: number;
  pageSize?: number;
}

export async function listEmployees(bos: BosUser, scope: Scope, f: EmployeeFilters) {
  const pageSize = Math.min(f.pageSize ?? 50, 200);
  const page = Math.max(1, f.page ?? 1);
  let q = db()
    .from("employees")
    .select("id, user_id, employee_code, full_name, photo_path, photo_updated_at, email, phone, position, department_id, team_id, manager_id, lifecycle_status, employment_type, country, timezone, is_remote, start_date, work_location, category_id, last_activity_at, archived_at, departments(name), teams(name)", { count: "exact" });
  q = withBranch(q, await branchFilter(bos));
  const users = await scopeUserIds(bos, scope);
  if (users) q = q.in("user_id", users);
  q = f.archived === "1" ? q.not("archived_at", "is", null) : q.is("archived_at", null);
  if (f.q) {
    const p = `%${f.q.replace(/[%_,()]/g, " ").trim()}%`;
    q = q.or(`full_name.ilike.${p},email.ilike.${p},position.ilike.${p},employee_code.ilike.${p}`);
  }
  if (f.department) q = q.eq("department_id", f.department);
  if (f.team) q = q.eq("team_id", f.team);
  if (f.status) q = q.eq("lifecycle_status", f.status as LifecycleStatus);
  if (f.type) q = q.eq("employment_type", f.type as DbEnum<"employment_type">);
  if (f.manager) q = q.eq("manager_id", f.manager);
  if (f.location) q = q.ilike("work_location", `%${f.location.replace(/[%_]/g, " ")}%`);
  if (f.category) q = q.eq("category_id", f.category);
  if (f.branch) q = q.eq("branch_id", f.branch);
  const { data, count, error } = await q.order("full_name").range((page - 1) * pageSize, page * pageSize - 1);
  if (error) throw error;
  const rows = data ?? [];

  // Today's attendance per employee in the employee's own timezone.
  const userIds = rows.map((r) => r.user_id).filter(Boolean) as string[];
  const dates = [...new Set(rows.map((r) => todayIn(r.timezone)))];
  const [{ data: records }, { data: roles }, { data: managers }] = await Promise.all([
    userIds.length ? db().from("attendance_records").select("user_id, work_date, status, first_clock_in").in("user_id", userIds).in("work_date", dates) : Promise.resolve({ data: [] as { user_id: string; work_date: string; status: string; first_clock_in: string | null }[] }),
    userIds.length ? db().from("user_roles").select("user_id, roles(name)").in("user_id", userIds) : Promise.resolve({ data: [] as { user_id: string; roles: unknown }[] }),
    db().from("employees").select("id, full_name").in("id", [...new Set(rows.map((r) => r.manager_id).filter(Boolean))] as string[]),
  ]);
  const managerNames = new Map((managers ?? []).map((m) => [m.id, m.full_name]));
  return {
    rows: rows.map((r) => ({
      ...r,
      managerName: r.manager_id ? managerNames.get(r.manager_id) ?? null : null,
      roleNames: (roles ?? []).filter((x) => x.user_id === r.user_id).map((x) => (x.roles as { name: string } | null)?.name).filter(Boolean) as string[],
      today: (records ?? []).find((x) => x.user_id === r.user_id && x.work_date === todayIn(r.timezone)) ?? null,
    })),
    total: count ?? 0,
    page,
    pageSize,
  };
}

export async function getEmployee(id: string) {
  const { data, error } = await db().from("employees").select("*, departments(id, name), teams(id, name), branches!employees_branch_id_fkey(id, name), work_schedules(id, name, timezone, start_time, end_time, work_days, break_minutes, grace_minutes)").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) throw new NotFoundError();
  const [{ data: manager }, { data: roles }, { data: reports }] = await Promise.all([
    data.manager_id ? db().from("employees").select("id, full_name, user_id").eq("id", data.manager_id).maybeSingle() : Promise.resolve({ data: null }),
    data.user_id ? db().from("user_roles").select("role_id, roles(id, key, name)").eq("user_id", data.user_id) : Promise.resolve({ data: [] }),
    db().from("employees").select("id, full_name, position, lifecycle_status").eq("manager_id", id).is("archived_at", null),
  ]);
  return {
    ...data,
    manager: manager as { id: string; full_name: string; user_id: string | null } | null,
    roles: (roles ?? []).map((r) => r.roles as unknown as { id: string; key: string; name: string }).filter(Boolean),
    directReports: reports ?? [],
  };
}

export async function getEmployeeByUserId(userId: string) {
  const { data } = await db().from("employees").select("id").eq("user_id", userId).maybeSingle();
  return data?.id ?? null;
}

export interface EmployeeInput {
  full_name: string;
  employee_code: string | null;
  email: string | null;
  personal_email: string | null;
  phone: string | null;
  position: string | null;
  department_id: string | null;
  team_id: string | null;
  manager_id: string | null;
  start_date: string | null;
  employment_type: DbEnum<"employment_type">;
  work_schedule_id: string | null;
  country: string | null;
  timezone: string;
  is_remote: boolean;
  hourly_cost: string | null;
  cost_currency: string | null;
  work_location?: string | null;
  category_id?: string | null;
  probation_end_date?: string | null;
  probation_status?: "none" | "in_probation" | "passed" | "extended" | "failed";
  skills?: string[];
  certifications?: string | null;
  qualifications?: string | null;
  experience_years?: string | null;
  profile_notes?: string | null;
  hourly_cost_source?: "manual" | "salary";
  branch_id?: string | null;
}

function validTimezone(tz: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

async function validate(input: EmployeeInput, id?: string) {
  if (!validTimezone(input.timezone)) throw new ValidationError("المنطقة الزمنية غير صالحة (استخدم صيغة IANA مثل Africa/Cairo).", { timezone: "غير صالحة" });
  if (input.email) {
    const company = await getSetting("company");
    const domain = (company as { email_domain?: string }).email_domain;
    if (domain && !input.email.toLowerCase().endsWith(`@${domain.toLowerCase()}`) && !input.email.toLowerCase().endsWith(".local")) {
      throw new ValidationError(`البريد الرسمي يجب أن يكون على نطاق الشركة @${domain}.`, { email: `@${domain}` });
    }
    let q = db().from("employees").select("id").ilike("email", input.email);
    if (id) q = q.neq("id", id);
    const { data } = await q.maybeSingle();
    if (data) throw new ValidationError("البريد الرسمي مستخدم لموظف آخر.", { email: "مكرر" });
  }
  if (input.manager_id) {
    if (id && input.manager_id === id) throw new ValidationError("لا يمكن أن يكون الموظف مديراً لنفسه.", { manager_id: "غير مسموح" });
    if (id) {
      // Walk up the manager chain to prevent cycles.
      let cursor: string | null = input.manager_id;
      for (let i = 0; cursor && i < 50; i++) {
        if (cursor === id) throw new ValidationError("هذا التعيين يُنشئ حلقة في الهيكل الإداري.", { manager_id: "حلقة" });
        const { data: next }: { data: { manager_id: string | null } | null } = await db().from("employees").select("manager_id").eq("id", cursor).maybeSingle();
        cursor = next?.manager_id ?? null;
      }
    }
  }
  if (input.team_id && input.department_id) {
    const { data: team } = await db().from("teams").select("department_id").eq("id", input.team_id).maybeSingle();
    if (team?.department_id && team.department_id !== input.department_id) throw new ValidationError("الفريق لا يتبع القسم المختار.", { team_id: "قسم مختلف" });
  }
}

function toRow(input: EmployeeInput) {
  const { experience_years, ...rest } = input;
  return {
    ...rest,
    ...(experience_years !== undefined ? { experience_years: experience_years === null ? null : Number(experience_years) } : {}),
    email: input.email?.toLowerCase() ?? null,
    hourly_cost: dec(input.hourly_cost),
  };
}

export async function createEmployee(bos: BosUser, input: EmployeeInput, opts: { roleIds: string[]; createLogin: boolean; careerApplicationId?: string | null }) {
  await validate(input);
  // No explicit schedule → inherits team / department / company schedule.
  const { data, error } = await db()
    .from("employees")
    .insert({ ...toRow(input), work_schedule_id: input.work_schedule_id ?? null, lifecycle_status: "pending_onboarding", career_application_id: opts.careerApplicationId ?? null })
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") throw new ValidationError("كود الموظف أو البريد مستخدم.", { employee_code: "مكرر" });
    throw error;
  }
  await recordStatus("employee", data.id, null, "pending_onboarding", bos.userId);
  await audit({ actorId: bos.userId, action: "employee.created", entityType: "employee", entityId: data.id, newValue: { ...input, hourly_cost: input.hourly_cost ? "***" : null } });
  await db().from("employee_job_history").insert({ employee_id: data.id, effective_date: input.start_date ?? nowIso().slice(0, 10), change_type: "hire", to_position: input.position, to_department_id: input.department_id, to_team_id: input.team_id, to_manager_id: input.manager_id, reason: opts.careerApplicationId ? "Hired from recruitment" : null, created_by: bos.userId });

  if (opts.createLogin) {
    await createBosLogin(bos, data.id, opts.roleIds);
  }
  // Onboarding checklist (IT §14–15).
  await db().rpc("bos_start_onboarding", { p_subject: "employee", p_template_key: "employee_onboarding", p_client: null as unknown as string, p_deal: null as unknown as string, p_project: null as unknown as string, p_employee: data.id, p_due: (input.start_date ? addDaysIso(input.start_date, 14) : null) as unknown as string });
  await emitEvent({ type: "employee.created", entityType: "employee", entityId: data.id, summary: `Employee created: ${data.full_name}`, actorId: bos.userId, payload: { manager_id: data.manager_id } });
  await emitEvent({ type: "onboarding.started", entityType: "employee", entityId: data.id, summary: `Onboarding started: ${data.full_name}`, actorId: bos.userId, payload: { employee_user_id: data.user_id } });
  return data;
}

function addDaysIso(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Creates the Supabase Auth user by invitation (no password is ever set or
// stored by the BOS) and links it to the employee.
export async function createBosLogin(bos: BosUser, employeeId: string, roleIds: string[]) {
  const emp = await getEmployee(employeeId);
  if (emp.user_id) throw new ValidationError("لدى الموظف حساب دخول بالفعل.");
  if (!emp.email) throw new ValidationError("أدخل البريد الرسمي للموظف أولاً.", { email: "مطلوب" });
  const admin = db();
  const { data: existing } = await admin.rpc("bos_find_auth_user_by_email", { p_email: emp.email });
  let userId = (existing as string | null) ?? null;
  let invited = false;
  if (!userId) {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(emp.email, { data: { full_name: emp.full_name, role: "staff" } });
    if (error) throw new ValidationError(`تعذر إنشاء حساب الدخول: ${error.message}`);
    userId = data.user.id;
    invited = true;
  } else {
    const { data: linked } = await admin.from("employees").select("id").eq("user_id", userId).maybeSingle();
    if (linked) throw new ValidationError("هذا البريد مرتبط بموظف آخر.");
  }
  await admin.auth.admin.updateUserById(userId, { app_metadata: { role: "staff" } });
  if (invited) await recordInvitation(userId, employeeId, emp.email, bos.userId);
  await admin.from("employees").update({ user_id: userId, ...(emp.lifecycle_status === "pending_onboarding" ? { lifecycle_status: "onboarding" as const } : {}) }).eq("id", employeeId);
  if (emp.lifecycle_status === "pending_onboarding") await recordStatus("employee", employeeId, "pending_onboarding", "onboarding", bos.userId, "BOS account created");
  if (roleIds.length) await setEmployeeRoles(bos, employeeId, roleIds, userId);
  await audit({ actorId: bos.userId, action: "employee.login_created", entityType: "employee", entityId: employeeId, newValue: { user_id: userId, email: emp.email } });
  await db().rpc("bos_generate_access_checklist", { p_employee: employeeId, p_actor: bos.userId });
  await refreshEmployeeOnboardingSafe(employeeId, bos.userId);
  return userId;
}

export async function setEmployeeRoles(bos: BosUser, employeeId: string, roleIds: string[], knownUserId?: string) {
  const emp = knownUserId ? { user_id: knownUserId } : await getEmployee(employeeId);
  if (!emp.user_id) throw new ValidationError("أنشئ حساب دخول للموظف قبل تعيين الأدوار.");
  const { data: roles } = await db().from("roles").select("id, key").in("id", roleIds.length ? roleIds : ["00000000-0000-0000-0000-000000000000"]);
  if ((roles ?? []).some((r) => r.key === "super_admin") && !bos.isSuperAdmin) throw new ValidationError("تعيين دور المدير العام يتطلب مديراً عاماً.");
  const { data: before } = await db().from("user_roles").select("role_id").eq("user_id", emp.user_id);
  const beforeIds = (before ?? []).map((r) => r.role_id).sort();
  const afterIds = [...new Set(roleIds)].sort();
  if (JSON.stringify(beforeIds) === JSON.stringify(afterIds)) return;
  await db().from("user_roles").delete().eq("user_id", emp.user_id);
  if (afterIds.length) await db().from("user_roles").insert(afterIds.map((role_id) => ({ user_id: emp.user_id as string, role_id, assigned_by: bos.userId })));
  await audit({ actorId: bos.userId, action: "employee.roles_changed", entityType: "employee", entityId: employeeId, oldValue: { role_ids: beforeIds }, newValue: { role_ids: afterIds } });
  // Role change re-derives the access checklist (IT edge case: new required apps added, removed flagged for review).
  await db().rpc("bos_generate_access_checklist", { p_employee: employeeId, p_actor: bos.userId });
  await refreshEmployeeOnboardingSafe(employeeId, bos.userId);
}

const tracked: (keyof Employee)[] = ["full_name", "employee_code", "email", "personal_email", "phone", "position", "department_id", "team_id", "manager_id", "start_date", "employment_type", "work_schedule_id", "country", "timezone", "is_remote", "hourly_cost", "cost_currency", "work_location", "category_id", "probation_end_date", "probation_status", "skills", "certifications", "qualifications", "experience_years", "profile_notes", "hourly_cost_source", "branch_id"];

export async function updateEmployee(bos: BosUser, id: string, input: EmployeeInput, opts: { canSensitive: boolean }) {
  const before = await getEmployee(id);
  if (before.archived_at) throw new ValidationError("الموظف مؤرشف.");
  // Employment data is changed by HR / authorised admins only — never by the
  // employee on their own record through a narrower scope (docs/bos/35 B7).
  if (before.user_id === bos.userId && bos.permissions.get("employees.update") !== "all") throw new ForbiddenError("بياناتك الوظيفية تُعدَّل من الموارد البشرية فقط.");
  await validate(input, id);
  const row = toRow(input);
  if (!opts.canSensitive) {
    row.hourly_cost = before.hourly_cost;
    row.cost_currency = before.cost_currency;
    row.hourly_cost_source = before.hourly_cost_source as "manual" | "salary";
  }
  const { error } = await db().from("employees").update(row).eq("id", id);
  if (error) throw error;
  const diff = diffFields(before as unknown as Record<string, unknown>, row as unknown as Record<string, unknown>, tracked as string[]);
  if (diff.changed) {
    if ("hourly_cost" in diff.newValue) {
      diff.oldValue.hourly_cost = "***";
      diff.newValue.hourly_cost = "***";
    }
    await audit({ actorId: bos.userId, action: "employee.updated", entityType: "employee", entityId: id, oldValue: diff.oldValue, newValue: diff.newValue });
  }
  if (before.manager_id !== input.manager_id) {
    await emitEvent({ type: "employee.manager_changed", entityType: "employee", entityId: id, summary: `Manager changed for ${input.full_name}`, actorId: bos.userId, payload: { from: before.manager_id, to: input.manager_id } });
  }
  // Job history: department / team / manager / title changes (transfer, title change).
  const moved = before.department_id !== input.department_id || before.team_id !== input.team_id || before.manager_id !== input.manager_id;
  if (moved || before.position !== input.position) {
    await db().from("employee_job_history").insert({
      employee_id: id,
      effective_date: nowIso().slice(0, 10),
      change_type: moved ? "transfer" : "title_change",
      from_position: before.position, to_position: input.position,
      from_department_id: before.department_id, to_department_id: input.department_id,
      from_team_id: before.team_id, to_team_id: input.team_id,
      from_manager_id: before.manager_id, to_manager_id: input.manager_id,
      created_by: bos.userId,
    });
  }
  if (row.hourly_cost_source === "salary") await db().rpc("bos_sync_hourly_cost", { p_employee: id });
  await refreshEmployeeOnboardingSafe(id, bos.userId);
}

export async function changeLifecycleStatus(bos: BosUser, id: string, to: LifecycleStatus, reason: string | null, separation?: SeparationInput) {
  const emp = await getEmployee(id);
  const from = emp.lifecycle_status;
  const allowed = lifecycleTransitions[from] ?? [];
  const restoring = from === "archived" && to === "active";
  if (!allowed.includes(to) && !(restoring && bos.isSuperAdmin)) {
    throw new ValidationError(`لا يمكن الانتقال من «${from}» إلى «${to}».`);
  }
  if ((to === "suspended" || to === "offboarding" || to === "terminated" || to === "archived" || restoring) && !reason) {
    throw new ValidationError("السبب مطلوب لهذا التغيير.", { reason: "مطلوب" });
  }
  if (to === "offboarding" && !separation) {
    throw new ValidationError("حدد نوع انتهاء الخدمة (استقالة / إنهاء / انتهاء عقد…).", { separation_type: "مطلوب" });
  }
  if (to === "active" && from === "onboarding") {
    const { data: checklist } = await db().from("onboarding_checklists").select("id, status").eq("employee_id", id).eq("template_key", "employee_onboarding").neq("status", "cancelled").maybeSingle();
    if (checklist && checklist.status !== "completed") throw new ValidationError("أكمل قائمة التهيئة والتأكيدات الثلاثة أولاً (الموظف، المدير، الإدارة).");
  }
  if (to === "terminated") {
    const { data: off } = await db().from("onboarding_checklists").select("id, status").eq("employee_id", id).eq("template_key", "employee_offboarding").neq("status", "cancelled").maybeSingle();
    if (off && off.status !== "completed") throw new ValidationError("أكمل قائمة إنهاء الخدمة (بما فيها الموافقة النهائية) أولاً.");
  }
  if (to === "terminated" || to === "archived") {
    const { count: devices } = await db().from("devices").select("id", { count: "exact", head: true }).eq("assigned_employee_id", id);
    if (devices) throw new ValidationError(`لا يمكن الأرشفة: لدى الموظف ${devices} جهاز لم يُسترجع.`);
    // Software licence seats and loaned assets are held through open assignments (Phase 15).
    const { count: seats } = await db().from("device_assignments").select("id", { count: "exact", head: true }).eq("employee_id", id).is("returned_at", null);
    if (seats) throw new ValidationError(`لا يمكن الأرشفة: لدى الموظف ${seats} أصل أو ترخيص لم يُسترجع.`);
    const { count: active } = await db().from("access_grants").select("id", { count: "exact", head: true }).eq("employee_id", id).in("status", ["active", "provisioned", "pending"]);
    if (active) throw new ValidationError(`لا يمكن الأرشفة: توجد ${active} صلاحية وصول لم تُلغَ.`);
  }

  const update: Partial<Employee> = { lifecycle_status: to };
  if (to === "archived") update.archived_at = nowIso();
  if (to === "offboarding" && separation) {
    const { error: sepError } = await db().from("employee_separations").insert({ employee_id: id, separation_type: separation.separation_type, notice_date: separation.notice_date, last_working_day: separation.last_working_day, reason, initiated_by: bos.userId });
    if (sepError && sepError.code !== "23505") throw sepError;
  }
  if (to === "terminated") {
    await db().from("employee_separations").update({ status: "completed", completed_at: nowIso() }).eq("employee_id", id).eq("status", "in_progress");
    await db().from("employee_contracts").update({ status: "terminated", terminated_at: nowIso(), termination_reason: reason }).eq("employee_id", id).eq("status", "active");
  }
  if (restoring || (from === "offboarding" && to !== "terminated")) {
    await db().from("employee_separations").update({ status: "cancelled" }).eq("employee_id", id).eq("status", "in_progress");
  }
  if (restoring) update.archived_at = null;
  await db().from("employees").update(update).eq("id", id);
  await recordStatus("employee", id, from, to, bos.userId, reason);
  await audit({ actorId: bos.userId, action: "employee.lifecycle_changed", entityType: "employee", entityId: id, oldValue: { lifecycle_status: from }, newValue: { lifecycle_status: to }, reason });

  // Side effects (IT workflows 3–4).
  if (emp.user_id) {
    if (to === "suspended" || to === "terminated" || to === "archived") {
      await db().auth.admin.updateUserById(emp.user_id, { ban_duration: "876000h" });
      await db().auth.admin.signOut(emp.user_id).catch(() => undefined);
    } else if ((from === "suspended" || restoring) && to === "active") {
      await db().auth.admin.updateUserById(emp.user_id, { ban_duration: "none" });
    }
  }
  if (to === "suspended") {
    await db().from("access_grants").update({ needs_review: true }).eq("employee_id", id).in("status", ["active", "provisioned"]);
  }
  if (to === "offboarding") {
    await db().rpc("bos_start_onboarding", { p_subject: "employee", p_template_key: "employee_offboarding", p_client: null as unknown as string, p_deal: null as unknown as string, p_project: null as unknown as string, p_employee: id, p_due: addDaysIso(nowIso().slice(0, 10), 7) });
    await db().from("devices").update({ return_status: "pending_return" }).eq("assigned_employee_id", id);
    await db().from("access_grants").update({ needs_review: true }).eq("employee_id", id).in("status", ["active", "provisioned", "pending"]);
    await db().from("onboarding_checklists").update({ status: "cancelled" }).eq("employee_id", id).eq("template_key", "employee_onboarding").eq("status", "in_progress");
    await emitEvent({ type: "offboarding.started", entityType: "employee", entityId: id, summary: `Offboarding started: ${emp.full_name} (${separation?.separation_type ?? ""})`, actorId: bos.userId, payload: { employee_user_id: emp.user_id, separation_type: separation?.separation_type, last_working_day: separation?.last_working_day } });
  }
  if (to !== "offboarding" && to !== "terminated" && to !== "archived") {
    await db().from("employee_job_history").insert({ employee_id: id, effective_date: nowIso().slice(0, 10), change_type: "status_change", reason: `${from} → ${to}${reason ? `: ${reason}` : ""}`, created_by: bos.userId });
  }
  // Direct reports of someone leaving need a new manager (edge case).
  if ((to === "offboarding" || to === "terminated" || to === "archived") && emp.directReports.length) {
    await emitEvent({ type: "employee.reports_need_reassignment", entityType: "employee", entityId: id, summary: `${emp.directReports.length} direct report(s) of ${emp.full_name} need a new manager`, actorId: bos.userId, payload: { reports: emp.directReports.map((r) => r.id) } });
  }
  await emitEvent({
    type: "employee.lifecycle_changed",
    entityType: "employee",
    entityId: id,
    summary: `${emp.full_name}: ${from} → ${to}`,
    actorId: bos.userId,
    payload: { from, to, reason, employee_user_id: emp.user_id },
  });
}

// Career application → employee (§29 "from candidate").
export async function candidateDefaults(applicationId: string) {
  const { data } = await db().from("career_applications").select("*").eq("id", applicationId).maybeSingle();
  return data;
}

// ---------------------------------------------------------------------------
// Employee onboarding auto-completion (IT §15). State-based: every auto key
// is re-evaluated from current data, so it is idempotent and self-healing.
// ---------------------------------------------------------------------------

export async function refreshEmployeeOnboarding(employeeId: string, actorId: string | null) {
  const c = db();
  const { data: checklist } = await c.from("onboarding_checklists").select("id, status").eq("employee_id", employeeId).eq("template_key", "employee_onboarding").eq("status", "in_progress").maybeSingle();
  const { data: offboarding } = await c.from("onboarding_checklists").select("id, status").eq("employee_id", employeeId).eq("template_key", "employee_offboarding").eq("status", "in_progress").maybeSingle();
  if (!checklist && !offboarding) return;
  const { data: emp } = await c.from("employees").select("*").eq("id", employeeId).single();
  if (!emp) return;

  const [roles, email, grants, devices, assignments, kpis, channels, reads, managerMeeting, accounts, deals, work] = await Promise.all([
    emp.user_id ? c.from("user_roles").select("role_id").eq("user_id", emp.user_id) : Promise.resolve({ data: [] }),
    c.from("company_accounts").select("id").eq("employee_id", employeeId).eq("account_type", "email").eq("status", "active").limit(1),
    c.from("access_grants").select("status, is_required").eq("employee_id", employeeId),
    c.from("devices").select("id").eq("assigned_employee_id", employeeId),
    c.from("device_assignments").select("confirmed_by_employee_at, returned_at").eq("employee_id", employeeId),
    emp.user_id ? c.from("kpi_assignments").select("kpi_id").eq("user_id", emp.user_id).limit(1) : Promise.resolve({ data: [] }),
    emp.user_id ? c.from("channel_members").select("channel_id, channels!inner(kind)").eq("user_id", emp.user_id).eq("channels.kind", "team").limit(1) : Promise.resolve({ data: [] }),
    emp.user_id ? c.from("kb_article_reads").select("kb_articles(slug)").eq("user_id", emp.user_id) : Promise.resolve({ data: [] }),
    emp.user_id && emp.manager_id ? managerMeetingDone(emp.user_id, emp.manager_id) : Promise.resolve(false),
    c.from("company_accounts").select("status").eq("employee_id", employeeId),
    emp.user_id ? c.from("deals").select("id, pipeline_stages!inner(category)", { count: "exact", head: true }).eq("assigned_to", emp.user_id).eq("pipeline_stages.category", "open") : Promise.resolve({ count: 0 }),
    emp.user_id ? c.from("tasks").select("id", { count: "exact", head: true }).eq("assigned_to", emp.user_id).not("status", "in", "(completed,cancelled)") : Promise.resolve({ count: 0 }),
  ]);
  const hr = await hrOnboardingState(employeeId, emp);
  const readSlugs = new Set(((reads.data ?? []) as { kb_articles: unknown }[]).map((r) => (r.kb_articles as { slug: string } | null)?.slug).filter(Boolean));
  const grantRows = (grants.data ?? []) as { status: string; is_required: boolean }[];
  const assignRows = (assignments.data ?? []) as { confirmed_by_employee_at: string | null; returned_at: string | null }[];
  const openLeads = emp.user_id ? (await c.from("leads").select("id", { count: "exact", head: true }).eq("assigned_to", emp.user_id).is("converted_deal_id", null).is("archived_at", null)).count ?? 0 : 0;
  const openPm = emp.user_id ? (await c.from("projects").select("id", { count: "exact", head: true }).eq("pm_id", emp.user_id).not("status", "in", "(completed,cancelled)")).count ?? 0 : 0;

  const state: Record<string, boolean> = {
    company_email: (email.data ?? []).length > 0,
    bos_account: !!emp.user_id,
    role_assigned: (roles.data ?? []).length > 0,
    manager_assigned: !!emp.manager_id,
    team_assigned: !!emp.team_id,
    mfa_enabled: emp.mfa_status === "enabled",
    required_access_active: grantRows.filter((g) => g.is_required).length > 0 && grantRows.filter((g) => g.is_required).every((g) => g.status === "active"),
    channels_joined: (channels.data ?? []).length > 0,
    device_assigned: (devices.data ?? []).length > 0 || assignRows.length > 0,
    device_received: assignRows.some((a) => a.confirmed_by_employee_at && !a.returned_at),
    manager_meeting: managerMeeting as boolean,
    kpis_assigned: (kpis.data ?? []).length > 0,
    // offboarding
    access_revoked: grantRows.every((g) => !["active", "provisioned", "pending"].includes(g.status)),
    accounts_suspended: ((accounts.data ?? []) as { status: string }[]).every((a) => ["revoked", "expired", "rejected"].includes(a.status)),
    bos_disabled: await bosLoginDisabled(emp.user_id),
    sales_transferred: openLeads === 0 && ((deals as { count: number | null }).count ?? 0) === 0,
    work_transferred: openPm === 0 && ((work as { count: number | null }).count ?? 0) === 0,
    devices_returned: (devices.data ?? []).length === 0 && !((assignments.data ?? []) as { returned_at: string | null }[]).some((a) => !a.returned_at),
    ...hr.state,
  };

  for (const cl of [checklist, offboarding].filter(Boolean) as { id: string }[]) {
    const { data: items } = await c.from("onboarding_items").select("id, auto_key, is_done").eq("checklist_id", cl.id).not("auto_key", "is", null);
    for (const it of items ?? []) {
      const key = it.auto_key as string;
      if (key.startsWith("confirm:")) continue; // explicit confirmations only
      const done = key.startsWith("read:") ? readSlugs.has(key.slice(5)) : key.startsWith("app_category:") ? hr.appCategory(key.slice("app_category:".length)) : state[key];
      if (done === undefined) continue;
      if (done && !it.is_done) await c.from("onboarding_items").update({ is_done: true, done_by: actorId, done_at: nowIso() }).eq("id", it.id);
      // Auto items that regress (e.g. device returned during onboarding) re-open.
      if (!done && it.is_done && cl.id === checklist?.id) await c.from("onboarding_items").update({ is_done: false, done_by: null, done_at: null }).eq("id", it.id);
    }
  }
}

// HR-driven onboarding/offboarding auto items (docs/bos/28 §23–24).
async function hrOnboardingState(employeeId: string, emp: Employee) {
  const c = db();
  const [docs, types, contracts, priv, comp, grants, finalSlips, expenses, loans, sep, offers] = await Promise.all([
    c.from("employee_documents").select("status, document_types(key, required_for_onboarding)").eq("employee_id", employeeId),
    c.from("document_types").select("id, key").eq("is_active", true).eq("required_for_onboarding", true),
    c.from("employee_contracts").select("status, signature_status").eq("employee_id", employeeId),
    c.from("employee_private").select("date_of_birth, national_id, address, bank_account_number, bank_iban, emergency_contact_name, emergency_contact_phone").eq("employee_id", employeeId).maybeSingle(),
    c.from("employee_compensation").select("id").eq("employee_id", employeeId).eq("approval_status", "approved").limit(1),
    c.from("access_grants").select("status, is_required, external_apps(category)").eq("employee_id", employeeId),
    c.from("payslips").select("status, payroll_runs!inner(run_type)").eq("employee_id", employeeId).eq("payroll_runs.run_type", "final_settlement").in("status", ["final", "paid"]),
    emp.user_id ? c.from("expenses").select("id").eq("employee_user_id", emp.user_id).is("archived_at", null).or("approval_status.eq.pending,reimbursement_status.eq.pending") : Promise.resolve({ data: [] }),
    c.from("employee_loans").select("id").eq("employee_id", employeeId).in("status", ["pending", "approved", "active"]),
    c.from("employee_separations").select("exit_interview_at").eq("employee_id", employeeId).neq("status", "cancelled").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    emp.career_application_id ? c.from("job_offers").select("status").eq("application_id", emp.career_application_id).eq("status", "accepted").limit(1) : Promise.resolve({ data: [] }),
  ]);
  const docRows = (docs.data ?? []) as { status: string; document_types: unknown }[];
  const docOf = (key: string, statuses: string[]) => docRows.some((d) => (d.document_types as { key: string } | null)?.key === key && statuses.includes(d.status));
  const received = new Set(docRows.filter((d) => !["rejected", "archived"].includes(d.status)).map((d) => (d.document_types as { key: string } | null)?.key));
  const p = priv.data;
  const grantRows = (grants.data ?? []) as { status: string; is_required: boolean; external_apps: unknown }[];
  const state: Record<string, boolean> = {
    offer_signed: docOf("offer_acceptance", ["valid"]) || (offers.data ?? []).length > 0,
    contract_signed: ((contracts.data ?? []) as { status: string; signature_status: string }[]).some((k) => k.signature_status === "signed" && ["active", "expired", "superseded"].includes(k.status)),
    data_completed: !!(emp.phone && emp.start_date && emp.department_id && emp.position && p?.date_of_birth && p?.national_id && p?.address),
    id_verified: docOf("national_id", ["valid"]) || docOf("passport", ["valid"]),
    documents_received: ((types.data ?? []) as { key: string }[]).every((t) => received.has(t.key)),
    payment_details: !!(p?.bank_account_number || p?.bank_iban),
    emergency_contact: !!(p?.emergency_contact_name && p?.emergency_contact_phone),
    compensation_set: (comp.data ?? []).length > 0,
    final_salary: (finalSlips.data ?? []).length > 0,
    expenses_settled: (expenses.data ?? []).length === 0,
    loans_settled: (loans.data ?? []).length === 0,
    exit_interview: !!sep.data?.exit_interview_at,
  };
  const appCategory = (category: string) => {
    const inCat = grantRows.filter((g) => (g.external_apps as { category: string } | null)?.category === category);
    const required = inCat.filter((g) => g.is_required);
    return required.length ? required.every((g) => g.status === "active") : inCat.some((g) => g.status === "active");
  };
  return { state, appCategory };
}

async function bosLoginDisabled(userId: string | null) {
  if (!userId) return true;
  const { data } = await db().auth.admin.getUserById(userId);
  const until = (data?.user as { banned_until?: string | null } | undefined)?.banned_until;
  return !!until && new Date(until).getTime() > nowMs();
}

export async function setBosLoginDisabled(bos: BosUser, employeeId: string, disabled: boolean) {
  const emp = await getEmployee(employeeId);
  if (!emp.user_id) throw new ValidationError("لا يوجد حساب دخول لهذا الموظف.");
  if (!disabled && ["suspended", "archived"].includes(emp.lifecycle_status)) throw new ValidationError("غيّر حالة الموظف أولاً قبل إعادة تفعيل الدخول.");
  await db().auth.admin.updateUserById(emp.user_id, { ban_duration: disabled ? "876000h" : "none" });
  if (disabled) await db().auth.admin.signOut(emp.user_id).catch(() => undefined);
  await audit({ actorId: bos.userId, action: disabled ? "employee.login_disabled" : "employee.login_enabled", entityType: "employee", entityId: employeeId });
  await refreshEmployeeOnboardingSafe(employeeId, bos.userId);
}

async function managerMeetingDone(userId: string, managerEmployeeId: string) {
  const c = db();
  const { data: mgr } = await c.from("employees").select("user_id").eq("id", managerEmployeeId).maybeSingle();
  if (!mgr?.user_id) return false;
  const { data: meetings } = await c.from("meetings").select("id, organizer_id, meeting_attendees(user_id)").eq("status", "completed").or(`organizer_id.eq.${userId},organizer_id.eq.${mgr.user_id}`).limit(200);
  return (meetings ?? []).some((m) => {
    const people = new Set([m.organizer_id, ...((m.meeting_attendees as { user_id: string | null }[]) ?? []).map((a) => a.user_id)]);
    return people.has(userId) && people.has(mgr.user_id);
  });
}

export async function refreshEmployeeOnboardingSafe(employeeId: string, actorId: string | null) {
  try {
    await refreshEmployeeOnboarding(employeeId, actorId);
  } catch (error) {
    const { logServerError } = await import("@/lib/bos/errors");
    logServerError("refreshEmployeeOnboarding", error);
  }
}
