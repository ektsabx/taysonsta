import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// What the workspace's won and lost deals say (owner, 2026-10-29): the
// industries, cities and company sizes of won deals, and why deals were lost.
// Read by every new search (as context for understanding the request) and
// shown on Analytics. Real CRM rows only, the last 12 months.

export interface SalesOutcomes {
  won: number;
  lost: number;
  wonIndustries: { name: string; n: number }[];
  wonCities: { name: string; n: number }[];
  wonSize: { min: number; max: number } | null;
  lostReasons: { reason: string; n: number }[];
  lostIndustries: { name: string; n: number }[];
}

const top = (values: (string | null | undefined)[], k = 5) => {
  const m = new Map<string, { name: string; n: number }>();
  for (const v of values) {
    const name = (v ?? "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const cur = m.get(key) ?? { name, n: 0 };
    cur.n++;
    m.set(key, cur);
  }
  return [...m.values()].sort((a, b) => b.n - a.n).slice(0, k);
};

export async function salesOutcomes(workspaceId: string): Promise<SalesOutcomes> {
  const db = createAdminClient();
  const since = new Date(Date.now() - 365 * 86_400_000).toISOString();
  const { data: leads } = await db.from("sales_leads").select("stage, lost_reason, company_id, prospect_id")
    .eq("workspace_id", workspaceId).in("stage", ["closed", "lost"]).gte("stage_changed_at", since).limit(2000);
  const rows = leads ?? [];
  const prospectIds = rows.filter((l) => !l.company_id && l.prospect_id).map((l) => l.prospect_id as string);
  const { data: people } = prospectIds.length ? await db.from("prospects").select("id, company_id").in("id", prospectIds.slice(0, 1000)) : { data: [] };
  const viaPerson = new Map((people ?? []).map((p) => [p.id, p.company_id]));
  const companyOf = (l: (typeof rows)[number]) => l.company_id ?? (l.prospect_id ? viaPerson.get(l.prospect_id) ?? null : null);
  const ids = [...new Set(rows.map(companyOf).filter((x): x is string => Boolean(x)))];
  const { data: companies } = ids.length ? await db.from("companies").select("id, industry, category, city, employee_count").in("id", ids.slice(0, 1000)) : { data: [] };
  const byId = new Map((companies ?? []).map((c) => [c.id, c]));
  const won = rows.filter((l) => l.stage === "closed").map((l) => byId.get(companyOf(l) ?? ""));
  const lost = rows.filter((l) => l.stage === "lost");
  const sizes = won.map((c) => c?.employee_count).filter((n): n is number => typeof n === "number" && n > 0).sort((a, b) => a - b);
  return {
    won: won.length,
    lost: lost.length,
    wonIndustries: top(won.map((c) => c?.industry || c?.category)),
    wonCities: top(won.map((c) => c?.city), 3),
    wonSize: sizes.length >= 2 ? { min: sizes[0], max: sizes[sizes.length - 1] } : null,
    lostReasons: top(lost.map((l) => l.lost_reason)).map((x) => ({ reason: x.name, n: x.n })),
    lostIndustries: top(lost.map((l) => byId.get(companyOf(l) ?? "")).map((c) => c?.industry || c?.category), 3),
  };
}

/** The outcomes as context for understanding a search; empty when there are none yet. */
export function outcomesLines(o: SalesOutcomes): string {
  if (!o.won && !o.lost) return "";
  const list = (xs: { name: string; n: number }[]) => xs.map((x) => `${x.name} (${x.n})`).join(", ");
  return [
    o.won ? `Deals won in the last 12 months: ${o.won}.` : null,
    o.wonIndustries.length ? `Industries of won deals: ${list(o.wonIndustries)}.` : null,
    o.wonCities.length ? `Cities of won deals: ${list(o.wonCities)}.` : null,
    o.wonSize ? `Company size of won deals: ${o.wonSize.min} to ${o.wonSize.max} employees.` : null,
    o.lost ? `Deals lost: ${o.lost}. Reasons: ${o.lostReasons.map((r) => `${r.reason.replace(/_/g, " ")} (${r.n})`).join(", ") || "not recorded"}.` : null,
    o.lostIndustries.length ? `Industries of lost deals: ${list(o.lostIndustries)}.` : null,
  ].filter(Boolean).join("\n");
}
