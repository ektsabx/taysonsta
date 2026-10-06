// Copies the website content shipped in code (Help Center, Docs, Blog,
// legal) into content_entries as published rows, so Yolias Admin can edit
// all of it. Idempotent: rows edited in Yolias Admin are never overwritten;
// rows still exactly as seeded follow the code's latest version.
//   npm run content:seed
import { createClient } from "@supabase/supabase-js";
import { articles } from "@/lib/content/help.ts";
import { docs } from "@/lib/content/docs.ts";
import { posts } from "@/lib/content/blog.ts";
import { legal, legalSlugs } from "@/lib/content/legal.ts";
import type { Database, Json } from "@/types/database.ts";

const db = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const now = new Date().toISOString();
const rows = [
  ...articles.map((a, i) => ({ kind: "help" as const, slug: a.slug, meta: { collection: a.collection }, doc: a.doc, sort: i })),
  ...docs.map((d, i) => ({ kind: "docs" as const, slug: d.slug, meta: { group: d.group }, doc: d.doc, sort: i })),
  ...posts.map((p, i) => ({ kind: "blog" as const, slug: p.slug, meta: { date: p.date, category: p.category }, doc: p.doc, sort: i })),
  ...legalSlugs.map((s, i) => ({ kind: "legal" as const, slug: s, meta: {}, doc: legal[s], sort: i })),
].map((r) => ({ ...r, meta: r.meta as unknown as Json, doc: r.doc as unknown as Json, status: "published" as const, published_at: now, updated_by: "seed" }));

const { data, error } = await db.from("content_entries").upsert(rows, { onConflict: "kind,slug", ignoreDuplicates: true }).select("id");
if (error) throw error;
// jsonb doesn't keep key order: compare with keys sorted.
const canon = (v: unknown): string => JSON.stringify(v, (_k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1))) : x));
let refreshed = 0;
const { data: seeded } = await db.from("content_entries").select("kind, slug, doc, meta").eq("updated_by", "seed");
for (const r of rows) {
  const cur = seeded?.find((x) => x.kind === r.kind && x.slug === r.slug);
  if (!cur || (canon(cur.doc) === canon(r.doc) && canon(cur.meta) === canon(r.meta))) continue;
  const { error: e } = await db.from("content_entries").update({ doc: r.doc, meta: r.meta }).eq("kind", r.kind).eq("slug", r.slug).eq("updated_by", "seed");
  if (e) throw e;
  refreshed++;
}
console.log(`content: ${data?.length ?? 0} new, ${refreshed} refreshed of ${rows.length}`);
