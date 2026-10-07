import type { EmailStatus, PipelineStage, Seniority } from "@/types/database";

// Normalised company and person shapes every provider adapter maps to
// (lib/intel/capabilities.ts). Providers plug in as adapters in
// lib/intel/adapters — see docs/03-intelligence-layer.md.

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
  /** Local businesses (places on a map); companies leave these empty. */
  kind?: "company" | "local_business";
  category?: string | null;
  address?: string | null;
  phone?: string | null;
  website?: string | null;
  rating?: number | null;
  reviewsCount?: number | null;
  placeRef?: string | null;           // maps place id
  /** Media and profile links when the provider has them (D-147). */
  logoUrl?: string | null;
  linkedinUrl?: string | null;
  foundedYear?: number | null;
  /** Social profiles (D-161): Facebook page, Instagram account, WhatsApp number. */
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  whatsapp?: string | null;
  mapsUrl?: string | null;
  /** The provider's own confidence in the record (0–1), when it gives one. */
  confidence?: number | null;
  raw?: unknown;
}

export interface PersonCandidate {
  fullName: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  city: string | null;
  country: string | null;
  sourceRef: string | null;
  confidence?: number | null;
  /** Profile photo (https) when the provider has one (D-147). */
  photoUrl?: string | null;
  /** Social profiles (D-161), when the provider has them. */
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  whatsapp?: string | null;
  raw?: unknown;
}

/** A job posting (hiring signal) for a company. */
export interface JobCandidate {
  title: string;
  department: string | null;
  city: string | null;
  country: string | null;
  url: string | null;
  postedAt: string | null;            // ISO
  company: { name: string; domain: string | null };
  sourceRef: string | null;
  confidence?: number | null;
  raw?: unknown;
}

export interface DiscoveryContext {
  workspaceId: string;
  campaignId: string;
  /** What the user's company sells (onboarding) — lets providers rank relevance. */
  offering: string | null;
  limit: number;
  /** The campaign_runs row of this run (run lineage on every result). */
  runId?: number | null;
  /** Candidates earlier runs already saw: later runs of a continuous campaign ask the source for the next ones. */
  offset?: number;
  /** Results delivered under an already-charged one (decision makers of a delivered company): not charged again (D-146). */
  free?: boolean;
  log: (
    stage: PipelineStage,
    message: string,
    level?: "info" | "success" | "warning" | "error",
    text?: { key?: string; vars?: Record<string, string | number> }
  ) => Promise<void>;
}

export interface ScoredPerson extends PersonCandidate {
  seniority: Seniority;
  emailStatus: EmailStatus;
  matchScore: number;
  matchReasons: string[];
}
