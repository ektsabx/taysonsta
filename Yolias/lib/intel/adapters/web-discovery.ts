import "server-only";
import { z } from "zod";
import type { ProviderAdapter } from "@/lib/intel/adapter";
import type { CompanyCandidate } from "@/lib/discovery/types";
import type { IcpCriteria } from "@/lib/discovery/icp";
import { runStructured } from "@/lib/ai/llm";
import { findSocials } from "@/lib/intel/socials";

// Discovery without a data provider (owner decision 2026-10-07, D-164).
// The model only proposes candidate businesses (name + official website) from
// its own knowledge; nothing it says is stored as fact. Each candidate is kept
// only when its website answers and publishes at least one way to reach it
// (email, phone or WhatsApp); every stored contact detail is read from that
// website (lib/intel/socials.ts). Name, industry and location come from the
// search itself or the model's proposal and are scored like any provider's.
// Runs after real data providers (priority in intel.providers).

const Candidate = z.object({
  name: z.string().trim().min(2).max(200),
  website: z.string().trim().min(4).max(300),
  industry: z.string().trim().max(120).nullable(),
  city: z.string().trim().max(120).nullable(),
  country: z.string().trim().length(2).nullable(),
  description: z.string().trim().max(400).nullable(),
});
// The JSON Schema sent to the model stays plain (Gemini rejects some
// constraint keywords); the limits above are checked when the answer returns.
const Loose = z.object({
  companies: z.array(z.object({
    name: z.string(), website: z.string(), industry: z.string().nullable(), city: z.string().nullable(), country: z.string().nullable(), description: z.string().nullable(),
  })),
});
const schema = (() => {
  const { $schema: _drop, ...s } = z.toJSONSchema(Loose) as Record<string, unknown>;
  void _drop;
  return s;
})();

const PROMPT_VERSION = "web-discovery-2026-10-07";
const MAX_CANDIDATES = 40;
const CHECKS_IN_PARALLEL = 6;

function domainOf(site: string): string | null {
  try {
    const u = new URL(/^https?:\/\//i.test(site) ? site : `https://${site}`);
    return u.hostname.replace(/^www\./, "").toLowerCase() || null;
  } catch {
    return null;
  }
}

function brief(icp: IcpCriteria, local: boolean, want: number, skip: number): string {
  const lines = [
    `Find ${want} real ${local ? "local businesses" : "companies"} that match this search${skip ? `, skipping the first ${skip} you would name` : ""}.`,
    `Search: ${icp.summary}`,
    icp.countries.length ? `Countries (ISO): ${icp.countries.join(", ")}` : "",
    icp.cities.length ? `Cities: ${icp.cities.join(", ")}` : "",
    icp.industries.length ? `Industries: ${icp.industries.join(", ")}` : "",
    icp.keywords.length ? `Keywords: ${icp.keywords.join(", ")}` : "",
    icp.employees_min != null || icp.employees_max != null ? `Employees: ${icp.employees_min ?? "any"}–${icp.employees_max ?? "any"}` : "",
    icp.exclusions.length ? `Exclude: ${icp.exclusions.join(", ")}` : "",
  ];
  return lines.filter(Boolean).join("\n");
}

async function propose(icp: IcpCriteria, local: boolean, limit: number, offset: number) {
  const want = Math.min(MAX_CANDIDATES, Math.max(5, Math.ceil(limit * 3)));
  const r = await runStructured("extract", {
    system: [
      "You list real, currently operating businesses with their official website, for a B2B prospecting tool.",
      "Only include a business when you are confident it exists and you know its official website domain. Never invent names or domains; return fewer results rather than guessing.",
      "Do not include emails, phone numbers or people. country is an ISO 3166-1 alpha-2 code or null.",
    ].join(" "),
    parts: [{ kind: "text", text: brief(icp, local, want, offset) }],
    schema,
    schemaName: "candidate_businesses",
    maxTokens: 6000,
  }, (d) => {
    const p = Loose.safeParse(d);
    return p.success ? p.data : null;
  }, { promptVersion: PROMPT_VERSION });
  return r.data.companies.slice(0, 60).flatMap((c) => {
    const ok = Candidate.safeParse({ ...c, country: c.country && c.country.length === 2 ? c.country : null });
    return ok.success ? [ok.data] : [];
  });
}

/** Keeps a candidate only when its own website answers with a way to reach it. */
async function verify(c: z.infer<typeof Candidate>, local: boolean, icp: IcpCriteria): Promise<CompanyCandidate | null> {
  const domain = domainOf(c.website);
  if (!domain) return null;
  const site = await findSocials(`https://${domain}`);
  if (!site.email && !site.phone && !site.whatsapp) return null;
  return {
    name: c.name, domain, website: `https://${domain}`, industry: c.industry, description: c.description,
    city: c.city ?? icp.cities[0] ?? null, country: c.country?.toUpperCase() ?? (icp.countries.length === 1 ? icp.countries[0] : null),
    employeeCount: null, fundingStage: null, fundingTotalUsd: null, hiringRoles: null, signals: [], sourceRef: domain,
    kind: local ? "local_business" : "company", category: local ? c.industry : null,
    email: site.email, phone: site.phone, whatsapp: site.whatsapp, facebookUrl: site.facebookUrl, instagramUrl: site.instagramUrl,
    confidence: 0.6,
  };
}

async function search(icp: IcpCriteria, local: boolean, limit: number, offset = 0) {
  const proposed = await propose(icp, local, limit, offset);
  const seen = new Set<string>();
  const unique = proposed.filter((c) => {
    const d = domainOf(c.website);
    if (!d || seen.has(d)) return false;
    seen.add(d);
    return true;
  });
  const kept: CompanyCandidate[] = [];
  for (let i = 0; i < unique.length && kept.length < limit; i += CHECKS_IN_PARALLEL) {
    const batch = await Promise.all(unique.slice(i, i + CHECKS_IN_PARALLEL).map((c) => verify(c, local, icp)));
    for (const c of batch) if (c && kept.length < limit) kept.push(c);
  }
  return { data: kept, units: proposed.length };
}

export const webDiscovery: ProviderAdapter = {
  id: "yolias_web",
  name: "Company websites (Yolias AI)",
  needsCredential: false,
  handlers: {
    "company.search": async (input) => search(input.icp, false, input.limit, input.offset ?? 0),
    "place.search": async (input) => search(input.icp, true, input.limit, input.offset ?? 0),
  },
};
