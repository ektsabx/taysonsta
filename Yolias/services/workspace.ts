import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { monthWindow } from "@/lib/plans";
import { trialLimits } from "@/lib/trial";

/**
 * Prospects from the usage ledger (docs/06): `prospects` = used (delivered),
 * `allowance` = plan quota + grants. Paid plans count this month; Free is a
 * one-time gift at signup (D-138), so it counts everything since signup and
 * never resets (`resetsAt` null). Callers must have checked that the user
 * belongs to the workspace (requireSession does).
 */
export async function monthlyUsage(workspaceId: string) {
  const { resets } = monthWindow();
  const admin = createAdminClient();
  const [{ data }, { data: ws }, { data: lim }] = await Promise.all([
    admin.rpc("usage_summary", { p_ws: workspaceId }),
    admin.from("workspaces").select("plan, subscription_status, trial_ends_at").eq("id", workspaceId).maybeSingle(),
    admin.rpc("limits_summary", { p_ws: workspaceId }),
  ]);
  const u = data?.[0];
  const l = lim?.[0];
  // Emails opened in the member's own mailbox and contacts uploaded by CSV, this month (owner brief 2026-10-12).
  const limits = {
    emails: { used: l?.emails_used ?? 0, limit: l?.emails_limit ?? 0 },
    contacts: { used: l?.contacts_used ?? 0, limit: l?.contacts_limit ?? 0 },
    trialEndsAt: ws?.subscription_status === "trialing" ? ws.trial_ends_at : null,
  };
  if (ws?.subscription_status === "trialing") {
    // The trial's prospects last the whole trial, not a calendar month.
    const trial = await trialLimits();
    const before = Math.max(trial.prospects - (u?.quota ?? 0), 0);
    return {
      prospects: before + (u?.consumed ?? 0),
      allowance: trial.prospects + (u?.granted ?? 0),
      reserved: u?.reserved ?? 0,
      available: u?.available ?? 0,
      extra: u?.granted ?? 0,
      resetsAt: null as string | null,
      ...limits,
    };
  }
  if (ws?.plan === "free") {
    const { data: free } = await admin.from("plan_quotas").select("prospects_per_month").eq("plan", "free").maybeSingle();
    const gift = free?.prospects_per_month ?? 0;
    const before = Math.max(gift - (u?.quota ?? 0), 0);
    return {
      prospects: before + (u?.consumed ?? 0),
      allowance: gift + (u?.granted ?? 0),
      reserved: u?.reserved ?? 0,
      available: u?.available ?? 0,
      extra: u?.granted ?? 0,
      resetsAt: null as string | null,
      ...limits,
    };
  }
  return {
    prospects: u?.consumed ?? 0,
    allowance: u?.allowance ?? 0,
    reserved: u?.reserved ?? 0,
    available: u?.available ?? 0,
    extra: u?.granted ?? 0,
    resetsAt: resets.toISOString() as string | null,
    ...limits,
  };
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

export async function listInvoices(workspaceId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("invoices").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(24);
  return data ?? [];
}

/** Buy More Prospects packs on sale (public read, RLS: active only). */
export async function listPacks() {
  const supabase = await createClient();
  const { data } = await supabase.from("prospect_packs").select("id, prospects, emails, price_usd").eq("active", true).order("sort").order("prospects");
  return data ?? [];
}

export async function getInvoice(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("invoices").select("*").eq("id", id).maybeSingle();
  return data;
}

/** Unread in-app notifications of the member (RLS). */
export async function unreadNotifications(userId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).is("read_at", null);
  return count ?? 0;
}
