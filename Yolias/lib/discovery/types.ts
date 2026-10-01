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
