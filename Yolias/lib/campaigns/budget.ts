import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { prospectRate } from "@/services/campaign-metrics";

// The workspace's daily budget (owner, 2026-10-31, D-273) and account
// spending limit (D-274), set on the
// dashboard: the most the account spends in one day (UTC) across all its
// campaigns. Spend is what campaigns are charged: prospects consumed × the
// workspace's rate. Searches never reserve past what is left of today.

const startOfDay = () => { const d = new Date(); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString(); };

/** USD spent today (UTC) across the workspace. */
export async function spentToday(workspaceId: string, rate?: number): Promise<number> {
  const db = createAdminClient();
  const { data } = await db.from("usage_ledger").select("prospects").eq("workspace_id", workspaceId).eq("kind", "consume").gte("created_at", startOfDay()).limit(10_000);
  const n = (data ?? []).reduce((s, r) => s + Number(r.prospects ?? 0), 0);
  return n * (rate ?? (await prospectRate(workspaceId)));
}

/** USD spent since a moment (the account spending limit's start), across the workspace. */
export async function spentSince(workspaceId: string, since: string, rate?: number): Promise<number> {
  const db = createAdminClient();
  const { data } = await db.from("usage_ledger").select("prospects").eq("workspace_id", workspaceId).eq("kind", "consume").gte("created_at", since).limit(50_000);
  const n = (data ?? []).reduce((s, r) => s + Number(r.prospects ?? 0), 0);
  return n * (rate ?? (await prospectRate(workspaceId)));
}

/**
 * Prospects the account may still use today, or null when nothing limits it:
 * the smaller of the daily budget (D-273) and the account spending limit
 * (D-274, like an ads account's: counted from when it was set or reset).
 */
export async function dailyRoom(workspaceId: string): Promise<number | null> {
  const db = createAdminClient();
  const { data: ws } = await db.from("workspaces").select("daily_budget_usd, spending_limit_usd, spending_limit_since").eq("id", workspaceId).maybeSingle();
  if (ws?.daily_budget_usd == null && ws?.spending_limit_usd == null) return null;
  const rate = await prospectRate(workspaceId);
  if (!(rate > 0)) return null;
  const rooms: number[] = [];
  if (ws.daily_budget_usd != null) rooms.push(Number(ws.daily_budget_usd) - (await spentToday(workspaceId, rate)));
  if (ws.spending_limit_usd != null) rooms.push(Number(ws.spending_limit_usd) - (await spentSince(workspaceId, ws.spending_limit_since ?? new Date(0).toISOString(), rate)));
  return Math.max(0, Math.floor(Math.min(...rooms) / rate + 1e-9));
}

/** The next start of a UTC day (when a capped search may run again). */
export const tomorrowUtc = () => new Date(Date.parse(startOfDay()) + 86_400_000 + 5 * 60_000).toISOString();
