import { z } from "zod";
import { countryLabel } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";

// The Ideal Customer Profile Yolias AI extracts from a strategy request. It is
// stored on the strategy and as the campaign's criteria, and is the only input
// data providers receive — so every provider speaks the same language.

export const seniorities = ["founder", "c_level", "vp", "director", "head", "manager", "other"] as const;

/** What a search returns (final spec §11–14): its own entity and output schema (lib/entities). */
export const searchTypes = ["people", "companies", "local_businesses", "company_lookalikes"] as const;
export type SearchTypeId = (typeof searchTypes)[number];

export const IcpSchema = z.object({
  search_type: z.enum(searchTypes).describe(
    'companies = matching companies and the decision makers inside them (default; people is legacy, treated as companies); local_businesses = shops, clinics, restaurants and other places on a map in a city; company_lookalikes = companies similar to the ones the user names',
  ),
  lookalike_seeds: z.array(z.string()).describe("For company_lookalikes: the companies (names or websites) to find lookalikes of; otherwise empty"),
  campaign_name: z.string().describe('Short mission name, e.g. "Saudi SaaS Companies — Founders"'),
  summary: z.string().describe("One sentence restating who the user wants to sell to"),
  target_count: z.number().int().describe("How many companies or prospects were asked for; 100 if not stated"),
  target_unit: z.enum(["companies", "prospects"]),
  countries: z.array(z.string()).describe("ISO 3166-1 alpha-2 codes, e.g. SA, AE, EG"),
  cities: z.array(z.string()),
  industries: z.array(z.string()),
  keywords: z.array(z.string()).describe("Business keywords that describe matching companies"),
  employees_min: z.number().int().nullable(),
  employees_max: z.number().int().nullable(),
  job_titles: z.array(z.string()).describe("Decision-maker titles to find inside each company"),
  seniorities: z.array(z.enum(seniorities)),
  hiring: z.boolean().nullable().describe("true when the user asked for companies that are currently hiring"),
  hiring_roles: z.array(z.string()).describe("Roles the companies should be hiring for, if stated"),
  funding_stages: z.array(z.string()),
  technologies: z.array(z.string()),
  exclusions: z.array(z.string()).describe("Companies, industries or traits to exclude"),
  assumptions: z.array(z.string()).describe("Defaults Yolias assumed because the request did not say"),
});

export type IcpCriteria = z.infer<typeof IcpSchema>;

export interface IcpLabels {
  anySize: string;
  sizeRange: string;
  sizeMin: string;
  sizeMax: string;
}

const enLabels: IcpLabels = { anySize: "Any size", sizeRange: "{min}–{max} employees", sizeMin: "{min}+ employees", sizeMax: "up to {max} employees" };

const fill = (s: string, v: Record<string, number>) => s.replace(/\{(\w+)\}/g, (m, k: string) => (k in v ? String(v[k]) : m));

export function sizeLabel(icp: Pick<IcpCriteria, "employees_min" | "employees_max">, labels: IcpLabels = enLabels): string {
  const { employees_min: min, employees_max: max } = icp;
  if (min != null && max != null) return fill(labels.sizeRange, { min, max });
  if (min != null) return fill(labels.sizeMin, { min });
  if (max != null) return fill(labels.sizeMax, { max });
  return labels.anySize;
}

// "B2B SaaS · 10–100 employees · KSA" — the Target ICP Criteria column.
export function criteriaLine(icp: IcpCriteria, locale: Locale = "en", labels: IcpLabels = enLabels): string {
  const parts = [
    icp.industries.slice(0, 2).join(", ") || icp.keywords.slice(0, 2).join(", "),
    sizeLabel(icp, labels),
    icp.countries.map((c) => countryLabel(c, locale, true)).join(", "),
  ];
  return parts.filter(Boolean).join(" · ");
}

export function parseIcp(value: unknown): IcpCriteria | null {
  // Searches saved before search types existed were all people searches.
  const v = value && typeof value === "object" ? { search_type: "people", lookalike_seeds: [], ...(value as object) } : value;
  const r = IcpSchema.safeParse(v);
  return r.success ? r.data : null;
}
