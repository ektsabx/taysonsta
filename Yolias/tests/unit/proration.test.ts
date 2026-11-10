import { test } from "node:test";
import assert from "node:assert/strict";
import { prorate } from "../../lib/billing-math.ts";

// Plan changes mid-period: the unused share of what was paid comes off.
const day = 86_400_000;
const start = Date.parse("2026-11-01T00:00:00Z"), end = start + 30 * day;

test("unused time is deducted by days left, to the cent, never more than paid", () => {
  assert.equal(prorate(100, start, end, start + 10 * day), 66.66, "20 of 30 days left");
  assert.equal(prorate(100, start, end, start), 100, "changed on the first day");
  assert.equal(prorate(100, start, end, end), 0, "nothing left at the end");
  assert.equal(prorate(100, start, end, start - day), 100, "never above what was paid");
  assert.equal(prorate(960, start, start + 365 * day, start + 73 * day), 768, "annual: 292 of 365 days");
});
