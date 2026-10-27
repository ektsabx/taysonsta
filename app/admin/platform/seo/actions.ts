"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authorize } from "@/lib/bos/auth";
import { handleAction, type ActionState } from "@/lib/bos/action";
import { ValidationError } from "@/lib/bos/errors";
import { parseCompare, parseFaq, parseLinks, parseList, parseSteps, type SeoFields, type SeoMeta } from "@/lib/yolias/seo-pages";
import { deleteSeoPage, restoreRevision, saveSeoPage, setSeoStatus } from "@/services/yolias/seo/pages";
import { deleteKeyword, parsePrices, saveCompetitor, saveKeyword, saveRedirect, setRedirectActive } from "@/services/yolias/seo/catalog";
import { googleSeoConfig, inspectUrls, syncGa4, syncSearchConsole } from "@/services/yolias/seo/google";
import { crawlSite } from "@/services/yolias/seo/indexing";

// Yolias Admin → SEO (D-257). Reading needs platform.read; every change
// platform.manage, audited in the services.

const s = (f: FormData, k: string) => String(f.get(k) ?? "");
const both = (f: FormData, k: string) => ({ en: s(f, `${k}_en`).trim(), ar: s(f, `${k}_ar`).trim() });
const lists = (f: FormData, k: string) => ({ en: parseList(s(f, `${k}_en`)), ar: parseList(s(f, `${k}_ar`)) });
// "2026-11-01T09:00" typed in a browser whose UTC offset is -120 minutes → UTC ISO.
const localToIso = (local: string, offset: string) => {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null;
  const off = /^-?\d{1,4}$/.test(offset) ? Number(offset) : 0;
  return new Date(Date.parse(`${local}:00Z`) + off * 60_000).toISOString();
};
const done = () => revalidatePath("/admin/platform/seo", "layout");

export async function saveSeoPageAction(_prev: ActionState, f: FormData): Promise<ActionState> {
  let id: string | null = null;
  const result = await handleAction("yolias.seo.savePage", async () => {
    const { bos } = await authorize("platform.manage", "all");
    const meta: SeoMeta = {
      format: s(f, "format") === "list" ? "list" : "versus",
      competitor: s(f, "competitor").trim() || undefined,
      tools: s(f, "tools").split(/[\s,]+/).map((x) => x.trim().toLowerCase()).filter(Boolean),
      answer: both(f, "answer"),
      audience: lists(f, "audience"),
      criteria: lists(f, "criteria"),
      steps: { en: parseSteps(s(f, "steps_en")), ar: parseSteps(s(f, "steps_ar")) },
      compare: { en: parseCompare(s(f, "compare_en")), ar: parseCompare(s(f, "compare_ar")) },
      faq: { en: parseFaq(s(f, "faq_en")), ar: parseFaq(s(f, "faq_ar")) },
      cta: { en: { title: s(f, "cta_title_en").trim(), body: s(f, "cta_body_en").trim(), label: s(f, "cta_label_en").trim() }, ar: { title: s(f, "cta_title_ar").trim(), body: s(f, "cta_body_ar").trim(), label: s(f, "cta_label_ar").trim() } },
      links: parseLinks(s(f, "links")),
      prompt: both(f, "prompt"),
      sources: parseList(s(f, "sources")),
      origin: f.get("reviewed") === "on" ? "human" : (s(f, "origin") === "human" ? "human" : "ai_draft"),
    };
    const seo: SeoFields = {
      meta_title: both(f, "meta_title"), meta_description: both(f, "meta_description"), h1: both(f, "h1"),
      canonical: s(f, "canonical").trim() || undefined, robots: s(f, "robots") === "noindex" ? "noindex" : "index", schema: s(f, "schema") === "none" ? "none" : "auto",
    };
    const status = s(f, "status");
    // Copy written by AI stays a draft until a person ticks "reviewed".
    if ((status === "published" || status === "scheduled") && meta.origin !== "human") throw new ValidationError("المحتوى مكتوب كمسودة آلية: راجعه وفعّل «راجعت المحتوى» قبل النشر.", { reviewed: "مطلوب" });
    id = await saveSeoPage(bos, {
      id: s(f, "id") || null, kind: s(f, "kind"), slug: s(f, "slug"), status, scheduledAt: localToIso(s(f, "scheduled_at"), s(f, "tz_offset")), sort: Number(s(f, "sort") || 0),
      primaryKeyword: s(f, "primary_keyword"), secondaryKeywords: parseList(s(f, "secondary_keywords").replace(/,/g, "\n")),
      meta, seo,
      en: { title: s(f, "title_en"), summary: s(f, "summary_en"), body: s(f, "body_en") },
      ar: { title: s(f, "title_ar"), summary: s(f, "summary_ar"), body: s(f, "body_ar") },
      allowSharedKeyword: f.get("allow_shared") === "on",
    });
    done();
    return { ok: true };
  });
  if (result.ok && !s(f, "id") && id) redirect(`/admin/platform/seo/pages/${id}`);
  return result;
}

export async function setSeoStatusAction(_prev: ActionState, f: FormData): Promise<ActionState> {
  return handleAction("yolias.seo.status", async () => {
    const { bos } = await authorize("platform.manage", "all");
    const st = s(f, "status");
    if (st !== "published" && st !== "draft" && st !== "hidden") throw new ValidationError("الحالة غير صالحة.");
    await setSeoStatus(bos, s(f, "id"), st);
    done();
    return { ok: true };
  });
}

export async function deleteSeoPageAction(_prev: ActionState, f: FormData): Promise<ActionState> {
  const result = await handleAction("yolias.seo.delete", async () => {
    const { bos } = await authorize("platform.manage", "all");
    await deleteSeoPage(bos, s(f, "id"));
    done();
    return { ok: true };
  });
  if (result.ok) redirect("/admin/platform/seo/pages");
  return result;
}

export async function restoreRevisionAction(_prev: ActionState, f: FormData): Promise<ActionState> {
  return handleAction("yolias.seo.restore", async () => {
    const { bos } = await authorize("platform.manage", "all");
    await restoreRevision(bos, s(f, "id"), Number(s(f, "revision")));
    done();
    return { ok: true };
  });
}

export async function saveCompetitorAction(_prev: ActionState, f: FormData): Promise<ActionState> {
  let id: string | null = null;
  const result = await handleAction("yolias.seo.competitor", async () => {
    const { bos } = await authorize("platform.manage", "all");
    const pp = s(f, "publishes_prices");
    id = await saveCompetitor(bos, {
      id: s(f, "id") || null, slug: s(f, "slug"), name: s(f, "name"), website: s(f, "website").trim(), pricingUrl: s(f, "pricing_url").trim(),
      publishesPrices: pp === "yes" || pp === "no" ? pp : "unknown",
      summary: both(f, "summary"), bestFor: both(f, "best_for"), strengths: lists(f, "strengths"), limits: lists(f, "limits"),
      pricing: parsePrices(s(f, "pricing")), reviewed: f.get("reviewed") === "on",
    });
    done();
    return { ok: true };
  });
  if (result.ok && !s(f, "id") && id) redirect(`/admin/platform/seo/competitors/${id}`);
  return result;
}

export async function saveKeywordAction(_prev: ActionState, f: FormData): Promise<ActionState> {
  return handleAction("yolias.seo.keyword", async () => {
    const { bos } = await authorize("platform.manage", "all");
    await saveKeyword(bos, {
      id: s(f, "id") || null, keyword: s(f, "keyword"), locale: s(f, "locale") || "en", intent: s(f, "intent"), cluster: s(f, "cluster"), pageType: s(f, "page_type"),
      priority: Number(s(f, "priority") || 2), stage: s(f, "stage") || "idea", targetPath: s(f, "target_path"), volume: s(f, "volume"), volumeSource: s(f, "volume_source"),
      difficulty: s(f, "difficulty"), difficultySource: s(f, "difficulty_source"), notes: s(f, "notes"), related: parseList(s(f, "related").replace(/,/g, "\n")),
    });
    done();
    return { ok: true };
  });
}

export async function deleteKeywordAction(_prev: ActionState, f: FormData): Promise<ActionState> {
  const result = await handleAction("yolias.seo.keywordDelete", async () => {
    const { bos } = await authorize("platform.manage", "all");
    await deleteKeyword(bos, s(f, "id"));
    done();
    return { ok: true };
  });
  if (result.ok) redirect("/admin/platform/seo/keywords");
  return result;
}

export async function saveRedirectAction(_prev: ActionState, f: FormData): Promise<ActionState> {
  return handleAction("yolias.seo.redirect", async () => {
    const { bos } = await authorize("platform.manage", "all");
    await saveRedirect(bos, { from: s(f, "from_path"), to: s(f, "to_path"), code: Number(s(f, "status_code") || 308), note: s(f, "note") });
    done();
    return { ok: true };
  });
}

export async function toggleRedirectAction(_prev: ActionState, f: FormData): Promise<ActionState> {
  return handleAction("yolias.seo.redirectToggle", async () => {
    const { bos } = await authorize("platform.manage", "all");
    await setRedirectActive(bos, s(f, "id"), s(f, "active") === "1");
    done();
    return { ok: true };
  });
}

/** "Sync now" for one source; the result (or Google's error) is shown and kept in the run log. */
export async function syncNowAction(_prev: ActionState, f: FormData): Promise<ActionState> {
  return handleAction("yolias.seo.sync", async () => {
    const { bos } = await authorize("platform.manage", "all");
    const src = s(f, "source");
    if (src === "crawl") {
      const r = await crawlSite(bos.email);
      done();
      return { ok: true, message: `تم فحص ${r.pages.length} صفحة: ${r.broken.length} رابط معطل، ${r.redirects.length} تحويل.` };
    }
    const cfg = await googleSeoConfig();
    if (!cfg.ok) throw new ValidationError("Google Search Console غير متصل: أضف حساب الخدمة من مركز التكاملات أولًا.");
    const r = src === "ga4" ? await syncGa4(cfg.config, 30, bos.email) : src === "inspection" ? await inspectUrls(cfg.config, parseList(s(f, "urls")), bos.email) : await syncSearchConsole(cfg.config, Number(s(f, "days") || 30), bos.email);
    done();
    if (!r.ok) throw new ValidationError(`فشلت المزامنة: ${r.error}`);
    return { ok: true, message: `تمت المزامنة: ${r.rows} صف.` };
  });
}
