import "server-only";
import { nowIso } from "@/lib/bos/clock";
import { db } from "@/lib/bos/db";
import type { BosUser } from "@/lib/bos/auth";
import { audit } from "@/lib/bos/audit";
import { NotFoundError, ValidationError } from "@/lib/bos/errors";

// Branches (docs/bos/30 §3.2). One head office always exists; branches in
// use are deactivated, never deleted, so history keeps its branch.

export interface BranchInput {
  code: string;
  name: string;
  name_en: string | null;
  status: "active" | "inactive";
  address: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  postal_code: string | null;
  timezone: string;
  currency: string | null;
  phone: string | null;
  email: string | null;
  manager_employee_id: string | null;
  work_schedule_id: string | null;
  notes: string | null;
}

function validTimezone(tz: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export async function saveBranch(bos: BosUser, id: string | null, input: BranchInput) {
  if (!validTimezone(input.timezone)) throw new ValidationError("المنطقة الزمنية غير صالحة.", { timezone: "غير صالحة" });
  const code = input.code.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{1,20}$/.test(code)) throw new ValidationError("الكود حروف إنجليزية كبيرة وأرقام فقط.", { code: "غير صالح" });
  const row = { ...input, code };
  if (id) {
    const { data: before } = await db().from("branches").select("*").eq("id", id).maybeSingle();
    if (!before) throw new NotFoundError();
    if (before.is_head_office && input.status === "inactive") throw new ValidationError("لا يمكن تعطيل المقر الرئيسي.");
    const { error } = await db().from("branches").update(row).eq("id", id);
    if (error) throw error.code === "23505" ? new ValidationError("الكود مستخدم لفرع آخر.", { code: "مكرر" }) : error;
    await audit({ actorId: bos.userId, action: "branch.updated", entityType: "branch", entityId: id, oldValue: before, newValue: row });
    return id;
  }
  const { data, error } = await db().from("branches").insert(row).select("id").single();
  if (error) throw error.code === "23505" ? new ValidationError("الكود مستخدم لفرع آخر.", { code: "مكرر" }) : error;
  await audit({ actorId: bos.userId, action: "branch.created", entityType: "branch", entityId: data.id, newValue: row });
  return data.id;
}

export async function setHeadOffice(bos: BosUser, id: string) {
  const { data } = await db().from("branches").select("id, status").eq("id", id).maybeSingle();
  if (!data) throw new NotFoundError();
  if (data.status !== "active") throw new ValidationError("فعّل الفرع أولاً.");
  await db().from("branches").update({ is_head_office: false }).eq("is_head_office", true);
  await db().from("branches").update({ is_head_office: true }).eq("id", id);
  await audit({ actorId: bos.userId, action: "branch.head_office_changed", entityType: "branch", entityId: id });
}

export async function removeBranch(bos: BosUser, id: string) {
  const { data: b } = await db().from("branches").select("*").eq("id", id).maybeSingle();
  if (!b) throw new NotFoundError();
  if (b.is_head_office) throw new ValidationError("لا يمكن حذف المقر الرئيسي.");
  const tables = ["employees", "clients", "leads", "deals", "projects", "invoices", "payments", "expenses", "tickets", "devices", "career_jobs"] as const;
  let used = 0;
  for (const t of tables) used += (await db().from(t).select("id", { count: "exact", head: true }).eq("branch_id", id)).count ?? 0;
  if (used > 0) {
    await db().from("branches").update({ status: "inactive" }).eq("id", id);
    await audit({ actorId: bos.userId, action: "branch.deactivated", entityType: "branch", entityId: id, reason: `In use by ${used} records` });
    return "deactivated" as const;
  }
  await db().from("branches").delete().eq("id", id);
  await audit({ actorId: bos.userId, action: "branch.deleted", entityType: "branch", entityId: id, oldValue: b });
  return "deleted" as const;
}

export async function listBranchGrants() {
  const { data } = await db().from("user_branch_access").select("user_id, branch_id, created_at").order("created_at", { ascending: false });
  return data ?? [];
}

export async function grantBranchAccess(bos: BosUser, userId: string, branchId: string, grant: boolean) {
  if (grant) {
    const { error } = await db().from("user_branch_access").upsert({ user_id: userId, branch_id: branchId, granted_by: bos.userId }, { onConflict: "user_id,branch_id" });
    if (error) throw error;
  } else {
    await db().from("user_branch_access").delete().eq("user_id", userId).eq("branch_id", branchId);
  }
  await audit({ actorId: bos.userId, action: grant ? "branch.access_granted" : "branch.access_revoked", entityType: "branch", entityId: branchId, newValue: { user_id: userId, at: nowIso() } });
}

// Moving a person to another branch (their records keep their own branch).
export async function setEmployeeBranch(bos: BosUser, employeeId: string, branchId: string) {
  const { data: b } = await db().from("branches").select("id, status").eq("id", branchId).maybeSingle();
  if (!b || b.status !== "active") throw new ValidationError("الفرع غير متاح.", { branch_id: "غير متاح" });
  const { data: emp } = await db().from("employees").select("branch_id").eq("id", employeeId).maybeSingle();
  if (!emp) throw new NotFoundError();
  await db().from("employees").update({ branch_id: branchId }).eq("id", employeeId);
  await audit({ actorId: bos.userId, action: "employee.branch_changed", entityType: "employee", entityId: employeeId, oldValue: { branch_id: emp.branch_id }, newValue: { branch_id: branchId } });
}

// Company brand assets (logo, icon) — not secret, served to staff, portal
// and documents through /api/bos/company-asset.
const BRAND_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/svg+xml": "svg" };

export async function createBrandUpload(kind: "logo" | "icon", mime: string, size: number) {
  const ext = BRAND_TYPES[mime];
  if (!ext) throw new ValidationError("الصيغ المسموحة: PNG, JPG, WEBP, SVG.");
  if (size <= 0 || size > 2 * 1024 * 1024) throw new ValidationError("الحد الأقصى 2MB.");
  const path = `company/${kind}-${crypto.randomUUID()}.${ext}`;
  const { data, error } = await db().storage.from("bos-files").createSignedUploadUrl(path);
  if (error || !data) throw error ?? new Error("Could not create upload URL");
  return { path, token: data.token };
}
