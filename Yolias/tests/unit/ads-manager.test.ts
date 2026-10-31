import { test } from "node:test";
import assert from "node:assert/strict";
import { METRICS, DEFAULT_COLUMNS, cleanColumns, formatMetric, metric, rangeBounds, inRange, zeroCounts } from "../../lib/campaigns/metrics.ts";
import { TARGETING, hasTargeting, sizeRange, targetingPrompt } from "../../lib/campaigns/targeting.ts";
import { CHANNELS, availableChannels, cleanChannels } from "../../lib/campaigns/channels.ts";
import { budgetProspects, expectedVolume, wizardSchema, zonedIso, aimOf } from "../../lib/campaigns/wizard.ts";
import { campaignWindow, withinWindow } from "../../lib/outreach/sending-rules.ts";

// Campaigns as an ads manager (D-272): the registries and the wizard's pure parts.

test("metric registry: defaults, ids, and no number where none can be worked out", () => {
  assert.deepEqual(DEFAULT_COLUMNS, ["contacted", "replies", "interested", "meetings", "spend"]);
  assert.equal(new Set(METRICS.map((m) => m.id)).size, METRICS.length, "unique ids");
  const c = zeroCounts();
  assert.equal(metric("reply_rate")!.compute(c), null, "nothing contacted: no rate");
  assert.equal(metric("cost_per_meeting")!.compute(c), null, "no spend: no cost");
  assert.equal(metric("roas")!.compute({ ...c, spendUsd: 10 }), null, "no revenue: no return");
  assert.equal(metric("reply_rate")!.compute({ ...c, contacted: 50, replies: 5 }), 0.1);
  assert.equal(metric("cost_per_meeting")!.compute({ ...c, spendUsd: 40, meetings: 4 }), 10);
  assert.equal(formatMetric(null, "count", "en"), "–", "unavailable is a dash, never 0");
  assert.equal(formatMetric(0, "count", "en"), "0");
  assert.equal(formatMetric(0.125, "pct", "en"), "13%");
  assert.deepEqual(cleanColumns(["meetings", "bogus", "meetings", "spend"]), ["meetings", "spend"]);
});

test("date ranges: presets and custom", () => {
  const now = new Date("2026-10-31T15:00:00Z");
  assert.deepEqual(rangeBounds("lifetime", now), { from: null, to: null });
  assert.deepEqual(rangeBounds("today", now), { from: "2026-10-31T00:00:00.000Z", to: null });
  assert.deepEqual(rangeBounds("yesterday", now), { from: "2026-10-30T00:00:00.000Z", to: "2026-10-31T00:00:00.000Z" });
  assert.equal(rangeBounds("7d", now).from, "2026-10-25T00:00:00.000Z");
  assert.deepEqual(rangeBounds("last_month", now), { from: "2026-09-01T00:00:00.000Z", to: "2026-10-01T00:00:00.000Z" });
  assert.deepEqual(rangeBounds("custom", now, { from: "2026-10-01", to: "2026-10-10" }), { from: "2026-10-01T00:00:00.000Z", to: "2026-10-11T00:00:00.000Z" });
  assert.ok(inRange("2026-10-10T23:00:00Z", rangeBounds("custom", now, { from: "2026-10-01", to: "2026-10-10" })));
  assert.ok(!inRange("2026-10-11T00:00:00Z", rangeBounds("custom", now, { from: "2026-10-01", to: "2026-10-10" })));
  assert.ok(!inRange(null, { from: null, to: null }));
});

test("targeting schema: selectors, prompt, sizes; no personal traits", () => {
  assert.ok(!TARGETING.some((f) => ["age", "gender"].includes(f.id)));
  const tg = { countries: { include: ["SA", "AE"] }, industries: { include: ["Dental"], exclude: ["Government"] }, sizes: { include: ["11-50", "51-200"] }, titles: { include: ["Founder", "CEO"] } };
  const p = targetingPrompt(tg, (c) => ({ SA: "Saudi Arabia", AE: "United Arab Emirates" })[c] ?? c);
  assert.match(p, /Countries: Saudi Arabia OR United Arab Emirates/);
  assert.match(p, /Exclude industries: Government/);
  assert.match(p, /Decision makers: Founder OR CEO/);
  assert.deepEqual(sizeRange(tg), { min: 11, max: 200 });
  assert.deepEqual(sizeRange({ sizes: { include: ["1001-"] } }), { min: 1001, max: null });
  assert.ok(hasTargeting({ description: "clinics" }));
  assert.ok(!hasTargeting({}));
});

test("channel registry: only working channels can be chosen", () => {
  assert.deepEqual(availableChannels().map((c) => c.id), ["email"]);
  assert.ok(CHANNELS.some((c) => c.id === "whatsapp" && !c.available), "recorded, not offered");
  assert.deepEqual(cleanChannels(["whatsapp", "email", "email"]), ["email"]);
  assert.deepEqual(cleanChannels(["sms"]), ["email"]);
});

test("wizard: defaults, budget, volume, time zones, objective", () => {
  const s = wizardSchema.parse({ groups: [{ key: "g1", name: "Main", source: "find_new" }] });
  assert.equal(s.groups[0].steps.length, 3, "first email + two follow-ups by default");
  assert.equal(budgetProspects({ budgetUsd: 50 }, 0.1), 500);
  assert.equal(budgetProspects({ budgetUsd: 50 }, 0), 0);
  // 2026-11-01 is a Sunday: Sun–Thu over two weeks = 10 days × 20.
  assert.equal(expectedVolume({ startDate: "2026-11-01", endDate: "2026-11-14", runDays: ["sun", "mon", "tue", "wed", "thu"], dailyLimit: 20 }, "2026-10-31"), 200);
  assert.equal(expectedVolume({ startDate: "", endDate: "", runDays: ["sun"], dailyLimit: 20 }, "2026-10-31"), null);
  assert.equal(zonedIso("2026-11-01", "09:00", "Asia/Riyadh"), "2026-11-01T06:00:00.000Z");
  assert.equal(zonedIso("", "09:00", "UTC"), null);
  assert.equal(aimOf("promote"), "sell");
  assert.equal(aimOf("leads"), "meeting");
});

test("campaign window: running days and contact hours in its zone", () => {
  assert.equal(campaignWindow({ run_days: ["sun", "mon", "tue", "wed", "thu", "fri", "sat"], contact_from: null, contact_to: null, timezone: null }, "UTC"), null, "no limits set");
  const w = campaignWindow({ run_days: ["sun", "mon", "tue", "wed", "thu"], contact_from: "09:00:00", contact_to: "17:00:00", timezone: "Asia/Riyadh" }, "UTC")!;
  assert.ok(withinWindow(w, new Date("2026-11-01T07:00:00Z")), "Sunday 10:00 Riyadh");
  assert.ok(!withinWindow(w, new Date("2026-11-01T15:00:00Z")), "Sunday 18:00 Riyadh");
  assert.ok(!withinWindow(w, new Date("2026-10-30T07:00:00Z")), "Friday");
});
