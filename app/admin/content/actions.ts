"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authorize } from "@/lib/bos/auth";
import { handleAction, parseForm, zf, type ActionState } from "@/lib/bos/action";
import { ValidationError } from "@/lib/bos/errors";
import {
  acceptDraft, addTask, contentTypes, createItem, deleteTask, discardDraft, generateDraft, moveStage, removeStage, reviewItem,
  saveStages, setTaskDone, updateItem, aiKinds, type AcceptField, type AiKind, type ItemInput,
} from "@/services/bos/content";

// Content Studio actions (docs/bos/30 §13).
const uuid = /^[0-9a-f-]{36}$/i;
const refresh = (id?: string) => {
  revalidatePath("/admin/content", "layout");
  if (id) revalidatePath(`/admin/content/${id}`);
};
const list = (v: string | null | undefined, sep = /[,،\n]+/) => (v ?? "").split(sep).map((s) => s.trim()).filter(Boolean);

const itemSchema = z.object({
  id: zf.optionalUuid(),
  title: zf.required("العنوان", 200),
  description: zf.optionalText(5000), goal: zf.optionalText(500), audience: zf.optionalText(500),
  platforms: z.array(z.string().max(30)).optional(),
  content_type: z.enum(contentTypes),
  hook: zf.optionalText(1000), key_message: zf.optionalText(2000), cta: zf.optionalText(500), topic: zf.optionalText(120), tags: zf.optionalText(1000),
  priority: z.enum(["low", "normal", "high", "urgent"]),
  owner_id: zf.optionalUuid(), deadline: zf.optionalDate(), publish_date: zf.optionalDateTime(),
  script: zf.optionalText(100000), final_version: zf.optionalText(100000),
  video_length_sec: z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().int().min(1).max(36000).nullable()),
  notes: zf.optionalText(10000), published_links: zf.optionalText(5000),
});

function toInput(v: z.infer<typeof itemSchema>): ItemInput {
  return {
    title: v.title, description: v.description ?? null, goal: v.goal ?? null, audience: v.audience ?? null, platforms: v.platforms ?? [], content_type: v.content_type,
    hook: v.hook ?? null, key_message: v.key_message ?? null, cta: v.cta ?? null, topic: v.topic ?? null, tags: list(v.tags, /[\s,،#]+/), priority: v.priority,
    owner_id: v.owner_id, deadline: v.deadline, publish_date: v.publish_date ? new Date(v.publish_date).toISOString() : null, script: v.script ?? null, final_version: v.final_version ?? null,
    video_length_sec: v.video_length_sec, notes: v.notes ?? null, published_links: list(v.published_links, /\s+/),
  };
}

export async function saveItemAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let newId: string | null = null;
  const res = await handleAction("saveContentItem", async () => {
    const { bos } = await authorize("content.create");
    const v = parseForm(itemSchema, formData);
    if (v.id) {
      const r = await updateItem(bos, v.id, toInput(v));
      refresh(v.id);
      return { ok: true, message: r.reset ? "تم الحفظ — عاد المحتوى للمراجعة لأن النص تغيّر بعد الاعتماد" : "تم الحفظ" };
    }
    newId = (await createItem(bos, toInput(v))).id;
    refresh();
    return { ok: true, message: "تم الإنشاء" };
  });
  if (newId) redirect(`/admin/content/${newId}`);
  return res;
}

export async function stageAction(id: string, op: "move" | "approve" | "changes", arg: string | null): Promise<ActionState> {
  return handleAction(`content.${op}`, async () => {
    const { bos } = await authorize("content.read");
    if (!uuid.test(id)) throw new ValidationError("قيمة غير صالحة.");
    if (op === "move") await moveStage(bos, id, arg ?? "");
    else await reviewItem(bos, id, op === "approve" ? "approve" : "changes", arg);
    refresh(id);
    return { ok: true, message: "تم" };
  });
}

export async function taskAction(op: "add" | "done" | "undo" | "delete", id: string, data?: { title: string; assignee_id: string | null; due_date: string | null }): Promise<ActionState> {
  return handleAction(`contentTask.${op}`, async () => {
    const { bos } = await authorize("content.read");
    if (!uuid.test(id)) throw new ValidationError("قيمة غير صالحة.");
    if (op === "add") await addTask(bos, id, data ?? { title: "", assignee_id: null, due_date: null });
    else if (op === "delete") await deleteTask(bos, id);
    else await setTaskDone(bos, id, op === "done");
    refresh();
    return { ok: true, message: "تم" };
  });
}

export async function generateAction(itemId: string | null, kind: string, instructions: string, language: "ar" | "en"): Promise<{ ok: true; id: string; output: string } | { ok: false; error: string }> {
  try {
    const { bos } = await authorize("content.create");
    if (itemId && !uuid.test(itemId)) throw new ValidationError("قيمة غير صالحة.");
    if (!aiKinds.includes(kind as AiKind)) throw new ValidationError("نوع غير صالح.");
    const d = await generateDraft(bos, { itemId, kind: kind as AiKind, instructions: instructions || null, language });
    if (itemId) refresh(itemId);
    return { ok: true, id: d.id, output: d.output };
  } catch (e) {
    return { ok: false, error: e instanceof ValidationError ? e.message : "تعذر التوليد." };
  }
}

export async function draftAction(id: string, op: "accept" | "discard", field?: AcceptField, text?: string): Promise<ActionState> {
  return handleAction(`contentDraft.${op}`, async () => {
    const { bos } = await authorize("content.update");
    if (!uuid.test(id)) throw new ValidationError("قيمة غير صالحة.");
    if (op === "discard") {
      await discardDraft(bos, id);
      refresh();
      return { ok: true, message: "تم" };
    }
    const r = await acceptDraft(bos, id, field ?? "notes", text ?? null);
    refresh();
    return { ok: true, message: r.reset ? "تم النسخ — عاد المحتوى للمراجعة" : "تم النسخ إلى المحتوى" };
  });
}

export async function saveStagesAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("saveContentStages", async () => {
    const { bos } = await authorize("content.manage");
    const keys = formData.getAll("key[]").map(String);
    const rows = keys.map((key, i) => ({ key, name: String(formData.get(`name_${key}`) ?? ""), sort_order: (i + 1) * 10, is_active: formData.get(`active_${key}`) === "on", requires_approval: formData.get(`gate_${key}`) === "on" }));
    const addKey = String(formData.get("new_key") ?? "").trim();
    await saveStages(bos, rows, addKey ? { key: addKey, name: String(formData.get("new_name") ?? ""), after: String(formData.get("new_after") ?? "") } : null);
    refresh();
    return { ok: true, message: "تم حفظ المراحل" };
  });
}

export async function removeStageAction(key: string): Promise<ActionState> {
  return handleAction("removeContentStage", async () => {
    const { bos } = await authorize("content.manage");
    await removeStage(bos, key);
    refresh();
    return { ok: true, message: "تم الحذف" };
  });
}
