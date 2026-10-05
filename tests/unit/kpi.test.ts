import { test } from "node:test";
import assert from "node:assert/strict";
import { attainment, periodRange } from "@/lib/bos/kpi-metrics";
import { lifecycleTransitions } from "@/services/bos/employees";

test("periodRange: weekly (Sun start), monthly, quarterly, yearly", () => {
  assert.deepEqual(periodRange("weekly", "2026-09-30"), { start: "2026-09-27", end: "2026-10-03" });
  assert.deepEqual(periodRange("monthly", "2026-02-10"), { start: "2026-02-01", end: "2026-02-28" });
  assert.deepEqual(periodRange("quarterly", "2026-05-15"), { start: "2026-04-01", end: "2026-06-30" });
  assert.deepEqual(periodRange("yearly", "2026-05-15"), { start: "2026-01-01", end: "2026-12-31" });
});

test("attainment respects direction", () => {
  assert.equal(attainment(15, 20, "higher_better"), 75);
  assert.equal(attainment(2, 3, "lower_better"), 100);
  assert.equal(attainment(6, 3, "lower_better"), 50);
  assert.equal(attainment(null, 3, "higher_better"), null);
});

test("lifecycle transitions follow the HR rules", () => {
  assert.deepEqual(lifecycleTransitions.archived, []);
  // docs/bos/28 §42: Offboarding → Terminated → Archived.
  assert.deepEqual(lifecycleTransitions.offboarding, ["terminated"]);
  assert.deepEqual(lifecycleTransitions.terminated, ["archived"]);
  assert.ok(!lifecycleTransitions.pending_onboarding.includes("active"), "must pass through onboarding");
});

import { renderMarkdown, slugify } from "@/lib/bos/markdown";

test("markdown is sanitized: no raw HTML, scripts or javascript: links", () => {
  const html = renderMarkdown('# Title\n<script>alert(1)</script>\n[x](javascript:alert(1)) [ok](https://taysonsta.com)\n<iframe src="x"></iframe>\n- a\n- **b**');
  assert.ok(!html.includes("<script"));
  assert.ok(!html.includes("<iframe"));
  assert.ok(!html.includes("javascript:"));
  assert.ok(html.includes('<a href="https://taysonsta.com"'));
  assert.ok(html.includes("<h2>Title</h2>"));
  assert.ok(html.includes("<li><strong>b</strong></li>"));
  assert.equal(slugify("How to Qualify a Lead!"), "how-to-qualify-a-lead");
});
