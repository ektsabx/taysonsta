import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isAutoReplyRow } from "@/lib/outreach/auto-reply";
import { computeDiscovery, type ActivityCounts, type LeadRow } from "@/lib/analytics/discovery";

export const ranges = { "7d": 7, "30d": 30, "90d": 90 } as const;
export type RangeKey = keyof typeof ranges;

export function parseRange(v: unknown): RangeKey {
  return typeof v === "string" && v in ranges ? (v as RangeKey) : "30d";
}

type Client = Awaited<ReturnType<typeof createClient>>;
const MAX_ROWS = 20_000;

/** Every row of a query, a page at a time (capped). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function all<T>(make: () => any): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < MAX_ROWS; from += 1000) {
    const { data } = await make().range(from, from + 999);
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

const head = { count: "exact" as const, head: true };

type PersonQ = { company_id: string | null; title: string | null; email: string | null; email_status: string; match_score: number | null };
type CompanyQ = { id: string; kind: "company" | "local_business"; match_score: number | null };

/**
 * Discovery analytics for one workspace and period (D-162). Leads are what a
 * search delivers: decision makers, and the companies / local businesses of
 * company searches. Read with the member's own client (RLS).
 */
export async function discoveryAnalytics(workspaceId: string, range: RangeKey) {
  const db: Client = await createClient();
  const days = ranges[range];
  const now = Date.now();
  const since = new Date(now - days * 86_400_000);
  const before = new Date(now - 2 * days * 86_400_000).toISOString();
  const s = since.toISOString();

  const [people, companies, messages, companiesFound, prevPeople, prevDelivered, prevCompanies, searches, collections, enrichCalls, exports] = await Promise.all([
    all<PersonQ>(() => db.from("prospects").select("company_id, title, email, email_status, match_score")
      .eq("workspace_id", workspaceId).gte("created_at", s).order("created_at")),
    all<CompanyQ>(() => db.from("companies").select("id, kind, match_score")
      .eq("workspace_id", workspaceId).gte("created_at", s).not("delivered_at", "is", null).order("created_at")),
    all<{ channel: string }>(() => db.from("outreach_messages").select("channel").eq("workspace_id", workspaceId).gte("created_at", s)),
    db.from("companies").select("id", head).eq("workspace_id", workspaceId).gte("created_at", s),
    db.from("prospects").select("id", head).eq("workspace_id", workspaceId).gte("created_at", before).lt("created_at", s),
    db.from("companies").select("id", head).eq("workspace_id", workspaceId).gte("created_at", before).lt("created_at", s).not("delivered_at", "is", null),
    db.from("companies").select("id", head).eq("workspace_id", workspaceId).gte("created_at", before).lt("created_at", s),
    db.from("strategies").select("id", head).eq("workspace_id", workspaceId).gte("created_at", s),
    db.from("companies").select("id", head).eq("workspace_id", workspaceId).gte("people_requested_at", s),
    db.from("agent_tool_calls").select("id", head).eq("workspace_id", workspaceId).eq("tool", "enrichProspect").eq("ok", true).gte("created_at", s),
    all<{ format: string | null }>(() => db.from("workspace_activity").select("format").eq("workspace_id", workspaceId).eq("kind", "export").gte("created_at", s)),
  ]);

  const rows: LeadRow[] = [
    ...people.map((p): LeadRow => ({
      kind: "person", companyId: p.company_id, title: p.title, match: p.match_score, emailFound: Boolean(p.email) && p.email_status !== "invalid",
    })),
    ...companies.map((c): LeadRow => ({ kind: c.kind, companyId: c.id, title: null, match: c.match_score, emailFound: false })),
  ];
  const activity: ActivityCounts = {
    searches: searches.count ?? 0,
    enrichments: (collections.count ?? 0) + (enrichCalls.count ?? 0),
    exports: exports.length,
    csvExports: exports.filter((e) => e.format === "csv").length,
    emailsPrepared: messages.filter((m) => m.channel === "email").length,
    messagesPrepared: messages.length,
  };
  return computeDiscovery(rows, companiesFound.count ?? 0, { leads: (prevPeople.count ?? 0) + (prevDelivered.count ?? 0), companies: prevCompanies.count ?? 0, decisionMakers: prevPeople.count ?? 0 }, activity);
}

/**
 * Outreach and sales results for the period (D-234), from real rows only:
 * campaigns created / started, messages the mailbox accepted ("sent") vs
 * confirmed by hand, failed, bounced (the provider returned them), replies,
 * interested replies, meetings and won deals. "Delivered" isn't claimed: the
 * only delivery signal we have is a bounce.
 */
export async function outreachAnalytics(workspaceId: string, range: RangeKey, client?: Client) {
  const db: Client = client ?? (await createClient());
  const s = new Date(Date.now() - ranges[range] * 86_400_000).toISOString();
  const [campaigns, out, received, meetings, won, leads] = await Promise.all([
    all<{ id: string; approved_at: string | null; created_at: string }>(() => db.from("outreach_campaigns").select("id, approved_at, created_at").eq("workspace_id", workspaceId).gte("created_at", s)),
    all<{ status: string; sent_via: string | null; delivery_status: string | null; sent_at: string | null; lead_id: string | null }>(() => db.from("outreach_messages").select("status, sent_via, delivery_status, sent_at, lead_id")
      .eq("workspace_id", workspaceId).eq("direction", "outbound").in("status", ["sent", "failed"]).gte("updated_at", s)),
    all<{ analysis: unknown; lead_id: string | null }>(() => db.from("outreach_messages").select("analysis, lead_id").eq("workspace_id", workspaceId).eq("direction", "inbound").gte("received_at", s)),
    db.from("sales_meetings").select("id", head).eq("workspace_id", workspaceId).gte("created_at", s).neq("status", "canceled"),
    db.from("sales_leads").select("id", head).eq("workspace_id", workspaceId).eq("stage", "closed").gte("stage_changed_at", s),
    db.from("sales_leads").select("id", head).eq("workspace_id", workspaceId).gte("created_at", s),
  ]);
  const sent = out.filter((m) => m.status === "sent" && m.sent_at && m.sent_at >= s);
  // An out-of-office reply isn't the lead answering (owner, 2026-10-28): not a reply here.
  const inbound = received.filter((m) => !isAutoReplyRow(m));
  const kinds = inbound.map((m) => (m.analysis as { kind?: string } | null)?.kind);
  const contactedLeads = new Set(sent.map((m) => m.lead_id).filter(Boolean));
  const repliedLeads = new Set(inbound.map((m) => m.lead_id).filter((id) => id && contactedLeads.has(id))).size;
  return {
    campaignsCreated: campaigns.length,
    campaignsStarted: campaigns.filter((c) => c.approved_at).length,
    leadsAdded: leads.count ?? 0,
    sent: sent.length,
    sentFromMailbox: sent.filter((m) => m.sent_via === "mailbox").length,
    failed: out.filter((m) => m.status === "failed").length,
    bounced: sent.filter((m) => m.delivery_status === "bounced").length,
    replies: inbound.length,
    repliedLeads,
    contactedLeads: contactedLeads.size,
    interested: kinds.filter((k) => k === "interested" || k === "meeting_request").length,
    interestedLeads: new Set(inbound.filter((m) => ["interested", "meeting_request"].includes((m.analysis as { kind?: string } | null)?.kind ?? "")).map((m) => m.lead_id).filter(Boolean)).size,
    optedOut: kinds.filter((k) => k === "stop_request").length,
    meetings: meetings.count ?? 0,
    won: won.count ?? 0,
  };
}

/**
 * The member's overview (owner, 2026-10-30, D-269): what matters in each part
 * of Yolias for the period: search, campaigns, conversations, meetings and
 * customers, plus a day-by-day series of emails sent, replies and meetings
 * booked. Real rows only (RLS: the member's workspace). A campaign's own
 * numbers are on its page, not here.
 */
export async function overviewAnalytics(workspaceId: string, range: RangeKey, timeZone: string | null) {
  const db: Client = await createClient();
  const days = ranges[range];
  const now = Date.now();
  const s = new Date(now - days * 86_400_000).toISOString();
  const [strategies, companies, people, campaigns, sentRows, received, unread, meetings, won, lost] = await Promise.all([
    db.from("strategies").select("id", head).eq("workspace_id", workspaceId).neq("status", "chat").gte("created_at", s),
    db.from("companies").select("id", head).eq("workspace_id", workspaceId).not("delivered_at", "is", null).gte("created_at", s),
    all<{ email: string | null; email_status: string }>(() => db.from("prospects").select("email, email_status").eq("workspace_id", workspaceId).gte("created_at", s).order("created_at")),
    db.from("outreach_campaigns").select("id", head).eq("workspace_id", workspaceId).eq("status", "active").not("approved_at", "is", null),
    all<{ sent_at: string | null; lead_id: string | null; delivery_status: string | null }>(() => db.from("outreach_messages").select("sent_at, lead_id, delivery_status")
      .eq("workspace_id", workspaceId).eq("direction", "outbound").eq("status", "sent").gte("sent_at", s).order("sent_at")),
    all<{ received_at: string | null; lead_id: string | null; analysis: unknown }>(() => db.from("outreach_messages").select("received_at, lead_id, analysis")
      .eq("workspace_id", workspaceId).eq("direction", "inbound").gte("received_at", s).order("received_at")),
    db.from("crm_leads").select("id", head).eq("workspace_id", workspaceId).eq("unread", true),
    all<{ created_at: string; starts_at: string; status: string; source: string }>(() => db.from("sales_meetings").select("created_at, starts_at, status, source")
      .eq("workspace_id", workspaceId).or(`created_at.gte.${s},starts_at.gte.${s}`).order("created_at")),
    db.from("sales_leads").select("id", head).eq("workspace_id", workspaceId).eq("stage", "closed").gte("stage_changed_at", s),
    db.from("sales_leads").select("id", head).eq("workspace_id", workspaceId).eq("stage", "lost").gte("stage_changed_at", s),
  ]);
  const replies = received.filter((m) => !isAutoReplyRow(m));
  const contacted = new Set(sentRows.map((m) => m.lead_id).filter(Boolean));
  const replied = new Set(replies.map((m) => m.lead_id).filter((id) => id && contacted.has(id)));
  const interested = new Set(replies.filter((m) => ["interested", "meeting_request"].includes((m.analysis as { kind?: string } | null)?.kind ?? "")).map((m) => m.lead_id).filter(Boolean));
  const booked = meetings.filter((m) => m.created_at >= s && m.status !== "canceled");
  const past = meetings.filter((m) => m.starts_at >= s && Date.parse(m.starts_at) < now);
  const held = past.filter((m) => m.status === "completed").length;
  const noShow = past.filter((m) => m.status === "no_show").length;
  const tz = timeZone ?? "UTC";
  const dayOf = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
  const series = new Map<string, { sent: number; replies: number; meetings: number }>();
  for (let i = days - 1; i >= 0; i--) series.set(dayOf(new Date(now - i * 86_400_000).toISOString()), { sent: 0, replies: 0, meetings: 0 });
  for (const m of sentRows) if (m.sent_at) { const d = series.get(dayOf(m.sent_at)); if (d) d.sent++; }
  for (const m of replies) if (m.received_at) { const d = series.get(dayOf(m.received_at)); if (d) d.replies++; }
  for (const m of booked) { const d = series.get(dayOf(m.created_at)); if (d) d.meetings++; }
  const withEmail = people.filter((p) => p.email && p.email_status !== "invalid").length;
  const wonN = won.count ?? 0, lostN = lost.count ?? 0;
  return {
    search: { searches: strategies.count ?? 0, companies: companies.count ?? 0, people: people.length, withEmail, emailPct: people.length ? Math.round((withEmail / people.length) * 100) : null },
    campaigns: { active: campaigns.count ?? 0, sent: sentRows.length, contacted: contacted.size, bounced: sentRows.filter((m) => m.delivery_status === "bounced").length },
    conversations: { replies: replies.length, replied: replied.size, replyPct: contacted.size ? Math.round((replied.size / contacted.size) * 100) : null, interested: interested.size, waiting: unread.count ?? 0 },
    meetings: {
      booked: booked.length, held, noShow, upcoming: meetings.filter((m) => m.status === "scheduled" && Date.parse(m.starts_at) >= now).length,
      bySource: { booking: booked.filter((m) => m.source === "booking").length, agent: booked.filter((m) => m.source === "agent").length, manual: booked.filter((m) => m.source === "manual").length },
    },
    customers: { won: wonN, lost: lostN, winPct: wonN + lostN ? Math.round((wonN / (wonN + lostN)) * 100) : null },
    series: [...series.entries()].map(([day, v]) => ({ day, ...v })),
    funnel: [
      { key: "found", n: (companies.count ?? 0) + people.length }, { key: "contacted", n: contacted.size }, { key: "replied", n: replied.size },
      { key: "interested", n: interested.size }, { key: "meetings", n: booked.length }, { key: "customers", n: wonN },
    ],
  };
}
export type Overview = Awaited<ReturnType<typeof overviewAnalytics>>;
