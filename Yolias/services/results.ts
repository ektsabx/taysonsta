import "server-only";
import { createClient } from "@/lib/supabase/server";
import { parseIcp } from "@/lib/discovery/icp";
import type { CampaignStatus, CompanyRow, ProspectRow, SearchType } from "@/types/database";

// All results of one search (D-147, owner's reference): its companies (or
// places) with their decision makers, and the decision makers on their own.
// Member's own client (RLS). Filters run on the search's rows, which are
// bounded by the campaigns' goals.

export const RESULTS_PAGE = 12;
export const resultSorts = ["relevance", "size", "name"] as const;
export const sizeBuckets = { s: [1, 50], m: [51, 200], l: [201, 1000], xl: [1001, 10_000_000] } as const;
export type SizeBucket = keyof typeof sizeBuckets;

export interface ResultFilters {
  tab: "companies" | "people";
  q: string;
  industry: string;
  city: string;
  size: SizeBucket | "";
  sort: (typeof resultSorts)[number];
  page: number;
}

export function parseResultFilters(sp: Record<string, string | string[] | undefined>): ResultFilters {
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).trim().slice(0, 120) : "");
  const page = Number(one("page"));
  return {
    tab: one("tab") === "people" ? "people" : "companies",
    q: one("q"), industry: one("industry"), city: one("city"),
    size: one("size") in sizeBuckets ? (one("size") as SizeBucket) : "",
    sort: (resultSorts as readonly string[]).includes(one("sort")) ? (one("sort") as ResultFilters["sort"]) : "relevance",
    page: Number.isInteger(page) && page > 1 ? Math.min(page, 1000) : 1,
  };
}

export type ResultCompany = CompanyRow & { people: Pick<ProspectRow, "id" | "full_name" | "photo_url">[] };

export async function searchResults(strategyId: string, workspaceId: string, f: ResultFilters) {
  const db = await createClient();
  const { data: campaigns } = await db.from("campaigns").select("id, status, search_type, criteria, prospects_found")
    .eq("strategy_id", strategyId).eq("workspace_id", workspaceId).order("created_at");
  const ids = (campaigns ?? []).map((c) => c.id);
  if (!ids.length) return null;
  const [{ data: companies }, { data: people }] = await Promise.all([
    db.from("companies").select("*").in("campaign_id", ids).order("match_score", { ascending: false, nullsFirst: false }).limit(2000),
    db.from("prospects").select("*").in("campaign_id", ids).order("match_score", { ascending: false, nullsFirst: false }).limit(2000),
  ]);
  const allCompanies = (companies ?? []) as CompanyRow[];
  const allPeople = (people ?? []) as ProspectRow[];
  const byCompany = new Map<string, ResultCompany["people"]>();
  for (const p of allPeople) if (p.company_id) byCompany.set(p.company_id, [...(byCompany.get(p.company_id) ?? []), { id: p.id, full_name: p.full_name, photo_url: p.photo_url }]);

  const searchType = (campaigns![0].search_type ?? "people") as SearchType;
  const icp = parseIcp(campaigns![0].criteria);
  const running = (campaigns ?? []).some((c) => !["completed", "partial", "failed", "paused", "awaiting_source"].includes(c.status as CampaignStatus));
  const industries = [...new Set(allCompanies.map((c) => c.industry ?? c.category).filter(Boolean) as string[])].sort();
  const cities = [...new Set(allCompanies.map((c) => c.city).filter(Boolean) as string[])].sort();

  const q = f.q.toLowerCase();
  let list: ResultCompany[] = allCompanies
    .filter((c) => !q || [c.name, c.domain, c.industry, c.category].some((v) => v?.toLowerCase().includes(q)))
    .filter((c) => !f.industry || (c.industry ?? c.category) === f.industry)
    .filter((c) => !f.city || c.city === f.city)
    .filter((c) => {
      if (!f.size) return true;
      const [min, max] = sizeBuckets[f.size];
      return c.employee_count != null && c.employee_count >= min && c.employee_count <= max;
    })
    .map((c) => ({ ...c, people: byCompany.get(c.id) ?? [] }));
  if (f.sort === "name") list = list.sort((a, b) => a.name.localeCompare(b.name));
  if (f.sort === "size") list = list.sort((a, b) => (b.employee_count ?? -1) - (a.employee_count ?? -1));

  const peopleList = allPeople.filter((p) => !q || [p.full_name, p.title].some((v) => v?.toLowerCase().includes(q)));
  const companyName = new Map(allCompanies.map((c) => [c.id, c.name]));

  return {
    searchType, icp, running,
    totals: { companies: allCompanies.length, people: allPeople.length, companiesWithPeople: allCompanies.filter((c) => byCompany.has(c.id)).length },
    options: { industries, cities },
    companies: { rows: list.slice((f.page - 1) * RESULTS_PAGE, f.page * RESULTS_PAGE), total: list.length },
    people: { rows: peopleList.slice((f.page - 1) * 24, f.page * 24), total: peopleList.length },
    companyName,
  };
}
