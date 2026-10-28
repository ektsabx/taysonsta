import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { CampaignEventRow, CampaignRow, CompanyRow, ProspectRow, StrategyRow } from "@/types/database";
import { plainDashes } from "@/lib/text";

// Sidebar history: all pinned strategies, then the most recent unpinned ones.
export async function recentStrategies(workspaceId: string, limit = 12) {
  const supabase = await createClient();
  const [{ data: pinned }, { data: recent }] = await Promise.all([
    supabase.from("strategies").select("id, title, pinned_at").eq("workspace_id", workspaceId)
      .not("pinned_at", "is", null).order("pinned_at", { ascending: false }),
    supabase.from("strategies").select("id, title, pinned_at").eq("workspace_id", workspaceId)
      .is("pinned_at", null).order("created_at", { ascending: false }).limit(limit),
  ]);
  return [...(pinned ?? []), ...(recent ?? [])].map((s) => ({ id: s.id, title: plainDashes(s.title, ": "), pinned: s.pinned_at !== null }));
}

export interface StrategyView {
  strategy: StrategyRow;
  campaign: CampaignRow | null;
  topCompany: CompanyRow | null;
  topProspects: ProspectRow[];
  /** Company / local business searches: the best delivered results. */
  topResults: CompanyRow[];
  lastEvent: CampaignEventRow | null;
  savedCount: number;
  /** How many results the search delivered, and how many have a published email a campaign can write to (owner, 2026-10-28). */
  reach: { total: number; withEmail: number };
}

// Everything the Yolias AI result card needs for one strategy: its own
// (first) campaign, or one Yolias AI started later in its conversation.
export async function getStrategyView(id: string, campaignId?: string): Promise<StrategyView | null> {
  const supabase = await createClient();
  const { data: strategy } = await supabase.from("strategies").select("*").eq("id", id).maybeSingle();
  if (!strategy) return null;
  strategy.title = plainDashes(strategy.title, ": ");

  const q = supabase.from("campaigns").select("*").eq("strategy_id", id);
  const { data: campaign } = await (campaignId ? q.eq("id", campaignId) : q.order("created_at").limit(1)).maybeSingle();
  if (campaign) campaign.name = plainDashes(campaign.name, ": ");
  if (!campaign) return { strategy, campaign: null, topCompany: null, topProspects: [], topResults: [], lastEvent: null, savedCount: 0, reach: { total: 0, withEmail: 0 } };
  if (campaign.search_type !== "people") {
    const delivered = () => supabase.from("companies").select("id", { count: "exact", head: true }).eq("campaign_id", campaign.id).not("delivered_at", "is", null);
    const [{ data: results }, { data: lastEvent }, { count: savedCount }, { count: total }, { count: withEmail }] = await Promise.all([
      supabase.from("companies").select("*").eq("campaign_id", campaign.id).not("delivered_at", "is", null)
        .order("match_score", { ascending: false, nullsFirst: false }).limit(4),
      supabase.from("campaign_events").select("*").eq("campaign_id", campaign.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("companies").select("id", { count: "exact", head: true }).eq("campaign_id", campaign.id).not("delivered_at", "is", null).not("saved_at", "is", null),
      delivered(),
      delivered().not("email", "is", null),
    ]);
    return { strategy, campaign, topCompany: null, topProspects: [], topResults: results ?? [], lastEvent, savedCount: savedCount ?? 0, reach: { total: total ?? 0, withEmail: withEmail ?? 0 } };
  }

  const found = () => supabase.from("prospects").select("id", { count: "exact", head: true }).eq("campaign_id", campaign.id);
  const [{ data: best }, { data: lastEvent }, { count: savedCount }, { count: total }, { count: withEmail }] = await Promise.all([
    supabase.from("prospects").select("company_id").eq("campaign_id", campaign.id).not("company_id", "is", null)
      .order("match_score", { ascending: false, nullsFirst: false }).limit(1).maybeSingle(),
    supabase.from("campaign_events").select("*").eq("campaign_id", campaign.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("prospects").select("id", { count: "exact", head: true }).eq("campaign_id", campaign.id).not("saved_at", "is", null),
    found(),
    found().not("email", "is", null).neq("email_status", "invalid"),
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

  return { strategy, campaign, topCompany, topProspects, topResults: [], lastEvent, savedCount: savedCount ?? 0, reach: { total: total ?? 0, withEmail: withEmail ?? 0 } };
}
