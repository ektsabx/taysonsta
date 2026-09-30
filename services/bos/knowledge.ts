import { nowIso, nowMs } from "@/lib/bos/clock";
import "server-only";
import { db, type DbEnum, type Tables } from "@/lib/bos/db";
import type { BosUser } from "@/lib/bos/auth";
import { canAccessEntity } from "@/lib/bos/access";
import { audit, recordStatus } from "@/lib/bos/audit";
import { emitEvent } from "@/lib/bos/events";
import { slugify } from "@/lib/bos/markdown";
import { refreshEmployeeOnboardingSafe } from "@/services/bos/employees";
import { NotFoundError, ValidationError } from "@/lib/bos/errors";

// Knowledge base (§42–44): versioned articles, SOPs with steps/checklists,
// playbooks, docs, policies and onboarding guides; role-restricted reading.

export type Article = Tables<"kb_articles">;
export type ArticleKind = DbEnum<"kb_kind">;

export const kindLabels: Record<ArticleKind, string> = { article: "مقال", sop: "إجراء تشغيل", playbook: "دليل مبيعات", documentation: "توثيق", policy: "سياسة", onboarding_guide: "دليل تهيئة" };
export const playbookLabels: Record<string, string> = {
  outreach_templates: "قوالب التواصل",
  discovery_questions: "أسئلة الاكتشاف",
  objection_handling: "التعامل مع الاعتراضات",
  pricing_rules: "قواعد التسعير",
  qualification_framework: "إطار التأهيل",
  follow_up_sequences: "تسلسلات المتابعة",
  proposal_templates: "قوالب المقترحات",
  closing_process: "عملية الإغلاق",
};

async function myRoleIds(bos: BosUser) {
  const { data } = await db().from("user_roles").select("role_id").eq("user_id", bos.userId);
  return (data ?? []).map((r) => r.role_id);
}

// Server-side visibility: published + (unrestricted or my roles), or mine,
// or everything for knowledge.manage. Restricted articles never reach others.
export async function visibleFilter(bos: BosUser) {
  const manage = !!bos.permissions.get("knowledge.manage") || bos.isSuperAdmin;
  const editor = !!bos.permissions.get("knowledge.update");
  const roles = await myRoleIds(bos);
  return (a: Pick<Article, "status" | "allowed_role_ids" | "author_id">) => {
    if (manage || a.author_id === bos.userId) return true;
    if (a.status !== "published") return editor && a.status === "draft";
    return !a.allowed_role_ids?.length || a.allowed_role_ids.some((r) => roles.includes(r));
  };
}

export async function listArticles(bos: BosUser, f: { q?: string; kind?: string | string[]; category?: string; tag?: string; status?: string; section?: string; limit?: number }) {
  let q = db().from("kb_articles").select("id, kind, slug, title, category_id, tags, author_id, owner_id, version, status, allowed_role_ids, playbook_section, published_at, updated_at, kb_categories(key, name)").order("updated_at", { ascending: false }).limit(Math.min(f.limit ?? 200, 500));
  if (f.kind) q = Array.isArray(f.kind) ? q.in("kind", f.kind as ArticleKind[]) : q.eq("kind", f.kind as ArticleKind);
  if (f.category) q = q.eq("category_id", f.category);
  if (f.tag) q = q.contains("tags", [f.tag.toLowerCase()]);
  if (f.status) q = q.eq("status", f.status);
  else q = q.neq("status", "archived");
  if (f.section) q = q.eq("playbook_section", f.section as DbEnum<"playbook_section">);
  if (f.q) q = q.textSearch("search", f.q.trim().split(/\s+/).map((w) => `${w.replace(/[^\p{L}\p{N}]/gu, "")}:*`).filter((w) => w.length > 2).join(" & ") || "''", { config: "simple" });
  const { data, error } = await q;
  if (error) throw error;
  const can = await visibleFilter(bos);
  return (data ?? []).filter(can);
}

export async function getArticleBySlug(bos: BosUser, slug: string) {
  const { data } = await db().from("kb_articles").select("*, kb_categories(key, name)").eq("slug", slug).maybeSingle();
  if (!data) throw new NotFoundError();
  if (!(await canAccessEntity(bos, "kb_article", data.id))) throw new NotFoundError(); // hidden, not forbidden
  const [{ data: steps }, { data: versions }, { data: read }] = await Promise.all([
    db().from("sop_steps").select("*").eq("article_id", data.id).order("kind").order("sort_order"),
    db().from("kb_article_versions").select("id, version, title, edited_by, created_at").eq("article_id", data.id).order("version", { ascending: false }),
    db().from("kb_article_reads").select("version, read_at").eq("article_id", data.id).eq("user_id", bos.userId).maybeSingle(),
  ]);
  return { ...data, steps: steps ?? [], versions: versions ?? [], myRead: read };
}

export async function getVersion(articleId: string, version: number) {
  const { data } = await db().from("kb_article_versions").select("*").eq("article_id", articleId).eq("version", version).maybeSingle();
  return data;
}

export interface ArticleInput {
  kind: ArticleKind;
  title: string;
  slug: string | null;
  content: string;
  category_id: string;
  tags: string[];
  owner_id: string | null;
  allowed_role_ids: string[] | null;
  playbook_section: DbEnum<"playbook_section"> | null;
  required_documents: string | null;
  status: "draft" | "published";
  // Phase 8: language, audience and whether AI support agents may quote it.
  language?: "ar" | "en";
  audience?: "internal" | "public";
  ai_allowed?: boolean;
}

function validate(input: ArticleInput) {
  if (!input.title.trim()) throw new ValidationError("العنوان مطلوب.", { title: "مطلوب" });
  if (!input.category_id) throw new ValidationError("التصنيف مطلوب.", { category_id: "مطلوب" });
  if (input.content.length > 200000) throw new ValidationError("المحتوى يتجاوز 200KB.", { content: "كبير جداً" });
  if (input.ai_allowed && input.audience === "internal") throw new ValidationError("المقال المتاح للمساعد الذكي يجب أن يكون موجهاً للعملاء (عام).", { audience: "اختر عام" });
  if (input.kind === "playbook" && !input.playbook_section) throw new ValidationError("اختر قسم دليل المبيعات.", { playbook_section: "مطلوب" });
}

async function uniqueSlug(base: string, excludeId?: string) {
  let slug = base;
  for (let i = 2; i < 50; i++) {
    let q = db().from("kb_articles").select("id").eq("slug", slug);
    if (excludeId) q = q.neq("id", excludeId);
    const { data } = await q.maybeSingle();
    if (!data) return slug;
    slug = `${base}-${i}`;
  }
  return `${base}-${nowMs().toString(36)}`;
}

export async function createArticle(bos: BosUser, input: ArticleInput) {
  validate(input);
  const slug = await uniqueSlug(slugify(input.slug || input.title));
  const publish = input.status === "published" && (!!bos.permissions.get("knowledge.manage") || bos.isSuperAdmin);
  const { data, error } = await db()
    .from("kb_articles")
    .insert({ ...input, slug, tags: input.tags.map((t) => t.toLowerCase()), author_id: bos.userId, owner_id: input.owner_id ?? bos.userId, status: publish ? "published" : "draft", published_at: publish ? nowIso() : null })
    .select("*")
    .single();
  if (error) throw error;
  await db().from("kb_article_versions").insert({ article_id: data.id, version: 1, title: data.title, content: data.content, edited_by: bos.userId });
  await audit({ actorId: bos.userId, action: "kb.article_created", entityType: "kb_article", entityId: data.id, newValue: { title: data.title, kind: data.kind, status: data.status } });
  if (publish) await emitPublished(bos, data);
  return data;
}

export async function updateArticle(bos: BosUser, id: string, input: ArticleInput) {
  validate(input);
  const { data: before } = await db().from("kb_articles").select("*").eq("id", id).single();
  if (!before) throw new NotFoundError();
  if (before.author_id !== bos.userId && bos.permissions.get("knowledge.update") !== "all" && !bos.permissions.get("knowledge.manage")) throw new ValidationError("يمكنك تعديل مقالاتك فقط.");
  const contentChanged = before.title !== input.title || before.content !== input.content;
  const version = contentChanged ? before.version + 1 : before.version;
  const canPublish = !!bos.permissions.get("knowledge.manage") || bos.isSuperAdmin;
  const status = canPublish ? input.status : before.status === "published" ? "published" : "draft";
  const slug = input.slug && input.slug !== before.slug ? await uniqueSlug(slugify(input.slug), id) : before.slug;
  const { error } = await db()
    .from("kb_articles")
    .update({ ...input, slug, tags: input.tags.map((t) => t.toLowerCase()), version, status, published_at: status === "published" ? before.published_at ?? nowIso() : before.published_at })
    .eq("id", id);
  if (error) throw error;
  if (contentChanged) await db().from("kb_article_versions").insert({ article_id: id, version, title: input.title, content: input.content, edited_by: bos.userId });
  await audit({ actorId: bos.userId, action: "kb.article_updated", entityType: "kb_article", entityId: id, oldValue: { version: before.version, status: before.status }, newValue: { version, status } });
  if (before.status !== status) await recordStatus("kb_article", id, before.status, status, bos.userId);
  const after = { ...before, ...input, slug, version, status };
  if (status === "published" && before.status !== "published") await emitPublished(bos, after as Article);
  // New version of a required policy → re-read requirement.
  if (status === "published" && before.status === "published" && contentChanged && ["policy", "onboarding_guide"].includes(before.kind)) {
    await emitEvent({ type: "kb.policy_updated", entityType: "kb_article", entityId: id, summary: `Policy updated: ${input.title} (v${version}) — please re-read`, actorId: bos.userId, payload: { version, slug } });
  }
  return { slug };
}

async function emitPublished(bos: BosUser, a: Pick<Article, "id" | "title" | "kind" | "slug">) {
  await emitEvent({ type: "kb.article_published", entityType: "kb_article", entityId: a.id, summary: `${kindLabels[a.kind]} published: ${a.title}`, actorId: bos.userId, payload: { kind: a.kind, slug: a.slug } });
}

export async function setArticleStatus(bos: BosUser, id: string, status: "draft" | "published" | "archived") {
  const { data: before } = await db().from("kb_articles").select("*").eq("id", id).single();
  if (!before) throw new NotFoundError();
  await db().from("kb_articles").update({ status, published_at: status === "published" ? before.published_at ?? nowIso() : before.published_at }).eq("id", id);
  await recordStatus("kb_article", id, before.status, status, bos.userId);
  await audit({ actorId: bos.userId, action: `kb.article_${status}`, entityType: "kb_article", entityId: id, oldValue: { status: before.status }, newValue: { status } });
  if (status === "published" && before.status !== "published") await emitPublished(bos, before);
}

export async function saveSteps(bos: BosUser, articleId: string, steps: { kind: "step" | "checklist"; title: string; description: string | null }[]) {
  const { data: a } = await db().from("kb_articles").select("kind").eq("id", articleId).single();
  if (a?.kind === "sop" && !steps.some((s) => s.kind === "step")) throw new ValidationError("إجراء التشغيل يحتاج خطوة واحدة على الأقل.");
  await db().from("sop_steps").delete().eq("article_id", articleId);
  const rows = steps.map((s, i) => ({ article_id: articleId, kind: s.kind, sort_order: i + 1, title: s.title.trim(), description: s.description }));
  if (rows.length) await db().from("sop_steps").insert(rows);
  await audit({ actorId: bos.userId, action: "kb.steps_updated", entityType: "kb_article", entityId: articleId, newValue: { count: rows.length } });
}

// Required reading: records the version read and completes onboarding items
// with auto_key read:<slug>.
export async function markRead(bos: BosUser, articleId: string) {
  const { data: a } = await db().from("kb_articles").select("id, version, slug, status").eq("id", articleId).single();
  if (!a || a.status !== "published") throw new ValidationError("المقال غير منشور.");
  await db().from("kb_article_reads").upsert({ article_id: articleId, user_id: bos.userId, version: a.version, read_at: nowIso() }, { onConflict: "article_id,user_id" });
  await refreshEmployeeOnboardingSafe(bos.employee.id, bos.userId);
}

export async function getRequiredReading(bos: BosUser) {
  const { data: items } = await db()
    .from("onboarding_items")
    .select("auto_key, is_done, onboarding_checklists!inner(employee_id, status)")
    .eq("onboarding_checklists.employee_id", bos.employee.id)
    .eq("onboarding_checklists.status", "in_progress")
    .like("auto_key", "read:%");
  const slugs = (items ?? []).map((i) => (i.auto_key as string).slice(5));
  const { data: policies } = await db().from("kb_articles").select("id, slug, title, version, kind").in("kind", ["policy", "onboarding_guide"]).eq("status", "published");
  const { data: reads } = await db().from("kb_article_reads").select("article_id, version").eq("user_id", bos.userId);
  const readVersion = new Map((reads ?? []).map((r) => [r.article_id, r.version]));
  return (policies ?? [])
    .filter((p) => slugs.includes(p.slug) || (readVersion.has(p.id) && (readVersion.get(p.id) ?? 0) < p.version))
    .map((p) => ({ ...p, readVersion: readVersion.get(p.id) ?? null, upToDate: (readVersion.get(p.id) ?? 0) >= p.version }));
}

export async function listCategories() {
  const { data } = await db().from("kb_categories").select("*").order("sort_order");
  return data ?? [];
}

export async function popularArticles(bos: BosUser, limit = 6) {
  const { data: reads } = await db().from("kb_article_reads").select("article_id").limit(2000);
  const counts = new Map<string, number>();
  for (const r of reads ?? []) counts.set(r.article_id, (counts.get(r.article_id) ?? 0) + 1);
  const all = await listArticles(bos, { status: "published" });
  return all.map((a) => ({ ...a, reads: counts.get(a.id) ?? 0 })).sort((a, b) => b.reads - a.reads).slice(0, limit);
}
