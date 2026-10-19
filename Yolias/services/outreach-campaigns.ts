import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { LeadStage, OutreachCampaignRow } from "@/types/database";

// Outreach campaign reads (D-193), as the member (RLS). Numbers are counted
// from real rows: enrollments, drafts, messages confirmed sent, logged
// replies and meetings booked after the lead joined the campaign.

/** Real counts only: sent = the member confirmed it or the mailbox accepted it; bounced = the provider returned it. */
export interface CampaignStats { leads: number; drafts: number; sent: number; failed: number; bounced: number; replies: number; interested: number; notInterested: number; optedOut: number; meetings: number }
const zero = (): CampaignStats => ({ leads: 0, drafts: 0, sent: 0, failed: 0, bounced: 0, replies: 0, interested: 0, notInterested: 0, optedOut: 0, meetings: 0 });

export async function listOutreachCampaigns(workspaceId: string): Promise<(OutreachCampaignRow & { stats: CampaignStats })[]> {
  const db = await createClient();
  const { data: campaigns } = await db.from("outreach_campaigns").select("*").eq("workspace_id", workspaceId).order("updated_at", { ascending: false }).limit(200);
  if (!campaigns?.length) return [];
  const stats = await campaignStats(campaigns.map((c) => c.id));
  return campaigns.map((c) => ({ ...c, stats: stats.get(c.id) ?? zero() }));
}

/** `client`: a member's client other than the request's (scripts, tools); RLS applies either way. */
export async function campaignStats(ids: string[], client?: Awaited<ReturnType<typeof createClient>>): Promise<Map<string, CampaignStats>> {
  const db = client ?? (await createClient());
  const out = new Map<string, CampaignStats>(ids.map((id) => [id, zero()]));
  const [{ data: enr }, { data: msgs }] = await Promise.all([
    db.from("outreach_enrollments").select("campaign_id, lead_id, created_at").in("campaign_id", ids).limit(20000),
    db.from("outreach_messages").select("outreach_campaign_id, status, direction, delivery_status, analysis").in("outreach_campaign_id", ids).limit(50000),
  ]);
  for (const e of enr ?? []) out.get(e.campaign_id)!.leads++;
  for (const m of msgs ?? []) {
    const s = m.outreach_campaign_id ? out.get(m.outreach_campaign_id) : undefined;
    if (!s) continue;
    if (m.direction === "inbound") {
      s.replies++;
      const kind = (m.analysis as { kind?: string } | null)?.kind;
      if (kind === "interested" || kind === "meeting_request") s.interested++;
      else if (kind === "not_interested") s.notInterested++;
      else if (kind === "stop_request") s.optedOut++;
    } else if (m.status === "sent") { s.sent++; if (m.delivery_status === "bounced") s.bounced++; }
    else if (m.status === "failed") s.failed++;
    else if (m.status === "draft" || m.status === "approved") s.drafts++;
  }
  const leadIds = [...new Set((enr ?? []).map((e) => e.lead_id))];
  if (leadIds.length) {
    const { data: meetings } = await db.from("sales_meetings").select("lead_id, created_at").in("lead_id", leadIds.slice(0, 1000)).neq("status", "canceled");
    for (const m of meetings ?? []) for (const e of enr ?? []) if (e.lead_id === m.lead_id && e.created_at <= m.created_at) out.get(e.campaign_id)!.meetings++;
  }
  return out;
}

export type EnrolledLead = { id: string; name: string; company_name: string | null; email: string | null; stage: LeadStage; do_not_contact: boolean };

export async function getOutreachCampaign(workspaceId: string, id: string) {
  const db = await createClient();
  const { data: campaign } = await db.from("outreach_campaigns").select("*").eq("workspace_id", workspaceId).eq("id", id).maybeSingle();
  if (!campaign) return null;
  const [steps, enrollments, messages, stats] = await Promise.all([
    db.from("outreach_steps").select("*").eq("campaign_id", id).order("position"),
    db.from("outreach_enrollments").select("*, lead:sales_leads(id, name, company_name, email, stage, do_not_contact)").eq("campaign_id", id).order("created_at", { ascending: false }).limit(500),
    db.from("outreach_messages").select("id, enrollment_id, status, step_position, created_at, sent_at").eq("outreach_campaign_id", id).eq("direction", "outbound").neq("status", "canceled").order("created_at", { ascending: false }).limit(2000),
    campaignStats([id]),
  ]);
  const last = new Map<string, { status: string; step: number | null; at: string }>();
  for (const m of messages.data ?? []) if (m.enrollment_id && !last.has(m.enrollment_id)) last.set(m.enrollment_id, { status: m.status, step: m.step_position, at: m.sent_at ?? m.created_at });
  return {
    campaign,
    steps: steps.data ?? [],
    enrollments: (enrollments.data ?? []).map((e) => ({ ...e, lead: e.lead as unknown as EnrolledLead | null, last: last.get(e.id) ?? null })),
    stats: stats.get(id) ?? zero(),
  };
}
export type OutreachDetail = NonNullable<Awaited<ReturnType<typeof getOutreachCampaign>>>;

/** Choices for the campaign form and the "Add to outreach" pickers. */
export async function outreachOptions(workspaceId: string) {
  const db = await createClient();
  const [profiles, offers, campaigns] = await Promise.all([
    db.from("customer_profiles").select("id, name, is_default").eq("workspace_id", workspaceId).order("is_default", { ascending: false }).order("name"),
    db.from("business_offers").select("id, name").eq("workspace_id", workspaceId).eq("active", true).order("name"),
    db.from("outreach_campaigns").select("id, name, status").eq("workspace_id", workspaceId).in("status", ["draft", "active", "paused"]).order("updated_at", { ascending: false }),
  ]);
  return { profiles: profiles.data ?? [], offers: offers.data ?? [], campaigns: campaigns.data ?? [] };
}

/** What the member approves before a campaign sends (D-229): who, how many, which channel, the first message and the sequence. */
export async function launchSummary(workspaceId: string, id: string) {
  const db = await createClient();
  const { data: c } = await db.from("outreach_campaigns").select("*").eq("workspace_id", workspaceId).eq("id", id).maybeSingle();
  if (!c) return null;
  const [{ data: enr }, { data: steps }, { data: sample }] = await Promise.all([
    db.from("outreach_enrollments").select("id, status, lead:sales_leads(email, do_not_contact)").eq("campaign_id", id).limit(5000),
    db.from("outreach_steps").select("position, delay_days, objective").eq("campaign_id", id).order("position"),
    db.from("outreach_messages").select("subject, body, to_email").eq("outreach_campaign_id", id).eq("direction", "outbound").eq("step_position", 1).in("status", ["draft", "approved", "sent"]).order("created_at").limit(1).maybeSingle(),
  ]);
  const active = (enr ?? []).filter((e) => e.status === "active");
  const lead = (e: (typeof active)[number]) => e.lead as unknown as { email: string | null; do_not_contact: boolean } | null;
  return {
    campaign: c,
    recipients: active.length,
    withEmail: active.filter((e) => lead(e)?.email && !lead(e)?.do_not_contact).length,
    excluded: active.filter((e) => lead(e)?.do_not_contact).length,
    steps: steps ?? [],
    sample: sample ?? null,
  };
}
export type LaunchSummary = NonNullable<Awaited<ReturnType<typeof launchSummary>>>;
