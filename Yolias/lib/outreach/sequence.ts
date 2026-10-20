import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSuppressed } from "@/lib/intel/shared";
import { loadAiSettings } from "@/lib/ai-workspace/server";
import { decide } from "@/lib/ai-workspace/settings";
import { runAutomations } from "@/lib/automations/engine";
import { draftOutreach, type DraftError, type MessageTarget } from "@/lib/outreach";
import { isMessageLanguage, DEFAULT_LANGUAGE } from "@/lib/outreach/channels";
import type { Database, LeadRow } from "@/types/database";

// Outreach campaigns (D-193): a campaign holds steps (first message +
// follow-ups with a delay); leads are enrolled once per campaign; the Outreach
// Agent prepares each step's draft from the lead, Company Knowledge, the
// offer and the customer profile. A draft is never "sent" by being written:
// Yolias has no connected mailbox (D-155), so the member sends it from their
// own app and confirms it — only then the next follow-up is scheduled.

type Db = SupabaseClient<Database>;
const DAY = 86_400_000;

export type EnrollSkip = "do_not_contact" | "suppressed" | "already_enrolled" | "recently_contacted" | "no_contact";
export type EnrollResult = { added: number; skipped: Partial<Record<EnrollSkip, number>> };

export function targetOf(lead: Pick<LeadRow, "prospect_id" | "company_id">): MessageTarget | null {
  if (lead.prospect_id) return { kind: "person", id: lead.prospect_id };
  if (lead.company_id) return { kind: "company", id: lead.company_id };
  return null;
}

/** Enrolls leads in a campaign as the member (RLS), honouring do-not-contact, suppression and the re-contact window. */
export async function enrollLeads(db: Db, workspaceId: string, userId: string, campaignId: string, leadIds: string[]): Promise<EnrollResult | null> {
  const { data: campaign } = await db.from("outreach_campaigns").select("id, status").eq("id", campaignId).eq("workspace_id", workspaceId).maybeSingle();
  if (!campaign || campaign.status === "archived") return null;
  const { data: leads } = await db.from("sales_leads").select("id, email, do_not_contact, company_id, prospect_id").eq("workspace_id", workspaceId).in("id", leadIds.slice(0, 500));
  const settings = await loadAiSettings(workspaceId);
  const admin = createAdminClient();
  const result: EnrollResult = { added: 0, skipped: {} };
  const skip = (r: EnrollSkip) => { result.skipped[r] = (result.skipped[r] ?? 0) + 1; };
  const since = new Date(Date.now() - settings.limits.no_recontact_days * DAY).toISOString();

  for (const lead of leads ?? []) {
    if (lead.do_not_contact) { skip("do_not_contact"); continue; }
    if (!targetOf(lead)) { skip("no_contact"); continue; }
    let domain: string | null = null;
    if (lead.company_id) domain = (await admin.from("companies").select("domain").eq("id", lead.company_id).maybeSingle()).data?.domain ?? null;
    if (await isSuppressed({ email: lead.email, domain })) { skip("suppressed"); continue; }
    if (settings.limits.no_recontact_days > 0) {
      const { count } = await admin.from("outreach_messages").select("id", { count: "exact", head: true })
        .eq("lead_id", lead.id).eq("status", "sent").gte("sent_at", since).neq("outreach_campaign_id", campaignId);
      if (count) { skip("recently_contacted"); continue; }
    }
    const { error } = await db.from("outreach_enrollments").insert({ workspace_id: workspaceId, campaign_id: campaignId, lead_id: lead.id, created_by: userId });
    if (error) { if (/duplicate key/.test(error.message)) skip("already_enrolled"); else throw error; continue; }
    result.added++;
  }
  return result;
}

/** The thread so far, oldest first, short (context for follow-ups and replies). */
export async function historyFor(leadId: string, max = 6): Promise<string> {
  const { data } = await createAdminClient().from("outreach_messages").select("direction, status, subject, body, sent_at, received_at, created_at")
    .eq("lead_id", leadId).in("status", ["sent", "received"]).order("created_at", { ascending: false }).limit(max);
  return (data ?? []).reverse().map((m) => {
    const who = m.direction === "inbound" ? "Them" : "Us";
    const at = (m.received_at ?? m.sent_at ?? m.created_at).slice(0, 10);
    return `[${at}] ${who}: ${m.subject ? `${m.subject}: ` : ""}${m.body.slice(0, 800)}`;
  }).join("\n");
}

export type PrepareError = DraftError | "no_step" | "limit" | "inactive" | "exists" | "denied";

/**
 * Prepares the next step's draft for an enrollment. `actor = "user"` when the
 * member asked (that request is the approval); "agent" for the follow-up sweep,
 * which needs Follow-up Agent → Prepare messages = automatic.
 */
export async function prepareNextStep(workspaceId: string, userId: string, enrollmentId: string, actor: "user" | "agent"): Promise<{ ok: true; messageId: string } | { ok: false; error: PrepareError }> {
  const db = createAdminClient();
  const { data: e } = await db.from("outreach_enrollments").select("*, lead:sales_leads(*), campaign:outreach_campaigns(*)").eq("id", enrollmentId).eq("workspace_id", workspaceId).maybeSingle();
  if (!e || !e.lead || !e.campaign) return { ok: false, error: "not_found" };
  const lead = e.lead as unknown as LeadRow;
  const campaign = e.campaign as unknown as Database["public"]["Tables"]["outreach_campaigns"]["Row"];
  if (e.status !== "active" || campaign.status === "archived" || (actor === "agent" && campaign.status !== "active")) return { ok: false, error: "inactive" };
  const settings = await loadAiSettings(workspaceId);
  const agent = e.current_step === 0 ? "outreach" : "follow_up";
  const d = decide(settings, agent, "prepare_messages");
  if (!d.allowed || (actor === "agent" && d.mode !== "auto")) return { ok: false, error: "denied" };
  const position = e.current_step + 1;
  if (position > settings.limits.max_messages_per_lead) return { ok: false, error: "limit" };
  const { data: step } = await db.from("outreach_steps").select("*").eq("campaign_id", campaign.id).eq("position", position).maybeSingle();
  if (!step) return { ok: false, error: "no_step" };
  const { data: existing } = await db.from("outreach_messages").select("id").eq("enrollment_id", e.id).eq("step_position", position).eq("direction", "outbound").neq("status", "canceled").maybeSingle();
  if (existing) return { ok: false, error: "exists" };
  const target = targetOf(lead);
  if (!target) return { ok: false, error: "not_found" };

  const r = await draftOutreach({
    workspaceId, userId, target, channel: campaign.channel, instruction: [campaign.goal, step.instruction].filter(Boolean).join("\n") || null,
    language: isMessageLanguage(campaign.language) ? campaign.language : DEFAULT_LANGUAGE, objective: step.objective, tone: campaign.tone, agent,
    sequence: {
      leadId: lead.id, outreachCampaignId: campaign.id, enrollmentId: e.id, stepPosition: position,
      customerProfileId: campaign.customer_profile_id ?? lead.customer_profile_id, offerId: campaign.offer_id,
      history: position > 1 ? await historyFor(lead.id) : "",
    },
  });
  if (!r.ok) return r;
  return { ok: true, messageId: r.message.id };
}

export type SendError = "not_found" | "not_ready" | "do_not_contact" | "too_soon" | "daily_limit";

/**
 * The member confirms they sent this message from their own app (Yolias
 * itself can't send: no mailbox is connected). Records it as sent, moves the
 * enrollment to the next step and schedules that follow-up.
 */
export async function confirmSent(db: Db, workspaceId: string, userId: string, messageId: string): Promise<{ ok: true } | { ok: false; error: SendError }> {
  // RLS: the member must be able to read the message.
  const { data: own } = await db.from("outreach_messages").select("id").eq("id", messageId).eq("workspace_id", workspaceId).maybeSingle();
  if (!own) return { ok: false, error: "not_found" };
  const admin = createAdminClient();
  const { data: m } = await admin.from("outreach_messages").select("*").eq("id", messageId).single();
  if (!m || m.direction !== "outbound" || !["draft", "approved"].includes(m.status)) return { ok: false, error: "not_ready" };
  const settings = await loadAiSettings(workspaceId);
  if (m.lead_id) {
    const { data: lead } = await admin.from("sales_leads").select("do_not_contact").eq("id", m.lead_id).single();
    if (lead?.do_not_contact) return { ok: false, error: "do_not_contact" };
    const { data: last } = await admin.from("outreach_messages").select("sent_at").eq("lead_id", m.lead_id).eq("status", "sent").order("sent_at", { ascending: false }).limit(1).maybeSingle();
    if (last?.sent_at && Date.now() - Date.parse(last.sent_at) < settings.limits.min_gap_hours * 3_600_000) return { ok: false, error: "too_soon" };
  }
  const dayStart = new Date(); dayStart.setUTCHours(0, 0, 0, 0);
  const { count } = await admin.from("outreach_messages").select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId).eq("status", "sent").eq("approved_by", userId).gte("sent_at", dayStart.toISOString());
  if ((count ?? 0) >= settings.limits.daily_send_limit) return { ok: false, error: "daily_limit" };

  const now = new Date().toISOString();
  const { error } = await admin.from("outreach_messages").update({ status: "sent", sent_at: now, sent_via: "manual", approved_by: m.approved_by ?? userId, approved_at: m.approved_at ?? now })
    .eq("id", m.id).in("status", ["draft", "approved"]);
  if (error) return { ok: false, error: "not_ready" };
  if (m.enrollment_id && m.step_position) await advanceEnrollment(m.enrollment_id, m.step_position, settings.limits.max_messages_per_lead);
  return { ok: true };
}

export async function advanceEnrollment(enrollmentId: string, sentStep: number, maxPerLead: number) {
  const db = createAdminClient();
  const { data: e } = await db.from("outreach_enrollments").select("id, campaign_id, workspace_id, lead_id, status, current_step").eq("id", enrollmentId).single();
  if (!e || e.status !== "active" || sentStep <= e.current_step) return;
  const { data: next } = await db.from("outreach_steps").select("delay_days").eq("campaign_id", e.campaign_id).eq("position", sentStep + 1).maybeSingle();
  if (next && sentStep + 1 <= maxPerLead) {
    await db.from("outreach_enrollments").update({ current_step: sentStep, next_step_at: new Date(Date.now() + next.delay_days * DAY).toISOString() }).eq("id", e.id);
  } else {
    await db.from("outreach_enrollments").update({ current_step: sentStep, status: "completed", next_step_at: null, stop_reason: "sequence_done" }).eq("id", e.id);
    await runAutomations({ workspaceId: e.workspace_id, trigger: "enrollment.finished", leadId: e.lead_id, eventKey: `enrollment:${e.id}:finished`, data: {}, origin: "system" })
      .catch((err) => console.error("[automations] enrollment.finished", err));
  }
}

/**
 * Worker sweep (Follow-up Agent): due follow-ups get a reminder, and a draft
 * when the agent may prepare messages automatically; scheduled emails and
 * meetings that passed without an outcome get a reminder. Idempotent: each
 * reminder has a dedupe key and each step one draft.
 */
export async function followUpSweep(limit = 25): Promise<{ due: number; drafted: number; reminders: number }> {
  const db = createAdminClient();
  const now = new Date().toISOString();
  const out = { due: 0, drafted: 0, reminders: 0 };
  const { data: due } = await db.from("outreach_enrollments").select("id, workspace_id, lead_id, current_step, campaign:outreach_campaigns(status, created_by, name, send_mode), lead:sales_leads(owner_id, do_not_contact)")
    .eq("status", "active").lte("next_step_at", now).order("next_step_at").limit(limit);
  for (const e of due ?? []) {
    out.due++;
    const camp = e.campaign as unknown as { status: string; created_by: string | null; name: string; send_mode: string } | null;
    const lead = e.lead as unknown as { owner_id: string | null; do_not_contact: boolean } | null;
    // Paused campaigns keep their schedule until resumed.
    if (!camp || camp.status !== "active") continue;
    // Campaigns approved to send from a mailbox are run by dispatchCampaigns (lib/outreach/execute.ts).
    if (camp.send_mode === "mailbox") continue;
    await db.from("outreach_enrollments").update({ next_step_at: null }).eq("id", e.id).eq("status", "active");
    if (!lead || lead.do_not_contact) continue;
    const settings = await loadAiSettings(e.workspace_id);
    const d = decide(settings, "follow_up", "schedule_follow_ups");
    if (!d.allowed) continue;
    const step = e.current_step + 1;
    const owner = lead.owner_id ?? camp.created_by;
    const { error } = await db.from("lead_tasks").insert({
      workspace_id: e.workspace_id, lead_id: e.lead_id, title: `Follow-up ${step} is due: ${camp.name}`.slice(0, 300), kind: "follow_up",
      due_at: now, source: "agent", assignee_id: owner, dedupe_key: `followup:${e.id}:${step}`,
    });
    if (!error) out.reminders++;
    if (owner) {
      const r = await prepareNextStep(e.workspace_id, owner, e.id, "agent").catch(() => null);
      if (r?.ok) out.drafted++;
    }
  }

  // Scheduled emails whose time came (no mailbox: the member sends them).
  const { data: scheduled } = await db.from("outreach_messages").select("id, workspace_id, lead_id, subject, created_by")
    .lte("scheduled_for", now).in("status", ["draft", "approved"]).not("lead_id", "is", null).limit(limit);
  for (const m of scheduled ?? []) {
    const { error } = await db.from("lead_tasks").insert({
      workspace_id: m.workspace_id, lead_id: m.lead_id!, title: `Send the scheduled message${m.subject ? `: ${m.subject}` : ""}`.slice(0, 300),
      kind: "reminder", due_at: now, source: "agent", assignee_id: m.created_by, dedupe_key: `scheduled:${m.id}`,
    });
    if (!error) out.reminders++;
  }

  // Meetings that ended without an outcome.
  const { data: meetings } = await db.from("sales_meetings").select("id, workspace_id, lead_id, title, created_by")
    .eq("status", "scheduled").lte("starts_at", new Date(Date.now() - 2 * 3_600_000).toISOString()).limit(limit);
  for (const m of meetings ?? []) {
    const { error } = await db.from("lead_tasks").insert({
      workspace_id: m.workspace_id, lead_id: m.lead_id, title: `Record the outcome of "${m.title}"`.slice(0, 300), kind: "review",
      due_at: now, source: "agent", assignee_id: m.created_by, dedupe_key: `meeting-outcome:${m.id}`,
    });
    if (!error) out.reminders++;
  }
  return out;
}
