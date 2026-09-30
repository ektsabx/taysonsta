import { test } from "node:test";
import assert from "node:assert/strict";
import { bosUserFor } from "@/tests/integration/helpers";

test("services load and BosUser resolves", async () => {
  const admin = await bosUserFor("admin@taysonsta.local");
  assert.ok(admin.isSuperAdmin);
  assert.equal(admin.permissions.get("employees.read"), "all");
});
