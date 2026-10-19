import "server-only";
import { db } from "@/lib/bos/db";
import { audit } from "@/lib/bos/audit";
import { nowIso } from "@/lib/bos/clock";
import type { BosUser } from "@/lib/bos/auth";
import { yoliasSiteUrl } from "@/lib/yolias/db";

// The support AI agent learns Yolias (owner brief 2026-10-19): everything the
// Yolias website says publicly — help center, docs, blog guides, legal pages,
// plans and prices, the free trial, the affiliate program and its terms, the
// community, solutions and use cases — comes from the Yolias feed
// (Yolias/lib/knowledge.ts, GET /api/knowledge) and is kept as published,
// customer-facing, AI-allowed articles in one category ("Yolias platform").
// A sync replaces their text, adds new pages and archives pages that are gone.
// Articles written by hand are never touched (only slugs starting "yolias-").

export const YOLIAS_KB_CATEGORY = "yolias-platform";
const PREFIX = "yolias-";

interface FeedItem { key: string; kind: string; language: "en" | "ar"; title: string; url: string; content: string }

const slugFor = (key: string) => (PREFIX + key.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")).slice(0, 120);

export type SyncResult = { ok: true; added: number; updated: number; archived: number; total: number } | { ok: false; error: string };

export async function syncYoliasKnowledge(actor: Pick<BosUser, "userId"> | null): Promise<SyncResult> {
  let items: FeedItem[];
  try {
    const res = await fetch(`${yoliasSiteUrl()}/api/knowledge`, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return { ok: false, error: `تعذر قراءة محتوى Yolias (HTTP ${res.status})` };
    const body = (await res.json()) as { items?: FeedItem[] };
    items = (body.items ?? []).filter((i) => i && typeof i.key === "string" && typeof i.title === "string" && typeof i.content === "string" && (i.language === "en" || i.language === "ar"));
  } catch {
    return { ok: false, error: "تعذر الاتصال بموقع Yolias" };
  }
  if (!items.length) return { ok: false, error: "لم يرجع موقع Yolias أي محتوى" };

  const category = await ensureCategory();
  const { data: existing } = await db().from("kb_articles").select("id, slug, title, content, status").like("slug", `${PREFIX}%`);
  const bySlug = new Map((existing ?? []).map((a) => [a.slug, a]));
  const seen = new Set<string>();
  let added = 0, updated = 0, archived = 0;
  const now = nowIso();

  for (const item of items) {
    const slug = slugFor(item.key);
    seen.add(slug);
    const content = `${item.content}\n\nSource: ${item.url}`.slice(0, 200_000);
    const title = item.title.slice(0, 200);
    const row = bySlug.get(slug);
    if (!row) {
      const { error } = await db().from("kb_articles").insert({
        kind: "documentation", slug, title, content, category_id: category, tags: ["yolias", item.kind], status: "published", published_at: now,
        language: item.language, audience: "public", ai_allowed: true,
      } as never);
      if (!error) added++;
    } else if (row.title !== title || row.content !== content || row.status !== "published") {
      const { error } = await db().from("kb_articles").update({ title, content, status: "published", category_id: category, audience: "public", ai_allowed: true, updated_at: now } as never).eq("id", row.id);
      if (!error) updated++;
    }
  }
  for (const [slug, row] of bySlug) {
    if (seen.has(slug) || row.status === "archived") continue;
    const { error } = await db().from("kb_articles").update({ status: "archived", updated_at: now } as never).eq("id", row.id);
    if (!error) archived++;
  }

  // Agents limited to some categories also get this one, so they can use it.
  const { data: agents } = await db().from("ai_agents").select("id, kb_category_ids");
  for (const a of agents ?? []) {
    const ids = (a.kb_category_ids ?? []) as string[];
    if (ids.length && !ids.includes(category)) await db().from("ai_agents").update({ kb_category_ids: [...ids, category] } as never).eq("id", a.id);
  }

  await audit({ actorId: actor?.userId ?? null, actorType: actor ? "user" : "system", action: "knowledge.yolias_sync", entityType: "kb_category", entityId: category as string, newValue: { added, updated, archived, total: items.length } });
  return { ok: true, added, updated, archived, total: items.length };
}

async function ensureCategory(): Promise<string> {
  const { data } = await db().from("kb_categories").select("id").eq("key", YOLIAS_KB_CATEGORY).maybeSingle();
  if (data) return data.id;
  const { data: made, error } = await db().from("kb_categories").insert({ key: YOLIAS_KB_CATEGORY, name: "Yolias platform", sort_order: 0 } as never).select("id").single();
  if (error || !made) throw new Error("kb category");
  return made.id;
}
