import { test } from "node:test";
import assert from "node:assert/strict";
import { auditInput, authorize, rolePermissions, type AgentActor } from "../../lib/agent/authz.ts";

const actor: AgentActor = { userId: "u", workspaceId: "w1", role: "member", active: true };

test("agent authz: inactive workspaces can't use tools", () => {
  assert.deepEqual(authorize({ ...actor, active: false }, "read"), { ok: false, reason: "inactive" });
});

test("agent authz: permission comes from the role table, not the prompt", () => {
  for (const role of ["owner", "admin", "member"] as const) {
    for (const p of rolePermissions[role]) assert.equal(authorize({ ...actor, role }, p).ok, true);
  }
  assert.deepEqual(authorize({ ...actor, role: "viewer" as never }, "read"), { ok: false, reason: "forbidden" });
});

test("agent authz: a resource from another workspace is refused", () => {
  assert.deepEqual(authorize(actor, "read", "w2"), { ok: false, reason: "wrong_workspace" });
  assert.equal(authorize(actor, "read", "w1").ok, true);
});

test("agent audit input is trimmed", () => {
  const out = auditInput({ request: "x".repeat(900), list: Array.from({ length: 80 }, (_, i) => i) }) as { request: string; list: number[] };
  assert.equal(out.request.length, 501);
  assert.equal(out.list.length, 50);
});

test("saved turns become valid API messages", async () => {
  const { toMessages } = await import("../../lib/agent/messages.ts");
  const out = toMessages([
    { role: "assistant", text: "orphan" },
    { role: "user", text: "a" },
    { role: "user", text: "b" },
    { role: "assistant", text: "c" },
  ]);
  assert.deepEqual(out, [{ role: "user", content: "a\n\nb" }, { role: "assistant", content: "c" }]);
});
