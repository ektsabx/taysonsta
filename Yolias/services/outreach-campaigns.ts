import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isAutoReplyRow } from "@/lib/outreach/auto-reply";
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
      if (isAutoReplyRow(m)) continue; // out of office: not a reply (owner, 2026-10-28)
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

export type EmailFinding = "verified" | "found" | "none" | "finding";

/**
 * The campaign page (D-239): every person in the campaign with their email
 * (and how it was found), the email Yolias wrote for their current step, and
 * what was sent (when, from which mailbox, bounced / replied).
 */
export async function campaignWorkspace(workspaceId: string, id: string) {
  const db = await createClient();
  const { data: enr } = await db.from("outreach_enrollments")
    .select("id, status, stop_reason, current_step, lead:sales_leads(id, name, company_name, email, prospect_id, company_id, do_not_contact)")
    .eq("campaign_id", id).eq("workspace_id", workspaceId).order("created_at").limit(500);
  type Lead = { id: string; name: string; company_name: string | null; email: string | null; prospect_id: string | null; company_id: string | null; do_not_contact: boolean };
  const rows = (enr ?? []).map((e) => ({ ...e, lead: e.lead as unknown as Lead | null }));
  const prospectIds = rows.map((e) => e.lead?.prospect_id).filter((x): x is string => Boolean(x));
  const companyIds = rows.map((e) => e.lead?.company_id).filter((x): x is string => Boolean(x));
  const [{ data: people }, { data: companies }, { data: msgs }] = await Promise.all([
    prospectIds.length ? db.from("prospects").select("id, title, email_status, linkedin_url").in("id", prospectIds.slice(0, 500)) : Promise.resolve({ data: [] }),
    companyIds.length ? db.from("companies").select("id, domain, website, linkedin_url").in("id", companyIds.slice(0, 500)) : Promise.resolve({ data: [] }),
    db.from("outreach_messages").select("id, enrollment_id, lead_id, direction, status, subject, body, to_email, from_address, sent_at, received_at, created_at, delivery_status, error, step_position, analysis")
      .eq("outreach_campaign_id", id).neq("status", "canceled").order("created_at").limit(3000),
  ]);
  const person = new Map((people ?? []).map((p) => [p.id, p]));
  const company = new Map((companies ?? []).map((c) => [c.id, c]));
  const replied = new Set((msgs ?? []).filter((m) => m.direction === "inbound" && !isAutoReplyRow(m)).map((m) => m.lead_id));
  const current = new Map<string, NonNullable<typeof msgs>[number]>();
  for (const m of msgs ?? []) if (m.direction === "outbound" && m.enrollment_id) current.set(m.enrollment_id, m); // latest wins
  const leads = rows.map((e) => {
    const p = e.lead?.prospect_id ? person.get(e.lead.prospect_id) : undefined;
    const co = e.lead?.company_id ? company.get(e.lead.company_id) : undefined;
    const email = e.lead?.email ?? null;
    const finding: EmailFinding = email ? (p?.email_status === "verified" ? "verified" : "found") : e.stop_reason === "no_email" || e.current_step > 0 || e.status !== "active" ? "none" : "finding";
    const m = current.get(e.id) ?? null;
    return {
      enrollmentId: e.id, status: e.status, stopReason: e.stop_reason, step: e.current_step,
      leadId: e.lead?.id ?? null, name: e.lead?.name ?? "-", title: p?.title ?? null, company: e.lead?.company_name ?? null, domain: co?.domain ?? co?.website ?? null,
      linkedin: p?.linkedin_url ?? co?.linkedin_url ?? null, email, finding, doNotContact: e.lead?.do_not_contact ?? false, replied: e.lead ? replied.has(e.lead.id) : false,
      message: m ? { id: m.id, subject: m.subject, body: m.body, status: m.status, to: m.to_email, sentAt: m.sent_at, error: m.error } : null,
    };
  });
  const sent = (msgs ?? []).filter((m) => m.direction === "outbound" && (m.status === "sent" || m.status === "failed")).reverse().map((m) => {
    const l = rows.find((e) => e.id === m.enrollment_id)?.lead ?? rows.find((e) => e.lead?.id === m.lead_id)?.lead ?? null;
    return {
      id: m.id, lead: l?.name ?? "-", leadId: m.lead_id, to: m.to_email, subject: m.subject, body: m.body, sentAt: m.sent_at, from: m.from_address, step: m.step_position,
      status: m.status === "failed" ? ("failed" as const) : m.delivery_status === "bounced" ? ("bounced" as const) : m.lead_id && replied.has(m.lead_id) ? ("replied" as const) : ("sent" as const),
    };
  });
  return { leads, sent };
}
export type CampaignWorkspace = Awaited<ReturnType<typeof campaignWorkspace>>;
