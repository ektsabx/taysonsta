// Automation engine + builder (docs/bos/20 testing requirements).
import { test, after } from "node:test";
import assert from "node:assert/strict";
import "@/services/bos/approval-handlers";
import { db } from "@/lib/bos/db";
import { bosUserFor, uniq } from "@/tests/integration/helpers";
import { saveRule, dryRun, retryRun, validateRule, type RuleInput } from "@/services/bos/automation";
import { emitEvent, dispatchPendingEvents } from "@/lib/bos/events";
import { evaluateConditions } from "@/lib/bos/automation/conditions";
import { ValidationError } from "@/lib/bos/errors";

const cleanup: (() => PromiseLike<unknown>)[] = [];
after(async () => {
  for (const fn of cleanup.reverse()) await Promise.resolve(fn()).catch(() => undefined);
});

const base = (patch: Partial<RuleInput>): RuleInput => ({ name: uniq("Test rule"), description: null, trigger_event: "deal.won", conditions: [], condition_logic: "all", actions: [{ type: "notify", params: { recipients: [{ kind: "role", value: "finance" }], title: "Won {{payload.deal_name}}" } }], is_active: true, run_once_per_entity: false, priority: 0, ...patch });

test("validation: catalogue trigger, known actions, safe templates only", () => {
  assert.throws(() => validateRule(base({ trigger_event: "made.up" })), ValidationError);
  assert.throws(() => validateRule(base({ actions: [{ type: "rm_rf", params: {} }] })), ValidationError);
  assert.throws(() => validateRule(base({ actions: [{ type: "notify", params: { title: "{{process.env.SECRET}}" } }] })), ValidationError);
  assert.throws(() => validateRule(base({ actions: [{ type: "webhook", params: { url: "http://example.com" } }] })), ValidationError);
  validateRule(base({}));
});

test("money conditions compare as decimals, not floats", () => {
  const ctx = { payload: { value_base: "10000.10", total: "0.3" } };
  assert.equal(evaluateConditions([{ field: "value_base", op: "gt", value: "10000" }], "all", ctx), true);
  assert.equal(evaluateConditions([{ field: "value_base", op: "gt", value: "10000.10" }], "all", ctx), false);
  assert.equal(evaluateConditions([{ field: "total", op: "eq", value: "0.30" }], "all", ctx), true);
});

test("rule runs once per event (idempotent), dry run matches, loop protection, retry", async () => {
  const admin = await bosUserFor("admin@taysonsta.local");
  const trigger = "feature_request.created";
  const input = base({ trigger_event: trigger, conditions: [{ field: "marker", op: "eq", value: "auto-test" }], actions: [{ type: "notify", params: { recipients: [{ kind: "user", value: admin.userId }], title: "Auto {{payload.marker}}" } }] });
  const id = await saveRule(admin, null, input);
  cleanup.push(() => db().from("automation_rules").delete().eq("id", id));
  const entityId = crypto.randomUUID();
  const eventId = await emitEvent({ type: trigger, entityType: "feature_request", entityId, summary: "auto test", payload: { marker: "auto-test" }, dedupeKey: `auto-test:${entityId}` });
  assert.ok(eventId);
  await dispatchPendingEvents();
  const { data: runs } = await db().from("automation_runs").select("id, status").eq("rule_id", id);
  assert.equal(runs?.length, 1, "one run");
  assert.equal(runs?.[0].status, "success");

  // Re-dispatch the same event: the unique (rule,event) claim prevents a second run.
  await db().from("activity_events").update({ processed_at: null }).eq("id", eventId!);
  await dispatchPendingEvents();
  const { data: again } = await db().from("automation_runs").select("id").eq("rule_id", id).eq("is_retry", false);
  assert.equal(again?.length, 1, "idempotent on re-dispatch");

  const dry = await dryRun(input, eventId!);
  assert.equal(dry.matched, true, "dry run matches real run");
  const dryMiss = await dryRun({ ...input, conditions: [{ field: "marker", op: "eq", value: "other" }] }, eventId!);
  assert.equal(dryMiss.matched, false);

  // Loop protection: events at automation depth 3 never trigger rules.
  const deep = crypto.randomUUID();
  await emitEvent({ type: trigger, entityType: "feature_request", entityId: deep, summary: "deep", payload: { marker: "auto-test", automation_depth: 3 }, dedupeKey: `auto-deep:${deep}` });
  await dispatchPendingEvents();
  const { data: deepRuns } = await db().from("automation_runs").select("id").eq("rule_id", id).eq("entity_id", deep);
  assert.equal(deepRuns?.length, 0, "loop protection");

  // Failure is logged without throwing; retry creates a flagged run.
  await db().from("automation_rules").update({ actions: [{ type: "update_field", params: { entity: "lead", field: "not_allowed", value: 1 } }] }).eq("id", id);
  const failId = crypto.randomUUID();
  await emitEvent({ type: trigger, entityType: "feature_request", entityId: failId, summary: "fail", payload: { marker: "auto-test" }, dedupeKey: `auto-fail:${failId}` });
  await dispatchPendingEvents();
  const { data: failed } = await db().from("automation_runs").select("id, status, error").eq("rule_id", id).eq("entity_id", failId).single();
  assert.equal(failed!.status, "failed");
  assert.match(failed!.error ?? "", /not allowed/);
  const retryId = await retryRun(admin, failed!.id);
  const { data: retry } = await db().from("automation_runs").select("is_retry").eq("id", retryId).single();
  assert.equal(retry!.is_retry, true);
});
