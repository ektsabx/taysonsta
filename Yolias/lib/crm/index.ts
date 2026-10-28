import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { runAutomations } from "@/lib/automations/engine";
import { loadAiSettings } from "@/lib/ai-workspace/server";
import { stopFollowUps } from "./follow-ups";
import type { ActorKind, Database, LeadStage, MeetingStatus } from "@/types/database";

// The CRM's write paths (D-195). Every stage change goes through
// changeStage(): the database records who moved it (timeline), stops outreach
// for lost / closed deals, and the workspace's automations run once for it.
// Inbox, CRM table and Kanban all read leads.stage, so a change shows
// everywhere at once.

type Db = SupabaseClient<Database>;
export type LeadTarget = { kind: "person" | "company"; id: string };

/** Adds results to the CRM as the member (RLS). Already-added people / companies return their existing lead. */
export async function addLeads(db: Db, targets: LeadTarget[], source: "search" | "import" | "manual" = "search"): Promise<{ ids: string[]; failed: number }> {
  const ids: string[] = [];
  let failed = 0;
  for (const t of targets) {
    const { data, error } = await db.rpc("upsert_lead", { p_prospect: t.kind === "person" ? t.id : null, p_company: t.kind === "company" ? t.id : null, p_source: source });
    if (error || !data) failed++;
    else if (!ids.includes(data)) ids.push(data);
  }
  return { ids, failed };
}

/** Runs the "lead.created" automations for leads that were new. */
export async function leadsCreated(workspaceId: string, ids: string[], origin: ActorKind = "user") {
  for (const id of ids) {
    await runAutomations({ workspaceId, trigger: "lead.created", leadId: id, eventKey: `lead:${id}:created`, data: {}, origin }).catch((e) => console.error("[automations] lead.created", e));
  }
}

/**
 * Moves a deal to a stage. `db` is the member's client for their own changes
 * (RLS) or the admin client for agents / automations / approved actions.
 */
export async function changeStage(db: Db, workspaceId: string, leadId: string, stage: LeadStage, actor: ActorKind): Promise<{ ok: boolean; changed: boolean }> {
  const { data: before } = await db.from("sales_leads").select("stage, deal_value, workspace_id").eq("id", leadId).eq("workspace_id", workspaceId).maybeSingle();
  if (!before) return { ok: false, changed: false };
  const { data: activityId, error } = await db.rpc("set_lead_stage", { p_lead: leadId, p_stage: stage, p_actor: actor });
  if (error) return { ok: false, changed: false };
  if (!activityId) return { ok: true, changed: false };
  await afterStageChange(workspaceId, leadId, before.stage, stage, Number(activityId), before.deal_value, actor);
  return { ok: true, changed: true };
}

async function afterStageChange(workspaceId: string, leadId: string, from: LeadStage, to: LeadStage, activityId: number, dealValue: number | null, actor: ActorKind) {
  // Rules & Permissions → "stop follow-ups when a meeting is booked".
  if (to === "meeting_booked") {
    const s = await loadAiSettings(workspaceId);
    if (s.limits.stop_on_meeting) await stopFollowUps(leadId, "meeting_booked");
  }
  await runAutomations({ workspaceId, trigger: "lead.stage_changed", leadId, eventKey: `activity:${activityId}`, data: { from, to, dealValue }, origin: actor })
    .catch((e) => console.error("[automations] stage_changed", e));
}

/** Meeting saved: booking moves the deal forward, completion too (never backwards). */
export async function meetingChanged(db: Db, workspaceId: string, meeting: { id: string; lead_id: string; status: MeetingStatus }, previous: MeetingStatus | null, actor: ActorKind) {
  const admin = createAdminClient();
  const { data: lead } = await admin.from("sales_leads").select("stage").eq("id", meeting.lead_id).single();
  const order: LeadStage[] = ["new", "interested", "meeting_booked", "meeting_completed", "proposal", "negotiation", "closed"];
  const at = (s: LeadStage | undefined) => (s ? order.indexOf(s) : -1);
  if (previous === null && meeting.status === "scheduled") {
    if (lead && at(lead.stage) >= 0 && at(lead.stage) < at("meeting_booked")) await changeStage(db, workspaceId, meeting.lead_id, "meeting_booked", actor);
    await runAutomations({ workspaceId, trigger: "meeting.booked", leadId: meeting.lead_id, eventKey: `meeting:${meeting.id}:booked`, data: {}, origin: actor })
      .catch((e) => console.error("[automations] meeting.booked", e));
  }
  if (meeting.status === "completed" && previous !== "completed") {
    if (lead && at(lead.stage) >= 0 && at(lead.stage) < at("meeting_completed")) await changeStage(db, workspaceId, meeting.lead_id, "meeting_completed", actor);
    await runAutomations({ workspaceId, trigger: "meeting.completed", leadId: meeting.lead_id, eventKey: `meeting:${meeting.id}:completed`, data: {}, origin: actor })
      .catch((e) => console.error("[automations] meeting.completed", e));
  }
}
