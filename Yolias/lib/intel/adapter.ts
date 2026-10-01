import type { Capability, CapabilityInput, CapabilityOutput } from "@/lib/intel/capabilities";
import type { FetchResult, ProviderRequest } from "@/lib/intel/http";

// Contract for a provider adapter (docs/03 "Adding a provider"). Path:
// Intelligence Service → Adapter → Provider (rule 11). Adapters translate;
// routing, retries, credentials, costs and logging live in the service.

export interface AdapterContext {
  /** Decrypted credential from Vault, or null when the adapter needs none. */
  credential: string | null;
  /** HTTP with timeout, retry/backoff and Retry-After. Use it for every call. */
  fetch: (req: ProviderRequest) => Promise<FetchResult>;
}

export interface HandlerResult<C extends Capability> {
  data: CapabilityOutput<C>;
  /** Billable units (records, requests…) — priced from the registry, never here (rule 14). */
  units: number;
}

export type Handler<C extends Capability> = (input: CapabilityInput<C>, ctx: AdapterContext) => Promise<HandlerResult<C>>;

export interface ProviderAdapter {
  /** Stable id: registry row id and the `source` stored on data. */
  id: string;
  name: string;
  needsCredential: boolean;
  handlers: { [C in Capability]?: Handler<C> };
}

export function adapterCapabilities(a: ProviderAdapter): Capability[] {
  return Object.keys(a.handlers) as Capability[];
}
