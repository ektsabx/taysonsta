import type { EmailStatus, PipelineStage, Seniority } from "@/types/database";
import type { IcpCriteria } from "@/lib/discovery/icp";

// Contracts every data provider implements. The pipeline (pipeline.ts) only
// talks to these interfaces; adding Apollo, People Data Labs, a web-research
// agent, etc. later means writing one adapter and registering it in
// registry.ts — no schema or UI changes.

export interface CompanyCandidate {
  name: string;
  domain: string | null;
  industry: string | null;
  description: string | null;
  city: string | null;
  country: string | null;             // ISO alpha-2
  employeeCount: number | null;
  fundingStage: string | null;
  fundingTotalUsd: number | null;
  hiringRoles: number | null;
  signals: string[];                  // e.g. "Hiring 12+ roles in GCC"
  sourceRef: string | null;           // provider's own id
  raw?: unknown;
}

export interface PersonCandidate {
  fullName: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  linkedinUrl: string | null;
  city: string | null;
  country: string | null;
  sourceRef: string | null;
  raw?: unknown;
}

export interface DiscoveryContext {
  workspaceId: string;
  campaignId: string;
  /** What the user's company sells (onboarding) — lets providers rank relevance. */
  offering: string | null;
  limit: number;
  log: (stage: PipelineStage, message: string, level?: "info" | "success" | "warning" | "error") => Promise<void>;
}

interface ProviderBase {
  /** Stable id stored in companies.source / prospects.source. */
  id: string;
  label: string;
  /** False when credentials are missing — the pipeline skips it. */
  isConfigured(): boolean;
}

export interface CompanySource extends ProviderBase {
  searchCompanies(icp: IcpCriteria, ctx: DiscoveryContext): Promise<CompanyCandidate[]>;
}

export interface PeopleSource extends ProviderBase {
  findDecisionMakers(company: CompanyCandidate, icp: IcpCriteria, ctx: DiscoveryContext): Promise<PersonCandidate[]>;
}

export interface Enricher extends ProviderBase {
  enrichCompany?(company: CompanyCandidate, ctx: DiscoveryContext): Promise<Partial<CompanyCandidate>>;
  enrichPerson?(person: PersonCandidate, company: CompanyCandidate, ctx: DiscoveryContext): Promise<Partial<PersonCandidate>>;
}

export interface EmailVerifier extends ProviderBase {
  verify(email: string): Promise<EmailStatus>;
}

export interface ScoredPerson extends PersonCandidate {
  seniority: Seniority;
  emailStatus: EmailStatus;
  matchScore: number;
  matchReasons: string[];
}
