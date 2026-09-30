import { nowIso } from "@/lib/bos/clock";
import "server-only";
import type { Json } from "@/types/database";
import { db, type Tables } from "@/lib/bos/db";
import type { BosUser } from "@/lib/bos/auth";
import { audit } from "@/lib/bos/audit";
import { eventMap } from "@/lib/bos/event-types";
import { conditionOperators, evaluateConditions, type Condition } from "@/lib/bos/automation/conditions";
import { automationActionTypes, runAction, type ActionContext } from "@/lib/bos/automation/actions";
import { evaluateRule } from "@/lib/bos/automation/engine";
import { dispatchPendingEvents } from "@/lib/bos/events";
import { NotFoundError, ValidationError } from "@/lib/bos/errors";

// Workflow builder backend (docs/bos/20): rule CRUD with validation,
// dry run against a real event, run logs and retries.

export type Rule = Tables<"automation_rules">;

export async function listRules(f: { system?: boolean } = {}) {
  let q = db().from("automation_rules").select("*").order("priority", { ascending: false }).order("name");
  if (f.system !== undefined) q = q.eq("is_system", f.system);
  const { data } = await q;
  const rules = data ?? [];
  const ids = rules.map((r) => r.id);
  const { data: runs } = ids.length ? await db().from("automation_runs").select("rule_id, status, started_at").in("rule_id", ids).order("started_at", { ascending: false }).limit(5000) : { data: [] };
  return rules.map((r) => {
    const rr = (runs ?? []).filter((x) => x.rule_id === r.id);
    return { ...r, lastRunAt: rr[0]?.started_at ?? null, success: rr.filter((x) => x.status === "success").length, failed: rr.filter((x) => x.status === "failed").length, skipped: rr.filter((x) => x.status === "skipped").length };
  });
}

export async function getRule(id: string) {
  const { data } = await db().from("automation_rules").select("*").eq("id", id).maybeSingle();
  if (!data) throw new NotFoundError();
  return data;
}

export interface RuleInput {
  name: string;
  description: string | null;
  trigger_event: string;
  conditions: Condition[];
  condition_logic: "all" | "any";
  actions: { type: string; params: Record<string, unknown> }[];
  is_active: boolean;
  run_once_per_entity: boolean;
  priority: number;
}

const placeholder = /\{\{\s*([^}]*)\s*\}\}/g;

export function validateRule(input: RuleInput) {
  if (!input.name.trim()) throw new ValidationError("اسم مسار العمل مطلوب.", { name: "مطلوب" });
  if (!eventMap.has(input.trigger_event)) throw new ValidationError("الحدث المُشغّل غير موجود في الكتالوج.", { trigger_event: "غير صالح" });
  const ops = new Set(conditionOperators.map((o) => o.value));
  for (const c of input.conditions) {
    if (!c.field?.trim() || !/^[a-z_.0-9]+$/i.test(c.field)) throw new ValidationError(`حقل شرط غير صالح: ${c.field}`);
    if (!ops.has(c.op)) throw new ValidationError(`عامل غير صالح: ${c.op}`);
  }
  if (!input.actions.length) throw new ValidationError("أضف إجراءً واحداً على الأقل.");
  for (const a of input.actions) {
    if (!automationActionTypes.includes(a.type)) throw new ValidationError(`إجراء غير معروف: ${a.type}`);
    // Templates: only {{payload.x}} / {{entity.x}} / {{summary}} placeholders — no code.
    for (const v of Object.values(a.params ?? {})) {
      if (typeof v !== "string") continue;
      for (const m of v.matchAll(placeholder)) {
        if (!/^(payload|entity)\.[a-z_0-9.]+$|^summary$/i.test(m[1].trim())) throw new ValidationError(`قالب غير مسموح: {{${m[1]}}} — المسموح {{payload.x}} أو {{entity.x}} أو {{summary}}.`);
      }
    }
    if (a.type === "webhook" && a.params.url && !String(a.params.url).startsWith("https://")) throw new ValidationError("Webhook يجب أن يكون https.");
  }
}

export async function saveRule(bos: BosUser, id: string | null, input: RuleInput) {
  validateRule(input);
  const row = { ...input, conditions: input.conditions as unknown as Json, actions: input.actions as unknown as Json };
  if (id) {
    const before = await getRule(id);
    const { error } = await db().from("automation_rules").update(row).eq("id", id);
    if (error) throw error;
    await audit({ actorId: bos.userId, action: "automation.rule_updated", entityType: "automation_rule", entityId: id, oldValue: { trigger: before.trigger_event, conditions: before.conditions, actions: before.actions, is_active: before.is_active }, newValue: { trigger: input.trigger_event, conditions: input.conditions, actions: input.actions, is_active: input.is_active } });
    return id;
  }
  const { data, error } = await db().from("automation_rules").insert({ ...row, created_by: bos.userId }).select("id").single();
  if (error) throw error;
  await audit({ actorId: bos.userId, action: "automation.rule_created", entityType: "automation_rule", entityId: data.id, newValue: input });
  return data.id;
}

export async function setRuleActive(bos: BosUser, id: string, active: boolean) {
  await db().from("automation_rules").update({ is_active: active }).eq("id", id);
  await audit({ actorId: bos.userId, action: active ? "automation.rule_activated" : "automation.rule_deactivated", entityType: "automation_rule", entityId: id });
}

export async function deleteRule(bos: BosUser, id: string) {
  const rule = await getRule(id);
  if (rule.is_system) throw new ValidationError("قواعد النظام لا تُحذف — يمكن تعطيلها.");
  await db().from("automation_rules").delete().eq("id", id);
  await audit({ actorId: bos.userId, action: "automation.rule_deleted", entityType: "automation_rule", entityId: id, oldValue: { name: rule.name, trigger: rule.trigger_event } });
}

// Dry run: evaluates conditions (with per-condition detail) against a real
// event and lists the actions that would run — nothing is executed.
export async function dryRun(input: RuleInput, eventId: number) {
  const { data: event } = await db().from("activity_events").select("*").eq("id", eventId).maybeSingle();
  if (!event) throw new ValidationError("الحدث غير موجود.");
  const noEmit: ActionContext["emit"] = async () => undefined;
  const evaluation = await evaluateRule({ id: "dry-run", name: input.name, conditions: input.conditions as unknown as Json, condition_logic: input.condition_logic, actions: input.actions as unknown as Json }, event, noEmit, true);
  const ctx = { payload: (event.payload ?? {}) as Record<string, unknown>, entity: null, summary: event.summary };
  const perCondition = input.conditions.map((c) => ({ ...c, passed: evaluateConditions([c], "all", ctx) }));
  return { event: { id: event.id, type: event.event_type, summary: event.summary, occurred_at: event.occurred_at, payload: event.payload }, matched: evaluation.matched, conditions: perCondition, actions: input.actions.map((a) => a.type) };
}

export async function sampleEvents(trigger: string, limit = 10) {
  const { data } = await db().from("activity_events").select("id, event_type, summary, occurred_at, entity_type, entity_id").eq("event_type", trigger).order("id", { ascending: false }).limit(limit);
  return data ?? [];
}

export async function listRuns(f: { rule?: string; status?: string; from?: string; to?: string; page?: number }) {
  const page = Math.max(1, f.page ?? 1);
  let q = db().from("automation_runs").select("*, automation_rules(id, name, trigger_event), activity_events(id, event_type, summary)", { count: "exact" });
  if (f.rule) q = q.eq("rule_id", f.rule);
  if (f.status) q = q.eq("status", f.status);
  if (f.from) q = q.gte("started_at", `${f.from}T00:00:00Z`);
  if (f.to) q = q.lte("started_at", `${f.to}T23:59:59Z`);
  const { data, count } = await q.order("started_at", { ascending: false }).range((page - 1) * 30, page * 30 - 1);
  return { rows: data ?? [], total: count ?? 0, page, pageSize: 30 };
}

export async function listEvents(f: { type?: string; entity?: string; q?: string; page?: number }) {
  const page = Math.max(1, f.page ?? 1);
  let q = db().from("activity_events").select("id, event_type, entity_type, entity_id, summary, actor_user_id, actor_type, visibility, occurred_at, processed_at", { count: "exact" });
  if (f.type) q = q.eq("event_type", f.type);
  if (f.entity) q = q.eq("entity_type", f.entity);
  if (f.q) q = q.ilike("summary", `%${f.q.replace(/[%_]/g, " ")}%`);
  const { data, count } = await q.order("id", { ascending: false }).range((page - 1) * 50, page * 50 - 1);
  return { rows: data ?? [], total: count ?? 0, page, pageSize: 50 };
}

// Retry: re-runs the CURRENT rule on the original event as a new run
// flagged is_retry (the unique (rule,event) index excludes retries).
export async function retryRun(bos: BosUser, runId: string) {
  const { data: run } = await db().from("automation_runs").select("*").eq("id", runId).maybeSingle();
  if (!run || !run.event_id) throw new NotFoundError();
  if (run.status !== "failed") throw new ValidationError("إعادة التشغيل متاحة للتشغيلات الفاشلة فقط.");
  const rule = await getRule(run.rule_id);
  const { data: event } = await db().from("activity_events").select("*").eq("id", run.event_id).single();
  if (!event) throw new NotFoundError();
  const { data: retry } = await db().from("automation_runs").insert({ rule_id: rule.id, event_id: event.id, entity_type: event.entity_type, entity_id: event.entity_id, status: "running", is_retry: true, rule_snapshot: { name: rule.name, conditions: rule.conditions, actions: rule.actions, retry_of: runId } as unknown as Json }).select("id").single();
  const emitted: Parameters<ActionContext["emit"]>[0][] = [];
  const evaluation = await evaluateRule(rule, event, async (input) => { emitted.push(input); });
  const failed = evaluation.results.filter((r) => r.status === "failed");
  await db().from("automation_runs").update({ status: !evaluation.matched ? "skipped" : failed.length ? "failed" : "success", error: failed.map((f) => `${f.type}: ${f.detail}`).join("; ") || null, results: evaluation.results as unknown as Json, finished_at: nowIso() }).eq("id", retry!.id);
  const { emitEvent } = await import("@/lib/bos/events");
  for (const e of emitted) await emitEvent({ ...e, actorType: "automation" });
  await dispatchPendingEvents();
  await audit({ actorId: bos.userId, action: "automation.run_retried", entityType: "automation_rule", entityId: rule.id, newValue: { run_id: runId, retry_id: retry!.id, status: failed.length ? "failed" : "success" } });
  return retry!.id;
}

export { runAction };
