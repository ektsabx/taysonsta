import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { CompanyRow, ProspectRow } from "@/types/database";

export interface ProspectFilters {
  campaign?: string;
  country?: string;
  minMatch?: number;
  q?: string;
}

export type ProspectListItem = ProspectRow & {
  company: Pick<CompanyRow, "name" | "employee_count" | "city" | "country"> | null;
  campaign: { name: string } | null;
};

export function parseFilters(sp: Record<string, string | string[] | undefined>): ProspectFilters {
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).trim() : "");
  const min = Number(one("min"));
  return {
    campaign: one("campaign") || undefined,
    country: one("country").toUpperCase() || undefined,
    minMatch: Number.isFinite(min) && min > 0 ? Math.min(min, 100) : undefined,
    q: one("q") || undefined,
  };
}

// Saved prospects ("Save to Prospects") of the workspace, best matches first.
export async function listProspects(workspaceId: string, f: ProspectFilters, limit = 500): Promise<ProspectListItem[]> {
  const supabase = await createClient();
  let query = supabase
    .from("prospects")
    .select("*, company:companies(name, employee_count, city, country), campaign:campaigns(name)")
    .eq("workspace_id", workspaceId)
    .not("saved_at", "is", null);
  if (f.campaign) query = query.eq("campaign_id", f.campaign);
  if (f.country) query = query.eq("country", f.country);
  if (f.minMatch) query = query.gte("match_score", f.minMatch);
  if (f.q) {
    const term = f.q.replace(/[%,()]/g, " ");
    query = query.or(`full_name.ilike.%${term}%,title.ilike.%${term}%`);
  }
  const { data } = await query.order("match_score", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }).limit(limit);
  return (data ?? []) as unknown as ProspectListItem[];
}
