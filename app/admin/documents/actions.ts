"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { authorize, requireBosUserForAction } from "@/lib/bos/auth";
import { handleAction, parseForm, zf, type ActionState } from "@/lib/bos/action";
import { ValidationError } from "@/lib/bos/errors";
import { addVersion, createTemplate, duplicateTemplate, emailDocument, generateDocument, previewDocument, restoreVersion, setDocumentStatus, updateTemplateMeta, type DocType } from "@/services/bos/documents";

// Documents & templates actions (docs/bos/30 §8).

const uuid = /^[0-9a-f-]{36}$/i;
const entityTypes = ["invoice", "contract", "deal", "job_offer", "employee", "client", "project"] as const;

const versionSchema = z.object({
  subject: zf.optionalText(500),
  body: z.string().max(100_000),
  primary: z.string().regex(/^#[0-9a-fA-F]{6}$/, "لون غير صالح (#RRGGBB)").default("#e51f26"),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/, "لون غير صالح (#RRGGBB)").default("#111827"),
  font_size: zf.int(8, 16).default(11),
  show_logo: zf.checkbox(),
  header_note: zf.optionalText(300),
  footer_note: zf.optionalText(300),
  change_note: zf.optionalText(300),
});

function versionInput(v: z.infer<typeof versionSchema>) {
  return { subject: v.subject ?? null, body: v.body, style: { primary: v.primary, accent: v.accent, fontSize: v.font_size, showLogo: v.show_logo }, header_note: v.header_note ?? null, footer_note: v.footer_note ?? null, change_note: v.change_note ?? null };
}

export async function saveTemplateVersionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("saveTemplateVersion", async () => {
    const { bos } = await authorize("documents.manage", "all");
    const id = String(formData.get("template_id") ?? "");
    if (!uuid.test(id)) throw new ValidationError("قيمة غير صالحة.");
    await addVersion(bos, id, versionInput(parseForm(versionSchema, formData)));
    revalidatePath(`/admin/documents/templates/${id}`);
    return { ok: true, message: "تم حفظ إصدار جديد من القالب" };
  });
}

const createSchema = versionSchema.extend({
  key: z.string().trim().regex(/^[a-z0-9_]{3,60}$/, "المفتاح حروف إنجليزية صغيرة وأرقام و _ فقط"),
  name: zf.required("الاسم", 150),
  doc_type: z.enum(["proposal", "client_contract", "invoice", "email", "job_offer", "employment_contract", "nda_ip", "maintenance_agreement", "license_certificate", "handover_certificate", "hr_document", "report"]),
  language: z.enum(["ar", "en"]),
  module: zf.text(40).default("general"),
  description: zf.optionalText(500),
});

export async function createTemplateAction(_prev: ActionState, formData: FormData): Promise<ActionState<{ id: string }>> {
  return handleAction("createTemplate", async () => {
    const { bos } = await authorize("documents.manage", "all");
    const v = parseForm(createSchema, formData);
    const id = await createTemplate(bos, { key: v.key, name: v.name, doc_type: v.doc_type as DocType, language: v.language, module: v.module || "general", description: v.description ?? null, edit_role_keys: [] }, versionInput(v));
    revalidatePath("/admin/documents");
    return { ok: true, data: { id }, message: "تم إنشاء القالب" };
  });
}

export async function templateMetaAction(id: string, patch: { name?: string; is_active?: boolean; edit_role_keys?: string[] }): Promise<ActionState> {
  return handleAction("templateMeta", async () => {
    const { bos } = await authorize("documents.manage", "all");
    if (!uuid.test(id)) throw new ValidationError("قيمة غير صالحة.");
    await updateTemplateMeta(bos, id, patch);
    revalidatePath(`/admin/documents/templates/${id}`);
    revalidatePath("/admin/documents");
    return { ok: true, message: "تم الحفظ" };
  });
}

export async function restoreVersionAction(templateId: string, versionId: string): Promise<ActionState> {
  return handleAction("restoreVersion", async () => {
    const { bos } = await authorize("documents.manage", "all");
    if (!uuid.test(templateId) || !uuid.test(versionId)) throw new ValidationError("قيمة غير صالحة.");
    await restoreVersion(bos, templateId, versionId);
    revalidatePath(`/admin/documents/templates/${templateId}`);
    return { ok: true, message: "تمت الاستعادة كإصدار جديد" };
  });
}

export async function duplicateTemplateAction(id: string, key: string, name: string, language: "ar" | "en"): Promise<ActionState<{ id: string }>> {
  return handleAction("duplicateTemplate", async () => {
    const { bos } = await authorize("documents.manage", "all");
    if (!uuid.test(id)) throw new ValidationError("قيمة غير صالحة.");
    const newId = await duplicateTemplate(bos, id, key.trim(), name.trim(), language);
    revalidatePath("/admin/documents");
    return { ok: true, data: { id: newId }, message: "تم النسخ" };
  });
}

// Live preview (nothing stored). Body/style may be the unsaved editor draft.
export async function previewAction(templateId: string, entityType: string, entityId: string, draft?: { subject: string | null; body: string; primary: string; accent: string; font_size: number; show_logo: boolean; header_note: string | null; footer_note: string | null }): Promise<ActionState<{ html: string; subject: string | null }>> {
  return handleAction("previewDocument", async () => {
    const bos = await requireBosUserForAction();
    if (!uuid.test(templateId) || !uuid.test(entityId) || !(entityTypes as readonly string[]).includes(entityType)) throw new ValidationError("اختر سجلاً صالحاً للمعاينة.");
    const out = await previewDocument(bos, templateId, entityType, entityId, draft ? { subject: draft.subject, body: draft.body, style: { primary: draft.primary, accent: draft.accent, fontSize: draft.font_size, showLogo: draft.show_logo }, header_note: draft.header_note, footer_note: draft.footer_note, change_note: null } : undefined);
    return { ok: true, data: { html: out.html, subject: out.subject } };
  });
}

export async function generateDocumentAction(templateId: string, entityType: string, entityId: string): Promise<ActionState<{ id: string; number: string }>> {
  return handleAction("generateDocument", async () => {
    const { bos } = await authorize("documents.create");
    if (!uuid.test(templateId) || !uuid.test(entityId) || !(entityTypes as readonly string[]).includes(entityType)) throw new ValidationError("قيمة غير صالحة.");
    const doc = await generateDocument(bos, templateId, entityType, entityId);
    revalidatePath("/admin/documents");
    return { ok: true, data: doc, message: "تم إصدار المستند وتجميد نسخته" };
  });
}

export async function documentStatusAction(id: string, status: "signed" | "void", reason?: string): Promise<ActionState> {
  return handleAction("documentStatus", async () => {
    const { bos } = await authorize("documents.create");
    if (!uuid.test(id)) throw new ValidationError("قيمة غير صالحة.");
    await setDocumentStatus(bos, id, status, { void_reason: reason });
    revalidatePath(`/admin/documents/${id}`);
    return { ok: true, message: status === "void" ? "تم إلغاء المستند" : "تم تسجيل التوقيع" };
  });
}

export async function emailDocumentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("emailDocument", async () => {
    const { bos } = await authorize("documents.create");
    const id = String(formData.get("id") ?? "");
    if (!uuid.test(id)) throw new ValidationError("قيمة غير صالحة.");
    await emailDocument(bos, id, String(formData.get("to") ?? "").split(/[,\s;]+/));
    revalidatePath(`/admin/documents/${id}`);
    return { ok: true, message: "تم إرسال المستند بالبريد" };
  });
}
