import { createHash } from "node:crypto";
import type { IcpCriteria } from "@/lib/discovery/icp";

// ICP fingerprint (docs/04, docs/05 "Search cache"): the same audience asked
// twice — in any order, case or spacing — gets the same hash, so results and
// work can be reused. Only who to find counts; names, summaries and the
// requested count don't.

const list = (xs: string[]) => [...new Set(xs.map((x) => x.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ")).filter(Boolean))].sort();

export function normalizeIcp(icp: IcpCriteria) {
  return {
    countries: list(icp.countries).map((c) => c.toUpperCase()),
    cities: list(icp.cities),
    industries: list(icp.industries),
    keywords: list(icp.keywords),
    employees_min: icp.employees_min ?? null,
    employees_max: icp.employees_max ?? null,
    job_titles: list(icp.job_titles),
    seniorities: list(icp.seniorities),
    hiring: icp.hiring ?? null,
    hiring_roles: list(icp.hiring_roles),
    funding_stages: list(icp.funding_stages),
    technologies: list(icp.technologies),
    exclusions: list(icp.exclusions),
    target_unit: icp.target_unit,
  };
}

export function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export function fingerprintIcp(icp: IcpCriteria): string {
  return sha256(JSON.stringify(normalizeIcp(icp)));
}

/** Cache key for any deterministic call: parts joined unambiguously. */
export function cacheKey(...parts: string[]): string {
  return sha256(JSON.stringify(parts));
}
