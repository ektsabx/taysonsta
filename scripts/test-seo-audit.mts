// Page audit (D-265): npx tsx scripts/test-seo-audit.mts
import assert from "node:assert/strict";
import { auditPage, crossPageIssues } from "../services/yolias/seo/page-audit";

const base = "https://www.yolias.com";
const words = (n: number, w = "lead") => Array.from({ length: n }, (_, i) => `${w}${i % 50}`).join(" ");
const page = (o: { lang?: string; title?: string; desc?: string; canonical?: string; body?: string; jsonld?: string; hreflang?: boolean }) => `<!doctype html><html lang="${o.lang ?? "en"}"><head>
<title>${o.title ?? "Find B2B customers with AI | Yolias"}</title>
<meta name="description" content="${o.desc ?? "Describe your ideal customer and Yolias finds matching companies and decision makers for you."}"/>
<link rel="canonical" href="${o.canonical ?? base + "/product"}"/>
${o.hreflang === false ? "" : `<link rel="alternate" hrefLang="en" href="${base}/product"/><link rel="alternate" hrefLang="ar" href="${base}/ar/product"/><link rel="alternate" hrefLang="x-default" href="${base}/product"/>`}
<script type="application/ld+json">${o.jsonld ?? '{"@type":"WebPage"}'}</script></head>
<body><header>nav words</header><main><h1>Title</h1><p>${o.body ?? words(400)}</p></main><footer>foot</footer></body></html>`;

const ok = auditPage("/product", page({}), base);
assert.deepEqual(ok.issues, [], "a good page has no issues");
assert.ok(ok.words >= 400);

const bad = auditPage("/ar/product", page({ title: "x", desc: "", canonical: base + "/product", jsonld: "{bad", hreflang: false, body: words(100) + " يولـياس" }), base);
for (const i of ["short_title", "no_description", "wrong_lang", "canonical_not_self", "no_hreflang", "invalid_jsonld", "thin", "not_arabic", "brand_spelling"] as const) assert.ok(bad.issues.includes(i), i);

const help = auditPage("/help-center/x", page({ canonical: base + "/help-center/x", body: words(60) }), base);
assert.ok(!help.issues.includes("thin"), "help pages may be short");

const a = auditPage("/compare/a", page({ canonical: base + "/compare/a", title: "Same title for two pages | Yolias" }), base);
const b = auditPage("/compare/b", page({ canonical: base + "/compare/b", title: "Same title for two pages | Yolias" }), base);
const c = auditPage("/compare/c", page({ canonical: base + "/compare/c", title: "A third distinct page title | Yolias", body: words(400, "other") }), base);
crossPageIssues([a, b, c]);
assert.ok(a.issues.includes("duplicate_title") && a.issues.includes("near_duplicate") && a.similar?.path === "/compare/b");
assert.ok(!c.issues.includes("near_duplicate") && !c.issues.includes("duplicate_title"));
assert.equal(a.sig, undefined, "signatures aren't kept");
console.log("✓ page audit");
