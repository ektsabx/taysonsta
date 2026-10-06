// Copies the website content shipped in code (Help Center, Docs, Blog,
// legal) into content_entries as published rows, so Yolias Admin can edit
// all of it. Idempotent: rows that already exist are never overwritten.
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
console.log(`content: ${data?.length ?? 0} new of ${rows.length}`);
