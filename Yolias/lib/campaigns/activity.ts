import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CampaignActivityKind, Database, Json } from "@/types/database";

/** One line in a campaign's activity log: what Yolias (or the member) did and why (D-270). */
export async function logCampaign(db: SupabaseClient<Database>, workspaceId: string, campaignId: string, kind: CampaignActivityKind, body: string, meta: Record<string, unknown> = {}) {
  await db.from("campaign_activity").insert({ workspace_id: workspaceId, campaign_id: campaignId, kind, body: body.slice(0, 600), meta: meta as Json });
}

/** The campaign a meeting belongs to: the one that last enrolled this person (D-270), or null. */
export async function campaignOfLead(db: SupabaseClient<Database>, leadId: string): Promise<string | null> {
  const { data } = await db.from("outreach_enrollments").select("campaign_id").eq("lead_id", leadId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return data?.campaign_id ?? null;
}
