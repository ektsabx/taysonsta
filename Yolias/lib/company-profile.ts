import { z } from "zod";
import type { WorkspaceRow } from "@/types/database";

// The company profile (onboarding + Settings → Organization). One schema for
// both forms, and one text block for every AI step that needs to know the
// business: understanding a search, the Yolias AI chat and outreach drafts.

export type CompanyProfileErrors = { company: string; website: string; offering: string; industry: string; targetMarkets: string };

export function companyProfileSchema(e: CompanyProfileErrors) {
  return z.object({
    name: z.string().trim().min(1, e.company).max(160),
    website: z.string().trim()
      .transform((v) => v.replace(/^https?:\/\//i, "").replace(/\/+$/, ""))
      .pipe(z.string().regex(/^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i, e.website)),
    industry: z.string().trim().min(2, e.industry).max(120),
    offering: z.string().trim().min(10, e.offering).max(2000),
    ideal_customer: z.string().trim().max(2000).transform((v) => v || null),
    target_markets: z.string().trim().min(2, e.targetMarkets).max(300),
  });
}

export type CompanyProfile = Pick<WorkspaceRow, "name" | "website" | "industry" | "offering" | "ideal_customer" | "target_markets">;

/** "Company: …\nIndustry: …" — only the fields that are filled in. */
export function businessLines(p: Partial<CompanyProfile>): string {
  return [
    p.name && `Company: ${p.name}`,
    p.website && `Website: ${p.website}`,
    p.industry && `Industry: ${p.industry}`,
    p.offering && `Products and services: ${p.offering}`,
    p.ideal_customer && `Ideal customer profile: ${p.ideal_customer}`,
    p.target_markets && `Target markets: ${p.target_markets}`,
  ].filter(Boolean).join("\n");
}
