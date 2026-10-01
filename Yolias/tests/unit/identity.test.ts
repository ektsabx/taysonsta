import { test } from "node:test";
import assert from "node:assert/strict";
import { isStale, linkedinKey, normalizeEmail, normalizeName, personMatch, registrableDomain } from "../../lib/intel/identity.ts";

test("registrable domain (eTLD+1)", () => {
  assert.equal(registrableDomain("https://www.Shop.Example.com.sa/about?x=1"), "example.com.sa");
  assert.equal(registrableDomain("blog.acme.io"), "acme.io");
  assert.equal(registrableDomain("acme.co.uk"), "acme.co.uk");
  assert.equal(registrableDomain("http://sub.acme.com.eg:8080/x"), "acme.com.eg");
  assert.equal(registrableDomain("mailto:ceo@acme.ae"), "acme.ae");
  assert.equal(registrableDomain("not a domain"), null);
  assert.equal(registrableDomain("10.0.0.1"), null);
  assert.equal(registrableDomain(""), null);
});

test("linkedin key", () => {
  assert.equal(linkedinKey("https://www.LinkedIn.com/in/Sara-Ali/?trk=x"), "linkedin.com/in/sara-ali");
  assert.equal(linkedinKey("linkedin.com/company/acme/"), "linkedin.com/company/acme");
  assert.equal(linkedinKey("https://x.com/sara"), null);
});

test("names and emails normalise across case, accents and Arabic variants", () => {
  assert.equal(normalizeName("  José  Ãlvarez-Ruiz "), "jose alvarez ruiz");
  assert.equal(normalizeName("أحمد  عبدالله"), normalizeName("احمد عبدالله"));
  assert.equal(normalizeName("فاطمة"), normalizeName("فاطمه"));
  assert.equal(normalizeEmail(" CEO@Acme.COM "), "ceo@acme.com");
  assert.equal(normalizeEmail("nope"), null);
});

test("person match: identifiers win; different LinkedIn with same name is only a possible duplicate", () => {
  const base = { linkedin: null, name: "sara ali", companyId: "c1", email: null };
  assert.equal(personMatch({ ...base, linkedin: "a" }, { ...base, linkedin: "a" }), "same");
  assert.equal(personMatch({ ...base, linkedin: "a" }, { ...base, linkedin: "b" }), "possible_duplicate");
  assert.equal(personMatch({ ...base, linkedin: "a", name: "x" }, { ...base, linkedin: "b" }), "different");
  assert.equal(personMatch({ ...base, email: "s@a.com" }, { ...base, companyId: "c2", email: "s@a.com" }), "same");
  assert.equal(personMatch(base, { ...base }), "same");
  assert.equal(personMatch(base, { ...base, companyId: "c2" }), "different");
});

test("freshness", () => {
  const now = new Date("2026-10-01T00:00:00Z");
  assert.equal(isStale("2026-09-25T00:00:00Z", 7, now), false);
  assert.equal(isStale("2026-09-20T00:00:00Z", 7, now), true);
  assert.equal(isStale(null, 7, now), true);
});
