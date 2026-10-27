import { test } from "node:test";
import assert from "node:assert/strict";
import { isLocalizedPath, localizedHref, splitLocale } from "../../lib/i18n/paths.ts";

// Language URLs of the website (D-258).
test("website pages get /ar, the app and sign-in keep one URL", () => {
  assert.equal(localizedHref("/pricing", "ar"), "/ar/pricing");
  assert.equal(localizedHref("/", "ar"), "/ar");
  assert.equal(localizedHref("/?x=1", "ar"), "/ar?x=1");
  assert.equal(localizedHref("/compare/apollo#faq", "ar"), "/ar/compare/apollo#faq");
  assert.equal(localizedHref("/ar/pricing", "en"), "/pricing");
  assert.equal(localizedHref("/ar/pricing", "ar"), "/ar/pricing", "never /ar/ar");
  for (const p of ["/signup", "/login", "/prospects", "/start?template=x", "/api/locale", "/r/abc"]) assert.equal(localizedHref(p, "ar"), p, p);
  assert.equal(localizedHref("https://example.com/pricing", "ar"), "https://example.com/pricing");
  assert.equal(localizedHref("//evil.example/pricing", "ar"), "//evil.example/pricing");
  assert.ok(isLocalizedPath("/templates/companies-in-uae") && isLocalizedPath("/partners/terms") && !isLocalizedPath("/pricingx") && !isLocalizedPath("/preview/seo/x"));
});

test("splitting the language from a path", () => {
  assert.deepEqual(splitLocale("/ar"), { locale: "ar", path: "/" });
  assert.deepEqual(splitLocale("/ar/blog/x"), { locale: "ar", path: "/blog/x" });
  assert.deepEqual(splitLocale("/ar?x=1"), { locale: "ar", path: "/?x=1" });
  assert.deepEqual(splitLocale("/arabic-page"), { locale: null, path: "/arabic-page" });
  assert.deepEqual(splitLocale("/pricing"), { locale: null, path: "/pricing" });
});
