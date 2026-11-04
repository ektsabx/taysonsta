import { test } from "node:test";
import assert from "node:assert/strict";
import { Filled, applyFill } from "../../lib/campaigns/fill.ts";
import { builderSchema, emptyAdSet, missing } from "../../lib/campaigns/builder.ts";

const proposal = { name: "Clinics in Riyadh", offer: "More booked patients", meetings: 8, budget_usd: 50, messages_per_day: 25, audiences: [{ name: "Owners", countries: ["sa"], industries: ["Dental"], titles: ["Owner"], sizes: ["11-50"] }, { name: "Managers", countries: ["ae"], industries: [], titles: ["Clinic Manager"], sizes: [] }] };

test("Build with Yolias: a proposal lands in the builder as a valid campaign", () => {
  const base = builderSchema.parse({ adSets: [emptyAdSet(1, "Audience 1")] });
  const s = applyFill(base, Filled.parse(proposal));
  const parsed = builderSchema.safeParse(s);
  assert.ok(parsed.success, parsed.success ? "" : parsed.error.message);
  assert.equal(s.budgetUsd, 50); assert.equal(s.dailyLimit, 25); assert.equal(s.adSets.length, 2);
  assert.deepEqual(s.adSets[0].targeting.countries, { include: ["SA"] });
  assert.equal(s.adSets[1].targeting.industries, undefined);
  assert.equal(s.objective, base.objective);
  assert.ok(Array.isArray(missing(s, 0.1)));
});

test("Build with Yolias: a budget under $5 or no audience is refused", () => {
  assert.equal(Filled.safeParse({ ...proposal, budget_usd: 4 }).success, false);
  assert.equal(Filled.safeParse({ ...proposal, audiences: [] }).success, false);
});
