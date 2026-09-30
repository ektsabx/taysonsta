import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement as h, Fragment } from "react";
import { countRows } from "@/lib/bos/table-rows";
import { guideFor, pageGuides } from "@/lib/bos/page-guides";
import { connState } from "@/lib/bos/integrations/state";
import { navigation } from "@/lib/bos/nav";
import { onColor, brandStyle, brandFontHref } from "@/lib/bos/branding";

// UI & system review (docs/bos/35): record summary counting, page guides,
// integration status honesty, navigation structure and branding tokens.
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

test("navigation: products standalone under the assistant, removed pages gone, sub-pages nested", () => {
  const keys = navigation.map((g) => g.key);
  assert.equal(keys.indexOf("products"), keys.indexOf("assistant") + 1);
  assert.ok(!keys.includes("website"), "website section removed");
  const hrefs = navigation.flatMap((g) => [g.href, ...(g.items ?? []).flatMap((i) => [i.href, ...(i.children ?? []).map((c) => c.href)])]).filter(Boolean) as string[];
  for (const gone of ["/admin/settings/pricing", "/admin/settings/commission", "/admin/settings/products"]) assert.ok(!hrefs.includes(gone), gone);
  for (const nested of ["/admin/team/payroll/loans", "/admin/ads/accounts", "/admin/content/ideas", "/admin/team/attendance/corrections", "/admin/settings/branches", "/admin/reports/bd"]) assert.ok(hrefs.includes(nested), nested);
});

test("branding: readable text on the brand colour, tokens and font stylesheet", () => {
  assert.equal(onColor("#e51f26"), "#ffffff");
  assert.equal(onColor("#facc15"), "#111827");
  const b = { brand_primary: "#0f766e", brand_accent: "#f59e0b", brand_success: "", brand_warning: "#b45309", brand_danger: "", brand_info: "", brand_font_ar: "Cairo", brand_font_en: "Inter" } as const;
  const s = brandStyle(b, "ar") as Record<string, string>;
  assert.equal(s["--bos-accent"], "#0f766e");
  assert.equal(s["--bos-secondary"], "#f59e0b");
  assert.equal(s["--bos-warning"], "#b45309");
  assert.ok(!("--bos-success" in s), "empty status colour keeps the theme default");
  assert.match(s["--font-main"], /^"Cairo"/);
  assert.match(brandFontHref(b) ?? "", /family=Cairo/);
  assert.equal(brandFontHref({ ...b, brand_font_ar: "IBM Plex Sans Arabic" }), null);
});
