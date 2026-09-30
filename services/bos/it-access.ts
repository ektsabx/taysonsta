import { nowIso } from "@/lib/bos/clock";
import "server-only";
import { db, type DbEnum, type Tables } from "@/lib/bos/db";
import type { BosUser } from "@/lib/bos/auth";
import { audit, recordStatus } from "@/lib/bos/audit";
import { emitEvent } from "@/lib/bos/events";
import { getSetting } from "@/lib/bos/settings";
import { requestApproval } from "@/services/bos/approvals";
import { refreshEmployeeOnboardingSafe } from "@/services/bos/employees";
import { NotFoundError, ValidationError } from "@/lib/bos/errors";

// IT & Access (IT §3–11): the BOS records who should have which access and
// its status. It never stores passwords or MFA secrets.

export type AccessStatus = DbEnum<"access_status">;
export type AccessGrant = Tables<"access_grants">;

export const accessTransitions: Record<AccessStatus, AccessStatus[]> = {
  not_started: ["requested", "pending", "provisioned", "active", "rejected", "revoked"],
  requested: ["pending", "provisioned", "active", "rejected", "revoked"],
  pending: ["provisioned", "active", "rejected", "revoked"],
  provisioned: ["active", "rejected", "revoked"],
  active: ["expired", "revoked"],
  rejected: ["requested", "not_started"],
  revoked: ["requested", "not_started"],
  expired: ["requested", "active", "revoked"],
};

// Heuristic warning for secrets pasted into free-text fields (IT §11).
export function looksLikeSecret(text: string | null | undefined): boolean {
  if (!text) return false;
  if (/pass(word)?\s*[:=]/i.test(text) || /كلمة\s*(ال)?(سر|مرور)/.test(text)) return true;
  return text.split(/\s+/).some((w) => w.length >= 12 && /[A-Z]/.test(w) && /[a-z]/.test(w) && /\d/.test(w) && /[^A-Za-z0-9]/.test(w));
}

export async function listApps(includeInactive = true) {
  let q = db().from("external_apps").select("*").order("category").order("name");
  if (!includeInactive) q = q.eq("is_active", true);
  const { data } = await q;
  return data ?? [];
}

export async function getAccessProfile(employeeId: string) {
  const [{ data: grants }, { data: accounts }, { data: requests }] = await Promise.all([
    db().from("access_grants").select("*, external_apps(id, key, name, category, requires_mfa, is_sensitive, access_levels, url)").eq("employee_id", employeeId).order("created_at"),
    db().from("company_accounts").select("*, external_apps(name)").eq("employee_id", employeeId).order("created_at"),
    db().from("access_requests").select("*, external_apps(name)").eq("employee_id", employeeId).order("created_at", { ascending: false }).limit(50),
  ]);
  const g = grants ?? [];
  return {
    grants: g,
    groups: {
      required: g.filter((x) => x.is_required),
      granted: g.filter((x) => ["active", "provisioned"].includes(x.status)),
      missing: g.filter((x) => x.is_required && x.status !== "active"),
      pending: g.filter((x) => ["requested", "pending"].includes(x.status)),
      revoked: g.filter((x) => x.status === "revoked"),
      expired: g.filter((x) => x.status === "expired"),
      review: g.filter((x) => x.needs_review),
    },
    accounts: accounts ?? [],
    requests: requests ?? [],
  };
}

export async function setAccessStatus(bos: BosUser, grantId: string, status: AccessStatus, opts: { level?: string | null; expiresAt?: string | null; notes?: string | null } = {}) {
  const { data: grant } = await db().from("access_grants").select("*, external_apps(name, access_levels)").eq("id", grantId).maybeSingle();
  if (!grant) throw new NotFoundError();
  const app = grant.external_apps as unknown as { name: string; access_levels: string[] };
  if (grant.status !== status && !accessTransitions[grant.status].includes(status)) throw new ValidationError(`لا يمكن الانتقال من «${grant.status}» إلى «${status}».`);
  const level = opts.level === undefined ? grant.access_level : opts.level;
  if (level && app.access_levels.length && !app.access_levels.includes(level)) throw new ValidationError(`مستوى الوصول يجب أن يكون أحد: ${app.access_levels.join("، ")}.`, { level: "غير صالح" });
  if (opts.notes && looksLikeSecret(opts.notes)) throw new ValidationError("يبدو أن الملاحظات تحتوي كلمة مرور أو سراً. لا تحفظ كلمات المرور في النظام — استخدم مدير كلمات المرور.", { notes: "سر محتمل" });
  const now = nowIso();
  const patch: Partial<AccessGrant> = { status, access_level: level ?? null, needs_review: false };
  if (opts.expiresAt !== undefined) patch.expires_at = opts.expiresAt;
  if (opts.notes !== undefined) patch.notes = opts.notes;
  if (status === "active" || status === "provisioned") Object.assign(patch, { granted_by: bos.userId, granted_at: grant.granted_at ?? now, revoked_at: null, revoked_by: null });
  if (status === "revoked") Object.assign(patch, { revoked_by: bos.userId, revoked_at: now });
  await db().from("access_grants").update(patch).eq("id", grantId);
  await recordStatus("access_grant", grantId, grant.status, status, bos.userId);
  await audit({ actorId: bos.userId, action: `access.${status}`, entityType: "employee", entityId: grant.employee_id, oldValue: { app: app.name, status: grant.status, level: grant.access_level }, newValue: { app: app.name, status, level } });
  if (status === "active" || status === "revoked") {
    const { data: emp } = await db().from("employees").select("user_id, full_name").eq("id", grant.employee_id).single();
    await emitEvent({ type: status === "active" ? "access.granted" : "access.revoked", entityType: "employee", entityId: grant.employee_id, summary: `${app.name} access ${status === "active" ? "granted" : "revoked"}${level ? ` (${level})` : ""} — ${emp?.full_name ?? ""}`, actorId: bos.userId, payload: { employee_user_id: emp?.user_id, app: app.name, level } });
  }
  await refreshEmployeeOnboardingSafe(grant.employee_id, bos.userId);
}

export async function addGrant(bos: BosUser, employeeId: string, appId: string, level: string | null, required: boolean) {
  const { data: app } = await db().from("external_apps").select("*").eq("id", appId).maybeSingle();
  if (!app || !app.is_active) throw new ValidationError("التطبيق غير متاح.");
  if (level && app.access_levels.length && !app.access_levels.includes(level)) throw new ValidationError("مستوى وصول غير صالح.");
  const { error } = await db().from("access_grants").insert({ employee_id: employeeId, app_id: appId, access_level: level, is_required: required, status: "not_started", source: "manual", vault: app.password_vault });
  if (error) {
    if (error.code === "23505") throw new ValidationError("هذا التطبيق موجود بالفعل في ملف الصلاحيات.");
    throw error;
  }
  await audit({ actorId: bos.userId, action: "access.item_added", entityType: "employee", entityId: employeeId, newValue: { app: app.name, level, required } });
}

export async function requestAccess(bos: BosUser, input: { employeeId: string; appId: string; level: string | null; reason: string }) {
  if (!input.reason.trim()) throw new ValidationError("السبب مطلوب.", { reason: "مطلوب" });
  const [{ data: app }, { data: emp }] = await Promise.all([
    db().from("external_apps").select("*").eq("id", input.appId).maybeSingle(),
    db().from("employees").select("id, user_id, full_name, lifecycle_status").eq("id", input.employeeId).maybeSingle(),
  ]);
  if (!app || !app.is_active) throw new ValidationError("التطبيق غير متاح لطلبات جديدة.", { appId: "غير متاح" });
  if (!emp) throw new NotFoundError();
  if (["suspended", "offboarding", "archived"].includes(emp.lifecycle_status)) throw new ValidationError("لا يمكن طلب صلاحيات لموظف موقوف أو في إنهاء الخدمة.");
  if (input.level && app.access_levels.length && !app.access_levels.includes(input.level)) throw new ValidationError("مستوى وصول غير صالح.", { level: "غير صالح" });
  const { data: open } = await db().from("access_requests").select("id").eq("employee_id", emp.id).eq("app_id", app.id).eq("status", "pending").maybeSingle();
  if (open) throw new ValidationError("يوجد طلب وصول قيد المراجعة لنفس التطبيق.");

  const { data: request, error } = await db().from("access_requests").insert({ employee_id: emp.id, requested_by: bos.userId, app_id: app.id, access_level: input.level, reason: input.reason.trim() }).select("*").single();
  if (error) throw error;
  await db().from("access_grants").upsert({ employee_id: emp.id, app_id: app.id, access_level: input.level, status: "requested", source: "request", request_id: request.id, vault: app.password_vault }, { onConflict: "employee_id,app_id", ignoreDuplicates: false });
  const policies = await getSetting("approval_policies");
  const chain = app.is_sensitive ? (policies as { access_request_sensitive: { steps: string[] } }).access_request_sensitive.steps : (policies as { access_request: { steps: string[] } }).access_request.steps;
  // The requester is the employee (manager step resolves to their manager).
  await requestApproval({ type: "access_request", entityType: "access_request", entityId: request.id, title: `${emp.full_name} — ${app.name}${input.level ? ` (${input.level})` : ""}`, requestedBy: emp.user_id ?? bos.userId, steps: chain, links: [{ type: "employee", id: emp.id }], payload: { sensitive: app.is_sensitive } });
  await audit({ actorId: bos.userId, action: "access.requested", entityType: "employee", entityId: emp.id, newValue: { app: app.name, level: input.level, reason: input.reason } });
  await emitEvent({ type: "access.requested", entityType: "employee", entityId: emp.id, summary: `Access requested: ${app.name} for ${emp.full_name}`, actorId: bos.userId, payload: { request_id: request.id, employee_user_id: emp.user_id } });
  return request;
}

export async function getAccessMatrix(employeeIds: string[] | null, f: { filter?: string; department?: string }) {
  let eq = db().from("employees").select("id, full_name, position, mfa_status, department_id, lifecycle_status").is("archived_at", null).order("full_name");
  if (employeeIds) eq = eq.in("id", employeeIds.length ? employeeIds : ["00000000-0000-0000-0000-000000000000"]);
  if (f.department) eq = eq.eq("department_id", f.department);
  const [{ data: emps }, apps] = await Promise.all([eq, listApps(false)]);
  const ids = (emps ?? []).map((e) => e.id);
  const { data: grants } = ids.length ? await db().from("access_grants").select("id, employee_id, app_id, status, access_level, is_required, needs_review, expires_at").in("employee_id", ids) : { data: [] };
  let rows = (emps ?? []).map((e) => ({ employee: e, grants: new Map((grants ?? []).filter((g) => g.employee_id === e.id).map((g) => [g.app_id, g])) }));
  if (f.filter === "missing") rows = rows.filter((r) => [...r.grants.values()].some((g) => g.is_required && g.status !== "active"));
  if (f.filter === "pending") rows = rows.filter((r) => [...r.grants.values()].some((g) => ["requested", "pending"].includes(g.status)));
  if (f.filter === "revoked") rows = rows.filter((r) => [...r.grants.values()].some((g) => g.status === "revoked"));
  if (f.filter === "expired") rows = rows.filter((r) => [...r.grants.values()].some((g) => g.status === "expired"));
  if (f.filter === "review") rows = rows.filter((r) => [...r.grants.values()].some((g) => g.needs_review));
  if (f.filter === "mfa") rows = rows.filter((r) => r.employee.mfa_status !== "enabled");
  const usedApps = apps.filter((a) => (grants ?? []).some((g) => g.app_id === a.id));
  return { rows, apps: usedApps };
}

export async function listAccessRequests(employeeIds: string[] | null, status?: string) {
  let q = db().from("access_requests").select("*, external_apps(name, is_sensitive), employees(id, full_name)").order("created_at", { ascending: false }).limit(200);
  if (employeeIds) q = q.in("employee_id", employeeIds.length ? employeeIds : ["00000000-0000-0000-0000-000000000000"]);
  if (status) q = q.eq("status", status);
  const { data } = await q;
  return data ?? [];
}

// Expire grants past expires_at (sweep).
export async function expireGrants() {
  const { data } = await db().from("access_grants").update({ status: "expired" }).eq("status", "active").lt("expires_at", nowIso()).select("id, employee_id, app_id");
  for (const g of data ?? []) {
    await recordStatus("access_grant", g.id, "active", "expired", null, "expires_at passed");
    await emitEvent({ type: "access.expired", entityType: "employee", entityId: g.employee_id, summary: "Access expired", actorType: "system", payload: { grant_id: g.id, app_id: g.app_id } });
  }
  return (data ?? []).length;
}

// ---------------------------------------------------------------------------
// MFA (IT §10) — status only, never secrets.
// ---------------------------------------------------------------------------

export async function syncBosMfaStatus(employeeId: string) {
  const { data: emp } = await db().from("employees").select("id, user_id, mfa_status").eq("id", employeeId).single();
  if (!emp?.user_id) return emp?.mfa_status ?? "not_configured";
  const { data } = await db().auth.admin.mfa.listFactors({ userId: emp.user_id });
  const factors = (data?.factors ?? []) as { status: string }[];
  const { data: roles } = await db().from("user_roles").select("roles(key)").eq("user_id", emp.user_id);
  const security = await getSetting("security");
  const requiredKeys = (security as { require_2fa_role_keys?: string[] }).require_2fa_role_keys ?? [];
  const required = (roles ?? []).some((r) => requiredKeys.includes((r.roles as unknown as { key: string } | null)?.key ?? ""));
  const status: DbEnum<"mfa_status"> = factors.some((f) => f.status === "verified") ? "enabled" : factors.length ? "pending" : required ? "required" : emp.mfa_status === "recovery_required" ? "recovery_required" : "not_configured";
  if (status !== emp.mfa_status) {
    await db().from("employees").update({ mfa_status: status }).eq("id", employeeId);
    await audit({ actorId: null, actorType: "system", action: "employee.mfa_status_synced", entityType: "employee", entityId: employeeId, oldValue: { mfa_status: emp.mfa_status }, newValue: { mfa_status: status } });
    await refreshEmployeeOnboardingSafe(employeeId, null);
  }
  return status;
}

export async function setMfaStatus(bos: BosUser, employeeId: string, status: DbEnum<"mfa_status">) {
  const { data: emp } = await db().from("employees").select("mfa_status").eq("id", employeeId).single();
  await db().from("employees").update({ mfa_status: status }).eq("id", employeeId);
  await audit({ actorId: bos.userId, action: "employee.mfa_status_changed", entityType: "employee", entityId: employeeId, oldValue: { mfa_status: emp?.mfa_status }, newValue: { mfa_status: status } });
  await refreshEmployeeOnboardingSafe(employeeId, bos.userId);
}

export async function listMfaNonCompliant() {
  const { data } = await db().from("employees").select("id, full_name, email, mfa_status, lifecycle_status").is("archived_at", null).neq("mfa_status", "enabled").order("full_name");
  const { data: accounts } = await db().from("company_accounts").select("id, provider, identifier, mfa_status, employees(id, full_name)").neq("mfa_status", "enabled").in("status", ["active", "provisioned"]);
  return { employees: data ?? [], accounts: accounts ?? [] };
}

// ---------------------------------------------------------------------------
// Company-managed accounts (IT §3). No password field exists.
// ---------------------------------------------------------------------------

export interface CompanyAccountInput {
  employee_id: string;
  app_id: string | null;
  account_type: "email" | "sso" | "app" | "other";
  provider: string;
  identifier: string;
  status: AccessStatus;
  owner_user_id: string | null;
  recovery_owner_user_id: string | null;
  mfa_status: DbEnum<"mfa_status">;
  mfa_method: string | null;
  last_reviewed_at: string | null;
  notes: string | null;
}

export async function saveCompanyAccount(bos: BosUser, id: string | null, input: CompanyAccountInput) {
  if (looksLikeSecret(input.notes) || looksLikeSecret(input.identifier)) throw new ValidationError("لا تحفظ كلمات المرور أو الأسرار في النظام. استخدم مدير كلمات المرور المؤسسي.", { notes: "سر محتمل" });
  if (input.account_type === "email") {
    const company = await getSetting("company");
    const domain = (company as { email_domain?: string }).email_domain;
    if (domain && !input.identifier.toLowerCase().endsWith(`@${domain.toLowerCase()}`)) throw new ValidationError(`البريد الرسمي يجب أن يكون على نطاق @${domain}.`, { identifier: `@${domain}` });
  }
  const row = { ...input, identifier: input.identifier.trim(), mfa_verified_at: input.mfa_status === "enabled" ? nowIso() : null };
  let accountId = id;
  if (id) {
    const { data: before } = await db().from("company_accounts").select("*").eq("id", id).single();
    const { error } = await db().from("company_accounts").update(row).eq("id", id);
    if (error) {
      if (error.code === "23505") throw new ValidationError("المعرّف مستخدم لدى نفس المزوّد.", { identifier: "مكرر" });
      throw error;
    }
    await audit({ actorId: bos.userId, action: "company_account.updated", entityType: "employee", entityId: input.employee_id, oldValue: before, newValue: row });
  } else {
    const { data, error } = await db().from("company_accounts").insert({ ...row, created_by: bos.userId }).select("id").single();
    if (error) {
      if (error.code === "23505") throw new ValidationError("المعرّف مستخدم لدى نفس المزوّد.", { identifier: "مكرر" });
      throw error;
    }
    accountId = data.id;
    await audit({ actorId: bos.userId, action: "company_account.created", entityType: "employee", entityId: input.employee_id, newValue: row });
  }
  // Company email on the employee record follows the email account.
  if (input.account_type === "email" && input.status === "active") {
    await db().from("employees").update({ email: input.identifier.toLowerCase() }).eq("id", input.employee_id).is("email", null);
  }
  await refreshEmployeeOnboardingSafe(input.employee_id, bos.userId);
  return accountId as string;
}

export async function listCompanyAccounts(f: { employee?: string; mfa?: string; status?: string; q?: string }) {
  let q = db().from("company_accounts").select("*, employees(id, full_name), external_apps(name)").order("created_at", { ascending: false }).limit(500);
  if (f.employee) q = q.eq("employee_id", f.employee);
  if (f.mfa === "noncompliant") q = q.neq("mfa_status", "enabled");
  if (f.status) q = q.eq("status", f.status as AccessStatus);
  if (f.q) q = q.or(`identifier.ilike.%${f.q.replace(/[%_,()]/g, " ")}%,provider.ilike.%${f.q.replace(/[%_,()]/g, " ")}%`);
  const { data } = await q;
  return data ?? [];
}
