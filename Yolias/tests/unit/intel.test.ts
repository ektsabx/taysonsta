import { test } from "node:test";
import assert from "node:assert/strict";
import { route, nextHealth, type ProviderState } from "../../lib/intel/routing.ts";
import { fingerprintIcp, normalizeIcp } from "../../lib/intel/fingerprint.ts";
import { llmCostUsd, unitCost } from "../../lib/intel/pricing.ts";
import { retryDelayMs, retryable } from "../../lib/intel/http.ts";
import type { IcpCriteria } from "../../lib/discovery/icp.ts";

const base: ProviderState = {
  id: "a", enabled: true, priority: 100, implemented: ["company.search"], hasAdapter: true, needsCredential: true, hasCredential: true,
  unitCostUsd: 0.02, storageAllowed: true, dailyBudgetUsd: null, monthlyBudgetUsd: null, spentTodayUsd: 0, spentMonthUsd: 0,
  consecutiveFailures: 0, circuitOpenUntil: null,
};
const p = (o: Partial<ProviderState>): ProviderState => ({ ...base, ...o });

test("routing: skips with a reason and never picks an unusable provider", () => {
  const now = new Date("2026-10-01T12:00:00Z");
  const r = route("company.search", [
    p({ id: "off", enabled: false }),
    p({ id: "nocode", hasAdapter: false, implemented: [] }),
    p({ id: "people", implemented: ["person.search"] }),
    p({ id: "nokey", hasCredential: false }),
    p({ id: "open", circuitOpenUntil: "2026-10-01T12:05:00Z" }),
    p({ id: "lic", storageAllowed: false }),
    p({ id: "day", dailyBudgetUsd: 5, spentTodayUsd: 5 }),
    p({ id: "month", monthlyBudgetUsd: 100, spentMonthUsd: 120 }),
    p({ id: "ok" }),
  ], now);
  assert.deepEqual(r.usable.map((x) => x.id), ["ok"]);
  assert.deepEqual(Object.fromEntries(r.skipped.map((s) => [s.id, s.reason])), {
    off: "disabled", nocode: "no_adapter", people: "no_capability", nokey: "no_credentials", open: "circuit_open",
    lic: "storage_not_allowed", day: "daily_budget", month: "monthly_budget",
  });
});

test("routing: priority, then cheapest, then healthiest; an expired circuit is closed", () => {
  const now = new Date("2026-10-01T12:00:00Z");
  const r = route("company.search", [
    p({ id: "pricey", unitCostUsd: 0.1 }),
    p({ id: "cheap", unitCostUsd: 0.01 }),
    p({ id: "flaky", unitCostUsd: 0.01, consecutiveFailures: 3 }),
    p({ id: "first", priority: 10, unitCostUsd: 1 }),
    p({ id: "unpriced", unitCostUsd: null }),
    p({ id: "reopened", unitCostUsd: 0.5, circuitOpenUntil: "2026-10-01T11:00:00Z" }),
  ], now);
  assert.deepEqual(r.usable.map((x) => x.id), ["first", "cheap", "flaky", "pricey", "reopened", "unpriced"]);
});

test("health: failures open the circuit, a success closes it", () => {
  const now = new Date("2026-10-01T12:00:00Z");
  let h = {};
  for (let i = 0; i < 4; i++) h = nextHealth(h, false, "boom", { failures: 5, open_seconds: 60 }, now);
  assert.equal((h as { circuit_open_until: string | null }).circuit_open_until, null);
  h = nextHealth(h, false, "boom", { failures: 5, open_seconds: 60 }, now);
  assert.equal((h as { circuit_open_until: string }).circuit_open_until, "2026-10-01T12:01:00.000Z");
  h = nextHealth(h, true, null, { failures: 5, open_seconds: 60 }, now);
  assert.deepEqual([(h as { consecutive_failures: number }).consecutive_failures, (h as { circuit_open_until: null }).circuit_open_until], [0, null]);
});

const icp: IcpCriteria = {
  campaign_name: "UAE Fintech", summary: "s", target_count: 100, target_unit: "prospects", countries: ["AE", "SA"], cities: [" Dubai "],
  industries: ["Fintech", "SaaS"], keywords: [], employees_min: 50, employees_max: 200, job_titles: ["CEO", "CTO"], seniorities: ["c_level"],
  hiring: null, hiring_roles: [], funding_stages: [], technologies: [], exclusions: [], assumptions: ["a"],
};

test("fingerprint: same audience in any order/case/spacing ⇒ same hash; different audience ⇒ different", () => {
  const same: IcpCriteria = { ...icp, campaign_name: "Other name", summary: "x", target_count: 30, assumptions: [], countries: ["sa", "AE"], cities: ["dubai"], industries: ["saas", "FINTECH"], job_titles: ["cto", "ceo"] };
  assert.equal(fingerprintIcp(icp), fingerprintIcp(same));
  assert.notEqual(fingerprintIcp(icp), fingerprintIcp({ ...icp, countries: ["EG"] }));
  assert.notEqual(fingerprintIcp(icp), fingerprintIcp({ ...icp, employees_max: 500 }));
  assert.match(fingerprintIcp(icp), /^[0-9a-f]{64}$/);
  assert.deepEqual(normalizeIcp(icp).countries, ["AE", "SA"]);
});

test("pricing: LLM cost from configured prices; unpriced is null, not $0", () => {
  const price = { input: 4, output: 20, cache_read_multiplier: 0.1, cache_write_multiplier: 1.25 };
  assert.equal(llmCostUsd({ input_tokens: 1_000_000, output_tokens: 0 }, price), 4);
  assert.equal(llmCostUsd({ input_tokens: 1000, output_tokens: 500 }, price), 0.014);
  assert.equal(llmCostUsd({ input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 1_000_000 }, price), 0.4);
  assert.equal(llmCostUsd({ input_tokens: 10, output_tokens: 10 }, undefined), null);
  assert.equal(unitCost({ "company.search": { unit: "record", unit_cost_usd: 0.03 } }, "company.search"), 0.03);
  assert.equal(unitCost({}, "company.search"), null);
});

test("http: retries only 429/5xx and honours Retry-After", () => {
  assert.equal(retryable(429), true);
  assert.equal(retryable(503), true);
  assert.equal(retryable(404), false);
  assert.equal(retryDelayMs(1, "3"), 3000);
  assert.equal(retryDelayMs(1, "120"), 30_000, "capped");
  assert.equal(retryDelayMs(1, null), 500);
  assert.equal(retryDelayMs(3, null), 2000);
});
