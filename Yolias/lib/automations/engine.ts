import "server-only";
import { cleanNotificationText } from "@/lib/notification-text";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadAiSettings } from "@/lib/ai-workspace/server";
import { decide } from "@/lib/ai-workspace/settings";
import { stopFollowUps } from "@/lib/crm/follow-ups";
import { actionSchema, conditionsSchema, matches, type AutomationAction, type AutomationEvent } from "./schema";
import type { AutomationRunStatus, Json } from "@/types/database";

// Runs the workspace's enabled automations for one event (D-198).
// Idempotent: the run row (automation, event) is claimed first, so a repeated
// event (double click, retry, two tabs) never runs the actions twice.
// Every action is checked against Rules & Permissions; the outcome of each
// action and any failure are kept in automation_runs.

type ActionResult = { type: AutomationAction["type"]; ok: boolean; detail?: string };

/** Automations are switched off for now (owner, 2026-10-13, D-205): no page, no runs. Tables and code stay for later. */
export const AUTOMATIONS_ENABLED = false;

export async function runAutomations(ev: AutomationEvent): Promise<{ ran: number }> {
  if (!AUTOMATIONS_ENABLED) return { ran: 0 };
  // Changes made by automations never start more automations (no loops).
  if (ev.origin === "automation") return { ran: 0 };
  const db = createAdminClient();
  const { data: automations } = await db.from("automations").select("*")
    .eq("workspace_id", ev.workspaceId).eq("trigger", ev.trigger).eq("enabled", true).is("deleted_at", null);
  if (!automations?.length) return { ran: 0 };
  const settings = await loadAiSettings(ev.workspaceId);
  let ran = 0;

  for (const a of automations) {
    const cond = conditionsSchema.safeParse(a.conditions);
    if (!cond.success || !matches(cond.data, ev)) continue;
    const { data: claimed } = await db.from("automation_runs")
      .upsert({ workspace_id: ev.workspaceId, automation_id: a.id, event_key: ev.eventKey, trigger: ev.trigger, lead_id: ev.leadId, status: "skipped" },
        { onConflict: "automation_id,event_key", ignoreDuplicates: true })
      .select("id").maybeSingle();
    if (!claimed) continue; // already ran for this event
    ran++;

    const results: ActionResult[] = [];
    let needsApproval = false;
    const actions = Array.isArray(a.actions) ? a.actions : [];
    for (const [i, raw] of actions.entries()) {
      const parsed = actionSchema.safeParse(raw);
      if (!parsed.success) { results.push({ type: "add_note", ok: false, detail: "invalid action" }); continue; }
      const act = parsed.data;
      try {
        const r = await runAction(act, { ev, automationId: a.id, automationName: a.name, index: i, settings });
        if (r.detail === "needs_approval") needsApproval = true;
        results.push(r);
      } catch (e) {
        results.push({ type: act.type, ok: false, detail: e instanceof Error ? e.message.slice(0, 300) : "failed" });
      }
    }
    const failed = results.filter((r) => !r.ok).length;
    const status: AutomationRunStatus = needsApproval ? "needs_approval" : failed === 0 ? "succeeded" : failed === results.length ? "failed" : "partial";
    await db.from("automation_runs").update({
      status, results: results as unknown as Json, error: failed ? results.filter((r) => !r.ok).map((r) => `${r.type}: ${r.detail}`).join("; ").slice(0, 1000) : null,
    }).eq("id", claimed.id);
    await db.from("lead_activities").insert({
      workspace_id: ev.workspaceId, lead_id: ev.leadId, kind: "automation", actor_kind: "automation", body: a.name,
      meta: { automation_id: a.id, run_id: claimed.id, status } as Json,
    });
  }
  return { ran };
}

interface Ctx {
  ev: AutomationEvent;
  automationId: string;
  automationName: string;
  index: number;
  settings: Awaited<ReturnType<typeof loadAiSettings>>;
}

async function runAction(act: AutomationAction, ctx: Ctx): Promise<ActionResult> {
  const db = createAdminClient();
  const { ev } = ctx;
  switch (act.type) {
    case "create_task": {
      const due = new Date(Date.now() + act.due_in_days * 86_400_000).toISOString();
      const { error } = await db.from("lead_tasks").insert({
        workspace_id: ev.workspaceId, lead_id: ev.leadId, title: act.title, kind: act.kind, due_at: due, source: "automation",
        dedupe_key: `auto:${ctx.automationId}:${ev.eventKey}:${ctx.index}`,
      });
      if (error && !/duplicate key/.test(error.message)) throw error;
      return { type: act.type, ok: true };
    }
    case "notify": {
      const { data: lead } = await db.from("sales_leads").select("name, owner_id").eq("id", ev.leadId).single();
      const recipients = lead?.owner_id ? [lead.owner_id]
        : ((await db.from("workspace_members").select("user_id").eq("workspace_id", ev.workspaceId)).data ?? []).map((m) => m.user_id);
      if (recipients.length) {
        await db.from("notifications").insert(recipients.map((user_id) => ({
          user_id, workspace_id: ev.workspaceId, kind: "automation", title: cleanNotificationText(act.title).slice(0, 300), body: lead?.name ?? null,
          link: `/crm/${ev.leadId}`, dedupe_key: `auto:${ctx.automationId}:${ev.eventKey}:${ctx.index}:${user_id}`,
        })));
      }
      return { type: act.type, ok: true, detail: `${recipients.length}` };
    }
    case "add_note": {
      await db.from("lead_activities").insert({ workspace_id: ev.workspaceId, lead_id: ev.leadId, kind: "note", actor_kind: "automation", body: act.text, meta: { automation_id: ctx.automationId } });
      return { type: act.type, ok: true };
    }
    case "stop_follow_ups": {
      const n = await stopFollowUps(ev.leadId, `automation:${ctx.automationName}`.slice(0, 200));
      return { type: act.type, ok: true, detail: `${n}` };
    }
    case "set_stage": {
      const d = decide(ctx.settings, "crm", "update_crm_stage");
      if (!d.allowed) return { type: act.type, ok: false, detail: d.reason };
      if (d.mode === "approve") {
        await db.from("agent_pending_actions").insert({
          workspace_id: ev.workspaceId, lead_id: ev.leadId, agent: "automation", tool: "crm.set_stage", input: { stage: act.stage } as Json,
          summary: `${ctx.automationName}: → ${act.stage}`, expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
        });
        return { type: act.type, ok: true, detail: "needs_approval" };
      }
      const { error } = await db.rpc("set_lead_stage", { p_lead: ev.leadId, p_stage: act.stage, p_actor: "automation" });
      if (error) throw error;
      return { type: act.type, ok: true };
    }
  }
}
