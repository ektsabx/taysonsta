import { test } from "node:test";
import assert from "node:assert/strict";
import { allocate, pickEvent, eventsOf, seeded, EVENT_MIN, LEARNING_CONTACTED } from "../../lib/agent-core/optimizer.ts";
import { splitPeriod } from "../../lib/campaigns/budget-split.ts";
import { guestReminderDue, visitState, leadLink } from "../../lib/meetings/pure.ts";
import { countsAsOpen } from "../../lib/outreach/opens.ts";
import { textToHtml, buildRawEmail, decodeBase64Url } from "../../lib/mailbox/mime.ts";

// D-274: the results engine (owner, 2026-11-02).

const H = 3_600_000;

test("optimizer: the result climbs the ladder (positive reply → booked → held) only with enough of it", () => {
  assert.equal(pickEvent({ interested: 0, meetings: 0, held: 0 }), null, "too little: learning");
  assert.equal(pickEvent({ interested: EVENT_MIN, meetings: 2, held: 0 }), "positive");
  assert.equal(pickEvent({ interested: 20, meetings: EVENT_MIN, held: 1 }), "booked");
  assert.equal(pickEvent({ interested: 20, meetings: 9, held: EVENT_MIN }), "booked", "a booked meeting is the result (owner)");
  assert.equal(eventsOf({ interested: 3, meetings: 2, held: 1 }, "booked"), 2);
});

test("optimizer: learning splits equally; results move the money; shares sum to 1 and repeat for a seed", () => {
  const eq = allocate([{ key: "a", contacted: 50, events: 0, spendUsd: 5 }, { key: "b", contacted: 50, events: 0, spendUsd: 5 }], null);
  assert.deepEqual(eq.arms.map((a) => a.share), [0.5, 0.5]);
  assert.ok(eq.arms.every((a) => a.learning && a.reason === "learning"));
  const arms = [{ key: "a", contacted: 200, events: 12, spendUsd: 20 }, { key: "b", contacted: 200, events: 3, spendUsd: 20 }, { key: "c", contacted: 10, events: 0, spendUsd: 1 }];
  const r1 = allocate(arms, "booked", { rng: seeded("x:2026-11-02") });
  const r2 = allocate(arms, "booked", { rng: seeded("x:2026-11-02") });
  assert.deepEqual(r1, r2, "same seed, same split");
  const share = (k: string) => r1.arms.find((a) => a.key === k)!.share;
  assert.ok(Math.abs(r1.arms.reduce((s, a) => s + a.share, 0) - 1) < 0.01);
  assert.ok(share("a") > share("b"), "the better audience gets more");
  assert.ok(share("c") >= 1 / 3 - 0.01, `a learning audience (<${LEARNING_CONTACTED} contacted) keeps a fair try`);
  assert.equal(r1.arms.find((a) => a.key === "a")!.reason, "best");
});

test("optimizer: a clear loser and an audience over the cost cap get no new budget; all over the cap = capped", () => {
  const r = allocate([{ key: "good", contacted: 300, events: 30, spendUsd: 30 }, { key: "bad", contacted: 300, events: 1, spendUsd: 30 }], "booked", { rng: seeded("l") });
  assert.equal(r.arms.find((a) => a.key === "bad")!.share, 0);
  assert.equal(r.arms.find((a) => a.key === "bad")!.reason, "weaker");
  assert.equal(r.arms.find((a) => a.key === "good")!.share, 1);
  const cap = allocate([{ key: "a", contacted: 100, events: 2, spendUsd: 100 }, { key: "b", contacted: 100, events: 10, spendUsd: 50 }], "held", { costCapUsd: 20, rng: seeded("c") });
  assert.equal(cap.arms.find((a) => a.key === "a")!.reason, "over_cap", "$50 a meeting is over a $20 cap");
  assert.equal(cap.arms.find((a) => a.key === "b")!.share, 1, "$5 a meeting is under it");
  const all = allocate([{ key: "a", contacted: 100, events: 1, spendUsd: 100 }], "held", { costCapUsd: 20, rng: seeded("d") });
  assert.equal(all.capped, true);
  assert.equal(all.arms[0].share, 0);
  const reply = allocate([{ key: "a", contacted: 100, events: 1, spendUsd: 100 }], "positive", { costCapUsd: 20, rng: seeded("e") });
  assert.equal(reply.capped, false, "the cap is per meeting, not per reply");
});

test("budget periods: split by the optimizer's shares, equal until it has set them", () => {
  assert.deepEqual([...splitPeriod(100, [{ id: "a", share: null }, { id: "b", share: null }])], [["a", 50], ["b", 50]]);
  assert.deepEqual([...splitPeriod(100, [{ id: "a", share: 0.8 }, { id: "b", share: 0.2 }])], [["a", 80], ["b", 20]]);
  assert.deepEqual([...splitPeriod(100, [{ id: "a", share: 1 }, { id: "b", share: 0 }])], [["a", 100]], "no new budget for a share of 0");
  assert.equal(splitPeriod(100, [{ id: "a", share: 0 }]).size, 0);
});

test("guest reminders: a day before (unless booked within the day), then an hour before, once each", () => {
  const now = Date.parse("2026-11-02T10:00:00Z");
  const m = (startsIn: number, bookedAgo: number, day: string | null = null, hour: string | null = null) => ({ starts_at: new Date(now + startsIn).toISOString(), created_at: new Date(now - bookedAgo).toISOString(), guest_reminded_day_at: day, guest_reminded_hour_at: hour });
  assert.equal(guestReminderDue(m(20 * H, 3 * 24 * H), now), "day");
  assert.equal(guestReminderDue(m(20 * H, 2 * H), now), null, "booked for tomorrow an hour ago: no day reminder");
  assert.equal(guestReminderDue(m(20 * H, 3 * 24 * H, "x"), now), null, "already sent");
  assert.equal(guestReminderDue(m(50 * 60_000, 3 * 24 * H, "x"), now), "hour");
  assert.equal(guestReminderDue(m(50 * 60_000, 3 * 24 * H, "x", "y"), now), null);
  assert.equal(guestReminderDue(m(-H, 3 * 24 * H), now), null, "past meetings: nothing");
});

test("booking link: lead in the link; a visit is booked, left mid-form (abandoned) or just a visit", () => {
  assert.equal(leadLink("https://www.yolias.com/meet/sara", "abc"), "https://www.yolias.com/meet/sara?r=abc");
  assert.equal(leadLink("https://x.test/meet/a?l=ar", "abc"), "https://x.test/meet/a?l=ar&r=abc");
  assert.equal(leadLink("https://x.test/meet/a", null), "https://x.test/meet/a");
  const now = Date.parse("2026-11-02T10:00:00Z");
  assert.equal(visitState({ started_at: null, meeting_id: null, updated_at: new Date(now).toISOString() }, now), "visited");
  assert.equal(visitState({ started_at: "x", meeting_id: "m", updated_at: new Date(now).toISOString() }, now), "booked");
  assert.equal(visitState({ started_at: "x", meeting_id: null, updated_at: new Date(now - 5 * 60_000).toISOString() }, now), "open", "still typing");
  assert.equal(visitState({ started_at: "x", meeting_id: null, updated_at: new Date(now - 40 * 60_000).toISOString() }, now), "started", "left: abandoned");
});

test("opens: scanners in the first minute don't count; the email keeps its words, with an HTML twin and the pixel", () => {
  const sent = "2026-11-02T10:00:00Z";
  assert.equal(countsAsOpen(sent, Date.parse(sent) + 20_000), false);
  assert.equal(countsAsOpen(sent, Date.parse(sent) + 5 * 60_000), true);
  assert.equal(countsAsOpen(null), false);
  const html = textToHtml("Hi <Sara>\nSee https://yolias.com/meet/a?r=1.", "https://www.yolias.com/api/o/abc");
  assert.ok(html.includes("Hi &lt;Sara&gt;<br>"), "escaped, line breaks kept");
  assert.ok(html.includes('<a href="https://yolias.com/meet/a?r=1">'), "links clickable, the full stop left out");
  assert.ok(html.includes('src="https://www.yolias.com/api/o/abc"'));
  const plain = decodeBase64Url(buildRawEmail({ from: "a@x.test", fromName: null, to: "b@x.test", subject: "Hi", body: "Hello" }));
  assert.ok(plain.includes('Content-Type: text/plain; charset="UTF-8"') && !plain.includes("multipart"), "no pixel: plain text as before");
  const tracked = decodeBase64Url(buildRawEmail({ from: "a@x.test", fromName: null, to: "b@x.test", subject: "Hi", body: "Hello", pixelUrl: "https://www.yolias.com/api/o/abc" }));
  assert.ok(tracked.includes("multipart/alternative") && tracked.includes("text/plain") && tracked.includes("text/html"));
});

test("pixel: events are cleaned, custom names allowed, bad ones dropped; domains", async () => {
  const { cleanEvent, domainAllowed } = await import("../../lib/pixel.ts");
  const ok = cleanEvent({ pixel: "0123456789abcdef", event: "Purchase", value: "99.5", currency: "usd", yc: "11111111-2222-3333-4444-555555555555", url: "https://shop.example.com/thanks" });
  assert.deepEqual([ok?.event, ok?.value, ok?.currency, ok?.yc], ["Purchase", 99.5, "USD", "11111111-2222-3333-4444-555555555555"]);
  assert.equal(cleanEvent({ pixel: "0123456789abcdef", event: "QuoteRequested" })?.event, "QuoteRequested", "custom event");
  assert.equal(cleanEvent({ pixel: "bad", event: "Purchase" }), null);
  assert.equal(cleanEvent({ pixel: "0123456789abcdef", event: "<script>" }), null);
  assert.equal(cleanEvent({ pixel: "0123456789abcdef", event: "Purchase", value: -5 })?.value, null, "no negative value");
  assert.equal(cleanEvent({ pixel: "0123456789abcdef", event: "Lead", yc: "not-a-uuid" })?.yc, null);
  assert.equal(domainAllowed("https://shop.example.com/x", []), true, "no list: any site");
  assert.equal(domainAllowed("https://shop.example.com/x", ["example.com"]), true, "subdomains of an allowed domain");
  assert.equal(domainAllowed("https://evil.com/?example.com", ["example.com"]), false);
});

test("objectives: tracked links, results, presets and what each optimizes for", async () => {
  const { trackedLink, aimOf } = await import("../../lib/outreach/aim.ts");
  const { RESULT_OF, PRESETS, customMetric, zeroCounts } = await import("../../lib/campaigns/metrics.ts");
  const { eventFor } = await import("../../lib/agent-core/optimizer.ts");
  assert.equal(trackedLink("https://shop.example.com/buy?x=1", "abc"), "https://shop.example.com/buy?x=1&yc=abc");
  assert.equal(trackedLink(null, "abc"), null);
  assert.deepEqual([aimOf("purchases"), aimOf("form_leads"), aimOf("meetings"), aimOf("qualified_leads")], ["sell", "form", "meeting", "meeting"]);
  assert.deepEqual(RESULT_OF.purchases, { result: "purchases", cost: "cost_per_purchase" });
  assert.ok(PRESETS.purchases.includes("purchase_roas") && PRESETS.form_leads.includes("form_leads") && PRESETS.meetings.includes("cost_per_meeting"));
  const c = { interested: 6, meetings: 0, held: 0, purchases: 5, formLeads: 0 };
  assert.equal(eventFor("purchases", c), "purchase");
  assert.equal(eventFor("form_leads", c), "positive", "too few forms: positive replies first");
  assert.equal(eventFor("qualified_leads", c), null, "finding only: equal split");
  const cpv = customMetric({ id: "x", name: "Cost per visit", a: "spend", op: "/", b: "site_visits", format: "usd" });
  assert.equal(cpv.id, "cm:x");
  assert.equal(cpv.compute({ ...zeroCounts(), spendUsd: 30, siteVisits: 10 }), 3);
  assert.equal(cpv.compute({ ...zeroCounts(), spendUsd: 30, siteVisits: 0 }), null, "never divides by zero");
});

test("xlsx: a valid zip with the sheet", async () => {
  const { xlsx, crc32 } = await import("../../lib/xlsx.ts");
  assert.equal(crc32(new TextEncoder().encode("hello")), 0x3610a686);
  const b = xlsx(["A", "B"], [["x", 1]]);
  assert.deepEqual([...b.slice(0, 4)], [0x50, 0x4b, 0x03, 0x04], "zip header");
});
