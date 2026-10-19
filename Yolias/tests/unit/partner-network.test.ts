import { test } from "node:test";
import assert from "node:assert/strict";
import { partnerTier, successRate, isPartnerRole } from "../../lib/affiliates/directory.ts";
import { flagEmoji, isCountryCode } from "../../lib/country-codes.ts";
import { parseTrial } from "../../lib/trial.ts";

test("partner network: level follows paying customers", () => {
  assert.equal(partnerTier(0), "partner");
  assert.equal(partnerTier(2), "partner");
  assert.equal(partnerTier(3), "silver");
  assert.equal(partnerTier(10), "gold");
  assert.equal(partnerTier(25), "platinum");
});

test("partner network: success rate only from 5 referrals, capped at 100%", () => {
  assert.equal(successRate(4, 4), null);
  assert.equal(successRate(5, 1), 20);
  assert.equal(successRate(8, 3), 38);
  assert.equal(successRate(5, 9), 100);
});

test("partner network: roles and countries are checked", () => {
  assert.equal(isPartnerRole("creator"), true);
  assert.equal(isPartnerRole("admin"), false);
  assert.equal(isCountryCode("EG"), true);
  assert.equal(isCountryCode("XX"), false);
  assert.equal(isCountryCode("eg"), false);
  assert.equal(flagEmoji("EG"), "🇪🇬");
});

test("trial: claim window is configuration (default 0 = no limit)", () => {
  assert.equal(parseTrial(null).claim_hours, 0);
  assert.equal(parseTrial({ claim_hours: 0 }).claim_hours, 0);
  assert.equal(parseTrial({ claim_hours: 72 }).claim_hours, 72);
  assert.equal(parseTrial({ claim_hours: -1 }).claim_hours, 0);
});
