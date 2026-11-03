import { test } from "node:test";
import assert from "node:assert/strict";
import { engagementOf, leadScore } from "../../lib/campaigns/lead-score.ts";

const all = { email: true, title: true, linkedin: true, phone: true };
test("lead score keeps fit and interest apart", () => {
  assert.deepEqual(leadScore({ fit: 100, signals: 3, completeness: all, engagement: "meeting" }), { fit: 100, interest: 100, score: 100 });
  assert.deepEqual(leadScore({ fit: 50, signals: 0, completeness: { ...all, phone: false, linkedin: false }, engagement: "none" }), { fit: 50, interest: 0, score: 25 });
  assert.equal(leadScore({ fit: null, signals: 1, completeness: all, engagement: "replied" }).fit, null);
});
test("engagement never counts opens", () => {
  assert.equal(engagementOf([{ direction: "outbound", analysis: null }]), "none");
  assert.equal(engagementOf([{ direction: "inbound", analysis: { kind: "question" } }]), "replied");
  assert.equal(engagementOf([{ direction: "inbound", analysis: { kind: "meeting_request" } }]), "interested");
});
