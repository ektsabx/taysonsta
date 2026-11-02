import { test } from "node:test";
import assert from "node:assert/strict";
import { METRICS, DEFAULT_COLUMNS, cleanColumns, formatMetric, metric, rangeBounds, inRange, zeroCounts } from "../../lib/campaigns/metrics.ts";
import { TARGETING, hasTargeting, sizeRange, targetingPrompt, placeName } from "../../lib/campaigns/targeting.ts";
import { CHANNELS, availableChannels, cleanChannels } from "../../lib/campaigns/channels.ts";
import { builderSchema, budgetPeople, scheduleCapacity, zonedIso, missing, minBudgetUsd, languageFor, hasAnyTargeting } from "../../lib/campaigns/builder.ts";
import { campaignWindow, withinWindow } from "../../lib/outreach/sending-rules.ts";
import { replyAction, CONVERSATION, UNITS, canDo, type ReplyContext } from "../../lib/agent-core/policy.ts";
import { tally, hintLines, MIN_CONTACTED, type Insights } from "../../lib/agent-core/learning.ts";
import { matches, traitsAt, confidenceOf } from "../../lib/campaigns/audience.ts";
import { referralDecision, sameInbox } from "../../lib/referrals.ts";

// Yolias as an AI sales agent (D-273), on top of the ads manager registries (D-272).

test("metric registry: held meetings lead (D-274), no qualified-opportunity columns, no number where none can be worked out", () => {
  assert.deepEqual(DEFAULT_COLUMNS, ["found", "sent", "open_rate", "reply_rate", "meetings", "cost_per_meeting", "held", "cost_per_held", "spend"]);
  assert.ok(!METRICS.some((m) => ["qualified", "cost_per_qualified"].includes(m.id)), "no qualified opportunities");
  assert.equal(new Set(METRICS.map((m) => m.id)).size, METRICS.length, "unique ids");
  const c = zeroCounts();
  assert.equal(metric("reply_rate")!.compute(c), null, "nothing contacted: no rate");
  assert.equal(metric("cost_per_meeting")!.compute(c), null, "no spend: no cost");
  assert.equal(metric("cost_per_meeting")!.compute({ ...c, spendUsd: 40, meetings: 4 }), 10);
  assert.equal(metric("cost_per_confirmed")!.compute({ ...c, spendUsd: 40, meetings: 4, confirmed: 2 }), 20);
  assert.equal(metric("cost_per_held")!.compute({ ...c, spendUsd: 40, meetings: 4, held: 0 }), null, "no held meeting: no cost per held");
  assert.equal(formatMetric(null, "count", "en"), "–", "unavailable is a dash, never 0");
  assert.equal(formatMetric(12.5, "usd", "ar"), "$12.50", "dollars always carry the sign");
  assert.deepEqual(cleanColumns(["meetings", "bogus", "meetings", "spend"]), ["meetings", "spend"]);
  // D-274: found = people + companies; didn't reply; opens and the booking link.
  assert.equal(metric("found")!.compute({ ...c, foundPeople: 3, foundCompanies: 7 }), 10);
  assert.equal(metric("no_reply")!.compute({ ...c, contacted: 10, replies: 3 }), 7);
  assert.equal(metric("no_reply")!.compute(c), null, "nobody contacted: no count");
  assert.equal(metric("open_rate")!.compute({ ...c, contacted: 10, opened: 4 }), 0.4);
  assert.equal(metric("link_rate")!.compute({ ...c, visits: 8, linkBooked: 2 }), 0.25);
  assert.equal(metric("show_rate")!.compute({ ...c, meetings: 4, held: 3 }), 0.75);
  assert.equal(metric("cost_per_held")!.compute({ ...c, spendUsd: 60, held: 3 }), 20);
});

test("date ranges: presets and custom", () => {
  const now = new Date("2026-10-31T15:00:00Z");
  assert.deepEqual(rangeBounds("lifetime", now), { from: null, to: null });
  assert.deepEqual(rangeBounds("yesterday", now), { from: "2026-10-30T00:00:00.000Z", to: "2026-10-31T00:00:00.000Z" });
  assert.deepEqual(rangeBounds("custom", now, { from: "2026-10-01", to: "2026-10-10" }), { from: "2026-10-01T00:00:00.000Z", to: "2026-10-11T00:00:00.000Z" });
  assert.ok(!inRange("2026-10-11T00:00:00Z", rangeBounds("custom", now, { from: "2026-10-01", to: "2026-10-10" })));
});

test("targeting: worldwide places by id with their names, exclusions, no personal traits", () => {
  assert.ok(!TARGETING.some((f) => ["age", "gender"].includes(f.id)));
  const tg = {
    countries: { include: ["SA"], exclude: ["AE"] }, cities: { include: ["108410"], exclude: ["105343"] }, regions: { include: ["SA-10"] },
    places: { "108410": { en: "Riyadh", ar: "الرياض", cc: "SA" }, "105343": { en: "Jeddah", cc: "SA" }, "SA-10": { en: "Riyadh Region", cc: "SA" } },
    industries: { include: ["Dental"] }, sizes: { include: ["11-50", "51-200"] }, exclude_companies: { include: ["acme.com"] },
  };
  const p = targetingPrompt(tg, (c) => ({ SA: "Saudi Arabia", AE: "United Arab Emirates" })[c] ?? c);
  assert.match(p, /Countries: Saudi Arabia/);
  assert.match(p, /Not in: United Arab Emirates/);
  assert.match(p, /Cities: Riyadh \(Saudi Arabia\)/);
  assert.match(p, /Exclude cities: Jeddah/);
  assert.match(p, /Regions: Riyadh Region/);
  assert.match(p, /Never these companies: acme.com/);
  assert.equal(placeName(tg, "108410", "ar"), "الرياض");
  assert.equal(placeName(tg, "Cairo"), "Cairo", "older audiences kept typed names");
  assert.deepEqual(sizeRange(tg), { min: 11, max: 200 });
  assert.ok(!hasTargeting({ exclude_companies: { include: ["x"] } }), "exclusions alone aren't an audience");
  assert.ok(hasAnyTargeting({ countries: { include: ["EG"] } }));
});

test("channel registry: only working channels can be chosen", () => {
  assert.deepEqual(availableChannels().map((c) => c.id), ["email"]);
  assert.ok(CHANNELS.some((c) => c.id === "whatsapp" && !c.available), "recorded, not offered");
  assert.deepEqual(cleanChannels(["whatsapp", "email", "email"]), ["email"]);
});

test("campaign builder: three levels, defaults, what's missing, budget, capacity, zones, language", () => {
  const s = builderSchema.parse({ adSets: [{ key: "a1", name: "Audience 1" }] });
  assert.equal(s.level, "campaign");
  assert.equal(s.language, "mul", "each person's language by default");
  assert.deepEqual(s.runDays, ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]);
  const gaps = missing(s, 0.1).map((g) => g.key);
  assert.deepEqual(gaps, ["name", "audience", "mailbox"]);
  assert.equal(minBudgetUsd(0.1), 1);
  assert.ok(missing({ ...s, budgetUsd: 0.5 }, 0.1).some((g) => g.key === "budget"));
  assert.equal(budgetPeople({ budgetUsd: 50 }, 0.1), 500);
  assert.equal(scheduleCapacity({ startDate: "2026-11-01", endDate: "2026-11-07", runDays: ["sun", "mon"], dailyLimit: 20 }, "2026-10-31"), 40);
  assert.equal(scheduleCapacity({ startDate: "", endDate: "", runDays: ["sun"], dailyLimit: 20 }, "2026-10-31"), null);
  assert.equal(zonedIso("2026-11-01", "09:00", "Asia/Riyadh"), "2026-11-01T06:00:00.000Z");
  assert.equal(languageFor("mul", "SA"), "ar");
  assert.equal(languageFor("mul", "de"), "de");
  assert.equal(languageFor("mul", null), "en");
  assert.equal(languageFor("fr", "SA"), "fr", "a chosen language wins");
});

const ctx = (x: Partial<ReplyContext>): ReplyContext => ({ kind: "question", unverified: false, needsHuman: false, proposedTime: false, autoReplies: 0, objectionsAnswered: 0, campaignRunning: true, hasAnswer: true, ...x });

test("agent policy: what Yolias does with each reply", () => {
  assert.equal(replyAction(ctx({ kind: "stop_request", needsHuman: true })), "stop", "an opt-out wins over everything");
  assert.equal(replyAction(ctx({ kind: "not_interested" })), "close");
  assert.equal(replyAction(ctx({ kind: "out_of_office" })), "postpone");
  assert.equal(replyAction(ctx({ kind: "interested" })), "offer_times", "interest → times and the booking page, no approval");
  assert.equal(replyAction(ctx({ kind: "meeting_request", proposedTime: true })), "book_named_time");
  assert.equal(replyAction(ctx({ kind: "question" })), "answer");
  assert.equal(replyAction(ctx({ kind: "question", unverified: true })), "hand_off", "never answers what it doesn't know");
  assert.equal(replyAction(ctx({ kind: "objection" })), "answer_objection");
  assert.equal(replyAction(ctx({ kind: "objection", objectionsAnswered: 1 })), "hand_off", "one objection answered, then the member");
  assert.equal(replyAction(ctx({ kind: "asks_for_human" })), "hand_off");
  assert.equal(replyAction(ctx({ kind: "question", needsHuman: true })), "hand_off");
  assert.equal(replyAction(ctx({ kind: "interested", autoReplies: CONVERSATION.maxAutoReplies })), "hand_off", "a thread's share of automatic answers");
  assert.equal(replyAction(ctx({ kind: "interested", campaignRunning: false })), "hand_off", "a paused campaign doesn't answer");
  assert.equal(CONVERSATION.maxColdMessages, 1 + CONVERSATION.followUpDays.length);
  assert.ok(canDo("email_delivery", "send_from_connected_mailbox"));
  assert.ok(!canDo("learning", "send_from_connected_mailbox"), "learning never sends");
  assert.ok(Object.values(UNITS).every((u) => u.may.length > 0));
});

test("learning: enough data before a number, best first, hints never invent", () => {
  const people = (key: string, n: number, positive: number) => Array.from({ length: n }, (_, i) => ({ key, replied: i < positive, positive: i < positive, meeting: i === 0 && positive > 0 }));
  const rows = tally([...people("Dental", 12, 3), ...people("Retail", 20, 1), ...people("Rare", MIN_CONTACTED - 1, 5)]);
  assert.deepEqual(rows.map((r) => r.value), ["Dental", "Retail"], "too little data is left out");
  assert.equal(rows[0].meetings, 1);
  const i: Insights = { contacted: 40, byIndustry: rows, byCountry: [], byTitle: [], bySize: [], openings: [], sources: [], objections: ["We already use a tool"], notInterested: [] };
  const h = hintLines(i);
  assert.match(h, /Industries that responded best: Dental \(25% interested of 12\)/);
  assert.match(h, /We already use a tool/);
  assert.equal(hintLines({ ...i, contacted: 3 }), "", "no hint without enough data");
});

test("audiences: matching what Yolias knows, lookalike traits by expansion, confidence from the seed", () => {
  const k = { country: "SA", city: "Riyadh", industry: "Dental clinic", title: "Owner", employees: 30, name: "Smile", domain: "smile.sa" };
  const tg = { countries: { include: ["SA"] }, cities: { include: ["108410"] }, places: { "108410": { en: "Riyadh", cc: "SA" } }, industries: { include: ["Dental"] } };
  assert.ok(matches(k, tg));
  assert.ok(!matches({ ...k, city: "Jeddah" }, tg));
  assert.ok(!matches(k, { ...tg, exclude_companies: { include: ["smile.sa"] } }));
  const rows = [...Array(6)].map(() => ({ industry: "Dental", country: "SA", size: "11-50", title: "Owner" })).concat([...Array(4)].map(() => ({ industry: "Retail", country: "EG", size: "51-200", title: "CEO" })));
  assert.deepEqual(traitsAt(rows, 1).map((x) => x.value), ["Dental", "SA", "11-50", "Owner"], "closest: what most share");
  assert.ok(traitsAt(rows, 10).every((x) => x.field === "industries" || x.field === "countries"), "broadest: no titles or sizes");
  assert.ok(traitsAt(rows, 10).length > traitsAt(rows, 1).length - 2);
  assert.equal(confidenceOf(3), "low");
  assert.equal(confidenceOf(5), "medium");
  assert.equal(confidenceOf(20), "high");
});

test("referrals: one rewarded account per network, hard signals reject, soft ones wait for review", () => {
  assert.deepEqual(referralDecision([], false), { status: "rewarded", reason: null });
  assert.deepEqual(referralDecision(["ip_used"], false), { status: "review", reason: "ip_used" });
  assert.deepEqual(referralDecision(["burst"], true), { status: "review", reason: "burst" });
  assert.deepEqual(referralDecision(["ip_used", "self_referral"], false), { status: "rejected", reason: "self_referral" });
  assert.deepEqual(referralDecision([], true), { status: "capped", reason: "monthly_cap" });
  assert.ok(sameInbox("John.Doe+x@gmail.com", "johndoe@googlemail.com"));
  assert.ok(!sameInbox("john@acme.com", "john+1@acme.co"));
});

test("campaign window: running days and contact hours in its zone", () => {
  const w = campaignWindow({ run_days: ["sun", "mon", "tue", "wed", "thu"], contact_from: "09:00:00", contact_to: "17:00:00", timezone: "Asia/Riyadh" }, "UTC")!;
  assert.ok(withinWindow(w, new Date("2026-11-01T07:00:00Z")), "Sunday 10:00 Riyadh");
  assert.ok(!withinWindow(w, new Date("2026-10-30T07:00:00Z")), "Friday");
});
