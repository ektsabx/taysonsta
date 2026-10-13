import type { CustomerProfileRow } from "@/types/database";

// Research Agent — fit check (D-197): how well a lead matches a Customer
// Profile. Plain code, never an LLM (rule 24: scoring and matching are code).
// Only criteria the profile sets and the lead has data for are judged; the
// rest are reported as unknown, never guessed.

export interface FitInput {
  industry: string | null;
  description: string | null;
  employees: number | null;
  country: string | null;
  title: string | null;
}

export type FitCheck = { key: "industry" | "size" | "country" | "title" | "include" | "exclude"; result: "match" | "miss" | "unknown"; detail?: string };
export interface Fit { score: number | null; checks: FitCheck[] }

const norm = (s: string) => s.toLowerCase().normalize("NFKC").trim();
const hasAny = (text: string, words: string[]) => words.find((w) => w.trim() && text.includes(norm(w)));

export function fitCheck(p: CustomerProfileRow, lead: FitInput): Fit {
  const checks: FitCheck[] = [];
  const text = norm([lead.industry, lead.description, lead.title].filter(Boolean).join(" "));
  if (p.industries.length) {
    if (!lead.industry && !lead.description) checks.push({ key: "industry", result: "unknown" });
    else { const hit = hasAny(text, p.industries); checks.push({ key: "industry", result: hit ? "match" : "miss", detail: hit }); }
  }
  if (p.company_size_min != null || p.company_size_max != null) {
    if (lead.employees == null) checks.push({ key: "size", result: "unknown" });
    else checks.push({ key: "size", result: (p.company_size_min == null || lead.employees >= p.company_size_min) && (p.company_size_max == null || lead.employees <= p.company_size_max) ? "match" : "miss", detail: String(lead.employees) });
  }
  if (p.countries.length) {
    if (!lead.country) checks.push({ key: "country", result: "unknown" });
    else checks.push({ key: "country", result: p.countries.some((c) => norm(c) === norm(lead.country!)) ? "match" : "miss", detail: lead.country });
  }
  if (p.job_titles.length) {
    if (!lead.title) checks.push({ key: "title", result: "unknown" });
    else { const hit = hasAny(norm(lead.title), p.job_titles); checks.push({ key: "title", result: hit ? "match" : "miss", detail: hit }); }
  }
  if (p.include_keywords.length) {
    if (!text) checks.push({ key: "include", result: "unknown" });
    else { const hit = hasAny(text, p.include_keywords); checks.push({ key: "include", result: hit ? "match" : "miss", detail: hit }); }
  }
  if (p.exclude_keywords.length && text) {
    const hit = hasAny(text, p.exclude_keywords);
    checks.push({ key: "exclude", result: hit ? "miss" : "match", detail: hit });
  }
  // An excluded keyword disqualifies; otherwise the share of judged criteria
  // met (not finding an excluded word isn't a reason to score higher).
  const judged = checks.filter((c) => c.result !== "unknown" && c.key !== "exclude");
  const excluded = checks.some((c) => c.key === "exclude" && c.result === "miss");
  const score = excluded ? 0 : !judged.length ? null : Math.round((judged.filter((c) => c.result === "match").length / judged.length) * 100);
  return { score, checks };
}
