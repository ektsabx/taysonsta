import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { LeadStage, OutreachCampaignRow } from "@/types/database";

// Outreach campaign reads (D-193), as the member (RLS). Numbers are counted
// from real rows: enrollments, drafts, messages confirmed sent, logged
// replies and meetings booked after the lead joined the campaign.

export interface CampaignStats { leads: number; drafts: number; sent: number; replies: number; meetings: number }
const zero = (): CampaignStats => ({ leads: 0, drafts: 0, sent: 0, replies: 0, meetings: 0 });

export async function listOutreachCampaigns(workspaceId: string): Promise<(OutreachCampaignRow & { stats: CampaignStats })[]> {
  const db = await createClient();
  const { data: campaigns } = await db.from("outreach_campaigns").select("*").eq("workspace_id", workspaceId).order("updated_at", { ascending: false }).limit(200);
  if (!campaigns?.length) return [];
  const stats = await campaignStats(campaigns.map((c) => c.id));
  return campaigns.map((c) => ({ ...c, stats: stats.get(c.id) ?? zero() }));
}

export async function campaignStats(ids: string[]): Promise<Map<string, CampaignStats>> {
  const db = await createClient();
  const out = new Map<string, CampaignStats>(ids.map((id) => [id, zero()]));
  const [{ data: enr }, { data: msgs }] = await Promise.all([
    db.from("outreach_enrollments").select("campaign_id, lead_id, created_at").in("campaign_id", ids).limit(20000),
    db.from("outreach_messages").select("outreach_campaign_id, status, direction").in("outreach_campaign_id", ids).limit(50000),
  ]);
  for (const e of enr ?? []) out.get(e.campaign_id)!.leads++;
  for (const m of msgs ?? []) {
    const s = m.outreach_campaign_id ? out.get(m.outreach_campaign_id) : undefined;
    if (!s) continue;
    if (m.direction === "inbound") s.replies++;
    else if (m.status === "sent") s.sent++;
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
