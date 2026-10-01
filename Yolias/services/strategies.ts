import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { CampaignEventRow, CampaignRow, CompanyRow, ProspectRow, StrategyRow } from "@/types/database";

export async function recentStrategies(workspaceId: string, limit = 12) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("strategies")
    .select("id, title")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export interface StrategyView {
  strategy: StrategyRow;
  campaign: CampaignRow | null;
  topCompany: CompanyRow | null;
  topProspects: ProspectRow[];
  lastEvent: CampaignEventRow | null;
  savedCount: number;
}

// Everything the Yolias AI result card needs for one strategy.
export async function getStrategyView(id: string): Promise<StrategyView | null> {
  const supabase = await createClient();
  const { data: strategy } = await supabase.from("strategies").select("*").eq("id", id).maybeSingle();
  if (!strategy) return null;

  const { data: campaign } = await supabase.from("campaigns").select("*").eq("strategy_id", id).maybeSingle();
  if (!campaign) return { strategy, campaign: null, topCompany: null, topProspects: [], lastEvent: null, savedCount: 0 };

  const [{ data: best }, { data: lastEvent }, { count: savedCount }] = await Promise.all([
    supabase.from("prospects").select("company_id").eq("campaign_id", campaign.id).not("company_id", "is", null)
      .order("match_score", { ascending: false, nullsFirst: false }).limit(1).maybeSingle(),
    supabase.from("campaign_events").select("*").eq("campaign_id", campaign.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("prospects").select("id", { count: "exact", head: true }).eq("campaign_id", campaign.id).not("saved_at", "is", null),
  ]);

  let topCompany: CompanyRow | null = null;
  let topProspects: ProspectRow[] = [];
  if (best?.company_id) {
    const [{ data: company }, { data: people }] = await Promise.all([
      supabase.from("companies").select("*").eq("id", best.company_id).maybeSingle(),
      supabase.from("prospects").select("*").eq("company_id", best.company_id)
        .order("match_score", { ascending: false, nullsFirst: false }).limit(3),
    ]);
    topCompany = company;
    topProspects = people ?? [];
  }

  return { strategy, campaign, topCompany, topProspects, lastEvent, savedCount: savedCount ?? 0 };
}
