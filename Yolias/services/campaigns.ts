import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { OutreachCampaignRow } from "@/types/database";
import { isAutoReplyRow } from "@/lib/outreach/auto-reply";

// Campaign numbers for the Campaigns list and a campaign's page (D-256, after
// AgentSDR Send campaigns). Counted from real rows only: enrollments, the
// emails the mailbox accepted (sent), the ones it refused (failed), the ones
// returned (bounced) and the replies read from the mailbox. Read as the member (RLS).

export type CampaignView = "draft" | "active" | "paused" | "completed" | "archived";
export type LeadView = "pending" | "in_sequence" | "replied" | "completed" | "bounced" | "suppressed";
const SUPPRESSED = new Set(["do_not_contact", "no_email", "suppressed", "campaign_canceled", "opted_out", "stop_request"]);

export interface CampaignSummary {
  id: string;
  name: string;
  view: CampaignView;
  status: OutreachCampaignRow["status"];
  approved: boolean;
  createdAt: string;
  steps: number;
  leads: number;
  contacted: number;
  sent: number;
  /** Emails still to go: the remaining steps of active leads. */
  scheduled: number;
  replied: number;
  bounced: number;
  failed: number;
  lastSendAt: string | null;
  nextSendAt: string | null;
  /** Share of the planned sends done (sent / (sent + scheduled)). */
  donePct: number;
  /** A/B test of the first email (D-268): leads sent each version and how many replied. */
  ab: { a: { sent: number; replied: number }; b: { sent: number; replied: number } } | null;
}

type Enr = { id: string; campaign_id: string; lead_id: string; status: string; current_step: number; next_step_at: string | null; stop_reason: string | null; created_at: string };
type Msg = { id: string; outreach_campaign_id: string; enrollment_id: string | null; lead_id: string | null; direction: "inbound" | "outbound"; status: string; delivery_status: string | null; sent_at: string | null; variant?: string | null; created_at: string; updated_at: string; step_position: number | null; body: string; subject: string; analysis?: unknown };

function summarise(c: OutreachCampaignRow, steps: number, enr: Enr[], msgs: Msg[]): CampaignSummary {
  const out = msgs.filter((m) => m.direction === "outbound");
  const sent = out.filter((m) => m.status === "sent");
  const repliedLeads = new Set(msgs.filter((m) => m.direction === "inbound" && m.lead_id && !isAutoReplyRow(m)).map((m) => m.lead_id));
  const active = enr.filter((e) => e.status === "active");
  const scheduled = active.reduce((n, e) => n + Math.max(steps - e.current_step, 0), 0);
  const lastSendAt = sent.map((m) => m.sent_at!).filter(Boolean).sort().at(-1) ?? null;
  const nextSendAt = active.map((e) => e.next_step_at).filter((x): x is string => Boolean(x)).sort()[0] ?? null;
  const view: CampaignView = c.status === "archived" ? "archived" : c.status === "draft" ? "draft"
    : enr.length > 0 && !active.length ? "completed" : c.status === "paused" ? "paused" : "active";
  return {
    id: c.id, name: c.name, view, status: c.status, approved: Boolean(c.approved_at), createdAt: c.created_at, steps, leads: enr.length,
    contacted: new Set(sent.map((m) => m.lead_id)).size, sent: sent.length, scheduled, replied: repliedLeads.size,
    bounced: sent.filter((m) => m.delivery_status === "bounced").length, failed: out.filter((m) => m.status === "failed").length,
    lastSendAt, nextSendAt, donePct: sent.length + scheduled ? (sent.length / (sent.length + scheduled)) * 100 : 0,
    ab: (() => {
      const first = sent.filter((m) => m.variant === "a" || m.variant === "b");
      if (!first.length) return null;
      const side = (v: "a" | "b") => { const leads = new Set(first.filter((m) => m.variant === v).map((m) => m.lead_id)); return { sent: leads.size, replied: [...leads].filter((l) => repliedLeads.has(l)).length }; };
      return { a: side("a"), b: side("b") };
    })(),
  };
}

/** Every campaign of the workspace with its numbers, newest first. */
export async function campaignList(workspaceId: string): Promise<CampaignSummary[]> {
  const db = await createClient();
  const { data: camps } = await db.from("outreach_campaigns").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(200);
  if (!camps?.length) return [];
  const ids = camps.map((c) => c.id);
  const [{ data: steps }, { data: enr }, { data: msgs }] = await Promise.all([
    db.from("outreach_steps").select("campaign_id").in("campaign_id", ids),
    db.from("outreach_enrollments").select("id, campaign_id, lead_id, status, current_step, next_step_at, stop_reason, created_at").in("campaign_id", ids).limit(20000),
    db.from("outreach_messages").select("id, outreach_campaign_id, enrollment_id, lead_id, direction, status, delivery_status, sent_at, created_at, updated_at, step_position, analysis").in("outreach_campaign_id", ids).in("status", ["sent", "failed", "received"]).limit(50000),
  ]);
  const group = <T,>(rows: T[] | null, key: (r: T) => string) => (rows ?? []).reduce((m, r) => m.set(key(r), [...(m.get(key(r)) ?? []), r]), new Map<string, T[]>());
  const s = group(steps, (r) => r.campaign_id), e = group(enr as Enr[] | null, (r) => r.campaign_id), m = group(msgs as Msg[] | null, (r) => r.outreach_campaign_id);
  return (camps as OutreachCampaignRow[]).map((c) => summarise(c, s.get(c.id)?.length ?? 0, e.get(c.id) ?? [], m.get(c.id) ?? []));
}

/** YYYY-MM-DD of `iso` in `tz`. */
export function dayKey(iso: string | number | Date, tz: string): string {
  try { return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso)); }
  catch { return new Date(iso).toISOString().slice(0, 10); }
}

export interface CampaignLead {
  enrollmentId: string;
  leadId: string;
  name: string;
  email: string | null;
  company: string | null;
  view: LeadView;
  step: number;
  lastMessage: string | null;
  nextSendAt: string | null;
}

export interface CampaignPage {
  summary: CampaignSummary;
  campaign: OutreachCampaignRow;
  /** Follow-ups sent today, new leads reached today (first email today), next email. */
  today: { followUps: number; newLeads: number };
  stand: { inProgress: number; yetToStart: number; completed: number; replied: number; bouncedOrUnsubscribed: number };
  /** Per day for the last 30 days (oldest first), in the member's time zone. */
  activity: { day: string; sent: number; scheduled: number; failed: number }[];
  leads: CampaignLead[];
}

/** One campaign's page: the numbers, where its leads stand, daily sends and every lead. */
export async function campaignPage(workspaceId: string, id: string, timeZone: string | null): Promise<CampaignPage | null> {
  const db = await createClient();
  const { data: c } = await db.from("outreach_campaigns").select("*").eq("workspace_id", workspaceId).eq("id", id).maybeSingle();
  if (!c) return null;
  const [{ data: steps }, { data: enr }, { data: msgs }] = await Promise.all([
    db.from("outreach_steps").select("position").eq("campaign_id", id),
    db.from("outreach_enrollments").select("id, campaign_id, lead_id, status, current_step, next_step_at, stop_reason, created_at, lead:sales_leads(name, email, company_name, do_not_contact)").eq("campaign_id", id).order("created_at", { ascending: false }).limit(5000),
    db.from("outreach_messages").select("id, outreach_campaign_id, enrollment_id, lead_id, direction, status, delivery_status, sent_at, created_at, updated_at, step_position, body, subject, analysis, variant").eq("outreach_campaign_id", id).neq("status", "canceled").order("created_at", { ascending: false }).limit(20000),
  ]);
  const rows = (enr ?? []) as unknown as (Enr & { lead: { name: string; email: string | null; company_name: string | null; do_not_contact: boolean } | null })[];
  const ms = (msgs ?? []) as Msg[];
  const nSteps = steps?.length ?? 0;
  const summary = summarise(c as OutreachCampaignRow, nSteps, rows, ms.filter((m) => ["sent", "failed", "received"].includes(m.status)));
  const tz = timeZone ?? "UTC";
  const today = dayKey(Date.now(), tz);
  const sentToday = ms.filter((m) => m.direction === "outbound" && m.status === "sent" && m.sent_at && dayKey(m.sent_at, tz) === today);
  const repliedLeads = new Set(ms.filter((m) => m.direction === "inbound" && !isAutoReplyRow(m)).map((m) => m.lead_id));
  const lastSent = new Map<string, string>();
  for (const m of ms) if (m.direction === "outbound" && m.status === "sent" && m.enrollment_id && !lastSent.has(m.enrollment_id)) lastSent.set(m.enrollment_id, m.body);

  const leadView = (e: (typeof rows)[number]): LeadView => {
    if (e.stop_reason === "bounced") return "bounced";
    if (repliedLeads.has(e.lead_id) || e.status === "replied") return "replied";
    if (e.status === "completed") return "completed";
    if (e.status === "stopped" && (SUPPRESSED.has(e.stop_reason ?? "") || e.lead?.do_not_contact)) return "suppressed";
    if (e.status === "active") return e.current_step > 0 ? "in_sequence" : "pending";
    return "completed";
  };
  const leads: CampaignLead[] = rows.map((e) => ({
    enrollmentId: e.id, leadId: e.lead_id, name: e.lead?.name ?? "-", email: e.lead?.email ?? null, company: e.lead?.company_name ?? null,
    view: leadView(e), step: e.current_step, lastMessage: lastSent.get(e.id) ?? null, nextSendAt: e.status === "active" ? e.next_step_at : null,
  }));
  const count = (v: LeadView) => leads.filter((l) => l.view === v).length;

  const days = Array.from({ length: 30 }, (_, i) => dayKey(Date.now() - (29 - i) * 86_400_000, tz));
  const activity = days.map((day) => ({ day, sent: 0, scheduled: 0, failed: 0 }));
  const at = new Map(activity.map((a) => [a.day, a]));
  for (const m of ms) {
    if (m.direction !== "outbound") continue;
    if (m.status === "sent" && m.sent_at) { const a = at.get(dayKey(m.sent_at, tz)); if (a) a.sent++; }
    if (m.status === "failed") { const a = at.get(dayKey(m.updated_at, tz)); if (a) a.failed++; }
  }
  // Still scheduled: what's due today or overdue for active leads.
  const todayRow = at.get(today);
  if (todayRow) todayRow.scheduled = rows.filter((e) => e.status === "active" && (!e.next_step_at || dayKey(e.next_step_at, tz) <= today)).length;

  return {
    summary, campaign: c as OutreachCampaignRow,
    today: { followUps: sentToday.filter((m) => (m.step_position ?? 1) > 1).length, newLeads: sentToday.filter((m) => (m.step_position ?? 1) === 1).length },
    stand: { inProgress: count("in_sequence"), yetToStart: count("pending"), completed: count("completed"), replied: count("replied"), bouncedOrUnsubscribed: count("bounced") + count("suppressed") },
    activity, leads,
  };
}
