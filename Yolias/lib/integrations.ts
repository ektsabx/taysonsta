import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Integration keys (D-132). The owner enters every key in one place — Yolias
// Admin → Settings → Integrations — and Admin copies the active connection
// of each provider Yolias uses into public.integration_keys (secrets in
// Supabase Vault). Yolias reads keys only from there, never from
// environment variables. Values are cached for a short time per server
// process, so a key changed in Admin applies within seconds.

export type IntegrationProvider = "anthropic" | "openai" | "gemini" | "google_oauth" | "microsoft_oauth";

interface Values {
  config: Record<string, string>;
  secrets: Record<string, string>;
}

const TTL_MS = 30_000;
let cache: { at: number; values: Map<string, Values> } | null = null;
let inflight: Promise<void> | null = null;
let fixed: Map<string, Values> | null = null;

/** Loads the keys (cached). Call before reading them with integrationSecret(). */
export async function loadIntegrations(force = false): Promise<void> {
  if (fixed) return;
  if (!force && cache && Date.now() - cache.at < TTL_MS) return;
  inflight ??= (async () => {
    try {
      const { data, error } = await createAdminClient().rpc("integration_values");
      if (error) throw error;
      cache = { at: Date.now(), values: new Map((data ?? []).map((r) => [r.provider, { config: r.config ?? {}, secrets: r.secrets ?? {} }])) };
    } catch {
      // Keep the last known keys if the database is briefly unreachable.
      cache = { at: Date.now(), values: cache?.values ?? new Map() };
    } finally {
      inflight = null;
    }
  })();
  await inflight;
}

function values(provider: IntegrationProvider): Values | undefined {
  return (fixed ?? cache?.values)?.get(provider);
}

/** A secret of a provider from the last load, or null when it isn't connected. */
export function integrationSecret(provider: IntegrationProvider, name: string): string | null {
  return values(provider)?.secrets[name]?.trim() || null;
}

/** A non-secret setting of a provider from the last load. */
export function integrationConfig(provider: IntegrationProvider, name: string): string | null {
  return values(provider)?.config[name]?.trim() || null;
}

/** Local test scripts only: use these keys instead of the database. */
export function setIntegrationsForTests(v: Partial<Record<IntegrationProvider, Record<string, string>>> | null) {
  fixed = v ? new Map(Object.entries(v).map(([k, secrets]) => [k, { config: {}, secrets: secrets ?? {} }])) : null;
}
