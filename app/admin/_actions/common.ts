"use server";
import { nowIso } from "@/lib/bos/clock";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/bos/db";
import { authorize, requireBosUserForAction, can } from "@/lib/bos/auth";
import { restrictedHrEntityTypes, assertCanAccess, canAccessEntity } from "@/lib/bos/access";
import { handleAction, parseForm, type ActionState } from "@/lib/bos/action";
import { emitEvent } from "@/lib/bos/events";
import { audit } from "@/lib/bos/audit";
import { ValidationError } from "@/lib/bos/errors";
import { decideApproval, resubmitApproval } from "@/services/bos/approvals";
import "@/services/bos/approval-handlers";
import { globalSearch, searchEntityOptions, type SearchableType } from "@/services/bos/search";
import type { EntityOption } from "@/components/bos/EntitySelector";

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

const commentSchema = z.object({
  entityType: z.string().min(1),
  entityId: z.string().uuid(),
  body: z.string().trim().min(1, "اكتب التعليق").max(20000),
  isInternal: z.preprocess((v) => v !== "false" && v !== "0" && v !== false, z.boolean()),
});

export async function addCommentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("addComment", async () => {
    const bos = await requireBosUserForAction();
    const input = parseForm(commentSchema, formData);
    await assertCanAccess(bos, input.entityType, input.entityId, "read");

    const { data, error } = await db()
      .from("comments")
      .insert({
        entity_type: input.entityType,
        entity_id: input.entityId,
        body: input.body,
        is_internal: input.isInternal,
        author_user_id: bos.userId,
      })
      .select("id")
      .single();
    if (error) throw error;

    // @mentions of staff by name notify them.
    const mentions = [...input.body.matchAll(/@([\p{L}\p{N}_.-]+(?:\s[\p{L}\p{N}_.-]+)?)/gu)].map((m) => m[1].toLowerCase());
    let mentioned: string[] = [];
    if (mentions.length) {
      const { data: staff } = await db().from("employees").select("user_id, full_name").not("user_id", "is", null);
      mentioned = (staff ?? []).filter((s) => mentions.some((m) => s.full_name.toLowerCase().startsWith(m))).map((s) => s.user_id!);
    }

    await emitEvent({
      type: "comment.added",
      entityType: input.entityType,
      entityId: input.entityId,
      summary: `${bos.employee.full_name} commented${input.isInternal ? "" : " (visible to client)"}`,
      payload: { comment_id: data.id, is_internal: input.isInternal },
      actorId: bos.userId,
      visibility: input.isInternal ? "internal" : "client",
    });
    for (const userId of mentioned) {
      await emitEvent({
        type: "chat.mentioned",
        entityType: input.entityType,
        entityId: input.entityId,
        summary: `${bos.employee.full_name} mentioned you in a comment`,
        payload: { assignee_user_id: userId, comment_id: data.id },
        actorId: bos.userId,
        dedupeKey: `mention:${data.id}:${userId}`,
      });
    }
    return { ok: true, message: "تمت إضافة التعليق" };
  });
}

export async function deleteCommentAction(commentId: string): Promise<ActionState> {
  return handleAction("deleteComment", async () => {
    const bos = await requireBosUserForAction();
    const { data: comment } = await db().from("comments").select("*").eq("id", commentId).maybeSingle();
    if (!comment) throw new ValidationError("التعليق غير موجود.");
    if (comment.author_user_id !== bos.userId && !bos.isSuperAdmin) throw new ValidationError("يمكنك حذف تعليقاتك فقط.");
    await db().from("comments").update({ deleted_at: nowIso() }).eq("id", commentId);
    await audit({ actorId: bos.userId, action: "comment.deleted", entityType: comment.entity_type, entityId: comment.entity_id, oldValue: { body: comment.body } });
    return { ok: true };
  });
}

// ---------------------------------------------------------------------------
// Files (private bucket, signed URLs — §75 secure file access)
// ---------------------------------------------------------------------------

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const BLOCKED_EXTENSIONS = ["exe", "bat", "cmd", "sh", "msi", "com", "scr", "ps1", "vbs", "jar"];

const uploadSchema = z.object({
  entityType: z.string().min(1),
  entityId: z.string().uuid(),
  name: z.string().trim().min(1).max(240),
  size: z.number().int().min(1).max(MAX_FILE_BYTES, "الحد الأقصى لحجم الملف 50MB"),
  mime: z.string().max(200).optional(),
  clientVisible: z.boolean().optional(),
  replaceFileId: z.string().uuid().optional(),
});

export async function createUploadAction(input: z.infer<typeof uploadSchema>): Promise<ActionState<{ fileId: string; path: string; token: string }>> {
  return handleAction("createUpload", async () => {
    const { bos } = await authorize("files.create");
    const data = parseForm(uploadSchema, input as unknown as Record<string, unknown>);
    const ext = data.name.split(".").pop()?.toLowerCase() ?? "";
    if (BLOCKED_EXTENSIONS.includes(ext)) throw new ValidationError("نوع الملف غير مسموح.");
    // HR records (documents, contracts, offers…) need update rights to attach files.
    await assertCanAccess(bos, data.entityType, data.entityId, restrictedHrEntityTypes.has(data.entityType) ? "update" : "read");

    let version = 1;
    let previousId: string | null = null;
    if (data.replaceFileId) {
      const { data: prev } = await db().from("files").select("id, version, entity_type, entity_id").eq("id", data.replaceFileId).maybeSingle();
      if (!prev || prev.entity_type !== data.entityType || prev.entity_id !== data.entityId) throw new ValidationError("الملف الأصلي غير موجود.");
      version = prev.version + 1;
      previousId = prev.id;
    }

    const safe = data.name.replace(/[^\p{L}\p{N}._-]+/gu, "_").slice(-120);
    const path = `${data.entityType}/${data.entityId}/${crypto.randomUUID()}-${safe}`;
    const { data: row, error } = await db()
      .from("files")
      .insert({
        storage_path: path,
        name: data.name,
        mime_type: data.mime ?? null,
        size_bytes: data.size,
        entity_type: data.entityType,
        entity_id: data.entityId,
        version,
        previous_version_id: previousId,
        client_visible: data.clientVisible ?? false,
        uploaded_by: bos.userId,
        is_finalized: false,
      })
      .select("id")
      .single();
    if (error) throw error;

    const { data: signed, error: signError } = await db().storage.from("bos-files").createSignedUploadUrl(path);
    if (signError || !signed) throw signError ?? new Error("Could not create upload URL");
    return { ok: true, data: { fileId: row.id, path, token: signed.token } };
  }, "تعذر بدء رفع الملف.");
}

export async function finalizeUploadAction(fileId: string): Promise<ActionState> {
  return handleAction("finalizeUpload", async () => {
    const bos = await requireBosUserForAction();
    const { data: file } = await db().from("files").select("*").eq("id", fileId).maybeSingle();
    if (!file || file.uploaded_by !== bos.userId) throw new ValidationError("الملف غير موجود.");
    const folder = file.storage_path.split("/").slice(0, -1).join("/");
    const name = file.storage_path.split("/").pop()!;
    const { data: objects } = await db().storage.from("bos-files").list(folder, { search: name });
    if (!objects?.some((o) => o.name === name)) throw new ValidationError("لم يكتمل رفع الملف. حاول مرة أخرى.");

    await db().from("files").update({ is_finalized: true }).eq("id", fileId);
    if (file.previous_version_id) {
      await db().from("files").update({ is_latest: false }).eq("id", file.previous_version_id);
    }
    await emitEvent({
      type: "file.uploaded",
      entityType: file.entity_type ?? "file",
      entityId: file.entity_id ?? file.id,
      summary: `${bos.employee.full_name} uploaded ${file.name}${file.version > 1 ? ` (v${file.version})` : ""}`,
      payload: { file_id: file.id, name: file.name, version: file.version, client_visible: file.client_visible },
      actorId: bos.userId,
      visibility: file.client_visible ? "client" : "internal",
    });
    return { ok: true, message: "تم رفع الملف" };
  });
}

async function loadFileForUpdate(fileId: string) {
  const bos = await requireBosUserForAction();
  const { data: file } = await db().from("files").select("*").eq("id", fileId).maybeSingle();
  if (!file || file.deleted_at) throw new ValidationError("الملف غير موجود.");
  if (file.entity_type && file.entity_id) {
    await assertCanAccess(bos, file.entity_type, file.entity_id, restrictedHrEntityTypes.has(file.entity_type) ? "update" : "read");
  }
  if (file.uploaded_by !== bos.userId && !can(bos, "files.update", "assigned")) {
    throw new ValidationError("ليس لديك صلاحية تعديل هذا الملف.");
  }
  return { bos, file };
}

export async function renameFileAction(fileId: string, name: string): Promise<ActionState> {
  return handleAction("renameFile", async () => {
    const { bos, file } = await loadFileForUpdate(fileId);
    const clean = name.trim();
    if (!clean || clean.length > 240) throw new ValidationError("اسم غير صالح.");
    await db().from("files").update({ name: clean }).eq("id", fileId);
    await audit({ actorId: bos.userId, action: "file.renamed", entityType: "file", entityId: fileId, oldValue: { name: file.name }, newValue: { name: clean } });
    return { ok: true };
  });
}

export async function moveFileAction(fileId: string, folder: string): Promise<ActionState> {
  return handleAction("moveFile", async () => {
    const { bos, file } = await loadFileForUpdate(fileId);
    const clean = `/${folder.trim().replace(/^\/+|\/+$/g, "")}`;
    await db().from("files").update({ folder: clean === "/" ? "/" : clean }).eq("id", fileId);
    await audit({ actorId: bos.userId, action: "file.moved", entityType: "file", entityId: fileId, oldValue: { folder: file.folder }, newValue: { folder: clean } });
    return { ok: true };
  });
}

export async function setFileClientVisibleAction(fileId: string, visible: boolean): Promise<ActionState> {
  return handleAction("fileVisibility", async () => {
    const { bos } = await loadFileForUpdate(fileId);
    await db().from("files").update({ client_visible: visible }).eq("id", fileId);
    await audit({ actorId: bos.userId, action: "file.visibility_changed", entityType: "file", entityId: fileId, newValue: { client_visible: visible } });
    return { ok: true };
  });
}

export async function deleteFileAction(fileId: string): Promise<ActionState> {
  return handleAction("deleteFile", async () => {
    const { bos, file } = await loadFileForUpdate(fileId);
    await db().from("files").update({ deleted_at: nowIso() }).eq("id", fileId);
    await audit({ actorId: bos.userId, action: "file.deleted", entityType: "file", entityId: fileId, oldValue: { name: file.name, entity_type: file.entity_type, entity_id: file.entity_id } });
    revalidatePath("/admin/files");
    return { ok: true, message: "تم حذف الملف" };
  });
}

export async function shareFileAction(fileId: string, userId: string): Promise<ActionState> {
  return handleAction("shareFile", async () => {
    const { bos } = await loadFileForUpdate(fileId);
    await db().from("file_shares").insert({ file_id: fileId, shared_with_user_id: userId, created_by: bos.userId });
    await emitEvent({ type: "file.shared", entityType: "file", entityId: fileId, summary: `${bos.employee.full_name} shared a file with you`, payload: { assignee_user_id: userId }, actorId: bos.userId });
    return { ok: true, message: "تمت المشاركة" };
  });
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export async function getNotificationsAction(): Promise<{ unread: number; items: { id: string; title: string; body: string | null; link: string | null; createdAt: string; read: boolean }[] }> {
  const bos = await requireBosUserForAction();
  const [{ count }, { data }] = await Promise.all([
    db().from("notifications").select("id", { count: "exact", head: true }).eq("user_id", bos.userId).is("read_at", null),
    db().from("notifications").select("id, title, body, link, created_at, read_at").eq("user_id", bos.userId).order("created_at", { ascending: false }).limit(12),
  ]);
  return {
    unread: count ?? 0,
    items: (data ?? []).map((n) => ({ id: n.id, title: n.title, body: n.body, link: n.link, createdAt: n.created_at, read: !!n.read_at })),
  };
}

export async function markNotificationsReadAction(ids: string[] | "all"): Promise<ActionState> {
  return handleAction("markRead", async () => {
    const bos = await requireBosUserForAction();
    let q = db().from("notifications").update({ read_at: nowIso() }).eq("user_id", bos.userId).is("read_at", null);
    if (ids !== "all") q = q.in("id", ids);
    await q;
    return { ok: true };
  });
}

export async function markNotificationUnreadAction(id: string): Promise<ActionState> {
  return handleAction("markUnread", async () => {
    const bos = await requireBosUserForAction();
    await db().from("notifications").update({ read_at: null }).eq("user_id", bos.userId).eq("id", id);
    return { ok: true };
  });
}

// ---------------------------------------------------------------------------
// Approvals
// ---------------------------------------------------------------------------

export async function decideApprovalAction(approvalId: string, decision: "approved" | "rejected" | "changes_requested", comment?: string): Promise<ActionState> {
  return handleAction("decideApproval", async () => {
    const { bos } = await authorize("approvals.read");
    if (!["approved", "rejected", "changes_requested"].includes(decision)) throw new ValidationError("قرار غير صالح.");
    await decideApproval(approvalId, decision, comment ?? null, { bos });
    revalidatePath("/admin", "layout");
    return { ok: true, message: decision === "approved" ? "تمت الموافقة" : decision === "rejected" ? "تم الرفض" : "تم طلب التعديلات من صاحب الطلب" };
  });
}

export async function resubmitApprovalAction(approvalId: string, note?: string): Promise<ActionState> {
  return handleAction("resubmitApproval", async () => {
    const bos = await requireBosUserForAction();
    await resubmitApproval(bos, approvalId, note ?? null);
    revalidatePath("/admin", "layout");
    return { ok: true, message: "تمت إعادة تقديم الطلب" };
  });
}

// ---------------------------------------------------------------------------
// Saved views
// ---------------------------------------------------------------------------

export async function saveViewAction(module: string, name: string, query: string): Promise<ActionState> {
  return handleAction("saveView", async () => {
    const bos = await requireBosUserForAction();
    const clean = name.trim().slice(0, 80);
    if (!clean) throw new ValidationError("اسم العرض مطلوب.");
    const { error } = await db()
      .from("saved_views")
      .upsert({ user_id: bos.userId, module, name: clean, filters: { query } }, { onConflict: "user_id,module,name" });
    if (error) throw error;
    return { ok: true };
  });
}

export async function deleteViewAction(id: string): Promise<ActionState> {
  return handleAction("deleteView", async () => {
    const bos = await requireBosUserForAction();
    await db().from("saved_views").delete().eq("id", id).eq("user_id", bos.userId);
    return { ok: true };
  });
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export async function globalSearchAction(q: string) {
  const bos = await requireBosUserForAction();
  if (q.trim().length < 2) return [];
  return globalSearch(bos, q.trim(), 4); // type-ahead: a few per type, full list on the search page
}

export async function searchEntitiesAction(type: SearchableType, q: string, filter?: Record<string, string>): Promise<EntityOption[]> {
  const bos = await requireBosUserForAction();
  return searchEntityOptions(bos, type, q.trim(), filter);
}

export async function canAccessEntityAction(entityType: string, entityId: string): Promise<boolean> {
  const bos = await requireBosUserForAction();
  return canAccessEntity(bos, entityType, entityId);
}

// ---------------------------------------------------------------------------
// Central files (docs/bos/16)
// ---------------------------------------------------------------------------

export async function restoreFileAction(fileId: string): Promise<ActionState> {
  return handleAction("restoreFile", async () => {
    const bos = await requireBosUserForAction();
    const { restoreFile } = await import("@/services/bos/files");
    await restoreFile(bos, fileId);
    revalidatePath("/admin/files");
    return { ok: true, message: "تمت الاستعادة" };
  });
}

export async function purgeFileAction(fileId: string): Promise<ActionState> {
  return handleAction("purgeFile", async () => {
    const bos = await requireBosUserForAction();
    const { purgeFile } = await import("@/services/bos/files");
    await purgeFile(bos, fileId);
    revalidatePath("/admin/files");
    return { ok: true, message: "تم الحذف النهائي" };
  });
}

export async function setTemplateAction(fileId: string, isTemplate: boolean): Promise<ActionState> {
  return handleAction("setTemplate", async () => {
    const bos = await requireBosUserForAction();
    const { setTemplate } = await import("@/services/bos/files");
    await setTemplate(bos, fileId, isTemplate);
    revalidatePath("/admin/files", "layout");
    return { ok: true, message: isTemplate ? "أُضيف للقوالب" : "أُزيل من القوالب" };
  });
}

export async function shareFileWithRoleAction(fileId: string, roleId: string): Promise<ActionState> {
  return handleAction("shareFileRole", async () => {
    const bos = await requireBosUserForAction();
    const { shareWithRole } = await import("@/services/bos/files");
    await shareWithRole(bos, fileId, roleId);
    return { ok: true, message: "تمت المشاركة مع الدور" };
  });
}
