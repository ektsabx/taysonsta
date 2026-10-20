import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { CompanyRow, JobRow, ProspectItemRow, ProspectRow } from "@/types/database";

// The Prospects workspace: one table for every company, local business and
// person in Prospects (owner brief 2026-10-12, like Clay / Instantly), read
// from the view prospect_items. Types are filters (All, Companies, Local
// businesses, People, Saved), not separate tabs. Search filters run on real
// columns only; anything without data behind it isn't offered (docs/21).
// Reads go through the member's own client (RLS), never the service role.

export const prospectTabs = ["all", "companies", "local", "people", "saved"] as const;
export type ProspectTab = (typeof prospectTabs)[number];
/** The type filters, in order. */
export const visibleTabs = prospectTabs;
export const sorts = ["match", "newest", "name"] as const;
export type ProspectSort = (typeof sorts)[number];
/** Employee-count ranges for the Employees filter. */
export const employeeBands = { "1-10": [1, 10], "11-50": [11, 50], "51-200": [51, 200], "201-1000": [201, 1000], "1001-5000": [1001, 5000], "5000+": [5001, null] } as const;
export type EmployeeBand = keyof typeof employeeBands;
/** Rows per page. */
export const PAGE_SIZE = 50;

export interface ProspectFilters {
  tab: ProspectTab;
  /** Keywords: name, title, company, industry, description, domain, signals. */
  q?: string;
  country?: string;
  city?: string;
  minMatch?: number;
  /** People: verified email only. */
  verified?: boolean;
  /** Job titles, comma separated (a person's title, or the titles of a company's decision makers). */
  titles?: string;
  industry?: string;
  employees?: EmployeeBand;
  domain?: string;
  company?: string;
  /** Hiring now (open roles or job listings found). */
  hiring?: boolean;
  /** Text in the company's signals. */
  signals?: string;
  funding?: string;
  sort: ProspectSort;
  page: number;
}

const text = (v: string, max: number) => v.slice(0, max) || undefined;

export function parseFilters(sp: Record<string, string | string[] | undefined>): ProspectFilters {
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).trim() : "");
  const min = Number(one("min"));
  const page = Number(one("page"));
  const tab = (prospectTabs as readonly string[]).includes(one("tab")) ? (one("tab") as ProspectTab) : "all";
  const sort = (sorts as readonly string[]).includes(one("sort")) ? (one("sort") as ProspectSort) : "match";
  return {
    tab,
    q: text(one("q"), 120),
    country: /^[a-z]{2}$/i.test(one("country")) ? one("country").toUpperCase() : undefined,
    city: text(one("city"), 80),
    minMatch: Number.isFinite(min) && min > 0 ? Math.min(min, 100) : undefined,
    verified: one("verified") === "1" || undefined,
    titles: text(one("titles"), 200),
    industry: text(one("industry"), 80),
    employees: Object.hasOwn(employeeBands, one("employees")) ? (one("employees") as EmployeeBand) : undefined,
    domain: text(one("domain"), 120),
    company: text(one("company"), 120),
    hiring: one("hiring") === "1" || undefined,
    signals: text(one("signals"), 80),
    funding: text(one("funding"), 60),
    sort,
    page: Number.isInteger(page) && page > 1 ? Math.min(page, 10_000) : 1,
  };
}

const QUERY_KEYS: [keyof ProspectFilters, string][] = [
  ["tab", "tab"], ["q", "q"], ["country", "country"], ["city", "city"], ["minMatch", "min"], ["verified", "verified"],
  ["titles", "titles"], ["industry", "industry"], ["employees", "employees"], ["domain", "domain"], ["company", "company"], ["hiring", "hiring"],
  ["signals", "signals"], ["funding", "funding"], ["sort", "sort"], ["page", "page"],
];

/** Same filters as a query string (for links, export and "all matching"). */
export function filterQuery(f: ProspectFilters, over: Partial<Record<keyof ProspectFilters, string | number | boolean | undefined>> = {}): string {
  const v = { ...f, ...over } as Record<string, unknown>;
  const qs = new URLSearchParams();
  for (const [k, name] of QUERY_KEYS) {
    const val = v[k];
    if (val === undefined || val === null || val === false || val === "") continue;
    if (k === "tab" && val === "all") continue;
    if (k === "sort" && val === "match") continue;
    if (k === "page" && Number(val) <= 1) continue;
    qs.set(name, val === true ? "1" : String(val));
  }
  return qs.toString();
}

/** Search filters in use (the type and the sort don't count). */
export function activeFilterCount(f: ProspectFilters): number {
  return QUERY_KEYS.filter(([k]) => !["tab", "sort", "page", "q"].includes(k) && f[k] !== undefined).length;
}

// Characters that would break PostgREST's or=() syntax.
const safe = (s: string) => s.replace(/[%,()*]/g, " ").replace(/\s+/g, " ").trim();

type Client = Awaited<ReturnType<typeof createClient>>;

// The hand-written database types carry no view filters' typing for chained
// .or() calls, so the builder is typed loosely here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function query(db: Client, f: ProspectFilters, workspaceId: string, columns = "*", count = true): any {
  let q = db.from("prospect_items").select(columns, count ? { count: "exact" as const } : undefined).eq("workspace_id", workspaceId);
  if (f.tab === "saved") q = q.not("bookmarked_at", "is", null);
  else {
    q = q.not("saved_at", "is", null);
    if (f.tab === "companies") q = q.eq("item_type", "company");
    if (f.tab === "local") q = q.eq("item_type", "local_business");
    if (f.tab === "people") q = q.eq("item_type", "person");
  }
  if (f.country) q = q.eq("country", f.country);
  if (f.city) q = q.ilike("city", `%${safe(f.city)}%`);
  if (f.minMatch) q = q.gte("match_score", f.minMatch);
  if (f.verified) q = q.eq("email_status", "verified");
  if (f.industry) q = q.ilike("industry", `%${safe(f.industry)}%`);
  if (f.domain) q = q.ilike("domain", `%${safe(f.domain)}%`);
  if (f.company) q = q.ilike("company_name", `%${safe(f.company)}%`);
  if (f.hiring) q = q.eq("hiring", true);
  if (f.signals) q = q.ilike("signals_text", `%${safe(f.signals)}%`);
  if (f.funding) q = q.ilike("funding_stage", safe(f.funding));
  if (f.employees) {
    const [lo, hi] = employeeBands[f.employees];
    q = q.gte("employee_count", lo);
    if (hi != null) q = q.lte("employee_count", hi);
  }
  if (f.titles) {
    const parts = f.titles.split(",").map(safe).filter(Boolean).slice(0, 10);
    if (parts.length) q = q.or(parts.flatMap((t) => [`title.ilike.%${t}%`, `people_titles.ilike.%${t}%`]).join(","));
  }
  if (f.q) {
    const t = safe(f.q);
    if (t) q = q.or(["name", "title", "company_name", "industry", "description", "domain", "signals_text"].map((c) => `${c}.ilike.%${t}%`).join(","));
  }
  return q;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sorted(q: any, f: ProspectFilters) {
  if (f.sort === "name") return q.order("name", { ascending: true });
  if (f.sort === "newest") return q.order(f.tab === "saved" ? "bookmarked_at" : "created_at", { ascending: false });
  return q.order("match_score", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false });
}

/** One page of the table. */
export async function listItems(workspaceId: string, f: ProspectFilters, pageSize = PAGE_SIZE): Promise<{ rows: ProspectItemRow[]; total: number }> {
  const db = await createClient();
  const from = (f.page - 1) * pageSize;
  const { data, count } = await sorted(query(db, f, workspaceId), f).range(from, from + pageSize - 1);
  return { rows: (data ?? []) as ProspectItemRow[], total: count ?? 0 };
}

export type ProspectListItem = ProspectRow & {
  company: Pick<CompanyRow, "id" | "name" | "domain" | "employee_count" | "city" | "country"> | null;
  campaign: { name: string } | null;
};
export type CompanyListItem = CompanyRow & { campaign: { name: string } | null };
export type SelectedItem =
  | { kind: "person"; row: ProspectListItem }
  | { kind: "company" | "local_business"; row: CompanyListItem };

/** Rows are addressed as "person:<id>" / "company:<id>" (two tables in one list). */
export function itemKey(i: SelectedItem) {
  return `${i.kind === "person" ? "person" : "company"}:${i.row.id}`;
}

/**
 * Rows to export or act on: the given keys, or every row matching the
 * filters (capped), as full records, in the table's order.
 */
/** `client`: a member's client other than the request's (agent tools in scripts); RLS applies either way. */
export async function selectItems(workspaceId: string, f: ProspectFilters, keys: string[] | "all", cap = 10_000, client?: Awaited<ReturnType<typeof createClient>>): Promise<{ rows: SelectedItem[]; total: number }> {
  const db = client ?? (await createClient());
  let q = query(db, f, workspaceId, "key, item_type, id");
  if (keys !== "all") q = q.in("key", keys.filter((k) => /^(person|company):[0-9a-f-]{36}$/i.test(k)).slice(0, cap));
  const { data, count } = await sorted(q, f).range(0, cap - 1);
  const refs = (data ?? []) as { key: string; item_type: ProspectItemRow["item_type"]; id: string }[];
  const personIds = refs.filter((r) => r.item_type === "person").map((r) => r.id);
  const companyIds = refs.filter((r) => r.item_type !== "person").map((r) => r.id);
  const chunks = <T,>(ids: string[], fn: (part: string[]) => PromiseLike<{ data: T[] | null }>) =>
    Promise.all(Array.from({ length: Math.ceil(ids.length / 500) }, (_, i) => fn(ids.slice(i * 500, i * 500 + 500)))).then((r) => r.flatMap((x) => x.data ?? []));
  const [people, companies] = await Promise.all([
    chunks<ProspectListItem>(personIds, (part) => db.from("prospects").select("*, company:companies(id, name, domain, employee_count, city, country), campaign:campaigns(name)").in("id", part) as never),
    chunks<CompanyListItem>(companyIds, (part) => db.from("companies").select("*, campaign:campaigns(name)").in("id", part) as never),
  ]);
  const byKey = new Map<string, SelectedItem>([
    ...people.map((row) => [`person:${row.id}`, { kind: "person" as const, row }] as const),
    ...companies.map((row) => [`company:${row.id}`, { kind: row.kind === "local_business" ? "local_business" as const : "company" as const, row }] as const),
  ]);
  return { rows: refs.map((r) => byKey.get(r.key)).filter((x): x is SelectedItem => Boolean(x)), total: count ?? 0 };
}

/** Rows per type filter (badges). */
export async function tabCounts(workspaceId: string): Promise<Record<ProspectTab, number>> {
  const db = await createClient();
  const head = { count: "exact" as const, head: true };
  const [people, companies, local, savedPeople, savedCompanies] = await Promise.all([
    db.from("prospects").select("id", head).eq("workspace_id", workspaceId).not("saved_at", "is", null),
    db.from("companies").select("id", head).eq("workspace_id", workspaceId).eq("kind", "company").not("saved_at", "is", null),
    db.from("companies").select("id", head).eq("workspace_id", workspaceId).eq("kind", "local_business").not("saved_at", "is", null),
    db.from("prospects").select("id", head).eq("workspace_id", workspaceId).not("bookmarked_at", "is", null),
    db.from("companies").select("id", head).eq("workspace_id", workspaceId).not("bookmarked_at", "is", null),
  ]);
  const p = people.count ?? 0, c = companies.count ?? 0, l = local.count ?? 0;
  return { all: p + c + l, people: p, companies: c, local: l, saved: (savedPeople.count ?? 0) + (savedCompanies.count ?? 0) };
}

/** Funding stages present in the workspace (the Funding type filter offers only real values). */
/** Countries the workspace's saved prospects are in (the Location filter). */
export async function prospectCountries(workspaceId: string): Promise<string[]> {
  const db = await createClient();
  const { data } = await db.from("prospect_items").select("country").eq("workspace_id", workspaceId).not("saved_at", "is", null).not("country", "is", null).limit(5000);
  return [...new Set((data ?? []).map((r: { country: string | null }) => r.country as string))].sort();
}

export async function fundingStages(workspaceId: string): Promise<string[]> {
  const db = await createClient();
  const { data } = await db.from("companies").select("funding_stage").eq("workspace_id", workspaceId).not("funding_stage", "is", null).limit(2000);
  return [...new Set((data ?? []).map((r) => r.funding_stage as string))].sort().slice(0, 50);
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
