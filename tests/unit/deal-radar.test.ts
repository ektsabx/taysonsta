import { test } from "node:test";
import assert from "node:assert/strict";
import { radarFlags, scoreDeal, topQuartile, type DealSignals } from "@/lib/bos/deal-radar";

// Master upgrade Phase 13 (docs/bos/30 §17): transparent rule-based estimate,
// bands, confidence, flags, intervention threshold.
const base = (o: Partial<DealSignals> = {}): DealSignals => ({ stageProbability: 40, stageKey: "proposal", expectedClose: "2026-10-15", today: "2026-09-30", daysSinceLastActivity: 3, hasNextActivity: true, nextActivityOverdue: false, inboundLast14: true, proposalStatus: "viewed", contractStatus: null, openBlockers: 0, historicStageWinRate: null, ...o });

test("estimate = base + named signals, rounded to 5, clamped, with a band", () => {
  const s = scoreDeal(base());
  assert.equal(s.base, 40);
  assert.equal(s.baseSource, "stage");
  assert.deepEqual(s.contributions.map((c) => c.key).sort(), ["client_replied", "proposal_viewed", "recent_activity"]);
  assert.equal(s.estimate, 55);
  assert.equal(s.band, "medium");
  const bad = scoreDeal(base({ proposalStatus: "rejected", daysSinceLastActivity: 40, hasNextActivity: false, inboundLast14: false, expectedClose: "2026-08-01" }));
  assert.equal(bad.estimate, 5, "clamped at 5, never 0");
  assert.equal(bad.band, "low");
  const great = scoreDeal(base({ stageProbability: 80, contractStatus: "partially_signed", proposalStatus: "accepted" }));
  assert.equal(great.estimate, 95, "clamped at 95, never certain");
});

test("historic win rate replaces the stage probability only when provided", () => {
  const s = scoreDeal(base({ historicStageWinRate: 25, proposalStatus: null, inboundLast14: false, daysSinceLastActivity: 10 }));
  assert.equal(s.baseSource, "history");
  assert.equal(s.base, 25);
});

test("confidence is low with little evidence", () => {
  assert.equal(scoreDeal(base({ proposalStatus: null, contractStatus: null, daysSinceLastActivity: null })).confidence, "low");
  assert.equal(scoreDeal(base({ contractStatus: "sent" })).confidence, "medium");
});

test("flags: near closing, overdue, stale, intervention for big risky deals", () => {
  const f = radarFlags(base({ stageProbability: 10, expectedClose: "2026-10-10" }), 1000, 50000);
  assert.equal(f.nearClosing, true, "close date within horizon");
  assert.equal(f.closeIn, 10);
  const late = radarFlags(base({ expectedClose: "2026-09-01", daysSinceLastActivity: 20 }), 60000, 50000);
  assert.equal(late.overdue, true);
  assert.equal(late.stale, true);
  assert.equal(late.intervention, true);
  assert.equal(radarFlags(base({ expectedClose: "2026-09-01" }), 1000, 50000).intervention, false, "small deals don't need a manager");
  assert.equal(topQuartile([10, 20, 30, 40, 50, 60, 70, 80]), 70);
});
