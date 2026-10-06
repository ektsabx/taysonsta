import { test } from "node:test";
import assert from "node:assert/strict";
import { countryFromAcceptLanguage, localeForCountry, normalizeCountry } from "../../lib/geo.ts";
import { defaultPlans, planPrice } from "../../lib/plans.ts";
import { formatMoney } from "../../lib/format.ts";

test("country picks the first language", () => {
  assert.equal(localeForCountry("EG"), "ar");
  assert.equal(localeForCountry("SA"), "ar");
  assert.equal(localeForCountry("US"), "en");
  assert.equal(localeForCountry(null), null);
});

test("country headers are normalised", () => {
  assert.equal(normalizeCountry(" eg "), "EG");
  assert.equal(normalizeCountry("XX"), null);
  assert.equal(normalizeCountry("EGY"), null);
  assert.equal(countryFromAcceptLanguage("ar-EG,ar;q=0.9,en;q=0.8"), "EG");
  assert.equal(countryFromAcceptLanguage("en;q=0.8"), null);
});

test("one USD price for every country (D-131)", () => {
  assert.equal(planPrice(defaultPlans.pro, "USD"), 20);
});

test("money is shown in USD", () => {
  assert.equal(formatMoney(20, "USD"), "$20");
  assert.equal(formatMoney(20, "USD", true), "$20.00");
});
