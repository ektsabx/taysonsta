import type { CompanySource, EmailVerifier, Enricher, PeopleSource } from "@/lib/discovery/types";

// Data provider registry. Intentionally empty in this phase: no company or
// people data source is connected yet, so campaigns stop at
// "awaiting_source" after Yolias AI has understood the strategy.
//
// To add a provider: implement the interface from types.ts in
// lib/discovery/providers/<name>.ts and append it to the matching list.

export const companySources: CompanySource[] = [];
export const peopleSources: PeopleSource[] = [];
export const enrichers: Enricher[] = [];
export const emailVerifiers: EmailVerifier[] = [];

export function configured<T extends { isConfigured(): boolean }>(list: T[]): T[] {
  return list.filter((p) => p.isConfigured());
}

/** Labels shown as the campaign's "Search Sources". */
export function sourceLabels(): string[] {
  return configured<{ isConfigured(): boolean; label: string }>([...companySources, ...peopleSources]).map((p) => p.label);
}
