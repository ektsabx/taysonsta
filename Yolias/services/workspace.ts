import "server-only";
import { createClient } from "@/lib/supabase/server";
import { monthWindow } from "@/lib/plans";

export async function monthlyUsage(workspaceId: string) {
  const supabase = await createClient();
  const { start, resets } = monthWindow();
  const [{ count: prospects }, { count: companies }] = await Promise.all([
    supabase.from("prospects").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).gte("created_at", start.toISOString()),
    supabase.from("companies").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).gte("created_at", start.toISOString()),
  ]);
  return { prospects: prospects ?? 0, companies: companies ?? 0, resetsAt: resets.toISOString() };
}

export async function teamMembers(workspaceId: string) {
  const supabase = await createClient();
  const { data: members } = await supabase.from("workspace_members").select("user_id, role, created_at").eq("workspace_id", workspaceId).order("created_at");
  const ids = (members ?? []).map((m) => m.user_id);
  const { data: profiles } = ids.length
    ? await supabase.from("profiles").select("id, full_name, email, avatar_url").in("id", ids)
    : { data: [] };
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
  const { data: invitations } = await supabase
    .from("workspace_invitations").select("id, email, role, created_at").eq("workspace_id", workspaceId).is("accepted_at", null).order("created_at");
  return {
    members: (members ?? []).map((m) => ({ ...m, profile: byId.get(m.user_id) ?? null })),
    invitations: invitations ?? [],
  };
}
