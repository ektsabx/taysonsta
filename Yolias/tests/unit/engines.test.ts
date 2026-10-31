import { test } from "node:test";
import assert from "node:assert/strict";
import { betaDraw, enoughData, forecastMeetings, guard, mean, pace, pickArm, planGoal, posterior, priorFrom, priority, rng, roi, sharedFor, type FunnelCounts } from "../../lib/campaigns/engines.ts";

// The campaign engines (D-270): nothing invented, ranges not points, meetings over opens.

const none: FunnelCounts = { contacted: 0, positive: 0, meetings: 0, held: 0, qualified: 0 };
const some: FunnelCounts = { contacted: 400, positive: 16, meetings: 8, held: 6, qualified: 5 };

test("no data: the planner and the forecast say nothing", () => {
  assert.equal(planGoal(10, none, 30), null);
  assert.equal(forecastMeetings(none, 500), null);
  assert.equal(enoughData({ ...none, contacted: 49, positive: 3 }, false), false);
  assert.equal(enoughData({ ...none, contacted: 60, positive: 0 }, false), false, "no positive reply yet");
});

test("planner: contacts needed from the campaign's own meeting rate", () => {
  const p = planGoal(20, some, 10)!;
  // Rate ≈ (1 + 8) / (2 + 400) ≈ 0.0224 → 12 meetings left → ≈ 536 contacts.
  assert.ok(Math.abs(p.meetingRate - 9 / 402) < 1e-9);
  assert.equal(p.contactsNeeded, Math.ceil(12 / (9 / 402)));
  assert.equal(p.perDay, Math.ceil(p.contactsNeeded / 10));
  assert.equal(planGoal(5, some, 10)!.contactsNeeded, 0, "target already reached");
});

test("shared learning is a weak prior: own data soon outweighs it", () => {
  const prior = priorFrom({ n: 5000, s: 250 })!; // 5% meeting rate across workspaces
  assert.ok(Math.abs(prior.a + prior.b - 40) < 1e-9);
  assert.ok(planGoal(10, none, 30, prior), "a new campaign can plan with shared learning");
  const own = mean(posterior({ n: 2000, s: 20 }, prior));
  assert.ok(own < 0.012, "2,000 own leads at 1% pull the rate far from the 5% prior");
});

test("forecast: a seeded range that holds the actual meetings", () => {
  const a = forecastMeetings(some, 400)!, b = forecastMeetings(some, 400)!;
  assert.deepEqual(a, b, "same inputs, same range");
  assert.ok(a.low >= some.meetings && a.low <= a.mid && a.mid <= a.high);
  assert.ok(a.mid >= 12 && a.mid <= 20, `about 8 more expected, got ${a.mid}`);
  assert.ok(a.high - a.low >= 3, "uncertainty shows");
});

test("pace: unknown early, then behind / on track / ahead against the schedule", () => {
  const base = { target: 10, startsAt: "2026-11-01T00:00:00Z", endsAt: "2026-11-30T00:00:00Z", now: new Date("2026-11-16T00:00:00Z") };
  assert.equal(pace({ ...base, target: null, meetings: 0, contacted: 0 }), "no_target");
  assert.equal(pace({ ...base, meetings: 0, contacted: 10 }), "unknown");
  assert.equal(pace({ ...base, meetings: 1, contacted: 300 }), "behind");
  assert.equal(pace({ ...base, meetings: 5, contacted: 300 }), "on_track");
  assert.equal(pace({ ...base, meetings: 9, contacted: 300 }), "ahead");
  assert.equal(pace({ ...base, meetings: 10, contacted: 300 }), "done");
  assert.equal(pace({ ...base, now: new Date("2026-10-20T00:00:00Z"), meetings: 0, contacted: 0 }), "not_started");
});

test("Thompson sampling: alternates early, then favours the angle that gets positive replies", () => {
  assert.equal(pickArm([{ key: "a", n: 30, s: 2 }, { key: "b", n: 5, s: 0 }]), "b");
  const r = rng(42);
  let b = 0;
  for (let i = 0; i < 1000; i++) if (pickArm([{ key: "a", n: 200, s: 4 }, { key: "b", n: 200, s: 16 }], r) === "b") b++;
  assert.ok(b > 950, `b should win nearly always, won ${b}`);
  const draws = Array.from({ length: 4000 }, () => betaDraw(3, 7, r));
  assert.ok(Math.abs(draws.reduce((x, y) => x + y) / draws.length - 0.3) < 0.02, "Beta(3, 7) mean 0.3");
});

test("priority: fit, fresh signal and a verified email first; never contactable last", () => {
  const plain = priority({ matchScore: 80, contactable: true, emailStatus: "verified" });
  const fresh = priority({ matchScore: 80, contactable: true, emailStatus: "verified", signalAgeDays: 0 });
  const old = priority({ matchScore: 80, contactable: true, emailStatus: "verified", signalAgeDays: 60 });
  assert.ok(fresh > old && old > plain);
  assert.ok(priority({ matchScore: 80, contactable: true, emailStatus: "catch_all" }) < plain);
  assert.equal(priority({ matchScore: 99, contactable: false }), 0);
});

test("deliverability guard: bounces pause the mailbox's campaigns", () => {
  assert.equal(guard({ sent: 10, bounced: 5 }), "ok", "too few sends to judge");
  assert.equal(guard({ sent: 100, bounced: 2 }), "ok");
  assert.equal(guard({ sent: 100, bounced: 4 }), "watch");
  assert.equal(guard({ sent: 100, bounced: 6 }), "pause");
});

test("shared learning: the most specific group that exists", () => {
  const rows = [
    { industry: "*", country: "*", aim: "meeting", workspaces: 9, contacted: 900, positive: 40, meetings: 20, qualified: 12 },
    { industry: "healthcare", country: "*", aim: "meeting", workspaces: 6, contacted: 300, positive: 20, meetings: 9, qualified: 6 },
  ];
  assert.equal(sharedFor(rows, "Healthcare", "SA", "meeting")?.industry, "healthcare");
  assert.equal(sharedFor(rows, "retail", "SA", "meeting")?.industry, "*");
  assert.equal(sharedFor(rows, "retail", "SA", "sell"), null);
});

test("ROI: costs per result, no division by zero", () => {
  const r = roi({ spendUsd: 100, revenueUsd: 1200, prospects: 1000, positive: 10, meetings: 4, qualified: 0 });
  assert.equal(r.roi, 11);
  assert.equal(r.perMeeting, 25);
  assert.equal(r.perQualified, null);
  assert.equal(roi({ spendUsd: 0, revenueUsd: 0, prospects: 0, positive: 0, meetings: 0, qualified: 0 }).roi, null);
});
