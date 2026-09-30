import { nowIso } from "@/lib/bos/clock";
import "server-only";
import type { Json } from "@/types/database";
import { db, type Tables } from "@/lib/bos/db";
import { evaluateConditions, type Condition } from "@/lib/bos/automation/conditions";
import { runAction, type ActionContext, type ActionResult } from "@/lib/bos/automation/actions";
import type { ActivityEvent } from "@/lib/bos/notify";
import { logServerError } from "@/lib/bos/errors";

type Rule = Tables<"automation_rules">;
type Emit = ActionContext["emit"];

const MAX_DEPTH = 3;

const entityTables: Record<string, string> = {
  lead: "leads", deal: "deals", project: "projects", task: "tasks", client: "clients", invoice: "invoices",
  payment: "payments", ticket: "tickets", meeting: "meetings", employee: "employees", change_request: "change_requests",
};

async function loadEntity(event: ActivityEvent): Promise<Record<string, unknown> | null> {
  const table = entityTables[event.entity_type];
  if (!table) return null;
  const { data } = await db().from(table as "leads").select("*").eq("id", event.entity_id).maybeSingle();
  return (data as Record<string, unknown> | null) ?? null;
}

export interface RuleEvaluation {
  matched: boolean;
  results: ActionResult[];
}

// Evaluates one rule against an event. dryRun=true never executes actions.
export async function evaluateRule(rule: Pick<Rule, "id" | "name" | "conditions" | "condition_logic" | "actions">, event: ActivityEvent, emit: Emit, dryRun = false): Promise<RuleEvaluation> {
  const payload = (event.payload ?? {}) as Record<string, unknown>;
  const entity = await loadEntity(event);
  const ctx: ActionContext = {
    payload: { ...entity, ...payload },
    entity,
    summary: event.summary,
    event,
    ruleId: rule.id,
    ruleName: rule.name,
    emit,
  };

  const conditions = (rule.conditions ?? []) as unknown as Condition[];
  const matched = evaluateConditions(conditions, (rule.condition_logic as "all" | "any") ?? "all", ctx);
  if (!matched) return { matched: false, results: [] };

  const actions = (rule.actions ?? []) as unknown as { type: string; params?: Record<string, unknown> }[];
  if (dryRun) {
    return { matched: true, results: actions.map((a) => ({ type: a.type, status: "skipped" as const, detail: "dry run" })) };
  }

  const results: ActionResult[] = [];
  for (const action of actions) {
    results.push(await runAction(action.type, action.params ?? {}, ctx));
  }
  return { matched: true, results };
}

export async function runAutomationsForEvent(event: ActivityEvent, emit: Emit): Promise<void> {
  const payload = (event.payload ?? {}) as Record<string, unknown>;
  if (Number(payload.automation_depth ?? 0) >= MAX_DEPTH) return;

  const client = db();
  const { data: rules } = await client
    .from("automation_rules")
    .select("*")
    .eq("trigger_event", event.event_type)
    .eq("is_active", true)
    .order("priority", { ascending: false });

  for (const rule of rules ?? []) {
    if (rule.run_once_per_entity) {
      const { count } = await client
        .from("automation_runs")
        .select("id", { count: "exact", head: true })
        .eq("rule_id", rule.id)
        .eq("entity_type", event.entity_type)
        .eq("entity_id", event.entity_id)
        .eq("status", "success");
      if ((count ?? 0) > 0) continue;
    }

    // Claim (rule, event) — the unique index makes this idempotent.
    const { data: run, error: claimError } = await client
      .from("automation_runs")
      .insert({
        rule_id: rule.id,
        event_id: event.id,
        entity_type: event.entity_type,
        entity_id: event.entity_id,
        status: "running",
        rule_snapshot: { name: rule.name, conditions: rule.conditions, actions: rule.actions } as unknown as Json,
      })
      .select("id")
      .maybeSingle();
    if (claimError || !run) continue;

    try {
      const depthEmit: Emit = (input) =>
        emit({ ...input, payload: { ...(input.payload ?? {}), automation_depth: Number(payload.automation_depth ?? 0) + 1 } });
      const evaluation = await evaluateRule(rule, event, depthEmit);
      const failed = evaluation.results.filter((r) => r.status === "failed");
      await client
        .from("automation_runs")
        .update({
          status: !evaluation.matched ? "skipped" : failed.length ? "failed" : "success",
          error: failed.length ? failed.map((f) => `${f.type}: ${f.detail}`).join("; ") : null,
          results: evaluation.results as unknown as Json,
          finished_at: nowIso(),
        })
        .eq("id", run.id);

      if (failed.length) {
        await emit({
          type: "automation.failed",
          entityType: "automation_rule",
          entityId: rule.id,
          summary: `Workflow "${rule.name}" failed: ${failed.map((f) => f.detail).join("; ")}`,
          payload: { run_id: run.id, event_id: event.id, automation_depth: MAX_DEPTH },
        });
      }
    } catch (error) {
      logServerError(`automation ${rule.name}`, error);
      await client
        .from("automation_runs")
        .update({ status: "failed", error: error instanceof Error ? error.message : String(error), finished_at: nowIso() })
        .eq("id", run.id);
    }
  }
}
