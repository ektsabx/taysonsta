import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { CrmLeadRow, LeadStage } from "@/types/database";

// CRM reads (D-195), always as the member (RLS). The table and the Kanban
// read the same view (crm_leads), so both show the same leads and stages.
// The CRM holds deals only (owner 2026-10-21): a lead enters it when it is
// moved from a conversation (Interested or later). "New" leads live in
// Conversations and campaigns.

export const CRM_PAGE = 50;
export const CRM_SORTS = ["last_activity_at", "created_at", "deal_value", "next_follow_up_at", "name"] as const;
export type CrmSort = (typeof CRM_SORTS)[number];

export interface CrmQuery { stage?: LeadStage | null; owner?: string | null; q?: string | null; sort?: CrmSort; page?: number; all?: boolean }

const term = (s: string) => s.replace(/[%,()*\\]/g, " ").trim();

export async function listLeads(workspaceId: string, query: CrmQuery = {}): Promise<{ rows: CrmLeadRow[]; total: number }> {
  const db = await createClient();
  let q = db.from("crm_leads").select("*", { count: "exact" }).eq("workspace_id", workspaceId).neq("stage", "new");
  if (query.stage) q = q.eq("stage", query.stage);
  if (query.owner === "none") q = q.is("owner_id", null);
  else if (query.owner) q = q.eq("owner_id", query.owner);
  const s = query.q ? term(query.q) : "";
  if (s) q = q.or(`name.ilike.%${s}%,company_name.ilike.%${s}%,email.ilike.%${s}%`);
  const sort = query.sort ?? "last_activity_at";
  q = q.order(sort, { ascending: sort === "name" || sort === "next_follow_up_at", nullsFirst: false }).order("id");
  if (!query.all) {
    const page = Math.max(1, query.page ?? 1);
    q = q.range((page - 1) * CRM_PAGE, page * CRM_PAGE - 1);
  } else q = q.limit(1000);
  const { data, count } = await q;
  return { rows: (data ?? []) as CrmLeadRow[], total: count ?? 0 };
}

export async function stageTotals(workspaceId: string): Promise<Record<LeadStage, { count: number; value: number }>> {
  const db = await createClient();
  const { data } = await db.from("sales_leads").select("stage, deal_value").eq("workspace_id", workspaceId).limit(10000);
  const out = { new: { count: 0, value: 0 }, interested: { count: 0, value: 0 }, meeting_booked: { count: 0, value: 0 }, meeting_completed: { count: 0, value: 0 }, proposal: { count: 0, value: 0 }, negotiation: { count: 0, value: 0 }, closed: { count: 0, value: 0 }, lost: { count: 0, value: 0 } };
  for (const r of data ?? []) { out[r.stage].count++; out[r.stage].value += Number(r.deal_value ?? 0); }
  return out;
}

export async function getLead(workspaceId: string, id: string) {
  const db = await createClient();
  const [{ data: lead }, { data: deal }] = await Promise.all([
    db.from("crm_leads").select("*").eq("workspace_id", workspaceId).eq("id", id).maybeSingle(),
    // Deal fields added after the crm_leads view (2026-10-29): read from the table.
    db.from("sales_leads").select("expected_close_at, lost_reason, closed_at").eq("workspace_id", workspaceId).eq("id", id).maybeSingle(),
  ]);
  if (!lead) return null;
  const l = { ...(lead as CrmLeadRow), ...(deal ?? { expected_close_at: null, lost_reason: null, closed_at: null }) } as CrmLeadRow;
  const [activities, tasks, meetings, messages, enrollments, approvals, profiles, person, company] = await Promise.all([
    db.from("lead_activities").select("*").eq("lead_id", id).order("created_at", { ascending: false }).limit(100),
    db.from("lead_tasks").select("*").eq("lead_id", id).order("done_at", { ascending: true, nullsFirst: true }).order("due_at", { ascending: true, nullsFirst: false }).limit(50),
    db.from("sales_meetings").select("*").eq("lead_id", id).order("starts_at", { ascending: false }).limit(30),
    db.from("outreach_messages").select("*").eq("lead_id", id).order("created_at", { ascending: true }).limit(100),
    db.from("outreach_enrollments").select("*, campaign:outreach_campaigns(id, name, status)").eq("lead_id", id).order("created_at"),
    db.from("agent_pending_actions").select("*").eq("lead_id", id).eq("status", "pending").order("created_at", { ascending: false }),
    db.from("customer_profiles").select("*").eq("workspace_id", workspaceId).order("is_default", { ascending: false }).order("name"),
    l.prospect_id ? db.from("prospects").select("full_name, title, seniority, city, country, email, phone, linkedin_url, match_score").eq("id", l.prospect_id).maybeSingle() : Promise.resolve({ data: null }),
    l.company_id ? db.from("companies").select("name, domain, website, industry, category, description, employee_count, city, country, phone, email, linkedin_url").eq("id", l.company_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  // A company lead shows the decision makers found at that company (one page per customer, 2026-10-29).
  const { data: people } = l.company_id && !l.prospect_id
    ? await db.from("prospects").select("id, full_name, title").eq("workspace_id", workspaceId).eq("company_id", l.company_id).order("match_score", { ascending: false, nullsFirst: false }).limit(10)
    : { data: [] };
  return {
    lead: l,
    activities: activities.data ?? [],
    tasks: tasks.data ?? [],
    meetings: meetings.data ?? [],
    messages: messages.data ?? [],
    enrollments: (enrollments.data ?? []).map((e) => ({ ...e, campaign: e.campaign as unknown as { id: string; name: string; status: string } | null })),
    approvals: approvals.data ?? [],
    profiles: profiles.data ?? [],
    person: person.data,
    people: people ?? [],
    company: company.data,
  };
}
export type LeadDetail = NonNullable<Awaited<ReturnType<typeof getLead>>>;

/** The lead behind a prospect page (person, or a company lead with no person), if there is one. */
export async function leadFor(workspaceId: string, by: { prospectId?: string; companyId?: string }): Promise<string | null> {
  const db = await createClient();
  const q = db.from("sales_leads").select("id").eq("workspace_id", workspaceId);
  const { data } = by.prospectId ? await q.eq("prospect_id", by.prospectId).limit(1).maybeSingle() : await q.eq("company_id", by.companyId!).is("prospect_id", null).limit(1).maybeSingle();
  return data?.id ?? null;
}
