import "server-only";
import { createClient } from "@/lib/supabase/server";
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

type PersonQ = {
  id: string; company_id: string | null; title: string | null; seniority: string | null; email: string | null; email_status: string; phone: string | null;
  country: string | null; city: string | null; match_score: number | null; confidence: number | null; missing_fields: string[]; source: string; created_at: string;
  revealed_at: string | null; bookmarked_at: string | null; company: { industry: string | null; employee_count: number | null; country: string | null; city: string | null } | null;
};
type CompanyQ = {
  id: string; kind: "company" | "local_business"; industry: string | null; category: string | null; employee_count: number | null; country: string | null; city: string | null;
  match_score: number | null; confidence: number | null; missing_fields: string[]; source: string; created_at: string; bookmarked_at: string | null; phone: string | null;
};

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
    all<PersonQ>(() => db.from("prospects").select("id, company_id, title, seniority, email, email_status, phone, country, city, match_score, confidence, missing_fields, source, created_at, revealed_at, bookmarked_at, company:companies(industry, employee_count, country, city)")
      .eq("workspace_id", workspaceId).gte("created_at", s).order("created_at")),
    all<CompanyQ>(() => db.from("companies").select("id, kind, industry, category, employee_count, country, city, match_score, confidence, missing_fields, source, created_at, bookmarked_at, phone")
      .eq("workspace_id", workspaceId).gte("created_at", s).not("delivered_at", "is", null).order("created_at")),
    all<{ prospect_id: string | null; company_id: string | null; channel: string; opened_at: string | null }>(() => db.from("outreach_messages").select("prospect_id, company_id, channel, opened_at")
      .eq("workspace_id", workspaceId).gte("created_at", s)),
    db.from("companies").select("id", head).eq("workspace_id", workspaceId).gte("created_at", s),
    db.from("prospects").select("id", head).eq("workspace_id", workspaceId).gte("created_at", before).lt("created_at", s),
    db.from("companies").select("id", head).eq("workspace_id", workspaceId).gte("created_at", before).lt("created_at", s).not("delivered_at", "is", null),
    db.from("companies").select("id", head).eq("workspace_id", workspaceId).gte("created_at", before).lt("created_at", s),
    db.from("strategies").select("id", head).eq("workspace_id", workspaceId).gte("created_at", s),
    db.from("companies").select("id", head).eq("workspace_id", workspaceId).gte("people_requested_at", s),
    db.from("agent_tool_calls").select("id", head).eq("workspace_id", workspaceId).eq("tool", "enrichProspect").eq("ok", true).gte("created_at", s),
    all<{ format: string | null }>(() => db.from("workspace_activity").select("format").eq("workspace_id", workspaceId).eq("kind", "export").gte("created_at", s)),
  ]);

  const contacted = new Set(messages.filter((m) => m.opened_at).flatMap((m) => [m.prospect_id, m.company_id]).filter(Boolean));
  const rows: LeadRow[] = [
    ...people.map((p): LeadRow => ({
      kind: "person", companyId: p.company_id, country: p.country ?? p.company?.country ?? null, city: p.city ?? p.company?.city ?? null,
      industry: p.company?.industry ?? null, employees: p.company?.employee_count ?? null, title: p.title, seniority: p.seniority,
      match: p.match_score, confidence: p.confidence, emailFound: Boolean(p.email) && p.email_status !== "invalid", emailVerified: p.email_status === "verified",
      phoneFound: Boolean(p.phone), missing: p.missing_fields ?? [], source: p.source, createdAt: p.created_at,
      selected: Boolean(p.revealed_at || p.bookmarked_at || contacted.has(p.id)), contacted: contacted.has(p.id),
    })),
    ...companies.map((c): LeadRow => ({
      kind: c.kind, companyId: c.id, country: c.country, city: c.city, industry: c.kind === "local_business" ? c.category ?? c.industry : c.industry ?? c.category,
      employees: c.employee_count, title: null, seniority: null, match: c.match_score, confidence: c.confidence, emailFound: false, emailVerified: false,
      phoneFound: Boolean(c.phone), missing: c.missing_fields ?? [], source: c.source, createdAt: c.created_at,
      selected: Boolean(c.bookmarked_at || contacted.has(c.id)), contacted: contacted.has(c.id),
    })),
  ];
  const activity: ActivityCounts = {
    searches: searches.count ?? 0,
    enrichments: (collections.count ?? 0) + (enrichCalls.count ?? 0),
    exports: exports.length,
    csvExports: exports.filter((e) => e.format === "csv").length,
    emailsPrepared: messages.filter((m) => m.channel === "email").length,
    messagesPrepared: messages.length,
  };
  return computeDiscovery(rows, companiesFound.count ?? 0, { leads: (prevPeople.count ?? 0) + (prevDelivered.count ?? 0), companies: prevCompanies.count ?? 0, decisionMakers: prevPeople.count ?? 0 }, activity, since, days);
}
