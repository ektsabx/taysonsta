import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement as h, Fragment } from "react";
import { countRows } from "@/lib/bos/table-rows";
import { guideFor, pageGuides } from "@/lib/bos/page-guides";
import { connState } from "@/lib/bos/integrations/state";
import { navigation } from "@/lib/bos/nav";

// UI & system review (docs/bos/35): record summary counting, page guides,
// integration status honesty and navigation structure.
const arabic = /[؀-ۿ]/;

test("record summary counts body rows, ignores header and the colSpan empty row", () => {
  const rows = [1, 2, 3].map((i) => h("tr", { key: i }, h("td", null, i)));
  assert.equal(countRows([h("thead", { key: "h" }, h("tr", null, h("th", null, "x"))), h("tbody", { key: "b" }, rows)]), 3);
  assert.equal(countRows(h("tbody", null, h("tr", null, h("td", { colSpan: 4 }, "empty")))), 0);
  assert.equal(countRows(h("tbody", null, h(Fragment, null, rows, null, false))), 3);
  assert.equal(countRows(null), 0);
});

test("page guides: longest prefix wins, both languages complete, English has no Arabic", () => {
  assert.equal(guideFor("/admin/settings/integrations")?.en.title, "Integrations hub");
  assert.equal(guideFor("/admin/settings/roles")?.en.title, "Settings");
  assert.equal(guideFor("/admin/team/leave/balances")?.en.title, "Leave");
  assert.equal(guideFor("/portal"), null);
  for (const [k, g] of Object.entries(pageGuides)) {
    for (const lang of ["ar", "en"] as const) {
      assert.ok(g[lang].title && g[lang].purpose && g[lang].owner && g[lang].steps.length >= 2, `${k} ${lang}`);
    }
    assert.ok(!arabic.test(JSON.stringify(g.en)), `${k} en contains Arabic`);
  }
});

test("integration status: connected only after a passed live test", () => {
  assert.equal(connState({ status: "active", last_test_ok: null }, true).label, "لم يُختبر بعد");
  assert.equal(connState({ status: "active", last_test_ok: true }, true).tone, "success");
  assert.equal(connState({ status: "active", last_test_ok: false }, true).tone, "danger");
  assert.equal(connState({ status: "error", last_test_ok: true }, true).tone, "danger");
  assert.equal(connState({ status: "active", last_test_ok: null }, false).tone, "neutral", "untestable providers are never shown as connected");
  assert.equal(connState({ status: "disabled", last_test_ok: true }, true).tone, "neutral");
});

test("navigation: removed modules and pages gone, sub-pages nested", () => {
  const keys = navigation.map((g) => g.key);
  for (const k of ["products", "projects", "automation"]) assert.ok(!keys.includes(k), k);
  assert.ok(!keys.includes("website"), "website section removed");
  const hrefs = navigation.flatMap((g) => [g.href, ...(g.items ?? []).flatMap((i) => [i.href, ...(i.children ?? []).map((c) => c.href)])]).filter(Boolean) as string[];
  for (const gone of ["/admin/settings/pricing", "/admin/settings/commission", "/admin/settings/products", "/admin/support/widgets", "/admin/social/accounts", "/admin/ads/accounts", "/admin/projects", "/admin/products", "/admin/automation", "/admin/settings/branches", "/admin/settings/cameras", "/admin/settings/it", "/admin/communication/messaging", "/admin/content/insights"]) assert.ok(!hrefs.includes(gone), gone);
  const support = navigation.find((g) => g.key === "support")!.items!.map((i) => i.href);
  assert.deepEqual(support, ["/admin/support", "/admin/support/inbox", "/admin/support/spam", "/admin/support/ai-agents", "/admin/support/tickets", "/admin/support/knowledge"], "support shows exactly the six pages in order");
  for (const nested of ["/admin/team/payroll/loans", "/admin/settings/integrations/ads", "/admin/settings/integrations/widgets", "/admin/support/spam", "/admin/support/knowledge", "/admin/content/ideas", "/admin/team/attendance/corrections", "/admin/reports/bd"]) assert.ok(hrefs.includes(nested), nested);
});

