import type { BuilderTargeting } from "@/lib/campaigns/builder";

// Audience checks before launch (audit, 2026-11-03): contradictions and
// audiences too wide to reach the right people. Pure: shown in the campaign
// builder next to each audience; they warn, they don't block.

export type AudienceIssue = "overlap" | "no_titles" | "too_broad";

const FIELDS = ["countries", "regions", "cities", "industries", "company_types", "sizes", "titles", "seniority", "departments", "technologies", "keywords"] as const;

export function audienceIssues(t: BuilderTargeting, contactTarget: "people" | "companies" | "both"): AudienceIssue[] {
  const out: AudienceIssue[] = [];
  const inc = (k: (typeof FIELDS)[number]) => (t[k]?.include ?? []).map((x) => x.trim().toLowerCase());
  const exc = (k: (typeof FIELDS)[number]) => (t[k]?.exclude ?? []).map((x) => x.trim().toLowerCase());
  if (FIELDS.some((k) => inc(k).some((v) => exc(k).includes(v)))) out.push("overlap");
  if (contactTarget !== "companies" && !inc("titles").length && !inc("seniority").length && !inc("departments").length) out.push("no_titles");
  const where = inc("countries").length + inc("regions").length + inc("cities").length;
  const what = inc("industries").length + inc("company_types").length + inc("keywords").length + inc("technologies").length;
  if (!where || !what) out.push("too_broad");
  return out;
}
