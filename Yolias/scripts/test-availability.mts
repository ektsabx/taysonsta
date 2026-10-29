// Booking page free times (D-267): npx tsx scripts/test-availability.mts
import assert from "node:assert/strict";
import { freeSlots, isFree, zoned, type AvailabilityRules } from "../lib/meetings/availability.ts";

const week = { sun: [["10:00", "12:00"]], mon: [["10:00", "12:00"]], tue: [], wed: [], thu: [], fri: [], sat: [] } as AvailabilityRules["hours"];
const r: AvailabilityRules = { duration_min: 30, buffer_min: 10, min_notice_hours: 0, window_days: 7, timezone: "Africa/Cairo", hours: week };
// Saturday 2026-11-07 08:00 UTC.
const now = new Date("2026-11-07T08:00:00Z");
const days = freeSlots(r, [], now);
assert.deepEqual(days.map((d) => d.day), ["2026-11-08", "2026-11-09"], "only Sunday and Monday");
// 10:00, 10:40, 11:20 Cairo (UTC+2 in November) fit before 12:00.
assert.deepEqual(days[0].slots, ["2026-11-08T08:00:00.000Z", "2026-11-08T08:40:00.000Z", "2026-11-08T09:20:00.000Z"]);
// A booked 10:40–11:10 (break to 11:20) leaves 10:00 (ends 10:30, break to 10:40) and 11:20.
const busy = [{ start: "2026-11-08T08:40:00.000Z", end: "2026-11-08T09:10:00.000Z" }];
assert.deepEqual(freeSlots(r, busy, now)[0].slots, ["2026-11-08T08:00:00.000Z", "2026-11-08T09:20:00.000Z"]);
// Notice: 48 hours ahead hides Sunday and Monday morning.
assert.equal(freeSlots({ ...r, min_notice_hours: 48 }, [], now).length, 1);
// Daylight saving: New York 10:00 is 15:00 UTC in November, 14:00 UTC in October.
assert.equal(zoned("2026-11-09", "10:00", "America/New_York").toISOString(), "2026-11-09T15:00:00.000Z");
assert.equal(zoned("2026-10-26", "10:00", "America/New_York").toISOString(), "2026-10-26T14:00:00.000Z");
assert.ok(isFree(r, [], "2026-11-08T08:00:00.000Z", now));
assert.ok(!isFree(r, [], "2026-11-08T08:05:00.000Z", now), "only the offered times");
console.log("✓ availability");
