import { test } from "node:test";
import assert from "node:assert/strict";
import { draftIssues, freshSignals } from "../../lib/outreach/quality.ts";

const facts = { prospect_company: { name: "Al Noor Developments", signals: ["Launched North Riyadh project"], city: "Riyadh" } };
const body = "Khalid, congratulations on the North Riyadh launch. With two sales managers joining, filling their calendars early matters. We book meetings with buyers for developers in Riyadh, from your own mailbox. Would a short call next week be useful?";

test("draft quality", () => {
  assert.deepEqual(draftIssues(body, ["North Riyadh project launch"], facts), []);
  assert.deepEqual(draftIssues(body, ["Raised a Series B"], facts), ["unsupported_fact"]);
  assert.deepEqual(draftIssues(body + " Amazing!", [], facts), ["exclamation"]);
  assert.deepEqual(draftIssues("Hi. Want a call?", [], facts), ["too_short"]);
  assert.ok(draftIssues(`${body} ? ? ?`, [], facts).includes("questions"));
  assert.deepEqual(draftIssues(body, ["إطلاق مشروع شمال الرياض"], { c: { signals: ["أطلقت مشروعًا في شمال الرياض"] } }), [], "Arabic prefixes");
});

test("stale signals are dropped", () => {
  const now = Date.parse("2026-11-03T00:00:00Z");
  assert.ok("signals" in freshSignals({ name: "A", signals: ["x"] }, "2026-10-01T00:00:00Z", now));
  assert.ok(!("signals" in freshSignals({ name: "A", signals: ["x"], open_roles: ["y"] }, "2026-06-01T00:00:00Z", now)));
});
