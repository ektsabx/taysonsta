import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SENDING_RULES, mailboxWindow, nextGapMs, parseSendingRules, withinWindow } from "../../lib/outreach/sending-rules.ts";

// 2026-10-21 was a Wednesday.
const at = (iso: string) => new Date(iso);

test("defaults are AgentSDR's: 30 a day, 18 to 24 minutes, Monday to Friday 09:00 to 18:00", () => {
  assert.deepEqual(parseSendingRules(null), DEFAULT_SENDING_RULES);
  assert.deepEqual(parseSendingRules({ gap_min: 30, gap_max: 10, days: [5, 1, 1], start: "25:00", timezone: "Mars/Base" }), { ...DEFAULT_SENDING_RULES, gap_min: 30, gap_max: 30, days: [1, 5] });
});

test("the window is read in the mailbox's time zone", () => {
  const w = { days: [1, 2, 3, 4, 5], start: "09:00", end: "18:00", timeZone: "Africa/Cairo" };
  assert.ok(withinWindow(w, at("2026-10-21T07:30:00Z")), "10:30 in Cairo (UTC+3)");
  assert.ok(!withinWindow(w, at("2026-10-21T05:30:00Z")), "08:30 in Cairo");
  assert.ok(!withinWindow(w, at("2026-10-21T15:00:00Z")), "18:00 in Cairo is closed");
  assert.ok(!withinWindow(w, at("2026-10-24T08:00:00Z")), "Saturday");
  assert.ok(withinWindow({ ...w, timeZone: "America/New_York" }, at("2026-10-21T15:00:00Z")), "11:00 in New York");
});

test("overnight windows belong to the day they start; start = end is all day", () => {
  const w = { days: [3], start: "21:00", end: "06:00", timeZone: "UTC" };
  assert.ok(withinWindow(w, at("2026-10-21T22:00:00Z")), "Wednesday 22:00");
  assert.ok(withinWindow(w, at("2026-10-22T05:00:00Z")), "Thursday 05:00, still Wednesday's window");
  assert.ok(!withinWindow(w, at("2026-10-22T22:00:00Z")), "Thursday evening is not enabled");
  assert.ok(withinWindow({ days: [3], start: "00:00", end: "00:00", timeZone: "UTC" }, at("2026-10-21T03:00:00Z")));
});

test("the mailbox's zone first, then the workspace's, then the member's", () => {
  const m = { send_days: [1], send_start: "09:00", send_end: "18:00", time_zone: null };
  assert.equal(mailboxWindow(m, { ...DEFAULT_SENDING_RULES, timezone: "Asia/Riyadh" }, "Africa/Cairo").timeZone, "Asia/Riyadh");
  assert.equal(mailboxWindow(m, DEFAULT_SENDING_RULES, "Africa/Cairo").timeZone, "Africa/Cairo");
  assert.equal(mailboxWindow({ ...m, time_zone: "Europe/London" }, DEFAULT_SENDING_RULES, null).timeZone, "Europe/London");
  assert.equal(mailboxWindow(m, DEFAULT_SENDING_RULES, null).timeZone, "UTC");
});

test("the gap is a whole number of minutes between its ends", () => {
  assert.equal(nextGapMs({ gap_min: 18, gap_max: 24 }, () => 0), 18 * 60_000);
  assert.equal(nextGapMs({ gap_min: 18, gap_max: 24 }, () => 0.9999), 24 * 60_000);
  assert.equal(nextGapMs({ gap_min: 0, gap_max: 0 }), 0);
});
