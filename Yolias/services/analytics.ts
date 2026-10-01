import "server-only";
import { createClient } from "@/lib/supabase/server";

export const ranges = { "7d": 7, "30d": 30, "90d": 90 } as const;
export type RangeKey = keyof typeof ranges;

export function parseRange(v: unknown): RangeKey {
  return typeof v === "string" && v in ranges ? (v as RangeKey) : "30d";
}

const decisionMakerLevels = new Set(["founder", "c_level", "vp", "director", "head"]);

export async function discoveryAnalytics(workspaceId: string, range: RangeKey) {
  const supabase = await createClient();
  const since = new Date(Date.now() - ranges[range] * 86_400_000).toISOString();

  const [{ data: prospects }, { count: companies }] = await Promise.all([
    supabase.from("prospects").select("email_status, seniority, match_score, country").eq("workspace_id", workspaceId).gte("created_at", since),
    supabase.from("companies").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).gte("created_at", since),
  ]);
  const rows = prospects ?? [];
  const total = rows.length;
  const verified = rows.filter((r) => r.email_status === "verified").length;
  const decisionMakers = rows.filter((r) => r.seniority && decisionMakerLevels.has(r.seniority)).length;
  const scored = rows.filter((r) => r.match_score != null);
  const qualified = scored.filter((r) => (r.match_score ?? 0) >= 70).length;

  const byCountry = new Map<string, number>();
  for (const r of rows) if (r.country) byCountry.set(r.country, (byCountry.get(r.country) ?? 0) + 1);
  const markets = [...byCountry.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([country, count]) => ({ country, count, pct: total ? Math.round((count / total) * 100) : 0 }));

  return {
    prospects: total,
    verifiedPct: total ? Math.round((verified / total) * 100) : 0,
    companies: companies ?? 0,
    decisionMakers,
    fitRate: scored.length ? Math.round((qualified / scored.length) * 1000) / 10 : null,
    markets,
  };
}
