import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizePhone } from "../../lib/phone.ts";

test("international numbers from any country are normalised to E.164", () => {
  assert.equal(normalizePhone("+20 100 123 4567"), "+201001234567");
  assert.equal(normalizePhone("+1 (415) 555-0123"), "+14155550123");
  assert.equal(normalizePhone("0044 20 7946 0958"), "+442079460958");
  assert.equal(normalizePhone("+966.50.123.4567"), "+966501234567");
  assert.equal(normalizePhone("+٢٠ ١٠٠ ١٢٣ ٤٥٦٧"), "+201001234567", "Arabic-Indic digits");
});

test("numbers without a country code or with impossible lengths are refused", () => {
  assert.equal(normalizePhone("01001234567"), null, "no country is assumed");
  assert.equal(normalizePhone("+0 123 456 789"), null);
  assert.equal(normalizePhone("+1234"), null);
  assert.equal(normalizePhone("+1234567890123456"), null);
  assert.equal(normalizePhone("+20 abc 123"), null);
  assert.equal(normalizePhone(""), null);
});
