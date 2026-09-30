// UI & system review (docs/bos/35 B7): employment data is changed by HR
// only (server-side, not just hidden in the UI); passwords are reset through
// an admin-sent recovery link; tasks are internal unless marked for clients.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "@/lib/bos/db";
import { bosUserFor } from "@/tests/integration/helpers";
import { updateEmployee } from "@/services/bos/employees";
import { sendStaffPasswordReset } from "@/services/bos/users";
import { ForbiddenError } from "@/lib/bos/errors";

const cleanup: (() => PromiseLike<unknown>)[] = [];
after(async () => {
  for (const fn of cleanup.reverse()) await Promise.resolve(fn()).catch((e) => console.error("cleanup", e));
});

test("an employee cannot edit their own employment record through a narrower scope", async () => {
  const dev = await bosUserFor("youssef.dev@taysonsta.local");
  // Even if a custom role granted employees.update on "own", self-edit is refused.
  const perms = new Map(dev.permissions);
  perms.set("employees.update", "own");
  const self = { ...dev, permissions: perms } as typeof dev;
  const { data: before } = await db().from("employees").select("position, updated_at").eq("id", dev.employee.id).single();
  await assert.rejects(updateEmployee(self, dev.employee.id, { position: "CEO" } as never, { canSensitive: false }), ForbiddenError);
  const { data: afterRow } = await db().from("employees").select("position").eq("id", dev.employee.id).single();
  assert.equal(afterRow!.position, before!.position, "nothing written");
});

test("admins send a password recovery link; the action is audited", async () => {
  const [admin, dev] = await Promise.all([bosUserFor("admin@taysonsta.local"), bosUserFor("youssef.dev@taysonsta.local")]);
  const started = new Date().toISOString();
  await sendStaffPasswordReset(admin, dev.employee.id, "http://localhost:3100");
  const { data: rows } = await db().from("audit_logs").select("id").eq("action", "user.password_reset_sent").eq("entity_id", dev.employee.id).gte("created_at", started);
  assert.equal(rows?.length, 1);
  cleanup.push(() => db().from("audit_logs").delete().in("id", rows!.map((r) => r.id)));
});

test("tasks are internal by default", async () => {
  const { data: col } = await db().from("tasks").select("client_visible").limit(20);
  assert.ok((col ?? []).length > 0);
  const { count } = await db().from("tasks").select("id", { count: "exact", head: true }).eq("client_visible", true).is("archived_at", null);
  assert.equal(count, 0, "existing tasks were not exposed by the migration");
});
