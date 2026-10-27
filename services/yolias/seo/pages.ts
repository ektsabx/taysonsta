import "server-only";
import { createHmac } from "node:crypto";
import type { BosUser } from "@/lib/bos/auth";
import { audit } from "@/lib/bos/audit";
import { NotFoundError, ValidationError } from "@/lib/bos/errors";
import { ydb } from "@/lib/yolias/db";
import { markdownToBlocks, type Doc } from "@/lib/yolias/content";
import { codeSolutionSlugs, normKeyword, seoKinds, seoPath, type SeoFields, type SeoKind, type SeoMeta, type SeoStatus } from "@/lib/yolias/seo-pages";
import type { Json } from "@/types/database";

// SEO pages (D-257): comparisons, alternatives, audience solutions and
// templates in Yolias content_entries. Every save keeps a revision, every
// change is audited, two live pages never share a main keyword, and a page
// that changes address leaves a redirect behind.

const columns = "id, kind, slug, meta, doc, seo, status, sort, primary_keyword, secondary_keywords, scheduled_at, updated_by, updated_at, published_at, created_at";

export type SeoRow = {
  id: string; kind: SeoKind; slug: string; meta: SeoMeta; doc: { en: Doc; ar: Doc }; seo: SeoFields; status: SeoStatus; sort: number;
  primary_keyword: string | null; secondary_keywords: string[]; scheduled_at: string | null; updated_by: string | null; updated_at: string; published_at: string | null; created_at: string;
};

const asRow = (r: Record<string, unknown>) => r as unknown as SeoRow;

export async function listSeoPages(): Promise<SeoRow[]> {
  const { data, error } = await ydb().from("content_entries").select(columns).in("kind", [...seoKinds]).order("kind").order("sort").order("slug");
  if (error) throw error;
  return (data ?? []).map(asRow);
}

export async function getSeoPage(id: string): Promise<SeoRow> {
  const { data } = await ydb().from("content_entries").select(columns).eq("id", id).in("kind", [...seoKinds]).maybeSingle();
  if (!data) throw new NotFoundError();
  return asRow(data);
}

export interface SeoPageInput {
  id: string | null;
  kind: string;
  slug: string;
  status: string;
  scheduledAt: string | null;
  sort: number;
  primaryKeyword: string;
  secondaryKeywords: string[];
  meta: SeoMeta;
  seo: SeoFields;
  en: { title: string; summary: string; body: string };
  ar: { title: string; summary: string; body: string };
  /** Saving over a keyword another page already targets, on purpose. */
  allowSharedKeyword?: boolean;
}

/** Other pages (Admin pages and the keyword plan) that target the same main keyword. */
export async function keywordConflicts(keyword: string, exceptId: string | null, path: string): Promise<string[]> {
  const k = normKeyword(keyword);
  if (!k) return [];
  const [pages, plan] = await Promise.all([
    ydb().from("content_entries").select("id, kind, slug, primary_keyword, status").not("primary_keyword", "is", null).neq("status", "hidden"),
    ydb().from("seo_keywords").select("keyword, target_path").not("target_path", "is", null).neq("stage", "dropped"),
  ]);
  const out = new Set<string>();
  for (const p of pages.data ?? []) if (p.id !== exceptId && normKeyword(p.primary_keyword ?? "") === k && seoKinds.includes(p.kind as SeoKind)) out.add(seoPath(p.kind as SeoKind, p.slug));
  for (const p of plan.data ?? []) if (normKeyword(p.keyword) === k && p.target_path && p.target_path !== path) out.add(p.target_path);
  return [...out];
}

export async function saveSeoPage(bos: BosUser, input: SeoPageInput): Promise<string> {
  const kind = input.kind as SeoKind;
  if (!seoKinds.includes(kind)) throw new ValidationError("نوع غير معروف.");
  const slug = input.slug.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(slug)) throw new ValidationError("الرابط غير صالح.", { slug: "حروف إنجليزية صغيرة وأرقام وشرطات" });
  if (kind === "solution" && (codeSolutionSlugs as readonly string[]).includes(slug)) throw new ValidationError("هذا الرابط لصفحة حلول موجودة في الكود.", { slug: "اختر رابطًا آخر" });
  if (!["draft", "scheduled", "published", "hidden"].includes(input.status)) throw new ValidationError("الحالة غير صالحة.");
  const status = input.status as SeoStatus;
  let scheduledAt: string | null = null;
  if (status === "scheduled") {
    const t = input.scheduledAt ? Date.parse(input.scheduledAt) : NaN;
    if (!Number.isFinite(t) || t < Date.now() - 60_000) throw new ValidationError("حدّد موعد نشر في المستقبل.", { scheduled_at: "مطلوب" });
    scheduledAt = new Date(t).toISOString();
  }
  const keyword = input.primaryKeyword.trim();
  if (status !== "hidden" && keyword.length < 2) throw new ValidationError("الكلمة الرئيسية مطلوبة: كل صفحة تستهدف نية بحث واحدة.", { primary_keyword: "مطلوب" });
  const path = seoPath(kind, slug);
  if (keyword && !input.allowSharedKeyword) {
    const clash = await keywordConflicts(keyword, input.id, path);
    if (clash.length) throw new ValidationError(`صفحة أخرى تستهدف نفس الكلمة: ${clash.join("، ")}. غيّر الكلمة أو ادمج الصفحتين، أو فعّل «السماح بنفس الكلمة» مع سبب.`, { primary_keyword: "مستخدمة" });
  }
  if ((kind === "compare" && input.meta.format !== "list") && !input.meta.competitor) throw new ValidationError("اختر المنافس الذي تقارن به.", { competitor: "مطلوب" });
  if (kind === "alternatives" && !input.meta.competitor) throw new ValidationError("اختر المنتج الذي تعرض بدائله.", { competitor: "مطلوب" });
  if (kind === "template" && status !== "draft" && (!input.meta.prompt.en.trim() || !input.meta.prompt.ar.trim())) throw new ValidationError("القالب يحتاج الطلب الذي يفتح به Yolias AI باللغتين.", { prompt_en: "مطلوب", prompt_ar: "مطلوب" });
  const canonical = input.seo.canonical?.trim() || "";
  if (canonical && !/^\/(?!\/)[A-Za-z0-9\-._~/%]*$/.test(canonical)) throw new ValidationError("الرابط الأساسي (canonical) يكون مسارًا داخل الموقع مثل /compare/apollo.", { canonical: "/…" });

  const doc = Object.fromEntries((["en", "ar"] as const).map((l) => {
    const d = input[l];
    if (!d.title.trim()) throw new ValidationError("اسم الصفحة مطلوب باللغتين.", { [`title_${l}`]: "مطلوب" });
    return [l, { title: d.title.trim().slice(0, 200), summary: d.summary.trim().slice(0, 600), blocks: markdownToBlocks(d.body) }];
  })) as { en: Doc; ar: Doc };
  for (const l of ["en", "ar"] as const) {
    if (status !== "draft" && status !== "hidden" && !input.seo.meta_description[l].trim() && !doc[l].summary) throw new ValidationError("الوصف (meta description) مطلوب قبل النشر.", { [`meta_description_${l}`]: "مطلوب" });
  }
  const seo: SeoFields = { ...input.seo, canonical: canonical || undefined };

  const before = input.id ? await getSeoPage(input.id) : null;
  const now = new Date().toISOString();
  const row = {
    kind, slug, status, scheduled_at: scheduledAt, sort: Number.isInteger(input.sort) ? input.sort : 0,
    primary_keyword: keyword || null, secondary_keywords: input.secondaryKeywords.map((k) => k.trim()).filter(Boolean).slice(0, 20),
    meta: input.meta as unknown as Json, doc: doc as unknown as Json, seo: seo as unknown as Json, updated_by: bos.email,
    ...(status === "published" && before?.status !== "published" ? { published_at: now } : {}),
    ...(status === "scheduled" ? { published_at: scheduledAt } : {}),
  };
  const q = input.id ? ydb().from("content_entries").update(row).eq("id", input.id).select("id").maybeSingle() : ydb().from("content_entries").insert(row).select("id").single();
  const { data, error } = await q;
  if (error?.code === "23505") throw new ValidationError(error.message.includes("primary_keyword") ? "صفحة أخرى تستهدف نفس الكلمة الرئيسية." : "يوجد صفحة بنفس الرابط.", error.message.includes("primary_keyword") ? { primary_keyword: "مستخدمة" } : { slug: "مستخدم" });
  if (error) throw error;
  if (!data) throw new NotFoundError();

  await ydb().from("content_revisions").insert({ entry_id: data.id, slug, status, meta: row.meta, doc: row.doc, seo: row.seo, primary_keyword: row.primary_keyword, secondary_keywords: row.secondary_keywords, scheduled_at: scheduledAt, saved_by: bos.email });
  // A live page that moved keeps its old address working.
  if (before && before.published_at && (before.slug !== slug || before.kind !== kind)) {
    await ydb().from("seo_redirects").upsert({ from_path: seoPath(before.kind, before.slug), to_path: path, status_code: 308, active: true, note: "تغيّر رابط الصفحة", created_by: bos.email }, { onConflict: "from_path" });
  }
  await audit({ actorId: bos.userId, action: input.id ? "yolias.seo_page.update" : "yolias.seo_page.create", entityType: "yolias_content", entityId: null, oldValue: before ? { slug: before.slug, status: before.status } : undefined, newValue: { kind, slug, status, keyword }, metadata: { content: data.id } });
  return data.id;
}

export async function setSeoStatus(bos: BosUser, id: string, status: "published" | "draft" | "hidden"): Promise<void> {
  const page = await getSeoPage(id);
  if (status === "published" && !page.primary_keyword) throw new ValidationError("أضف الكلمة الرئيسية قبل النشر.");
  const { error } = await ydb().from("content_entries").update({ status, scheduled_at: null, updated_by: bos.email, ...(status === "published" && page.status !== "published" ? { published_at: new Date().toISOString() } : {}) }).eq("id", id);
  if (error) throw error;
  await ydb().from("content_revisions").insert({ entry_id: id, slug: page.slug, status, meta: page.meta as unknown as Json, doc: page.doc as unknown as Json, seo: page.seo as unknown as Json, primary_keyword: page.primary_keyword, secondary_keywords: page.secondary_keywords, saved_by: bos.email });
  await audit({ actorId: bos.userId, action: "yolias.seo_page.status", entityType: "yolias_content", entityId: null, oldValue: { status: page.status }, newValue: { status }, metadata: { content: id, slug: page.slug } });
}

export async function deleteSeoPage(bos: BosUser, id: string): Promise<void> {
  const page = await getSeoPage(id);
  if (page.published_at && page.status === "published") throw new ValidationError("الصفحة منشورة: أخفِها أولًا أو حوّل رابطها إلى صفحة أخرى، ثم احذفها.");
  const { error } = await ydb().from("content_entries").delete().eq("id", id);
  if (error) throw error;
  await audit({ actorId: bos.userId, action: "yolias.seo_page.delete", entityType: "yolias_content", entityId: null, oldValue: { kind: page.kind, slug: page.slug } });
}

export async function listRevisions(id: string) {
  const { data, error } = await ydb().from("content_revisions").select("id, status, slug, primary_keyword, saved_by, saved_at").eq("entry_id", id).order("saved_at", { ascending: false }).limit(30);
  if (error) throw error;
  return data ?? [];
}

/** Puts a saved version back as a draft (never straight to the live site). */
export async function restoreRevision(bos: BosUser, id: string, revisionId: number): Promise<void> {
  const { data: rev } = await ydb().from("content_revisions").select("*").eq("id", revisionId).eq("entry_id", id).maybeSingle();
  if (!rev) throw new NotFoundError();
  const page = await getSeoPage(id);
  const status = page.status === "published" ? "published" : "draft";
  const { error } = await ydb().from("content_entries").update({ meta: rev.meta, doc: rev.doc, seo: rev.seo, primary_keyword: rev.primary_keyword, secondary_keywords: rev.secondary_keywords, updated_by: bos.email, status, scheduled_at: null }).eq("id", id);
  if (error?.code === "23505") throw new ValidationError("صفحة أخرى تستهدف الآن نفس الكلمة الرئيسية لهذه النسخة.");
  if (error) throw error;
  await ydb().from("content_revisions").insert({ entry_id: id, slug: page.slug, status, meta: rev.meta, doc: rev.doc, seo: rev.seo, primary_keyword: rev.primary_keyword, secondary_keywords: rev.secondary_keywords, saved_by: bos.email });
  await audit({ actorId: bos.userId, action: "yolias.seo_page.restore", entityType: "yolias_content", entityId: null, newValue: { revision: revisionId }, metadata: { content: id } });
}

/** Scheduled pages whose time came: published (the site already shows them; this makes the status say so). */
export async function publishDuePages(): Promise<number> {
  const { data, error } = await ydb().from("content_entries").update({ status: "published" }).eq("status", "scheduled").lte("scheduled_at", new Date().toISOString()).select("id");
  if (error) throw error;
  return (data ?? []).length;
}

/** A link to see a draft on the real site for 30 minutes (Yolias/lib/content/seo-store.ts checks it). */
export function previewUrl(id: string): string | null {
  const base = (process.env.YOLIAS_SITE_URL ?? "").replace(/\/$/, "");
  const key = process.env.YOLIAS_SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) return null;
  const exp = Math.floor(Date.now() / 1000) + 30 * 60;
  const sig = createHmac("sha256", key).update(`seo-preview:${id}:${exp}`).digest("hex");
  return `${base}/preview/seo/${id}?exp=${exp}&sig=${sig}`;
}
