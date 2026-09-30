import { test } from "node:test";
import assert from "node:assert/strict";
import { detectLang, routeByKeywords, tools } from "@/lib/bos/assistant-catalog";

// Master upgrade Phase 17 (docs/bos/30 §25): fixed read-only tool catalogue and the no-AI router.
test("catalogue: fixed tools, each with a description; no SQL tool", () => {
  assert.ok(tools.length >= 10);
  assert.ok(!tools.some((t) => /sql|query_db|raw/i.test(t.name)));
  for (const t of tools) assert.ok(t.description.length > 10, t.name);
});

test("keyword routing respects permissions and falls back to the daily summary", () => {
  const all = tools.map((t) => t.name);
  assert.deepEqual(routeByKeywords("ما الفواتير المستحقة؟", all), ["outstanding_invoices"]);
  assert.ok(routeByKeywords("overdue tasks and projects at risk", all).includes("overdue_tasks"));
  assert.deepEqual(routeByKeywords("ما الفواتير المستحقة؟", ["today_problems", "overdue_tasks"]), ["today_problems"], "no invoice permission → summary");
  assert.deepEqual(routeByKeywords("hello", ["overdue_tasks"]), []);
  assert.equal(detectLang("ما أهم المشاكل اليوم"), "ar");
  assert.equal(detectLang("top problems today"), "en");
});
