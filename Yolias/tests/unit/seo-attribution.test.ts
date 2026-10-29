import { test } from "node:test";
import assert from "node:assert/strict";
import { classify, decodeFirstTouch, encodeFirstTouch, firstTouch, isLandingPath } from "../../lib/attribution.ts";
import { safePath, toCompetitor, toSeoPage } from "../../lib/content/seo-pages.ts";

// Sign-up attribution and SEO page parsing (D-257).
const self = ["www.yolias.com", "yolias.com"];
const ft = (path: string, ref: string | null) => firstTouch(new URL(`https://www.yolias.com${path}`), ref, 1_700_000_000_000);

test("first touch keeps the path, the referring host and UTM tags, never the full referrer", () => {
  const t = ft("/compare/apollo?utm_source=Google&utm_medium=cpc&utm_campaign=Brand+1&x=secret", "https://www.google.com/search?q=private+words");
  assert.deepEqual(t, { l: "/compare/apollo", r: "www.google.com", us: "google", um: "cpc", uc: "brand 1", ck: undefined, t: 1_700_000_000 });
  assert.deepEqual(decodeFirstTouch(encodeFirstTouch(t)), t);
  assert.equal(decodeFirstTouch("not base64 json"), null);
  assert.equal(decodeFirstTouch(encodeFirstTouch({ ...t, l: "https://evil.example" })), null, "a path only");
});

test("channels", () => {
  const ch = (path: string, ref: string | null) => classify(ft(path, ref), self);
  assert.deepEqual(ch("/compare/apollo", "https://www.google.com.eg/"), { channel: "organic_search", engine: "google" });
  assert.deepEqual(ch("/", "https://www.bing.com/"), { channel: "organic_search", engine: "bing" });
  assert.equal(ch("/?gclid=abc", "https://www.google.com/").channel, "paid_search");
  assert.equal(ch("/?utm_medium=cpc&utm_source=google", null).channel, "paid_search");
  assert.deepEqual(ch("/", "https://chatgpt.com/"), { channel: "ai_assistant", engine: "chatgpt" });
  assert.deepEqual(ch("/", "https://gemini.google.com/app"), { channel: "ai_assistant", engine: "gemini" }, "Gemini isn't Google search");
  assert.equal(ch("/", "https://l.facebook.com/").channel, "social");
  assert.equal(ch("/", "https://mail.google.com/").channel, "email", "webmail isn't Google search");
  assert.equal(ch("/r/abc", "https://www.google.com/").channel, "affiliate", "a referral link wins");
  assert.equal(ch("/pricing", "https://www.yolias.com/").channel, "direct", "an internal referrer is direct");
  assert.equal(ch("/", "https://news.example.org/post").channel, "referral");
  assert.equal(ch("/", null).channel, "direct");
  assert.equal(classify(null, self).channel, "unknown");
});

test("only public website pages are landing pages", () => {
  for (const p of ["/", "/compare/apollo", "/templates/companies-in-uae", "/pricing", "/r/abc"]) assert.ok(isLandingPath(p), p);
  for (const p of ["/api/funnel", "/login", "/prospects", "/preview/seo/x", "/start", "/brand/logo.png", "/_next/static/x.js"]) assert.ok(!isLandingPath(p), p);
});

const doc = (title: string) => ({ title, summary: "Lead", blocks: [{ p: "Body" }] });
const row = (over: Record<string, unknown> = {}) => ({ id: "1", kind: "compare", slug: "apollo", updated_at: "2026-10-27", published_at: null, doc: { en: doc("Yolias vs Apollo"), ar: doc("يولياس مقابل Apollo") }, seo: {}, meta: {}, ...over });

test("SEO pages: malformed rows never reach a page, unsafe links are dropped", () => {
  assert.equal(toSeoPage(row({ kind: "help" })), null, "not an SEO kind");
  assert.equal(toSeoPage(row({ doc: { en: doc("x") } })), null, "both languages required");
  const p = toSeoPage(row({ meta: { competitor: "apollo", links: { en: [{ path: "javascript:alert(1)", label: "x" }, { path: "//evil.example", label: "y" }, { path: "/pricing", label: "Pricing" }], ar: [] }, faq: { en: [{ q: "Q", a: "" }, { q: "Q2", a: "A2" }], ar: [] } }, seo: { canonical: "/compare/apollo", robots: "noindex", meta_title: { en: "  T  " } } }))!;
  assert.deepEqual(p.copy.en.links, [{ path: "/pricing", label: "Pricing" }]);
  assert.deepEqual(p.copy.en.faq, [{ q: "Q2", a: "A2" }], "a question without an answer is left out");
  assert.equal(p.canonical, null, "a canonical to itself is no canonical");
  assert.equal(p.noindex, true);
  assert.equal(p.copy.en.metaTitle, "T");
  assert.equal(p.copy.en.h1, "Yolias vs Apollo", "H1 falls back to the page name");
  assert.equal(p.path, "/compare/apollo");
  assert.equal(safePath("/a?b=1#c"), "/a?b=1#c");
  assert.equal(safePath("https://x.com"), null);
});

test("competitors: only verified prices with a source and a date are shown", () => {
  const c = toCompetitor({ slug: "x", name: "X", website: "https://x.com", pricing_url: null, summary: { en: "S" }, best_for: {}, strengths: { en: ["a", 1, ""] }, limits: {}, publishes_prices: true, last_reviewed_at: null, pricing: [
    { plan: "A", price: "$1", period: "month", source_url: "https://x.com/p", checked_at: "2026-10-26", verified: true },
    { plan: "B", price: "$2", period: "month", source_url: "https://x.com/p", checked_at: "2026-10-26", verified: false },
    { plan: "C", price: "$3", period: "month", source_url: "", checked_at: "2026-10-26", verified: true },
  ] }, "en");
  assert.deepEqual(c.prices.map((p) => p.plan), ["A"]);
  assert.deepEqual(c.strengths, ["a"]);
});
