import { test } from "node:test";
import assert from "node:assert/strict";
import { groupBy, hourBucket, lengthBucket, missingData, MIN_SAMPLE, type PerfRow } from "@/lib/bos/content-insights";

// Master upgrade Phase 11 (docs/bos/30 §13.4): grouping real post data,
// sample-size flags, missing-data list.
const row = (o: Partial<PerfRow>): PerfRow => ({ platform: "facebook", contentType: "post", publishedAt: "2026-09-01T09:00:00Z", hook: "Hook", topic: "tips", videoLengthSec: null, reach: 1000, engagement: 5, views: null, ...o });

test("groups average only existing values and flag small samples", () => {
  const rows = [row({ engagement: 4 }), row({ engagement: 6 }), row({ engagement: 8 }), row({ platform: "instagram", engagement: 20, reach: null })];
  const { groups } = groupBy(rows, "platform");
  const fb = groups.find((g) => g.value === "facebook")!;
  assert.equal(fb.avgEngagement, 6);
  assert.equal(fb.lowSample, false);
  const ig = groups.find((g) => g.value === "instagram")!;
  assert.equal(ig.avgReach, null, "missing reach is not averaged as 0");
  assert.equal(ig.lowSample, true, `fewer than ${MIN_SAMPLE}`);
  assert.equal(groups[0].value, "instagram", "sorted by engagement");
});

test("hook dimension: unlinked posts are 'missing', empty hook is 'no_hook'", () => {
  const r = groupBy([row({ hook: null }), row({ hook: "" }), row({ hook: "Did you know?" })], "hook");
  assert.equal(r.missing, 1);
  assert.deepEqual(r.groups.map((g) => g.value).sort(), ["no_hook", "with_hook"]);
});

test("buckets: Cairo hours and video lengths", () => {
  assert.equal(hourBucket("2026-09-01T16:30:00Z"), "17–21"); // 19:30 Cairo (UTC+3)
  assert.equal(hourBucket("2026-09-01T02:00:00Z"), "00–06");
  assert.equal(lengthBucket(12), "≤15s");
  assert.equal(lengthBucket(45), "31–60s");
  assert.equal(lengthBucket(null), null);
});

test("missing data is reported, never filled", () => {
  assert.deepEqual(missingData([]), ["no_published_posts"]);
  const m = missingData([row({ reach: null, contentType: null, hook: null })]);
  for (const k of ["reach_missing", "not_linked_to_content", "hook_unknown", "retention_not_collected", "small_sample"]) assert.ok(m.includes(k), k);
});
