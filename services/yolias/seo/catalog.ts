import "server-only";
import type { BosUser } from "@/lib/bos/auth";
import { audit } from "@/lib/bos/audit";
import { NotFoundError, ValidationError } from "@/lib/bos/errors";
import { ydb } from "@/lib/yolias/db";
import type { Json } from "@/types/database";
import type { SeoKeywordIntent, SeoKeywordStage, SeoPageType } from "../../../Yolias/types/database";

// Competitors, keywords and redirects for SEO (D-257). Competitor facts and
// prices always carry their source and the date they were checked; a price
// reaches the website only after a person marks it verified. Keyword volume
// and difficulty are stored only with where they came from.

// ───────────────────────── Competitors ─────────────────────────

export interface CompetitorPrice { plan: string; price: string; period: string; note?: string; source_url: string; checked_at: string; verified: boolean }
export interface CompetitorInput {
  id: string | null;
  slug: string;
  name: string;
  website: string;
  pricingUrl: string;
  publishesPrices: "yes" | "no" | "unknown";
  summary: { en: string; ar: string };
  bestFor: { en: string; ar: string };
  strengths: { en: string[]; ar: string[] };
  limits: { en: string[]; ar: string[] };
  pricing: CompetitorPrice[];
  /** "Reviewed now": stamps the review date and reviewer. */
  reviewed: boolean;
}

export async function listCompetitors() {
  const { data, error } = await ydb().from("seo_competitors").select("*").order("name");
  if (error) throw error;
  return data ?? [];
}

export async function getCompetitor(id: string) {
  const { data } = await ydb().from("seo_competitors").select("*").eq("id", id).maybeSingle();
  if (!data) throw new NotFoundError();
  return data;
}

const https = (u: string) => /^https:\/\/[a-z0-9.-]+\.[a-z]{2,}(\/\S*)?$/i.test(u);

/** "Plan | $49 | month | https://source | 2026-10-26 | verified" per line. */
export function parsePrices(s: string): CompetitorPrice[] {
  return s.replace(/\r\n/g, "\n").split("\n").map((l) => l.trim()).filter(Boolean).map((l, i) => {
    const [plan, price, period, source_url, checked_at, flag] = l.split("|").map((x) => x.trim());
    if (!plan || !price) throw new ValidationError(`سطر السعر ${i + 1} ناقص: الخطة | السعر | الفترة | رابط المصدر | تاريخ المراجعة | verified`, { pricing: "صيغة" });
    if (!https(source_url ?? "")) throw new ValidationError(`سطر السعر ${i + 1}: رابط المصدر مطلوب (https).`, { pricing: "المصدر" });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(checked_at ?? "")) throw new ValidationError(`سطر السعر ${i + 1}: تاريخ المراجعة YYYY-MM-DD.`, { pricing: "التاريخ" });
    return { plan, price, period: period ?? "", source_url, checked_at, verified: /^(verified|موثق|✓)$/i.test(flag ?? "") };
  });
}
export const formatPrices = (v: unknown) => (Array.isArray(v) ? (v as CompetitorPrice[]) : []).map((p) => [p.plan, p.price, p.period, p.source_url, p.checked_at, p.verified ? "verified" : "unverified"].join(" | ")).join("\n");

export async function saveCompetitor(bos: BosUser, input: CompetitorInput): Promise<string> {
  const slug = input.slug.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{0,59}$/.test(slug)) throw new ValidationError("المعرّف غير صالح.", { slug: "حروف إنجليزية صغيرة وأرقام وشرطات" });
  if (!input.name.trim()) throw new ValidationError("الاسم مطلوب.", { name: "مطلوب" });
  if (!https(input.website)) throw new ValidationError("رابط الموقع الرسمي مطلوب (https).", { website: "https://…" });
  if (input.pricingUrl && !https(input.pricingUrl)) throw new ValidationError("رابط صفحة الأسعار غير صالح.", { pricing_url: "https://…" });
  const row = {
    slug, name: input.name.trim(), website: input.website.trim(), pricing_url: input.pricingUrl.trim() || null,
    publishes_prices: input.publishesPrices === "yes" ? true : input.publishesPrices === "no" ? false : null,
    summary: input.summary as unknown as Json, best_for: input.bestFor as unknown as Json, strengths: input.strengths as unknown as Json, limits: input.limits as unknown as Json,
    pricing: input.pricing as unknown as Json,
    ...(input.reviewed ? { last_reviewed_at: new Date().toISOString(), reviewed_by: bos.email } : {}),
  };
  const q = input.id ? ydb().from("seo_competitors").update(row).eq("id", input.id).select("id").maybeSingle() : ydb().from("seo_competitors").insert(row).select("id").single();
  const { data, error } = await q;
  if (error?.code === "23505") throw new ValidationError("يوجد منافس بنفس المعرّف.", { slug: "مستخدم" });
  if (error) throw error;
  if (!data) throw new NotFoundError();
  await audit({ actorId: bos.userId, action: input.id ? "yolias.seo_competitor.update" : "yolias.seo_competitor.create", entityType: "yolias_seo", entityId: null, newValue: { slug, reviewed: input.reviewed, verifiedPrices: input.pricing.filter((p) => p.verified).length } });
  return data.id;
}

// ───────────────────────── Keywords ─────────────────────────

export const intents: SeoKeywordIntent[] = ["informational", "commercial", "comparison", "transactional", "navigational"];
export const stages: SeoKeywordStage[] = ["idea", "researching", "planned", "writing", "review", "published", "monitoring", "dropped"];
export const pageTypes: SeoPageType[] = ["compare", "alternatives", "solution", "template", "use_case", "blog", "help", "core"];

export interface KeywordFilters { q?: string; cluster?: string; stage?: string; intent?: string; priority?: string }

export async function listKeywords(f: KeywordFilters = {}) {
  let q = ydb().from("seo_keywords").select("*").order("priority").order("cluster").order("keyword").limit(1000);
  if (f.q) q = q.ilike("keyword", `%${f.q.replace(/[%_]/g, "")}%`);
  if (f.cluster) q = q.eq("cluster", f.cluster);
  if (f.stage && (stages as string[]).includes(f.stage)) q = q.eq("stage", f.stage as SeoKeywordStage);
  if (f.intent && (intents as string[]).includes(f.intent)) q = q.eq("intent", f.intent as SeoKeywordIntent);
  if (f.priority && /^[123]$/.test(f.priority)) q = q.eq("priority", Number(f.priority) as 1 | 2 | 3);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export interface KeywordInput {
  id: string | null;
  keyword: string; locale: string; intent: string; cluster: string; pageType: string; priority: number; stage: string; targetPath: string;
  volume: string; volumeSource: string; difficulty: string; difficultySource: string; notes: string; related: string[];
}

export async function saveKeyword(bos: BosUser, i: KeywordInput): Promise<string> {
  const keyword = i.keyword.trim().replace(/\s+/g, " ");
  if (keyword.length < 2) throw new ValidationError("الكلمة مطلوبة.", { keyword: "مطلوب" });
  if (!["en", "ar"].includes(i.locale)) throw new ValidationError("اللغة غير صالحة.");
  if (!(intents as string[]).includes(i.intent)) throw new ValidationError("نية البحث غير صالحة.", { intent: "اختر" });
  if (!(stages as string[]).includes(i.stage)) throw new ValidationError("المرحلة غير صالحة.", { stage: "اختر" });
  if (i.pageType && !(pageTypes as string[]).includes(i.pageType)) throw new ValidationError("نوع الصفحة غير صالح.", { page_type: "اختر" });
  if (i.targetPath && !/^\/(?!\/)\S*$/.test(i.targetPath.trim())) throw new ValidationError("الصفحة المرتبطة مسار داخل الموقع.", { target_path: "/…" });
  const num = (v: string, max?: number) => (v.trim() === "" ? null : Number.isInteger(Number(v)) && Number(v) >= 0 && (!max || Number(v) <= max) ? Number(v) : NaN);
  const volume = num(i.volume);
  const difficulty = num(i.difficulty, 100);
  if (Number.isNaN(volume)) throw new ValidationError("حجم البحث رقم صحيح.", { volume: "رقم" });
  if (Number.isNaN(difficulty)) throw new ValidationError("الصعوبة من 0 إلى 100.", { difficulty: "0 - 100" });
  // A number without its source is a guess presented as data: refused.
  if (volume !== null && !i.volumeSource.trim()) throw new ValidationError("اذكر مصدر حجم البحث (اسم الأداة، أو manual_estimate لتقدير يدوي).", { volume_source: "مطلوب" });
  if (difficulty !== null && !i.difficultySource.trim()) throw new ValidationError("اذكر مصدر الصعوبة.", { difficulty_source: "مطلوب" });
  const row = {
    keyword, locale: i.locale as "en" | "ar", intent: i.intent as SeoKeywordIntent, cluster: i.cluster.trim() || null, page_type: (i.pageType || null) as SeoPageType | null,
    priority: ([1, 2, 3].includes(i.priority) ? i.priority : 2) as 1 | 2 | 3, stage: i.stage as SeoKeywordStage, target_path: i.targetPath.trim() || null,
    volume, volume_source: volume === null ? null : i.volumeSource.trim(), difficulty, difficulty_source: difficulty === null ? null : i.difficultySource.trim(),
    metrics_checked_at: volume !== null || difficulty !== null ? new Date().toISOString() : null,
    notes: i.notes.trim() || null, related: i.related.map((r) => r.trim()).filter(Boolean).slice(0, 30),
    ...(i.id ? {} : { created_by: bos.email }),
  };
  const q = i.id ? ydb().from("seo_keywords").update(row).eq("id", i.id).select("id").maybeSingle() : ydb().from("seo_keywords").insert(row).select("id").single();
  const { data, error } = await q;
  if (error?.code === "23505") throw new ValidationError("الكلمة موجودة بالفعل بنفس اللغة.", { keyword: "مكررة" });
  if (error) throw error;
  if (!data) throw new NotFoundError();
  await audit({ actorId: bos.userId, action: i.id ? "yolias.seo_keyword.update" : "yolias.seo_keyword.create", entityType: "yolias_seo", entityId: null, newValue: { keyword, stage: i.stage } });
  return data.id;
}

export async function deleteKeyword(bos: BosUser, id: string) {
  const { error } = await ydb().from("seo_keywords").delete().eq("id", id);
  if (error) throw error;
  await audit({ actorId: bos.userId, action: "yolias.seo_keyword.delete", entityType: "yolias_seo", entityId: null, metadata: { keyword: id } });
}

/** Keywords whose target page is shared with another keyword of the same intent: possible cannibalisation. */
export function sharedTargets(rows: { keyword: string; target_path: string | null; intent: string; stage: string }[]): Map<string, string[]> {
  const by = new Map<string, string[]>();
  for (const r of rows) if (r.target_path && r.stage !== "dropped") by.set(r.target_path, [...(by.get(r.target_path) ?? []), r.keyword]);
  return new Map([...by].filter(([, v]) => v.length > 1));
}

// ───────────────────────── Redirects ─────────────────────────

export async function listRedirects() {
  const { data, error } = await ydb().from("seo_redirects").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function saveRedirect(bos: BosUser, i: { from: string; to: string; code: number; note: string }) {
  const from = i.from.trim().replace(/\/$/, "");
  const to = i.to.trim();
  if (!/^\/[^?#\s]+$/.test(from)) throw new ValidationError("المسار القديم يبدأ بـ / بدون ? أو #.", { from_path: "/…" });
  if (!/^\/[^#\s]*$/.test(to) || to === from) throw new ValidationError("المسار الجديد مسار داخل الموقع ومختلف عن القديم.", { to_path: "/…" });
  if (/^\/(api|auth|admin|_next)(\/|$)/.test(from)) throw new ValidationError("لا يمكن تحويل مسارات النظام.", { from_path: "غير مسموح" });
  const code = [301, 302, 307, 308].includes(i.code) ? (i.code as 301 | 302 | 307 | 308) : 308;
  // No chains: a redirect never points at another redirect.
  const { data: chain } = await ydb().from("seo_redirects").select("from_path").eq("from_path", to).eq("active", true).maybeSingle();
  if (chain) throw new ValidationError("المسار الجديد نفسه محوَّل: وجّه مباشرة إلى الصفحة النهائية.", { to_path: "سلسلة تحويلات" });
  const { error } = await ydb().from("seo_redirects").upsert({ from_path: from, to_path: to, status_code: code, active: true, note: i.note.trim() || null, created_by: bos.email }, { onConflict: "from_path" });
  if (error) throw error;
  await audit({ actorId: bos.userId, action: "yolias.seo_redirect.save", entityType: "yolias_seo", entityId: null, newValue: { from, to, code } });
}

export async function setRedirectActive(bos: BosUser, id: string, active: boolean) {
  const { error } = await ydb().from("seo_redirects").update({ active }).eq("id", id);
  if (error) throw error;
  await audit({ actorId: bos.userId, action: "yolias.seo_redirect.active", entityType: "yolias_seo", entityId: null, newValue: { id, active } });
}
