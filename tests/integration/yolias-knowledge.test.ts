// Support AI agent ← Yolias website content (owner brief 2026-10-19,
// services/bos/yolias-knowledge.ts). Needs the local Yolias app running
// (YOLIAS_SITE_URL, e.g. http://localhost:3201) and the local Admin DB.
import { test } from "node:test";
import assert from "node:assert/strict";
import { db } from "@/lib/bos/db";
import { retrieveKb } from "@/services/bos/ai-agents";
import { syncYoliasKnowledge, YOLIAS_KB_CATEGORY } from "@/services/bos/yolias-knowledge";

test("yolias knowledge: sync adds published, AI-allowed articles the agent finds", async () => {
  assert.match(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", /127\.0\.0\.1|localhost/, "local Admin database only");
  const first = await syncYoliasKnowledge(null);
  assert.ok(first.ok, first.ok ? "" : first.error);
  assert.ok(first.total > 50, "every public page in both languages");

  const { data: cat } = await db().from("kb_categories").select("id").eq("key", YOLIAS_KB_CATEGORY).single();
  const { data: rows } = await db().from("kb_articles").select("slug, status, audience, ai_allowed, language, category_id").like("slug", "yolias-%");
  assert.equal(rows!.filter((r) => r.status === "published").length, first.total);
  assert.ok(rows!.every((r) => r.status !== "published" || (r.audience === "public" && r.ai_allowed && r.category_id === cat!.id)));
  assert.ok(rows!.some((r) => r.language === "ar") && rows!.some((r) => r.language === "en"));

  // A second sync changes nothing.
  const again = await syncYoliasKnowledge(null);
  assert.ok(again.ok && again.added === 0 && again.updated === 0 && again.archived === 0);

  // The agent's retrieval finds pricing and the partner terms.
  const pricing = await retrieveKb({ kb_category_ids: [] }, "annual months free price plan", "en");
  assert.ok(pricing.some((a) => a.slug.startsWith("yolias-pricing")), "pricing found");
  const terms = await retrieveKb({ kb_category_ids: [] }, "عمولة السحب الحد الأدنى", "ar");
  assert.ok(terms.some((a) => a.slug.startsWith("yolias-affiliates")), "partner terms found in Arabic");
});
