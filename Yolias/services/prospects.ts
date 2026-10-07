import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { CompanyRow, JobRow, ProspectRow } from "@/types/database";

// The Prospects workspace (final spec phase 5): one tab per entity, each with
// filters, search, sort and pagination; selection by ids or "all matching".
// Reads go through the member's own client (RLS), never the service role.

export const prospectTabs = ["people", "companies", "local", "saved", "jobs"] as const;
export type ProspectTab = (typeof prospectTabs)[number];
/**
 * Tabs shown to customers: Yolias doesn't search for jobs (owner decision
 * D-149); hiring stays an internal signal. Saved lists the people, companies
 * and local businesses a member saved (bookmarked_at, D-159).
 */
// People are reached through their company (owner decision 2026-10-07, D-166):
// no People tab; "people" stays valid for exports of selected decision makers.
export const visibleTabs = ["companies", "local", "saved"] as const;
export const sorts = ["match", "newest", "name"] as const;
export type ProspectSort = (typeof sorts)[number];
/** Cards per page (fills 2, 3 or 4 columns evenly). */
export const PAGE_SIZE = 48;

export interface ProspectFilters {
  tab: ProspectTab;
  campaign?: string;
  country?: string;
  minMatch?: number;
  q?: string;
  /** People: verified email only. */
  verified?: boolean;
  /** Local businesses: city contains. */
  city?: string;
  sort: ProspectSort;
  page: number;
}

export type ProspectListItem = ProspectRow & {
  company: Pick<CompanyRow, "id" | "name" | "domain" | "employee_count" | "city" | "country"> | null;
  campaign: { name: string } | null;
};
export type CompanyListItem = CompanyRow & { campaign: { name: string } | null };
export type JobListItem = JobRow & { company: Pick<CompanyRow, "id" | "name" | "domain"> | null; campaign: { name: string } | null };

const uuid = /^[0-9a-f-]{36}$/i;

export function parseFilters(sp: Record<string, string | string[] | undefined>): ProspectFilters {
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).trim() : "");
  const min = Number(one("min"));
  const page = Number(one("page"));
  const tab = (prospectTabs as readonly string[]).includes(one("tab")) ? (one("tab") as ProspectTab) : "companies";
  const sort = (sorts as readonly string[]).includes(one("sort")) ? (one("sort") as ProspectSort) : "match";
  return {
    tab,
    campaign: uuid.test(one("campaign")) ? one("campaign") : undefined,
    country: /^[a-z]{2}$/i.test(one("country")) ? one("country").toUpperCase() : undefined,
    minMatch: Number.isFinite(min) && min > 0 ? Math.min(min, 100) : undefined,
    q: one("q").slice(0, 120) || undefined,
    verified: one("verified") === "1" || undefined,
    city: one("city").slice(0, 80) || undefined,
    sort,
    page: Number.isInteger(page) && page > 1 ? Math.min(page, 10_000) : 1,
  };
}

/** Same filters as a query string (for links, export and "all matching"). */
export function filterQuery(f: ProspectFilters, over: Partial<Record<keyof ProspectFilters, string | number | boolean | undefined>> = {}): string {
  const v = { ...f, ...over } as Record<string, unknown>;
  const qs = new URLSearchParams();
  for (const k of ["tab", "q", "campaign", "country", "minMatch", "verified", "city", "sort", "page"]) {
    const val = v[k];
    if (val === undefined || val === null || val === false || val === "") continue;
    if (k === "tab" && val === "companies") continue;
    if (k === "sort" && val === "match") continue;
    if (k === "page" && Number(val) <= 1) continue;
    qs.set(k === "minMatch" ? "min" : k, val === true ? "1" : String(val));
  }
  return qs.toString();
}

const safe = (s: string) => s.replace(/[%,()*]/g, " ").trim();

type Client = Awaited<ReturnType<typeof createClient>>;

// The hand-written database types carry no relation metadata, so joined
// selects are typed by the result types above instead of by the builder.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function base(db: Client, f: ProspectFilters, workspaceId: string): any {
  const opts = { count: "exact" as const };
  if (f.tab === "people") {
    let q = db.from("prospects").select("*, company:companies(id, name, domain, employee_count, city, country), campaign:campaigns(name)", opts)
      .eq("workspace_id", workspaceId).not("saved_at", "is", null);
    if (f.campaign) q = q.eq("campaign_id", f.campaign);
    if (f.country) q = q.eq("country", f.country);
    if (f.minMatch) q = q.gte("match_score", f.minMatch);
    if (f.verified) q = q.eq("email_status", "verified");
    if (f.q) {
      const t = safe(f.q);
      q = q.or(`full_name.ilike.%${t}%,title.ilike.%${t}%`);
    }
    return q;
  }
  if (f.tab === "jobs") {
    let q = db.from("jobs").select("*, company:companies(id, name, domain), campaign:campaigns(name)", opts).eq("workspace_id", workspaceId);
    if (f.campaign) q = q.eq("campaign_id", f.campaign);
    if (f.country) q = q.eq("country", f.country);
    if (f.minMatch) q = q.gte("match_score", f.minMatch);
    if (f.q) {
      const t = safe(f.q);
      q = q.or(`title.ilike.%${t}%,department.ilike.%${t}%`);
    }
    return q;
  }
  let q = db.from("companies").select("*, campaign:campaigns(name)", opts)
    .eq("workspace_id", workspaceId).eq("kind", f.tab === "local" ? "local_business" : "company").not("saved_at", "is", null);
  if (f.campaign) q = q.eq("campaign_id", f.campaign);
  if (f.country) q = q.eq("country", f.country);
  if (f.minMatch) q = q.gte("match_score", f.minMatch);
  if (f.city) q = q.ilike("city", `%${safe(f.city)}%`);
  if (f.q) {
    const t = safe(f.q);
    q = q.or(f.tab === "local" ? `name.ilike.%${t}%,category.ilike.%${t}%` : `name.ilike.%${t}%,industry.ilike.%${t}%,domain.ilike.%${t}%`);
  }
  return q;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sorted(q: any, f: ProspectFilters) {
  const name = f.tab === "people" ? "full_name" : f.tab === "jobs" ? "title" : "name";
  if (f.sort === "name") return q.order(name, { ascending: true });
  if (f.sort === "newest") return q.order("created_at", { ascending: false });
  return q.order("match_score", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false });
}

export type SavedItem =
  | { kind: "person"; row: ProspectListItem }
  | { kind: "company" | "local_business"; row: CompanyListItem };

export type EntityPage =
  | { tab: "saved"; rows: SavedItem[]; total: number }
  | { tab: "people"; rows: ProspectListItem[]; total: number }
  | { tab: "companies" | "local"; rows: CompanyListItem[]; total: number }
  | { tab: "jobs"; rows: JobListItem[]; total: number };

const SAVED_CAP = 2000;

/** Everything saved (people, companies, local businesses), newest first; search by name. */
async function listSaved(db: Client, workspaceId: string, f: ProspectFilters): Promise<SavedItem[]> {
  const t = f.q ? safe(f.q) : null;
  let people = db.from("prospects").select("*, company:companies(id, name, domain, employee_count, city, country), campaign:campaigns(name)")
    .eq("workspace_id", workspaceId).not("bookmarked_at", "is", null);
  let companies = db.from("companies").select("*, campaign:campaigns(name)").eq("workspace_id", workspaceId).not("bookmarked_at", "is", null);
  if (t) {
    people = people.or(`full_name.ilike.%${t}%,title.ilike.%${t}%`);
    companies = companies.or(`name.ilike.%${t}%,industry.ilike.%${t}%,category.ilike.%${t}%,domain.ilike.%${t}%`);
  }
  const [p, c] = await Promise.all([
    people.order("bookmarked_at", { ascending: false }).limit(SAVED_CAP),
    companies.order("bookmarked_at", { ascending: false }).limit(SAVED_CAP),
  ]);
  const items: SavedItem[] = [
    ...((p.data ?? []) as unknown as ProspectListItem[]).map((row) => ({ kind: "person" as const, row })),
    ...((c.data ?? []) as unknown as CompanyListItem[]).map((row) => ({ kind: row.kind === "local_business" ? "local_business" as const : "company" as const, row })),
  ];
  const name = (i: SavedItem) => (i.kind === "person" ? i.row.full_name : i.row.name);
  const at = (i: SavedItem) => i.row.bookmarked_at ?? "";
  if (f.sort === "name") return items.sort((a, b) => name(a).localeCompare(name(b)));
  if (f.sort === "match") return items.sort((a, b) => (b.row.match_score ?? -1) - (a.row.match_score ?? -1) || at(b).localeCompare(at(a)));
  return items.sort((a, b) => at(b).localeCompare(at(a)));
}

/** Saved rows are addressed as "person:<id>" / "company:<id>" (two tables in one list). */
export function savedKey(i: SavedItem) {
  return `${i.kind === "person" ? "person" : "company"}:${i.row.id}`;
}

/** One page of a tab. */
export async function listEntities(workspaceId: string, f: ProspectFilters, pageSize = PAGE_SIZE): Promise<EntityPage> {
  const db = await createClient();
  const from = (f.page - 1) * pageSize;
  if (f.tab === "saved") {
    const all = await listSaved(db, workspaceId, f);
    return { tab: "saved", rows: all.slice(from, from + pageSize), total: all.length };
  }
  const { data, count } = await sorted(base(db, f, workspaceId), f).range(from, from + pageSize - 1);
  return { tab: f.tab, rows: data ?? [], total: count ?? 0 } as EntityPage;
}

/** Rows to export or act on: the given ids, or every row matching the filters (capped). */
export async function selectEntities(workspaceId: string, f: ProspectFilters, ids: string[] | "all", cap = 10_000): Promise<EntityPage> {
  const db = await createClient();
  if (f.tab === "saved") {
    const keys = ids === "all" ? null : new Set(ids);
    const all = (await listSaved(db, workspaceId, f)).filter((i) => !keys || keys.has(savedKey(i)));
    return { tab: "saved", rows: all.slice(0, cap), total: all.length };
  }
  let q = base(db, f, workspaceId);
  if (ids !== "all") q = q.in("id", ids.filter((i) => uuid.test(i)).slice(0, cap));
  const { data, count } = await sorted(q, f).range(0, cap - 1);
  return { tab: f.tab, rows: data ?? [], total: count ?? 0 } as EntityPage;
}

/** Saved counts per tab (badges on the tabs). */
export async function tabCounts(workspaceId: string): Promise<Record<ProspectTab, number>> {
  const db = await createClient();
  const head = { count: "exact" as const, head: true };
  const [people, companies, local, jobs, savedPeople, savedCompanies] = await Promise.all([
    db.from("prospects").select("id", head).eq("workspace_id", workspaceId).not("saved_at", "is", null),
    db.from("companies").select("id", head).eq("workspace_id", workspaceId).eq("kind", "company").not("saved_at", "is", null),
    db.from("companies").select("id", head).eq("workspace_id", workspaceId).eq("kind", "local_business").not("saved_at", "is", null),
    db.from("jobs").select("id", head).eq("workspace_id", workspaceId),
    db.from("prospects").select("id", head).eq("workspace_id", workspaceId).not("bookmarked_at", "is", null),
    db.from("companies").select("id", head).eq("workspace_id", workspaceId).not("bookmarked_at", "is", null),
  ]);
  return {
    people: people.count ?? 0, companies: companies.count ?? 0, local: local.count ?? 0, jobs: jobs.count ?? 0,
    saved: (savedPeople.count ?? 0) + (savedCompanies.count ?? 0),
  };
}

/** The decision makers already found at these companies (faces on their cards). */
export async function peopleByCompany(companyIds: string[]): Promise<Map<string, { full_name: string; photo_url: string | null }[]>> {
  const map = new Map<string, { full_name: string; photo_url: string | null }[]>();
  if (!companyIds.length) return map;
  const db = await createClient();
  const { data } = await db.from("prospects").select("company_id, full_name, photo_url").in("company_id", companyIds).order("match_score", { ascending: false, nullsFirst: false }).limit(1000);
  for (const p of data ?? []) {
    if (!p.company_id) continue;
    map.set(p.company_id, [...(map.get(p.company_id) ?? []), { full_name: p.full_name, photo_url: p.photo_url }]);
  }
  return map;
}

// ───────────────────────── Details ─────────────────────────

export type PersonDetail = ProspectRow & { company: CompanyRow | null; campaign: { id: string; name: string; strategy_id: string | null } | null };

export async function getPerson(id: string): Promise<PersonDetail | null> {
  const db = await createClient();
  const { data } = await db.from("prospects").select("*, company:companies(*), campaign:campaigns(id, name, strategy_id)").eq("id", id).maybeSingle();
  return data as PersonDetail | null;
}

export async function getCompany(id: string) {
  const db = await createClient();
  const [{ data: company }, { data: people }, { data: jobs }] = await Promise.all([
    db.from("companies").select("*, campaign:campaigns(id, name, strategy_id)").eq("id", id).maybeSingle(),
    db.from("prospects").select("*").eq("company_id", id).order("match_score", { ascending: false, nullsFirst: false }).limit(50),
    db.from("jobs").select("*").eq("company_id", id).order("posted_at", { ascending: false, nullsFirst: false }).limit(50),
  ]);
  if (!company) return null;
  return { company: company as unknown as CompanyRow & { campaign: { id: string; name: string; strategy_id: string | null } | null }, people: (people ?? []) as ProspectRow[], jobs: (jobs ?? []) as JobRow[] };
}

/** "s•••@acme.com" until a member reveals it. */
export function maskEmail(email: string): string {
  const [user, host] = email.split("@");
  return host ? `${user.slice(0, 1)}•••@${host}` : "•••";
}
/** "+••• 4567" until a member reveals it. */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length > 4 ? `${phone.trim().startsWith("+") ? "+" : ""}••• ${digits.slice(-4)}` : "•••";
}
