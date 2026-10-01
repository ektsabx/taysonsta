import type { IcpCriteria } from "@/lib/discovery/icp";
import type { CompanyCandidate, PersonCandidate } from "@/lib/discovery/types";

// What providers can do (docs/03-intelligence-layer.md "Capabilities").
// Product code asks for a capability, never for a provider by name (rule 13).

export const capabilities = [
  "company.search",
  "company.enrich",
  "company.lookup_local",
  "person.search",
  "person.enrich",
  "email.find",
  "email.verify",
  "phone.find",
  "web.search",
  "web.extract",
  "tech.detect",
  "signals.hiring",
] as const;

export type Capability = (typeof capabilities)[number];

export function isCapability(v: unknown): v is Capability {
  return typeof v === "string" && (capabilities as readonly string[]).includes(v);
}

export type VerifyStatus = "valid" | "invalid" | "catch_all" | "risky" | "unknown";

export interface WebResult {
  url: string;
  title: string;
  snippet: string | null;
}

/** Input and output of every capability. Adapters implement only what they really offer. */
export interface CapabilityIO {
  "company.search": { input: { icp: IcpCriteria; limit: number; offering: string | null }; output: CompanyCandidate[] };
  "company.enrich": { input: { company: CompanyCandidate }; output: Partial<CompanyCandidate> };
  "company.lookup_local": { input: { name: string; city: string | null; country: string | null }; output: Partial<CompanyCandidate> | null };
  "person.search": { input: { company: CompanyCandidate; icp: IcpCriteria; limit: number }; output: PersonCandidate[] };
  "person.enrich": { input: { person: PersonCandidate; company: CompanyCandidate }; output: Partial<PersonCandidate> };
  "email.find": { input: { person: PersonCandidate; company: CompanyCandidate }; output: { email: string; confidence: number | null } | null };
  "email.verify": { input: { email: string }; output: { status: VerifyStatus } };
  "phone.find": { input: { person: PersonCandidate; company: CompanyCandidate }; output: { phone: string; kind: "mobile" | "phone" } | null };
  "web.search": { input: { query: string; limit: number; country: string | null }; output: WebResult[] };
  "web.extract": { input: { url: string }; output: { url: string; title: string | null; text: string } };
  "tech.detect": { input: { domain: string }; output: string[] };
  "signals.hiring": { input: { company: CompanyCandidate }; output: { roles: string[]; count: number } };
}

export type CapabilityInput<C extends Capability> = CapabilityIO[C]["input"];
export type CapabilityOutput<C extends Capability> = CapabilityIO[C]["output"];
