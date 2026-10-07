import { z } from "zod";
import type { Capability } from "@/lib/intel/capabilities";
import type { SearchTypeId } from "@/lib/discovery/icp";

// Entity layer (final spec phase 4, §11–14, §37). Yolias returns four kinds of
// entity — Person, Company, Local Business, Job — and every search type
// returns its own entity with its own output schema. Every result carries
// the same standard intelligence fields. These schemas are the contract for
// the UI, CSV export, the agent tools and any API: one place, no forks.

export const entityKinds = ["person", "company", "local_business", "job"] as const;
export type EntityKind = (typeof entityKinds)[number];

// ───────────────────────── Standard intelligence fields ─────────────────────────

export const FieldProvenanceSchema = z.object({
  field: z.string(),
  source: z.string(),
  at: z.string().describe("ISO time the value was fetched"),
  confidence: z.number().min(0).max(1).nullable(),
});
export type FieldProvenance = z.infer<typeof FieldProvenanceSchema>;

export const IntelligenceSchema = z.object({
  source: z.string().describe("Data provider (or yolias_shared) that produced the record"),
  provenance: z.array(FieldProvenanceSchema).describe("Where each field came from, when, with what confidence"),
  last_updated: z.string().describe("When the record was last refreshed"),
  confidence: z.number().min(0).max(1).nullable().describe("Overall confidence in the record, when the source gives one"),
  match_score: z.number().int().min(0).max(100).nullable().describe("How well it matches the search (deterministic code)"),
  match_reasons: z.array(z.string()),
  missing: z.array(z.string()).describe("Expected fields Yolias couldn't find"),
});
export type Intelligence = z.infer<typeof IntelligenceSchema>;

// ───────────────────────── Entities ─────────────────────────

export const PersonSchema = z.object({
  kind: z.literal("person"),
  id: z.string(),
  full_name: z.string(),
  title: z.string().nullable(),
  seniority: z.string().nullable(),
  email: z.string().nullable(),
  email_status: z.enum(["unknown", "found", "verified", "invalid"]),
  phone: z.string().nullable(),
  linkedin_url: z.string().nullable(),
  facebook_url: z.string().nullable(),
  instagram_url: z.string().nullable(),
  whatsapp: z.string().nullable(),
  city: z.string().nullable(),
  country: z.string().nullable(),
  company: z.object({ id: z.string().nullable(), name: z.string().nullable(), domain: z.string().nullable() }).nullable(),
  intelligence: IntelligenceSchema,
});

export const CompanySchema = z.object({
  kind: z.literal("company"),
  id: z.string(),
  name: z.string(),
  domain: z.string().nullable(),
  industry: z.string().nullable(),
  description: z.string().nullable(),
  employee_count: z.number().int().nullable(),
  funding_stage: z.string().nullable(),
  hiring_roles: z.number().int().nullable(),
  city: z.string().nullable(),
  country: z.string().nullable(),
  signals: z.array(z.string()),
  facebook_url: z.string().nullable(),
  instagram_url: z.string().nullable(),
  whatsapp: z.string().nullable(),
  intelligence: IntelligenceSchema,
});

export const LocalBusinessSchema = z.object({
  kind: z.literal("local_business"),
  id: z.string(),
  name: z.string(),
  category: z.string().nullable(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  country: z.string().nullable(),
  phone: z.string().nullable(),
  website: z.string().nullable(),
  rating: z.number().nullable(),
  reviews_count: z.number().int().nullable(),
  maps_url: z.string().nullable(),
  facebook_url: z.string().nullable(),
  instagram_url: z.string().nullable(),
  whatsapp: z.string().nullable(),
  intelligence: IntelligenceSchema,
});

export const JobSchema = z.object({
  kind: z.literal("job"),
  id: z.string(),
  title: z.string(),
  department: z.string().nullable(),
  seniority: z.string().nullable(),
  city: z.string().nullable(),
  country: z.string().nullable(),
  url: z.string().nullable(),
  posted_at: z.string().nullable(),
  company: z.object({ id: z.string().nullable(), name: z.string().nullable() }).nullable(),
  intelligence: IntelligenceSchema,
});

export type PersonEntity = z.infer<typeof PersonSchema>;
export type CompanyEntity = z.infer<typeof CompanySchema>;
export type LocalBusinessEntity = z.infer<typeof LocalBusinessSchema>;
export type JobEntity = z.infer<typeof JobSchema>;
export type Entity = PersonEntity | CompanyEntity | LocalBusinessEntity | JobEntity;

export const entitySchemas = { person: PersonSchema, company: CompanySchema, local_business: LocalBusinessSchema, job: JobSchema } as const;

// ───────────────────────── Search types ─────────────────────────

export interface SearchTypeSpec {
  /** The entity a result of this search is (and what counts as one prospect). */
  entity: Exclude<EntityKind, "job">;
  /** Capability that finds the candidates; the search waits for a source until a provider offers it. */
  source: "company.search" | "place.search" | "company.lookalikes";
  /** Extra capabilities used when a provider offers them (skipped otherwise, no cost). */
  optional: Capability[];
}

export const searchTypeSpecs: Record<SearchTypeId, SearchTypeSpec> = {
  people: { entity: "person", source: "company.search", optional: ["company.enrich", "person.search", "person.enrich", "email.verify", "job.search"] },
  companies: { entity: "company", source: "company.search", optional: ["company.enrich", "job.search"] },
  local_businesses: { entity: "local_business", source: "place.search", optional: [] },
  company_lookalikes: { entity: "company", source: "company.lookalikes", optional: ["company.enrich", "job.search"] },
};

// ───────────────────────── Helpers ─────────────────────────

/** Fields each entity is expected to have; what's absent is reported as missing (never invented). */
export const expectedFields: Record<EntityKind, string[]> = {
  person: ["title", "email", "phone", "linkedin_url", "city", "country"],
  company: ["domain", "industry", "employee_count", "city", "country", "description", "facebook_url", "instagram_url", "whatsapp"],
  local_business: ["category", "address", "phone", "website", "rating", "city", "facebook_url", "instagram_url", "whatsapp"],
  job: ["department", "city", "country", "url", "posted_at"],
};

const present = (v: unknown) => v !== null && v !== undefined && !(typeof v === "string" && v.trim() === "") && !(Array.isArray(v) && v.length === 0);

export function missingFields(kind: EntityKind, row: Record<string, unknown>): string[] {
  return expectedFields[kind].filter((f) => !present(row[f]));
}

/** One provenance entry per present field: who returned it, when, how sure. */
export function provenanceFor(row: Record<string, unknown>, fields: string[], source: string, at: string, confidence: number | null): FieldProvenance[] {
  return fields.filter((f) => present(row[f])).map((field) => ({ field, source, at, confidence }));
}

/** All the fields a provider may have filled for this entity, for provenance. */
export const provenanceFields: Record<EntityKind, string[]> = {
  person: ["full_name", ...expectedFields.person, "facebook_url", "instagram_url", "whatsapp"],
  company: ["name", ...expectedFields.company, "funding_stage", "hiring_roles", "phone", "email"],
  local_business: ["name", ...expectedFields.local_business, "reviews_count", "country", "email"],
  job: ["title", ...expectedFields.job],
};

export function clampConfidence(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number.NaN;
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : null;
}
