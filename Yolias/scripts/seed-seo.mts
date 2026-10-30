// The first SEO content (D-257): competitors with their sources, the keyword
// plan, and 23 pages (comparisons, alternatives, audiences, templates),
// published with the owner's approval (2026-10-27). Idempotent: rows that
// exist (by slug / keyword) are never overwritten, so Admin edits are kept.
//   npm run seo:seed               (local database)
//   npm run seo:seed:production    (production, after the migration)
import { createClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database.ts";
import { competitors } from "./seo-seed/competitors.ts";
import { keywords } from "./seo-seed/keywords.ts";
import { comparePages } from "./seo-seed/pages-compare.ts";
import { alternativesPages, listPages } from "./seo-seed/pages-alternatives.ts";
import { solutionPages } from "./seo-seed/pages-solutions.ts";
import { templatePages } from "./seo-seed/pages-templates.ts";
import { meetingAlternativesPages, meetingComparePages, meetingSolutionPages } from "./seo-seed/pages-meetings.ts";
import { toRow } from "./seo-seed/types.ts";

const db = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const j = (x: unknown) => x as Json;

const c = await db.from("seo_competitors").upsert(competitors.map((x) => ({ ...x, last_reviewed_at: "2026-10-27T00:00:00Z", reviewed_by: "seo-seed", summary: j(x.summary), best_for: j(x.best_for), strengths: j(x.strengths), limits: j(x.limits), facts: j(x.facts), pricing: j(x.pricing) })), { onConflict: "slug", ignoreDuplicates: true }).select("id");
if (c.error) throw c.error;

const pages = [...listPages, ...comparePages, ...meetingComparePages, ...alternativesPages, ...meetingAlternativesPages, ...solutionPages, ...meetingSolutionPages, ...templatePages];
const rows = pages.map((p, i) => toRow(p, i)).map((r) => ({ ...r, doc: j(r.doc), seo: j(r.seo), meta: j(r.meta) }));
const p = await db.from("content_entries").upsert(rows, { onConflict: "kind,slug", ignoreDuplicates: true }).select("id");
if (p.error) throw p.error;

// Comparison pages written against each competitor (owner, 2026-10-28): pages
// still as the seed left them (updated_by "seo-seed") get the new table and
// "What Yolias doesn't do"; a page edited in Admin is left alone.
let refreshed = 0;
// Every seeded page still as the seed left it follows the product (D-268: no CRM, meetings).
for (const r of rows) {
  const u = await db.from("content_entries").update({ doc: r.doc, meta: r.meta, seo: r.seo, updated_at: new Date().toISOString() }).eq("kind", r.kind).eq("slug", r.slug).eq("updated_by", "seo-seed").select("id");
  if (u.error) throw u.error;
  refreshed += u.data?.length ?? 0;
}
console.log(`SEO seed: ${refreshed} seeded pages refreshed.`);

const { data: existing } = await db.from("seo_keywords").select("keyword, locale");
const have = new Set((existing ?? []).map((k) => `${k.locale}:${k.keyword.toLowerCase()}`));
const fresh = keywords.filter((k) => !have.has(`${k.locale ?? "en"}:${k.keyword.toLowerCase()}`)).map((k) => ({ ...k, locale: k.locale ?? "en", related: k.related ?? [], created_by: "seo-seed" }));
if (fresh.length) {
  const k = await db.from("seo_keywords").insert(fresh);
  if (k.error) throw k.error;
}
console.log(`SEO seed: ${c.data?.length ?? 0} new competitors, ${p.data?.length ?? 0} new pages (of ${pages.length}), ${fresh.length} new keywords.`);
