// Yolias AI control center (D-141): the Admin edits a draft of the agent
// policy, publishes it, rolls back to an earlier version and discards drafts;
// invalid values are refused; everything is audited. Restores the original
// published version afterwards.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { ydb, yoliasConfigured } from "@/lib/yolias/db";
import { bosUserFor } from "@/tests/integration/helpers";
import { discardDraft, policyState, publishDraft, restoreVersion, savePolicySection } from "@/services/yolias/agent-policy";
import { ValidationError } from "@/lib/bos/errors";

const skip = !yoliasConfigured();
let original: { id: string; version: number } | null = null;
const created: number[] = [];

after(async () => {
  if (skip) return;
  // Put things back exactly as they were.
  const y = ydb();
  if (created.length) await y.from("agent_policies").delete().in("version", created).neq("status", "published");
  if (original) {
    const { data: pub } = await y.from("agent_policies").select("id, version").eq("status", "published").maybeSingle();
    if (pub && pub.id !== original.id) {
      await y.from("agent_policies").update({ status: "archived" }).eq("id", pub.id);
      await y.from("agent_policies").update({ status: "published" }).eq("id", original.id);
      await y.from("agent_policies").delete().eq("id", pub.id);
    }
  }
  await y.from("agent_policies").delete().in("version", created).neq("status", "published");
});

test("agent policy: draft → publish → rollback → discard", { skip }, async () => {
  const admin = await bosUserFor("admin@taysonsta.local");
  const start = await policyState();
  assert.ok(start.published, "a published version exists");
  original = { id: start.published!.id, version: start.published!.version };
  if (start.draft) await discardDraft(admin);

  await savePolicySection(admin, "identity", { ...start.published!.policy.identity, name: "Yoli Test" });
  let s = await policyState();
  assert.ok(s.draft); created.push(s.draft!.version);
  assert.equal(s.draft!.policy.identity.name, "Yoli Test");
  assert.equal(s.published!.policy.identity.name, start.published!.policy.identity.name, "customers still get the published version");
  assert.deepEqual(s.draft!.changed, ["identity"]);

  await assert.rejects(() => savePolicySection(admin, "limits", { ...s.draft!.policy.limits, perDay: -1 }), ValidationError);

  await publishDraft(admin, "test publish");
  s = await policyState();
  assert.equal(s.published!.version, created[0]);
  assert.equal(s.published!.policy.identity.name, "Yoli Test");
  assert.equal(s.versions.find((v) => v.version === original!.version)!.status, "archived");

  await restoreVersion(admin, original!.version);
  s = await policyState();
  assert.ok(s.draft); created.push(s.draft!.version);
  assert.equal(s.draft!.policy.identity.name, start.published!.policy.identity.name, "rollback brings the old settings back as a draft");
  await discardDraft(admin);
  assert.equal((await policyState()).draft, null);

  const { data: audit } = await (await import("@/lib/bos/db")).db().from("audit_logs").select("action").like("action", "yolias.agent_policy.%").order("created_at", { ascending: false }).limit(10);
  for (const a of ["yolias.agent_policy.section_saved", "yolias.agent_policy.published", "yolias.agent_policy.restored", "yolias.agent_policy.draft_discarded"]) {
    assert.ok(audit!.some((r) => r.action === a), `audited: ${a}`);
  }
});
