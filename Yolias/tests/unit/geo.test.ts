import { test } from "node:test";
import assert from "node:assert/strict";
import { countryFromAcceptLanguage, currencyForCountry, localeForCountry, normalizeCountry } from "../../lib/geo.ts";
import { defaultPlans, pricingCurrency } from "../../lib/plans.ts";
import { formatMoney } from "../../lib/format.ts";

test("country picks the first language", () => {
  assert.equal(localeForCountry("EG"), "ar");
  assert.equal(localeForCountry("SA"), "ar");
  assert.equal(localeForCountry("US"), "en");
  assert.equal(localeForCountry(null), null);
});

test("Egypt pays in EGP, every other country in USD", () => {
  assert.equal(currencyForCountry("EG"), "USD", "D-131: one USD price everywhere");
  assert.equal(currencyForCountry("SA"), "USD");
  assert.equal(currencyForCountry(null), "USD");
});

test("country headers are normalised", () => {
  assert.equal(normalizeCountry(" eg "), "EG");
  assert.equal(normalizeCountry("XX"), null);
  assert.equal(normalizeCountry("EGY"), null);
  assert.equal(countryFromAcceptLanguage("ar-EG,ar;q=0.9,en;q=0.8"), "EG");
  assert.equal(countryFromAcceptLanguage("en;q=0.8"), null);
});

test("Egypt sees USD until every paid plan has an EGP price", () => {
  assert.equal(pricingCurrency("EGP", defaultPlans), "USD");
  const priced = { ...defaultPlans, pro: { ...defaultPlans.pro, priceEgp: 999 }, growth: { ...defaultPlans.growth, priceEgp: 2499 } };
  assert.equal(pricingCurrency("EGP", priced), "EGP");
  assert.equal(pricingCurrency("USD", priced), "USD");
});

test("money keeps its own currency", () => {
  assert.equal(formatMoney(20, "USD"), "$20");
  assert.equal(formatMoney(1000, "EGP").replace(/\s/g, " "), "EGP 1,000");
  assert.equal(formatMoney(20, "USD", true), "$20.00");
});
