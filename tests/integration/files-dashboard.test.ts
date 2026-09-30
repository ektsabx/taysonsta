import { test, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "@/lib/bos/db";
import { bosUserFor, uniq } from "@/tests/integration/helpers";
import { canReadFile, purgeFile, restoreFile } from "@/services/bos/files";
import { resolveWidgets } from "@/services/bos/dashboard-layout";

const cleanup: (() => PromiseLike<unknown>)[] = [];
after(async () => {
  for (const fn of cleanup.reverse()) await Promise.resolve(fn()).catch(() => undefined);
});

test("file access follows parent record; shares grant access; purge rules", async () => {
  const ahmed = await bosUserFor("ahmed@taysonsta.local");
  const sara = await bosUserFor("sara@taysonsta.local");
  const admin = await bosUserFor("admin@taysonsta.local");
  const { data: lead } = await db().from("leads").select("id").eq("assigned_to", sara.userId).limit(1).single();
  const { data: file } = await db().from("files").insert({ storage_path: `test/${uniq("f")}.txt`, name: "sara-lead.txt", entity_type: "lead", entity_id: lead!.id, uploaded_by: sara.userId, is_finalized: true }).select("*").single();
  cleanup.push(() => db().from("files").delete().eq("id", file!.id));
  assert.equal(await canReadFile(sara, file!), true);
  assert.equal(await canReadFile(ahmed, file!), false, "BD cannot read another BD's lead file");
  await db().from("file_shares").insert({ file_id: file!.id, shared_with_user_id: ahmed.userId, created_by: sara.userId });
  assert.equal(await canReadFile(ahmed, file!), true, "explicit share grants access");

  await assert.rejects(purgeFile(admin, file!.id), "must soft-delete first");
  await db().from("files").update({ deleted_at: new Date().toISOString() }).eq("id", file!.id);
  await restoreFile(sara, file!.id);
  const { data: restored } = await db().from("files").select("deleted_at").eq("id", file!.id).single();
  assert.equal(restored!.deleted_at, null);
  await assert.rejects(purgeFile(sara, file!.id), "only super admin purges");

  const { data: contract } = await db().from("contracts").select("id").limit(1).single();
  const { data: cf } = await db().from("files").insert({ storage_path: `test/${uniq("c")}.pdf`, name: "contract.pdf", entity_type: "contract", entity_id: contract!.id, uploaded_by: admin.userId, is_finalized: true, deleted_at: new Date().toISOString() }).select("id").single();
  cleanup.push(() => db().from("files").delete().eq("id", cf!.id));
  await assert.rejects(purgeFile(admin, cf!.id), "contract files are never purged");
});

test("dashboard: personal layout overrides role layout and never shows unpermitted widgets", async () => {
  const ahmed = await bosUserFor("ahmed@taysonsta.local");
  const before = await resolveWidgets(ahmed);
  assert.ok(before.length > 0);
  assert.ok(!before.some((w) => w.key === "fin_profitability"), "no finance widget for BD");
  await db().from("dashboard_layouts").insert({ user_id: ahmed.userId, widgets: [{ key: "my_leads" }, { key: "fin_profitability" }] });
  cleanup.push(() => db().from("dashboard_layouts").delete().eq("user_id", ahmed.userId));
  const after = await resolveWidgets(ahmed);
  assert.deepEqual(after.map((w) => w.key), ["my_leads"], "personal order applied; unpermitted widget filtered out");
});
