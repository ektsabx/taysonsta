import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function listCampaigns(workspaceId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("campaigns")
    .select("id, name, criteria, quota, status, prospects_found, strategy_id, created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
  return data ?? [];
}
