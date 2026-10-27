// SEO Control Center (D-257): pages, keywords, competitors and redirects
// against the LOCAL Yolias database, and what the local Yolias site shows.
// Run with the Yolias variables pointing to the local stack, e.g.
//   YOLIAS_SUPABASE_URL=<Yolias/.env.local NEXT_PUBLIC_SUPABASE_URL> \
//   YOLIAS_SUPABASE_SERVICE_ROLE_KEY=<Yolias/.env.local SUPABASE_SERVICE_ROLE_KEY> \
//   YOLIAS_SITE_URL=http://localhost:3201 npm run test:integration -- tests/integration/seo.test.ts
// (the root .env.local points the Admin at production Yolias: never run there).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { ydb } from "@/lib/yolias/db";
import { emptyMeta, type SeoFields } from "@/lib/yolias/seo-pages";
import { getSeoPage, keywordConflicts, listRevisions, previewUrl, publishDuePages, restoreRevision, saveSeoPage, setSeoStatus, type SeoPageInput } from "@/services/yolias/seo/pages";
import { saveKeyword, saveRedirect, parsePrices } from "@/services/yolias/seo/catalog";
import { bosUserFor, uniq } from "./helpers";

const site = (process.env.YOLIAS_SITE_URL ?? "").replace(/\/$/, "");
const slug = uniq("seo-test").toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 40);
const keyword = `test keyword ${slug}`;
const ids: string[] = [];
let bos: Awaited<ReturnType<typeof bosUserFor>>;

const seo: SeoFields = { meta_title: { en: "Test page title", ar: "عنوان صفحة الاختبار" }, meta_description: { en: "A test description for the SEO page.", ar: "وصف تجريبي لصفحة SEO." }, h1: { en: "Test H1", ar: "عنوان رئيسي تجريبي" }, robots: "index", schema: "auto" };
const input = (over: Partial<SeoPageInput> = {}): SeoPageInput => ({
  id: null, kind: "template", slug, status: "draft", scheduledAt: null, sort: 0, primaryKeyword: keyword, secondaryKeywords: ["one", "two"],
  meta: { ...emptyMeta(), prompt: { en: "Find test companies in Cairo.", ar: "اعثر على شركات تجريبية في القاهرة." }, faq: { en: [{ q: "Is this a test?", a: "Yes." }], ar: [{ q: "هل هذا اختبار؟", a: "نعم." }] }, origin: "human" },
  seo, en: { title: "Test template", summary: "Lead text.", body: "## Section\n\nBody text." }, ar: { title: "قالب تجريبي", summary: "نص افتتاحي.", body: "## قسم\n\nنص." }, ...over,
});

before(async () => {
  assert.match(process.env.YOLIAS_SUPABASE_URL ?? "", /127\.0\.0\.1|localhost/, "the Yolias database must be local");
  bos = await bosUserFor("admin@taysonsta.local");
});
after(async () => {
  if (ids.length) await ydb().from("content_entries").delete().in("id", ids);
  await ydb().from("seo_redirects").delete().like("from_path", `%${slug}%`);
  await ydb().from("seo_keywords").delete().like("keyword", `%${slug}%`);
});

test("seo: a draft is saved, kept off the site, previewed with a signed link, then published", async () => {
  const id = await saveSeoPage(bos, input());
  ids.push(id);
  const row = await getSeoPage(id);
  assert.equal(row.status, "draft");
  assert.equal((await listRevisions(id)).length, 1, "every save keeps a revision");
  if (site) {
    assert.equal((await fetch(`${site}/templates/${slug}`)).status, 404, "a draft isn't public");
    const pv = previewUrl(id)!.replace(/^https?:\/\/[^/]+/, site);
    const html = await (await fetch(pv)).text();
    assert.match(html, /Test H1|عنوان رئيسي تجريبي/, "the signed preview shows the draft");
    assert.match(html, /<meta name="robots" content="noindex/, "the preview is never indexed");
    assert.equal((await fetch(pv.replace(/sig=[0-9a-f]+/, "sig=" + "0".repeat(64)))).status, 404, "a wrong signature shows nothing");
  }
  await setSeoStatus(bos, id, "published");
  if (site) {
    const res = await fetch(`${site}/templates/${slug}`, { headers: { cookie: "yolias_locale=en" } });
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /<title>Test page title \| Yolias<\/title>/);
    assert.match(html, new RegExp(`<link rel="canonical" href="[^"]*/templates/${slug}"`));
    assert.match(html, /"@type":"FAQPage"/, "FAQ structured data from the visible FAQ");
    assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 1);
    assert.match(await (await fetch(`${site}/sitemap.xml`)).text(), new RegExp(`/templates/${slug}<`), "published pages join the sitemap");
  }
});

test("seo: two live pages can't target the same main keyword", async () => {
  assert.ok((await keywordConflicts(keyword, null, "/compare/other")).length > 0);
  await assert.rejects(saveSeoPage(bos, input({ slug: `${slug}-b` })), /نفس الكلمة/);
  const id = await saveSeoPage(bos, input({ slug: `${slug}-b`, primaryKeyword: `${keyword} b` }));
  ids.push(id);
});

test("seo: a published page that changes address leaves a redirect, and an edit can be undone", async () => {
  const id = ids[0];
  await saveSeoPage(bos, input({ id, slug: `${slug}-new`, status: "published", en: { title: "Renamed", summary: "Lead text.", body: "Body." } }));
  const { data: r } = await ydb().from("seo_redirects").select("to_path, status_code").eq("from_path", `/templates/${slug}`).single();
  assert.equal(r!.to_path, `/templates/${slug}-new`);
  if (site) {
    await new Promise((ok) => setTimeout(ok, 500));
    // The front door caches redirects for five minutes; a fresh dev server may still serve the old list.
    const res = await fetch(`${site}/templates/${slug}`, { redirect: "manual" });
    assert.ok([308, 404].includes(res.status), `old address: ${res.status}`);
  }
  const revs = await listRevisions(id);
  const first = revs[revs.length - 1];
  await restoreRevision(bos, id, first.id);
  assert.equal((await getSeoPage(id)).doc.en.title, "Test template", "the first version is back");
  await assert.rejects(saveRedirect(bos, { from: `/x-${slug}`, to: `/templates/${slug}`, code: 308, note: "" }), /محوَّل/, "no redirect chains");
});

test("seo: scheduled pages go live at their time", async () => {
  const id = await saveSeoPage(bos, input({ slug: `${slug}-s`, primaryKeyword: `${keyword} s`, status: "scheduled", scheduledAt: new Date(Date.now() + 60_000).toISOString() }));
  ids.push(id);
  await assert.rejects(saveSeoPage(bos, input({ id, slug: `${slug}-s`, primaryKeyword: `${keyword} s`, status: "scheduled", scheduledAt: new Date(Date.now() - 3_600_000).toISOString() })), /المستقبل/);
  await ydb().from("content_entries").update({ scheduled_at: new Date(Date.now() - 1000).toISOString() }).eq("id", id);
  assert.ok((await publishDuePages()) >= 1);
  assert.equal((await getSeoPage(id)).status, "published");
});

test("seo: keyword numbers need their source, prices need source and date", async () => {
  const base = { id: null, keyword: `kw ${slug}`, locale: "en", intent: "commercial", cluster: "test", pageType: "template", priority: 2, stage: "idea", targetPath: "", volume: "", volumeSource: "", difficulty: "", difficultySource: "", notes: "", related: [] };
  await assert.rejects(saveKeyword(bos, { ...base, volume: "500" }), /مصدر/);
  await saveKeyword(bos, { ...base, volume: "500", volumeSource: "manual_estimate" });
  const { data } = await ydb().from("seo_keywords").select("volume, volume_source").eq("keyword", `kw ${slug}`).single();
  assert.deepEqual(data, { volume: 500, volume_source: "manual_estimate" });
  assert.throws(() => parsePrices("Pro | $49 | month"), /المصدر/);
  assert.equal(parsePrices("Pro | $49 | month | https://example.com/pricing | 2026-10-26 | verified")[0].verified, true);
});
