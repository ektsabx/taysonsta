import type { IcpCriteria } from "@/lib/discovery/icp";

// Scoring for the bilingual ICP eval set (tests/evals/icp-cases.json, docs/07).
// Pure code: checks only what each request clearly states.

export interface IcpExpect {
  countries?: string[];
  target?: [number, "companies" | "prospects"];
  titlesAny?: string[];
  seniorityAny?: string[];
  industryAny?: string[];
  employees?: [number | null, number | null];
  hiring?: boolean;
}

export interface CheckResult {
  check: string;
  ok: boolean;
  detail: string;
}

const has = (hay: string[], needles: string[]) => hay.some((h) => needles.some((n) => h.toLowerCase().includes(n.toLowerCase())));

export function scoreIcp(icp: IcpCriteria, e: IcpExpect): CheckResult[] {
  const out: CheckResult[] = [];
  if (e.countries) {
    const missing = e.countries.filter((c) => !icp.countries.includes(c));
    out.push({ check: "countries", ok: missing.length === 0, detail: `got ${icp.countries.join(",") || "∅"}${missing.length ? `, missing ${missing.join(",")}` : ""}` });
  }
  if (e.target) {
    out.push({ check: "target", ok: icp.target_count === e.target[0] && icp.target_unit === e.target[1], detail: `got ${icp.target_count} ${icp.target_unit}` });
  }
  if (e.titlesAny) out.push({ check: "titles", ok: has(icp.job_titles, e.titlesAny), detail: `got ${icp.job_titles.slice(0, 4).join(" / ") || "∅"}` });
  if (e.seniorityAny) out.push({ check: "seniority", ok: icp.seniorities.some((s) => e.seniorityAny!.includes(s)), detail: `got ${icp.seniorities.join(",") || "∅"}` });
  if (e.industryAny) out.push({ check: "industry", ok: has([...icp.industries, ...icp.keywords], e.industryAny), detail: `got ${[...icp.industries, ...icp.keywords].slice(0, 4).join(" / ") || "∅"}` });
  if (e.employees) {
    const [min, max] = e.employees;
    const okMin = min == null || (icp.employees_min != null && icp.employees_min >= min * 0.9 && icp.employees_min <= min * 1.1);
    const okMax = max == null || (icp.employees_max != null && icp.employees_max >= max * 0.9 && icp.employees_max <= max * 1.1);
    out.push({ check: "employees", ok: okMin && okMax, detail: `got ${icp.employees_min ?? "–"}–${icp.employees_max ?? "–"}` });
  }
  if (e.hiring !== undefined) out.push({ check: "hiring", ok: icp.hiring === e.hiring, detail: `got ${icp.hiring}` });
  return out;
}
