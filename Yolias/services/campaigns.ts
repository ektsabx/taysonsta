import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { CampaignEventRow, CampaignRow, CampaignRunRow } from "@/types/database";

export async function listCampaigns(workspaceId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("campaigns")
    .select("id, name, criteria, search_type, quota, status, prospects_found, strategy_id, continuous, run_every_hours, deadline, next_run_at, runs_count, partial_reason, created_at, updated_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export interface CampaignDashboard {
  campaign: CampaignRow;
  runs: CampaignRunRow[];
  events: CampaignEventRow[];
  usage: { consumed: number; reserved: number };
  results: { people: number; companies: number; local: number; jobs: number; saved: number };
  /** Delivered per day (for the progress chart). */
  daily: { day: string; delivered: number }[];
  /** Whole days until the deadline (≤ 0 = passed); null without a deadline. */
  daysLeft: number | null;
}

// Everything the campaign dashboard shows (final spec phase 6): status, goal,
// runs (lineage), results per entity, prospects used, activity.
export async function getCampaignDashboard(id: string): Promise<CampaignDashboard | null> {
  const db = await createClient();
  const { data: campaign } = await db.from("campaigns").select("*").eq("id", id).maybeSingle();
  if (!campaign) return null;
  const head = { count: "exact" as const, head: true };
  const [runs, events, usage, people, companies, local, jobs, savedPeople, savedCompanies] = await Promise.all([
    db.from("campaign_runs").select("*").eq("campaign_id", id).order("started_at", { ascending: false }).limit(100),
    db.from("campaign_events").select("*").eq("campaign_id", id).order("created_at", { ascending: false }).limit(100),
    db.rpc("campaign_usage", { p_campaign: id }),
    db.from("prospects").select("id", head).eq("campaign_id", id),
    // Counted as they appear in Prospects (the campaign page links there, D-168).
    db.from("companies").select("id", head).eq("campaign_id", id).eq("kind", "company").not("saved_at", "is", null),
    db.from("companies").select("id", head).eq("campaign_id", id).eq("kind", "local_business").not("saved_at", "is", null),
    db.from("jobs").select("id", head).eq("campaign_id", id),
    db.from("prospects").select("id", head).eq("campaign_id", id).not("saved_at", "is", null),
    db.from("companies").select("id", head).eq("campaign_id", id).not("delivered_at", "is", null).not("saved_at", "is", null),
  ]);
  const byDay = new Map<string, number>();
  // Runs recorded before `delivered` existed carry the count in meta.
  const runRows = (runs.data ?? []).map((r) => ({ ...r, delivered: r.delivered || Number((r.meta as { prospects?: number } | null)?.prospects ?? 0) }));
  for (const r of runRows) {
    if (!r.delivered) continue;
    const day = (r.finished_at ?? r.started_at).slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + r.delivered);
  }
  return {
    campaign,
    runs: runRows,
    events: events.data ?? [],
    usage: usage.data?.[0] ?? { consumed: 0, reserved: 0 },
    results: {
      people: people.count ?? 0, companies: companies.count ?? 0, local: local.count ?? 0, jobs: jobs.count ?? 0,
      saved: (savedPeople.count ?? 0) + (savedCompanies.count ?? 0),
    },
    daily: [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, delivered]) => ({ day, delivered })),
    daysLeft: campaign.deadline ? Math.ceil((new Date(campaign.deadline).getTime() - Date.now()) / 86_400_000) : null,
  };
}
