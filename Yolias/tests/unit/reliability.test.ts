import { test } from "node:test";
import assert from "node:assert/strict";
import { isNetworkError, isNetworkFailure } from "../../lib/network-error.ts";
import { DEFAULT_DAILY_LIMITS, parseDailyLimits } from "../../lib/daily-limits.ts";
import { normalizeEmail } from "../../lib/auth/email-policy.ts";

test("dropped connections are recognised in every browser, real errors are not", () => {
  for (const m of ["Failed to fetch", "Load failed", "NetworkError when attempting to fetch resource.", "network error", "The network connection was lost."]) {
    assert.equal(isNetworkError(new TypeError(m)), true, m);
  }
  assert.equal(isNetworkError(new TypeError("x is not a function")), false);
  assert.equal(isNetworkError(new Error("Failed to fetch")), false, "only TypeErrors come from fetch");
  assert.equal(isNetworkFailure({ ok: false, network: true }), true);
  assert.equal(isNetworkFailure({ ok: false, error: "x" }), false);
});

test("daily limits: valid values override the defaults, invalid ones never do", () => {
  assert.deepEqual(parseDailyLimits(null), DEFAULT_DAILY_LIMITS);
  const p = parseDailyLimits({ free: { search: 2, ai_message: 9.5 }, pro: { search: -1 }, growth: "x" });
  assert.equal(p.free.search, 2);
  assert.equal(p.free.ai_message, DEFAULT_DAILY_LIMITS.free.ai_message, "not a whole number");
  assert.equal(p.pro.search, DEFAULT_DAILY_LIMITS.pro.search, "negative");
  assert.deepEqual(p.growth, DEFAULT_DAILY_LIMITS.growth);
  assert.equal(parseDailyLimits({ free: { search: 0 } }).free.search, 0, "0 = blocked is allowed");
});

test("emails are normalised before the disposable-domain check", () => {
  assert.equal(normalizeEmail(" Sara.Ali@Example.COM.. "), "sara.ali@example.com");
  assert.equal(normalizeEmail("no-at-sign"), "no-at-sign");
});
