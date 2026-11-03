import { test } from "node:test";
import assert from "node:assert/strict";
import { flagsOf } from "@/lib/yolias/campaign-flags";

const now = Date.parse("2026-11-03T12:00:00Z");
const base = { status: "active", approvedAt: "2026-10-01T00:00:00Z", sent: 100, bounced: 1, failed: 0, lastSentAt: "2026-11-03T10:00:00Z" };

test("campaign flags", () => {
  assert.deepEqual(flagsOf(base, now), []);
  assert.deepEqual(flagsOf({ ...base, lastSentAt: "2026-10-30T00:00:00Z" }, now), ["stuck"]);
  assert.deepEqual(flagsOf({ ...base, bounced: 6 }, now), ["bounces"]);
  assert.deepEqual(flagsOf({ ...base, sent: 10, bounced: 5 }, now), [], "too few sent to judge bounces");
  assert.deepEqual(flagsOf({ ...base, failed: 5 }, now), ["failures"]);
  assert.deepEqual(flagsOf({ ...base, status: "paused", lastSentAt: null }, now), [], "a paused campaign isn't stuck");
});
