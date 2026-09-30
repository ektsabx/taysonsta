import { createClient } from "@/lib/supabase/server";
import type { Database, PortfolioRelationshipType } from "@/types/database";

export type PortfolioCompany = Database["public"]["Tables"]["portfolio_companies"]["Row"];
export type PortfolioCompanyRole = Database["public"]["Tables"]["portfolio_company_roles"]["Row"];
export type PortfolioCompanyBuiltItem = Database["public"]["Tables"]["portfolio_company_built_items"]["Row"];
export type PortfolioCompanyMetric = Database["public"]["Tables"]["portfolio_company_metrics"]["Row"];
export type PortfolioCompanyTimelineEntry = Database["public"]["Tables"]["portfolio_company_timeline"]["Row"];

export interface PortfolioCompanyDetail extends PortfolioCompany {
  roles: PortfolioCompanyRole[];
  builtItems: PortfolioCompanyBuiltItem[];
  metrics: PortfolioCompanyMetric[];
  timeline: PortfolioCompanyTimelineEntry[];
}

export async function getPortfolioCompanies(
  relationshipType?: PortfolioRelationshipType
): Promise<PortfolioCompany[]> {
  const supabase = await createClient();
  let query = supabase
    .from("portfolio_companies")
    .select("*")
    .eq("is_published", true)
    .order("sort_order", { ascending: true });

  if (relationshipType) {
    query = query.eq("relationship_type", relationshipType);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function getPortfolioCompanyBySlug(slug: string): Promise<PortfolioCompanyDetail | null> {
  const supabase = await createClient();

  const { data: company, error } = await supabase
    .from("portfolio_companies")
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!company) {
    return null;
  }

  const [{ data: roles }, { data: builtItems }, { data: metrics }, { data: timeline }] = await Promise.all([
    supabase
      .from("portfolio_company_roles")
      .select("*")
      .eq("company_id", company.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("portfolio_company_built_items")
      .select("*")
      .eq("company_id", company.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("portfolio_company_metrics")
      .select("*")
      .eq("company_id", company.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("portfolio_company_timeline")
      .select("*")
      .eq("company_id", company.id)
      .order("sort_order", { ascending: true }),
  ]);

  return {
    ...company,
    roles: roles ?? [],
    builtItems: builtItems ?? [],
    metrics: metrics ?? [],
    timeline: timeline ?? [],
  };
}

export interface PortfolioStats {
  companies: number;
  markets: number;
  exits: number;
}

export async function getPortfolioStats(): Promise<PortfolioStats> {
  const companies = await getPortfolioCompanies();
  const markets = new Set<string>();
  let exits = 0;

  for (const company of companies) {
    for (const market of company.markets) {
      markets.add(market);
    }
    if (company.relationship_type === "acquired") {
      exits += 1;
    }
  }

  return {
    companies: companies.length,
    markets: markets.size,
    exits,
  };
}
