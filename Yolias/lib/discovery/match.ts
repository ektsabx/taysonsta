import type { Seniority } from "@/types/database";
import type { IcpCriteria } from "@/lib/discovery/icp";
import type { CompanyCandidate, PersonCandidate } from "@/lib/discovery/types";

// Deterministic ICP match scoring (0–100). Each criterion the user specified
// contributes weight; criteria left open don't count against a candidate.

export function classifySeniority(title: string | null | undefined): Seniority {
  const t = (title ?? "").toLowerCase();
  if (!t) return "other";
  if (/\b(co-?founder|founder|owner)\b/.test(t)) return "founder";
  if (/\b(ceo|cto|cfo|coo|cmo|cro|cio|cpo|chief)\b/.test(t)) return "c_level";
  if (/\b(vp|vice president|svp|evp)\b/.test(t)) return "vp";
  if (/\b(managing director|director)\b/.test(t)) return "director";
  if (/\bhead\b/.test(t)) return "head";
  if (/\bmanager|lead\b/.test(t)) return "manager";
  return "other";
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, " ").trim();
const overlaps = (hay: string, needles: string[]) => {
  const h = norm(hay);
  return needles.some((n) => {
    const x = norm(n);
    return x.length > 0 && h.includes(x);
  });
};

export interface MatchResult {
  score: number;
  reasons: string[];
}

export function scoreMatch(icp: IcpCriteria, company: CompanyCandidate, person: PersonCandidate | null): MatchResult {
  let earned = 0;
  let possible = 0;
  const reasons: string[] = [];
  const check = (weight: number, ok: boolean, reason: string) => {
    possible += weight;
    if (ok) {
      earned += weight;
      reasons.push(reason);
    }
  };

  if (icp.countries.length) {
    check(20, !!company.country && icp.countries.map((c) => c.toUpperCase()).includes(company.country.toUpperCase()), "Market");
  }
  if (icp.industries.length || icp.keywords.length) {
    const text = [company.industry, company.description, company.name].filter(Boolean).join(" ");
    check(25, overlaps(text, [...icp.industries, ...icp.keywords]), "Industry");
  }
  if (icp.employees_min != null || icp.employees_max != null) {
    const n = company.employeeCount;
    const ok = n != null && (icp.employees_min == null || n >= icp.employees_min) && (icp.employees_max == null || n <= icp.employees_max);
    check(20, ok, "Company size");
  }
  if (icp.hiring) check(10, (company.hiringRoles ?? 0) > 0, "Hiring");
  if (icp.funding_stages.length) check(5, !!company.fundingStage && overlaps(company.fundingStage, icp.funding_stages), "Funding");

  if (person) {
    const seniority = classifySeniority(person.title);
    if (icp.job_titles.length || icp.seniorities.length) {
      const ok = (!!person.title && overlaps(person.title, icp.job_titles)) || icp.seniorities.includes(seniority);
      check(20, ok, "Decision maker");
    }
  }

  if (possible === 0) return { score: 0, reasons };
  return { score: Math.round((earned / possible) * 100), reasons };
}
