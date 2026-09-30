import { test } from "node:test";
import assert from "node:assert/strict";
import { pageAllowed } from "@/lib/bos/page-access";

// Page-level restrictions (docs/bos/30 §6, doc 31 Phase 3).
test("page restrictions: prefix match, all matching rules apply, super admin passes", () => {
  const rules = [
    { prefix: "/admin/finance", role_keys: ["finance", "admin"] },
    { prefix: "/admin/finance/revenue", role_keys: ["executive"] },
  ];
  assert.equal(pageAllowed(rules, "/admin/dashboard", ["employee"], false), true, "unrestricted path");
  assert.equal(pageAllowed(rules, "/admin/finance/invoices", ["finance"], false), true);
  assert.equal(pageAllowed(rules, "/admin/finance/invoices?page=2", ["employee"], false), false, "query string ignored");
  assert.equal(pageAllowed(rules, "/admin/financex", ["employee"], false), true, "prefix is a path segment, not a string prefix");
  assert.equal(pageAllowed(rules, "/admin/finance/revenue", ["finance"], false), false, "nested rule must also pass");
  assert.equal(pageAllowed(rules, "/admin/finance/revenue", ["finance", "executive"], false), true);
  assert.equal(pageAllowed(rules, "/admin/finance/revenue/", ["finance", "executive"], false), true, "trailing slash");
  assert.equal(pageAllowed(rules, "/admin/finance/revenue", [], true), true, "super admin");
});
