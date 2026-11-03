import { test } from "node:test";
import assert from "node:assert/strict";
import { DAY, bucketOf, buckets, change, channelGroup, concentration, ltv, monthlyChurn, monthlyPrice, nrr, paybackMonths, ratio } from "@/lib/yolias/growth-math";

test("growth math (D-276): rates without a base are unknown, never zero", () => {
  assert.equal(ratio(1, 0), null);
  assert.equal(ratio(1, 4), 0.25);
  assert.equal(change(150, 100), 0.5);
  assert.equal(change(5, 0), null, "growth from nothing has no percentage");
  assert.equal(monthlyPrice(100, "annual"), 80, "annual is 20% off, per month");
  assert.equal(monthlyPrice(200, "monthly"), 200);
});

test("growth math: churn per month, LTV and payback", () => {
  assert.ok(Math.abs((monthlyChurn(10, 100, 30) ?? 0) - 0.1) < 1e-9, "30 days is a month");
  const q = monthlyChurn(27.1, 100, 90) ?? 0;
  assert.ok(Math.abs(q - 0.1) < 0.002, `a quarter's 27.1% is about 10% a month (${q})`);
  assert.equal(monthlyChurn(0, 0, 30), null);
  assert.equal(ltv(100, 0.8, 0.05), 1600);
  assert.equal(ltv(100, 0.8, 0), null, "no churn yet: LTV can't be worked out");
  assert.equal(paybackMonths(400, 100, 0.8), 5);
  assert.equal(paybackMonths(null, 100, 0.8), null);
});

test("growth math: concentration, net revenue retention, channels", () => {
  const c = concentration([500, 100, 100, 100, 100, 100, 0, 0, 0, 0]);
  assert.equal(c.top1, 0.5);
  assert.equal(c.topShare, 0.5, "top 10% of 6 paying = 1 customer");
  assert.deepEqual(concentration([]), { topShare: null, top1: null });
  assert.equal(nrr(new Map([["a", 100], ["b", 100]]), new Map([["a", 150], ["c", 999]])), 0.75, "new customers don't count; b churned");
  assert.equal(channelGroup("organic_search"), "seo");
  assert.equal(channelGroup("ai_assistant"), "geo");
  assert.equal(channelGroup("paid_search"), "paid_ads");
  assert.equal(channelGroup(null), "unknown");
});

test("growth math: day, week and month buckets", () => {
  const since = Date.parse("2026-10-01T00:00:00Z");
  const d = buckets(since, since + 7 * DAY);
  assert.equal(d.unit, "day");
  assert.equal(d.starts.length, 7);
  assert.equal(bucketOf(d.starts, since + 2.5 * DAY, since + 7 * DAY), 2);
  assert.equal(bucketOf(d.starts, since - 1, since + 7 * DAY), -1);
  assert.equal(buckets(since, since + 200 * DAY).unit, "week");
  const m = buckets(since, since + 400 * DAY);
  assert.equal(m.unit, "month");
  assert.equal(new Date(m.starts[1]).toISOString().slice(0, 10), "2026-11-01");
});
