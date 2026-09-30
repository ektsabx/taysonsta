import "server-only";
import { db } from "@/lib/bos/db";
import type { BosUser } from "@/lib/bos/auth";
import { canAccessEntity, restrictedHrEntityTypes } from "@/lib/bos/access";
import { audit } from "@/lib/bos/audit";
import { NotFoundError, ValidationError } from "@/lib/bos/errors";

// Central file views (docs/bos/16). Access to a file = access to its parent
// entity, own upload, or an explicit share.

export async function canReadFile(bos: BosUser, f: { id: string; entity_type: string | null; entity_id: string | null; uploaded_by: string | null; is_template: boolean }) {
  // HR files (documents, contracts, payslips, offers, candidates) follow the
  // HR record rules even for company-wide file readers.
  if (f.entity_type && restrictedHrEntityTypes.has(f.entity_type) && !bos.isSuperAdmin) {
    return f.uploaded_by === bos.userId || (!!f.entity_id && (await canAccessEntity(bos, f.entity_type, f.entity_id)));
  }
  if (bos.isSuperAdmin || bos.permissions.get("files.read") === "all" || f.uploaded_by === bos.userId) return true;
  if (f.is_template && bos.permissions.has("files.read")) return true;
  if (f.entity_type && f.entity_id && (await canAccessEntity(bos, f.entity_type, f.entity_id))) return true;
  const { data: roles } = await db().from("user_roles").select("role_id").eq("user_id", bos.userId);
  const { data: shares } = await db().from("file_shares").select("shared_with_user_id, shared_with_role_id").eq("file_id", f.id);
  return (shares ?? []).some((s) => s.shared_with_user_id === bos.userId || (s.shared_with_role_id && (roles ?? []).some((r) => r.role_id === s.shared_with_role_id)));
}

export async function listFiles(bos: BosUser, f: { q?: string; entity_type?: string; uploader?: string; kind?: string; from?: string; to?: string; deleted?: string; page?: number }) {
  const page = Math.max(1, f.page ?? 1);
  let q = db().from("files").select("id, name, mime_type, size_bytes, entity_type, entity_id, folder, version, uploaded_by, created_at, client_visible, is_template, deleted_at", { count: "exact" }).eq("is_latest", true).eq("is_finalized", true);
  q = f.deleted === "1" ? q.not("deleted_at", "is", null) : q.is("deleted_at", null);
  if (f.q) q = q.ilike("name", `%${f.q.replace(/[%_]/g, " ")}%`);
  if (f.entity_type) q = q.eq("entity_type", f.entity_type);
  if (f.uploader) q = q.eq("uploaded_by", f.uploader);
  if (f.kind === "image") q = q.like("mime_type", "image/%");
  if (f.kind === "pdf") q = q.eq("mime_type", "application/pdf");
  if (f.kind === "doc") q = q.or("mime_type.ilike.%word%,mime_type.ilike.%sheet%,mime_type.ilike.%presentation%,mime_type.ilike.text/%");
  if (f.from) q = q.gte("created_at", `${f.from}T00:00:00Z`);
  if (f.to) q = q.lte("created_at", `${f.to}T23:59:59Z`);
  const unrestricted = bos.isSuperAdmin || bos.permissions.get("files.read") === "all";
  if (unrestricted && !bos.isSuperAdmin) q = q.or(`entity_type.is.null,entity_type.not.in.(${[...restrictedHrEntityTypes].join(",")})`);
  if (unrestricted) {
    const { data, count } = await q.order("created_at", { ascending: false }).range((page - 1) * 50, page * 50 - 1);
    return { rows: data ?? [], total: count ?? 0, page, pageSize: 50 };
  }
  // Scoped users: filter per row (bounded scan).
  const { data } = await q.order("created_at", { ascending: false }).limit(1000);
  const out = [];
  for (const row of data ?? []) if (await canReadFile(bos, row)) out.push(row);
  return { rows: out.slice((page - 1) * 50, page * 50), total: out.length, page, pageSize: 50 };
}

export async function listSharedWithMe(bos: BosUser) {
  const { data: roles } = await db().from("user_roles").select("role_id").eq("user_id", bos.userId);
  const roleIds = (roles ?? []).map((r) => r.role_id);
  const { data } = await db().from("file_shares").select("id, permission, created_by, created_at, files!inner(id, name, mime_type, size_bytes, entity_type, entity_id, version, deleted_at)").or([`shared_with_user_id.eq.${bos.userId}`, ...(roleIds.length ? [`shared_with_role_id.in.(${roleIds.join(",")})`] : [])].join(",")).is("files.deleted_at", null).order("created_at", { ascending: false });
  return data ?? [];
}

export async function listTemplates() {
  const { data } = await db().from("files").select("id, name, mime_type, size_bytes, folder, version, uploaded_by, created_at").eq("is_template", true).eq("is_latest", true).is("deleted_at", null).order("folder").order("name");
  return data ?? [];
}

export async function restoreFile(bos: BosUser, fileId: string) {
  const { data: f } = await db().from("files").select("*").eq("id", fileId).maybeSingle();
  if (!f || !f.deleted_at) throw new NotFoundError();
  if (!(await canReadFile(bos, f)) || (f.uploaded_by !== bos.userId && !bos.permissions.get("files.delete"))) throw new ValidationError("ليس لديك صلاحية استعادة هذا الملف.");
  await db().from("files").update({ deleted_at: null }).eq("id", fileId);
  await audit({ actorId: bos.userId, action: "file.restored", entityType: "file", entityId: fileId });
}

// Hard delete (storage + row): Super Admin only, audited, blocked for
// contract / invoice / payment records (legal history).
export async function purgeFile(bos: BosUser, fileId: string) {
  if (!bos.isSuperAdmin) throw new ValidationError("الحذف النهائي للمدير العام فقط.");
  const { data: f } = await db().from("files").select("*").eq("id", fileId).maybeSingle();
  if (!f) throw new NotFoundError();
  if (!f.deleted_at) throw new ValidationError("احذف الملف (حذفاً مؤقتاً) أولاً.");
  if (["contract", "invoice", "payment"].includes(f.entity_type ?? "")) throw new ValidationError("ملفات العقود والفواتير والمدفوعات لا تُحذف نهائياً.");
  const { data: versions } = await db().from("files").select("id, storage_path").or(`id.eq.${fileId},previous_version_id.eq.${fileId}`);
  await db().storage.from("bos-files").remove((versions ?? []).map((v) => v.storage_path));
  await db().from("files").delete().in("id", (versions ?? []).map((v) => v.id));
  await audit({ actorId: bos.userId, action: "file.purged", entityType: "file", entityId: fileId, oldValue: { name: f.name, entity_type: f.entity_type, entity_id: f.entity_id, versions: versions?.length } });
}

export async function setTemplate(bos: BosUser, fileId: string, isTemplate: boolean) {
  if (!bos.permissions.get("files.manage") && !bos.isSuperAdmin) throw new ValidationError("إدارة القوالب تتطلب صلاحية files.manage.");
  await db().from("files").update({ is_template: isTemplate, folder: isTemplate ? "/templates" : "/" }).eq("id", fileId);
  await audit({ actorId: bos.userId, action: isTemplate ? "file.marked_template" : "file.unmarked_template", entityType: "file", entityId: fileId });
}

export async function shareWithRole(bos: BosUser, fileId: string, roleId: string) {
  const { data: f } = await db().from("files").select("*").eq("id", fileId).maybeSingle();
  if (!f || !(await canReadFile(bos, f))) throw new NotFoundError();
  await db().from("file_shares").insert({ file_id: fileId, shared_with_role_id: roleId, created_by: bos.userId });
  await audit({ actorId: bos.userId, action: "file.shared_role", entityType: "file", entityId: fileId, newValue: { role_id: roleId } });
}

export async function versionsOf(fileId: string) {
  const chain: { id: string; version: number; created_at: string; uploaded_by: string | null; is_latest: boolean }[] = [];
  let cursor: string | null = fileId;
  for (let i = 0; cursor && i < 50; i++) {
    const { data: row }: { data: { id: string; version: number; created_at: string; uploaded_by: string | null; is_latest: boolean; previous_version_id: string | null } | null } = await db().from("files").select("id, version, created_at, uploaded_by, is_latest, previous_version_id").eq("id", cursor).maybeSingle();
    if (!row) break;
    chain.push(row);
    cursor = row.previous_version_id;
  }
  return chain;
}
