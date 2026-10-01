import { z } from "zod";

// The Ideal Customer Profile Yolias AI extracts from a strategy request. It is
// stored on the strategy and as the campaign's criteria, and is the only input
// data providers receive — so every provider speaks the same language.

export const seniorities = ["founder", "c_level", "vp", "director", "head", "manager", "other"] as const;

export const IcpSchema = z.object({
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

const countryNames: Record<string, string> = {
  SA: "Saudi Arabia", AE: "UAE", EG: "Egypt", QA: "Qatar", KW: "Kuwait", BH: "Bahrain", OM: "Oman",
  JO: "Jordan", MA: "Morocco", GB: "United Kingdom", US: "United States",
};

export function countryName(code: string | null | undefined): string {
  if (!code) return "";
  return countryNames[code.toUpperCase()] ?? code.toUpperCase();
}

export function sizeLabel(icp: Pick<IcpCriteria, "employees_min" | "employees_max">): string {
  const { employees_min: min, employees_max: max } = icp;
  if (min != null && max != null) return `${min}–${max} employees`;
  if (min != null) return `${min}+ employees`;
  if (max != null) return `up to ${max} employees`;
  return "Any size";
}

// "B2B SaaS · 10–100 employees · KSA" — the Target ICP Criteria column.
export function criteriaLine(icp: IcpCriteria): string {
  const parts = [
    icp.industries.slice(0, 2).join(", ") || icp.keywords.slice(0, 2).join(", "),
    sizeLabel(icp),
    icp.countries.map(countryName).join(", "),
  ];
  return parts.filter(Boolean).join(" · ");
}

export function parseIcp(value: unknown): IcpCriteria | null {
  const r = IcpSchema.safeParse(value);
  return r.success ? r.data : null;
}
