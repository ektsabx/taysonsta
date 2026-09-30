// Settings (docs/bos/22 testing requirements).
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "@/lib/bos/db";
import { bosUserFor, uniq } from "@/tests/integration/helpers";
import { saveSettingSection, saveConfigRow, removeConfigRow, savePipelineStages, setRolePermission, saveRole, archiveRole, addSubscription } from "@/services/bos/settings-admin";
import { getSetting } from "@/lib/bos/settings";
import { ValidationError } from "@/lib/bos/errors";

const cleanup: (() => PromiseLike<unknown>)[] = [];
after(async () => {
  for (const fn of cleanup.reverse()) await Promise.resolve(fn()).catch(() => undefined);
});

test("setting section save is validated and audited (old/new)", async () => {
  const admin = await bosUserFor("admin@taysonsta.local");
  const before = await getSetting("notifications");
  await assert.rejects(saveSettingSection(admin, "notifications", { meeting_reminder_minutes: -5 }), ValidationError);
  await saveSettingSection(admin, "notifications", { ...before, meeting_reminder_minutes: 45 });
  cleanup.push(() => saveSettingSection(admin, "notifications", before));
  assert.equal((await getSetting("notifications")).meeting_reminder_minutes, 45);
  const { data: a } = await db().from("audit_logs").select("old_value, new_value").eq("action", "settings.updated").contains("metadata", { key: "notifications" }).order("created_at", { ascending: false }).limit(1).single();
  assert.equal((a!.new_value as { meeting_reminder_minutes: number }).meeting_reminder_minutes, 45);
  assert.equal((a!.old_value as { meeting_reminder_minutes: number }).meeting_reminder_minutes, before.meeting_reminder_minutes);
});

test("config rows: validation, create/update, used rows are deactivated not deleted", async () => {
  const admin = await bosUserFor("admin@taysonsta.local");
  await assert.rejects(saveConfigRow(admin, "exchange_rates", null, { base: "USD", quote: "USD", rate: "1", effective_date: "2026-01-01" }), ValidationError);
  await assert.rejects(saveConfigRow(admin, "work_schedules", null, { name: "Bad", work_days: [0], start_time: "18:00", end_time: "10:00", timezone: "Africa/Cairo" }), ValidationError);
  const id = await saveConfigRow(admin, "lead_sources", null, { name: uniq("Src"), sort_order: 99, is_active: true });
  assert.equal(await removeConfigRow(admin, "lead_sources", id!), "deleted", "unused → deleted");
  const { data: used } = await db().from("leads").select("source_id").not("source_id", "is", null).limit(1).single();
  const mode = await removeConfigRow(admin, "lead_sources", used!.source_id!);
  cleanup.push(() => db().from("lead_sources").update({ is_active: true }).eq("id", used!.source_id!));
  assert.equal(mode, "deactivated", "referenced → deactivated");
});

test("pipeline stages: exactly one won and one lost per deal pipeline", async () => {
  const admin = await bosUserFor("admin@taysonsta.local");
  const { data: p } = await db().from("pipelines").select("id, pipeline_stages(id, key, name, probability, category, is_active, sort_order)").eq("entity", "deal").eq("is_default", true).single();
  const stages = ((p!.pipeline_stages as unknown as { id: string; key: string; name: string; probability: number; category: "open" | "won" | "lost"; is_active: boolean; sort_order: number }[]) ?? []).sort((a, b) => a.sort_order - b.sort_order).map((s) => ({ id: s.id, key: s.key, name: s.name, probability: Number(s.probability), category: s.category, is_active: s.is_active }));
  await assert.rejects(savePipelineStages(admin, p!.id, stages.map((s) => (s.category === "lost" ? { ...s, category: "won" as const } : s))), ValidationError);
  await savePipelineStages(admin, p!.id, stages); // unchanged save is valid
});

test("permission matrix change takes effect; super admin locked; role archive rules", async () => {
  const admin = await bosUserFor("admin@taysonsta.local");
  const roleId = await saveRole(admin, null, { key: uniq("tmp_role").replace(/[^a-z_]/g, "_"), name: "Temp", description: null, sort_order: 99 });
  cleanup.push(() => db().from("roles").delete().eq("id", roleId));
  const { data: perm } = await db().from("permissions").select("id").eq("key", "reports.read").single();
  await setRolePermission(admin, roleId, perm!.id, "team");
  const { data: rp } = await db().from("role_permissions").select("scope").eq("role_id", roleId).eq("permission_id", perm!.id).single();
  assert.equal(rp!.scope, "team");
  const { data: sa } = await db().from("roles").select("id").eq("key", "super_admin").single();
  await assert.rejects(setRolePermission(admin, sa!.id, perm!.id, null), ValidationError);
  const { data: dev } = await db().from("roles").select("id").eq("key", "developer").single();
  await assert.rejects(archiveRole(admin, dev!.id, true), ValidationError, "system roles not archivable");
  await archiveRole(admin, roleId, true);
});

test("notification subscription change affects recipients", async () => {
  const admin = await bosUserFor("admin@taysonsta.local");
  const hana = await bosUserFor("hana@taysonsta.local");
  const type = "kb.policy_updated";
  await addSubscription(admin, { event_type: type, kind: "user", value: hana.userId, channels: ["in_app"], user_configurable: true });
  cleanup.push(() => db().from("notification_subscriptions").delete().eq("event_type", type).eq("user_id", hana.userId));
  const { emitEvent } = await import("@/lib/bos/events");
  const id = crypto.randomUUID();
  const eventId = await emitEvent({ type, entityType: "kb_article", entityId: id, summary: "Policy updated test", actorId: admin.userId, dedupeKey: `sub-test:${id}` });
  const { data: n } = await db().from("notifications").select("id").eq("user_id", hana.userId).eq("event_id", eventId!);
  assert.equal(n?.length, 1);
});
