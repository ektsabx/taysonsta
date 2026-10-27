import { test } from "node:test";
import assert from "node:assert/strict";
import { formatCompare, formatFaq, formatLinks, formatSteps, normKeyword, parseCompare, parseFaq, parseLinks, parseSteps } from "@/lib/yolias/seo-pages";
import { period } from "@/services/yolias/seo/metrics";
import { pathOf } from "@/services/yolias/seo/google";

// Admin → SEO editor formats and number helpers (D-257).

test("FAQ lines round-trip in both languages, multi-line answers join", () => {
  const faq = parseFaq("Q: One?\nA: First line\nsecond line\n\nQ: No answer?\n\nس: سؤال؟\nج: جواب.");
  assert.deepEqual(faq, [{ q: "One?", a: "First line second line" }, { q: "سؤال؟", a: "جواب." }]);
  assert.deepEqual(parseFaq(formatFaq(faq)), faq);
  assert.deepEqual(parseFaq(formatFaq(faq, true)), faq);
});

test("steps, comparison rows and links", () => {
  const steps = parseSteps("Describe | what you want | with pipes\nCheck");
  assert.deepEqual(steps, [{ title: "Describe", body: "what you want | with pipes" }, { title: "Check", body: "" }]);
  assert.deepEqual(parseSteps(formatSteps(steps)), steps);
  const rows = parseCompare("Price | $5 | $49\nbroken row");
  assert.deepEqual(rows, [{ label: "Price", yolias: "$5", them: "$49" }]);
  assert.deepEqual(parseCompare(formatCompare(rows)), rows);
  const links = parseLinks("/pricing | Pricing | الأسعار\n//evil.example | x | y\nhttps://x.com | x\n/docs | Docs");
  assert.deepEqual(links, { en: [{ path: "/pricing", label: "Pricing" }, { path: "/docs", label: "Docs" }], ar: [{ path: "/pricing", label: "الأسعار" }, { path: "/docs", label: "Docs" }] });
  assert.deepEqual(parseLinks(formatLinks(links)), links);
  assert.equal(normKeyword("  Apollo   Alternatives "), "apollo alternatives");
});

test("periods end two days ago (Search Console lag) and compare with the same length before", () => {
  const p = period(7, Date.parse("2026-10-27T12:00:00Z"));
  assert.deepEqual(p, { days: 7, from: "2026-10-19", to: "2026-10-25", prevFrom: "2026-10-12", prevTo: "2026-10-18" });
  assert.equal(period(13).days, 28, "unknown lengths fall back to 28 days");
  assert.equal(pathOf("https://www.yolias.com/compare/apollo/?x=1"), "/compare/apollo");
  assert.equal(pathOf("https://www.yolias.com/"), "/");
});

test("Google service-account token: a valid RS256 JWT signed with Web Crypto", async () => {
  const { generateKeyPairSync, createVerify } = await import("node:crypto");
  const { signJwt } = await import("@/services/yolias/seo/google");
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  // A key as it appears in a service-account JSON file (escaped newlines).
  const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString().replace(/\n/g, "\\n");
  const jwt = await signJwt({ email: "seo@test.iam.gserviceaccount.com", key: pem, gscProperty: "sc-domain:example.com", ga4Property: null }, "https://www.googleapis.com/auth/webmasters.readonly", 1_800_000_000);
  const [h, b, sig] = jwt.split(".");
  assert.deepEqual(JSON.parse(Buffer.from(h, "base64url").toString()), { alg: "RS256", typ: "JWT" });
  assert.deepEqual(JSON.parse(Buffer.from(b, "base64url").toString()), { iss: "seo@test.iam.gserviceaccount.com", scope: "https://www.googleapis.com/auth/webmasters.readonly", aud: "https://oauth2.googleapis.com/token", iat: 1_800_000_000, exp: 1_800_003_600 });
  assert.ok(createVerify("RSA-SHA256").update(`${h}.${b}`).verify(publicKey, Buffer.from(sig, "base64url")), "signature verifies");
});
