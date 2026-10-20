import "server-only";
import type { ProviderAdapter } from "@/lib/intel/adapter";
import type { CompanyCandidate } from "@/lib/discovery/types";
import type { IcpCriteria } from "@/lib/discovery/icp";
import { intel } from "@/lib/intel/db";
import { canonicalCity } from "@/lib/datasets/normalize";

// Imported datasets (D-248): the companies and local businesses uploaded in
// Yolias Admin → Data import from datasets marked "may be shown to
// customers". Free, so it runs before paid providers and the website
// discovery (priority in intel.providers). Only what the dataset holds is
// returned; nothing is filled in.

const words = (icp: IcpCriteria) => [...new Set([...icp.industries, ...icp.keywords].map((w) => w.trim()).filter((w) => w.length >= 3))].slice(0, 12);

async function search(icp: IcpCriteria, local: boolean, limit: number, offset: number) {
  const { data, error } = await intel().rpc("dataset_search", {
    p_countries: icp.countries.map((c) => c.toUpperCase()), p_cities: [...new Set(icp.cities.flatMap((c) => [c, canonicalCity(c) ?? c]))], p_terms: words(icp),
    p_emp_min: icp.employees_min, p_emp_max: icp.employees_max, p_local: local, p_limit: limit, p_offset: offset,
  });
  if (error) throw new Error(`dataset search failed: ${error.message}`);
  const rows = data ?? [];
  const out: CompanyCandidate[] = rows.map((r) => ({
    name: r.name, domain: r.domain, industry: r.industry, description: r.description, city: r.city, country: r.country,
    employeeCount: r.employee_count, fundingStage: null, fundingTotalUsd: null, hiringRoles: null, signals: [], sourceRef: `intel:${r.id}`,
    kind: local ? "local_business" : "company", category: r.category, address: r.address, phone: r.phone, website: r.website, email: r.email,
    linkedinUrl: r.linkedin_url,
  }));
  return { data: out, units: 0 };
}

export const datasets: ProviderAdapter = {
  id: "yolias_datasets",
  name: "Yolias datasets (imported data)",
  needsCredential: false,
  handlers: {
    "company.search": async (input) => search(input.icp, false, input.limit, input.offset ?? 0),
    "place.search": async (input) => search(input.icp, true, input.limit, input.offset ?? 0),
  },
};
