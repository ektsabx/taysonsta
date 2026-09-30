"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authorize } from "@/lib/bos/auth";
import { assertCanAccess } from "@/lib/bos/access";
import { handleAction, parseForm, zf, type ActionState } from "@/lib/bos/action";
import { createArticle, markRead, saveSteps, setArticleStatus, updateArticle, type ArticleInput, setArticleAiAllowed } from "@/services/bos/knowledge";

const articleSchema = z.object({
  kind: z.enum(["article", "sop", "playbook", "documentation", "policy", "onboarding_guide"]),
  title: zf.required("العنوان", 200),
  slug: zf.optionalText(120),
  content: z.string().max(200000, "المحتوى يتجاوز 200KB").default(""),
  category_id: zf.uuid("التصنيف"),
  tags: zf.optionalText(500),
  owner_id: zf.optionalUuid(),
  allowed_role_ids: z.array(z.string().uuid()).optional(),
  playbook_section: z.preprocess((v) => (v === "" ? null : v), z.enum(["outreach_templates", "discovery_questions", "objection_handling", "pricing_rules", "qualification_framework", "follow_up_sequences", "proposal_templates", "closing_process"]).nullable()),
  required_documents: zf.optionalText(5000),
  status: z.enum(["draft", "published"]).default("draft"),
  language: z.enum(["ar", "en"]).default("ar"),
  audience: z.enum(["internal", "public"]).default("internal"),
  ai_allowed: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
});

function toInput(v: z.infer<typeof articleSchema>): ArticleInput {
  return {
    kind: v.kind,
    title: v.title,
    slug: v.slug ?? null,
    content: v.content,
    category_id: v.category_id,
    tags: (v.tags ?? "").split(",").map((t) => t.trim().toLowerCase()).filter(Boolean),
    owner_id: v.owner_id,
    allowed_role_ids: v.allowed_role_ids?.length ? v.allowed_role_ids : null,
    playbook_section: v.kind === "playbook" ? v.playbook_section : null,
    required_documents: v.required_documents ?? null,
    status: v.status,
    language: v.language,
    audience: v.audience,
    ai_allowed: v.ai_allowed,
  };
}

export async function createArticleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("createArticle", async () => {
    const { bos } = await authorize("knowledge.create");
    const a = await createArticle(bos, toInput(parseForm(articleSchema, formData)));
    revalidatePath("/admin/knowledge", "layout");
    redirect(`/admin/knowledge/articles/${a.slug}`);
  }, "تعذر إنشاء المقال.");
}

export async function updateArticleAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("updateArticle", async () => {
    const { bos } = await authorize("knowledge.update");
    const { slug } = await updateArticle(bos, id, toInput(parseForm(articleSchema, formData)));
    revalidatePath("/admin/knowledge", "layout");
    redirect(`/admin/knowledge/articles/${slug}`);
  }, "تعذر حفظ المقال.");
}

export async function setArticleStatusAction(id: string, status: "draft" | "published" | "archived"): Promise<ActionState> {
  return handleAction("setArticleStatus", async () => {
    const { bos } = await authorize("knowledge.manage");
    await setArticleStatus(bos, id, status);
    revalidatePath("/admin/knowledge", "layout");
    revalidatePath("/admin/support/knowledge");
    return { ok: true, message: status === "published" ? "تم النشر" : status === "archived" ? "تمت الأرشفة" : "أصبح مسودة" };
  });
}

export async function saveStepsAction(articleId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("saveSteps", async () => {
    const { bos } = await authorize("knowledge.update");
    const kinds = formData.getAll("step_kind[]").map(String);
    const titles = formData.getAll("step_title[]").map(String);
    const descs = formData.getAll("step_desc[]").map(String);
    const steps = titles.map((t, i) => ({ kind: (kinds[i] === "checklist" ? "checklist" : "step") as "step" | "checklist", title: t, description: descs[i]?.trim() || null })).filter((s) => s.title.trim());
    await saveSteps(bos, articleId, steps);
    revalidatePath("/admin/knowledge", "layout");
    return { ok: true, message: "تم حفظ الخطوات" };
  });
}

export async function markReadAction(articleId: string): Promise<ActionState> {
  return handleAction("markRead", async () => {
    const { bos } = await authorize("knowledge.read");
    await assertCanAccess(bos, "kb_article", articleId);
    await markRead(bos, articleId);
    revalidatePath("/admin/knowledge", "layout");
    return { ok: true, message: "تم تسجيل القراءة" };
  });
}

export async function setArticleAiAction(id: string, allowed: boolean): Promise<ActionState> {
  return handleAction("setArticleAi", async () => {
    const { bos } = await authorize("knowledge.update");
    await setArticleAiAllowed(bos, id, allowed);
    revalidatePath("/admin/knowledge", "layout");
    revalidatePath("/admin/support/knowledge");
    return { ok: true, message: allowed ? "أصبح المقال متاحاً لوكيل الذكاء الاصطناعي" : "لم يعد المقال متاحاً للوكيل" };
  });
}
