import "server-only";
import type { BosUser } from "@/lib/bos/auth";
import { audit } from "@/lib/bos/audit";
import { NotFoundError, ValidationError } from "@/lib/bos/errors";
import { ydb } from "@/lib/yolias/db";
import { contentKinds, docGroups, helpCollections, legalSlugs, markdownToBlocks, type ContentKind, type Doc } from "@/lib/yolias/content";
import type { Json } from "@/types/database";

// Yolias website content from the Admin (final spec phase 9). The site shows
// published rows (Yolias/lib/content/store.ts). Every change is audited.

export async function listContent(kind: ContentKind) {
  const { data, error } = await ydb().from("content_entries").select("id, kind, slug, meta, doc, status, sort, updated_by, updated_at, published_at").eq("kind", kind).order("sort").order("slug");
  if (error) throw error;
  return (data ?? []).map((r) => ({ ...r, doc: r.doc as unknown as { en: Doc; ar: Doc } }));
}

export async function getContent(id: string) {
  const { data } = await ydb().from("content_entries").select("*").eq("id", id).maybeSingle();
  if (!data) throw new NotFoundError();
  return { ...data, doc: data.doc as unknown as { en: Doc; ar: Doc }, meta: (data.meta ?? {}) as Record<string, unknown> };
}

export interface ContentInput {
  id?: string | null;
  kind: string;
  slug: string;
  status: string;
  sort: number;
  meta: { collection?: string; group?: string; date?: string; categoryEn?: string; categoryAr?: string };
  en: { title: string; summary: string; body: string };
  ar: { title: string; summary: string; body: string };
}

export async function saveContent(bos: BosUser, input: ContentInput): Promise<string> {
  const kind = input.kind as ContentKind;
  if (!(contentKinds as readonly string[]).includes(kind)) throw new ValidationError("نوع غير معروف.");
  const slug = input.slug.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(slug)) throw new ValidationError("الرابط غير صالح.", { slug: "حروف إنجليزية صغيرة وأرقام وشرطات" });
  if (kind === "legal" && !(legalSlugs as readonly string[]).includes(slug)) throw new ValidationError("الصفحات القانونية ثابتة.", { slug: legalSlugs.join(", ") });
  if (!["draft", "published", "hidden"].includes(input.status)) throw new ValidationError("الحالة غير صالحة.");
  const meta: Record<string, unknown> = {};
  if (kind === "help") {
    if (!helpCollections.some((c) => c.id === input.meta.collection)) throw new ValidationError("اختر القسم.", { collection: "مطلوب" });
    meta.collection = input.meta.collection;
  }
  if (kind === "docs") {
    if (!docGroups.some((g) => g.id === input.meta.group)) throw new ValidationError("اختر المجموعة.", { group: "مطلوب" });
    meta.group = input.meta.group;
  }
  if (kind === "blog") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.meta.date ?? "")) throw new ValidationError("التاريخ غير صالح.", { date: "YYYY-MM-DD" });
    if (!input.meta.categoryEn?.trim() || !input.meta.categoryAr?.trim()) throw new ValidationError("التصنيف مطلوب باللغتين.", { category_en: "مطلوب", category_ar: "مطلوب" });
    meta.date = input.meta.date;
    meta.category = { en: input.meta.categoryEn.trim(), ar: input.meta.categoryAr.trim() };
  }
  const doc = Object.fromEntries((["en", "ar"] as const).map((l) => {
    const d = input[l];
    if (!d.title.trim()) throw new ValidationError("العنوان مطلوب باللغتين.", { [`title_${l}`]: "مطلوب" });
    const blocks = markdownToBlocks(d.body);
    if (!blocks.length) throw new ValidationError("المحتوى مطلوب باللغتين.", { [`body_${l}`]: "مطلوب" });
    return [l, { title: d.title.trim().slice(0, 200), summary: d.summary.trim().slice(0, 400), blocks }];
  }));
  const row = {
    kind, slug, meta: meta as Json, doc: doc as unknown as Json, status: input.status as "draft" | "published" | "hidden",
    sort: Number.isInteger(input.sort) ? input.sort : 0, updated_by: bos.email,
    ...(input.status === "published" ? { published_at: new Date().toISOString() } : {}),
  };
  const q = input.id ? ydb().from("content_entries").update(row).eq("id", input.id).select("id").maybeSingle() : ydb().from("content_entries").insert(row).select("id").single();
  const { data, error } = await q;
  if (error?.code === "23505") throw new ValidationError("يوجد محتوى بنفس الرابط.", { slug: "مستخدم" });
  if (error) throw error;
  if (!data) throw new NotFoundError();
  await audit({ actorId: bos.userId, action: input.id ? "yolias.content.update" : "yolias.content.create", entityType: "yolias_content", entityId: null, newValue: { kind, slug, status: input.status }, metadata: { content: data.id } });
  return data.id;
}

export async function deleteContent(bos: BosUser, id: string): Promise<void> {
  const before = await getContent(id);
  const { error } = await ydb().from("content_entries").delete().eq("id", id);
  if (error) throw error;
  await audit({ actorId: bos.userId, action: "yolias.content.delete", entityType: "yolias_content", entityId: null, oldValue: { kind: before.kind, slug: before.slug } });
}
