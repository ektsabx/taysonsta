import "server-only";
import { createClient } from "@/lib/supabase/server";

export const ranges = { "7d": 7, "30d": 30, "90d": 90 } as const;
export type RangeKey = keyof typeof ranges;

export function parseRange(v: unknown): RangeKey {
  return typeof v === "string" && v in ranges ? (v as RangeKey) : "30d";
}

interface WorkspaceAnalytics {
  prospects: number;
  verified: number;
  decision_makers: number;
  scored: number;
  qualified: number;
  companies: number;
  markets: { country: string; count: number }[];
}

// One SQL aggregate (public.workspace_analytics), checked for membership in the database.
export async function discoveryAnalytics(workspaceId: string, range: RangeKey) {
  const supabase = await createClient();
  const since = new Date(Date.now() - ranges[range] * 86_400_000).toISOString();
  const { data } = await supabase.rpc("workspace_analytics", { p_ws: workspaceId, p_since: since });
  const a = (data ?? { prospects: 0, verified: 0, decision_makers: 0, scored: 0, qualified: 0, companies: 0, markets: [] }) as unknown as WorkspaceAnalytics;
  const total = a.prospects;
  return {
    prospects: total,
    verifiedPct: total ? Math.round((a.verified / total) * 100) : 0,
    companies: a.companies,
    decisionMakers: a.decision_makers,
    fitRate: a.scored ? Math.round((a.qualified / a.scored) * 1000) / 10 : null,
    markets: a.markets.map((m) => ({ ...m, pct: total ? Math.round((m.count / total) * 100) : 0 })),
  };
}
