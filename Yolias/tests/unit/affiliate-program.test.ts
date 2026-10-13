import { test } from "node:test";
import assert from "node:assert/strict";
import { commissionFor, formatCents, parseProgramSettings } from "../../lib/affiliates/program.ts";

test("program settings: broken or missing values fall back to the safe side", () => {
  const s = parseProgramSettings({});
  assert.equal(s.enabled, false, "closed unless enabled");
  assert.equal(s.commission.percentBps, 0, "no commission unless configured");
  assert.equal(s.eligible.plans.length, 0);
  assert.equal(s.recurring.enabled, false);
  const bad = parseProgramSettings({ enabled: "yes", commission: { type: "percent", percent_bps: 50000 }, attribution: { days: 0, model: "x" }, eligible: { plans: ["pro", "enterprise"] } });
  assert.equal(bad.enabled, false);
  assert.equal(bad.commission.percentBps, 0, "over 100% is refused");
  assert.equal(bad.attribution.days, 30); assert.equal(bad.attribution.model, "first_touch");
  assert.deepEqual(bad.eligible.plans, ["pro"]);
});

test("commission maths in cents, like the database (floor)", () => {
  const pct = parseProgramSettings({ commission: { type: "percent", percent_bps: 2000 } });
  assert.equal(commissionFor(pct, 999), 199);
  assert.equal(commissionFor(pct, 1000), 200);
  const fixed = parseProgramSettings({ commission: { type: "fixed", fixed_cents: 2500 } });
  assert.equal(commissionFor(fixed, 1000), 1000, "never more than the payment");
  assert.equal(commissionFor(fixed, 9900), 2500);
  assert.equal(formatCents(12345), "$123.45");
});
