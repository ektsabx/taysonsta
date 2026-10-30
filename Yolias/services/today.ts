import "server-only";
import { reengageTargets } from "@/lib/outreach/reengage";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, LeadStage } from "@/types/database";

type Db = SupabaseClient<Database>;

// "Today" at the top of Analytics and in the morning email (owner, 2026-10-29): what needs the member now,
// from real rows only (RLS: their workspace): conversations with an unread
// reply, today's meetings, open deals with no activity for a week, and the
// companies of won deals (to find more like them).

const OPEN: LeadStage[] = ["interested", "meeting_booked", "meeting_completed", "proposal", "negotiation"];
const STALE_DAYS = 7;

export interface Today {
  replies: number;
  meetings: { leadId: string; name: string; at: string }[];
  stale: { leadId: string; name: string; days: number }[];
  staleCount: number;
  won: string[];
  /** Calls, WhatsApp and LinkedIn steps and other tasks due today (D-268). */
  tasks: number;
  /** People to try again (didn't reply 60+ days ago), D-268. */
  reengage: number;
  firstTaskLead: string | null;
}

/** `db`: the member's client (RLS) in the app; the morning email passes the service client. */
export async function todayFor(workspaceId: string, timeZone: string | null, client?: Db): Promise<Today> {
  const db = client ?? await createClient();
  const tz = timeZone ?? "UTC";
  // The member's day in their time zone, as UTC bounds.
  const now = new Date();
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const offset = now.getTime() - new Date(now.toLocaleString("en-US", { timeZone: tz })).getTime();
  const start = new Date(Date.parse(`${day}T00:00:00Z`) + offset).toISOString();
  const end = new Date(Date.parse(`${day}T00:00:00Z`) + offset + 86_400_000).toISOString();
  const staleBefore = new Date(now.getTime() - STALE_DAYS * 86_400_000).toISOString();
  const [unread, meetings, stale, staleCount, won, tasks] = await Promise.all([
    db.from("crm_leads").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("unread", true),
    db.from("sales_meetings").select("lead_id, starts_at, lead:sales_leads(name)").eq("workspace_id", workspaceId).eq("status", "scheduled").gte("starts_at", start).lt("starts_at", end).order("starts_at").limit(3),
    db.from("sales_leads").select("id, name, last_activity_at").eq("workspace_id", workspaceId).in("stage", OPEN).lt("last_activity_at", staleBefore).order("last_activity_at").limit(3),
    db.from("sales_leads").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).in("stage", OPEN).lt("last_activity_at", staleBefore),
    db.from("sales_leads").select("company_name, name").eq("workspace_id", workspaceId).eq("stage", "closed").order("stage_changed_at", { ascending: false }).limit(3),
    db.from("lead_tasks").select("lead_id", { count: "exact" }).eq("workspace_id", workspaceId).is("done_at", null).lt("due_at", end).order("due_at").limit(1),
  ]);
  return {
    replies: unread.count ?? 0,
    meetings: (meetings.data ?? []).map((m) => ({ leadId: m.lead_id, name: (m.lead as unknown as { name: string } | null)?.name ?? "", at: m.starts_at })),
    stale: (stale.data ?? []).map((l) => ({ leadId: l.id, name: l.name, days: Math.floor((now.getTime() - Date.parse(l.last_activity_at)) / 86_400_000) })),
    staleCount: staleCount.count ?? 0,
    tasks: tasks.count ?? 0,
    reengage: await reengageTargets(db, workspaceId).then((r) => r.prospectIds.length + r.companyIds.length).catch(() => 0),
    firstTaskLead: tasks.data?.[0]?.lead_id ?? null,
    won: [...new Set((won.data ?? []).map((w) => w.company_name || w.name).filter(Boolean))] as string[],
  };
}
