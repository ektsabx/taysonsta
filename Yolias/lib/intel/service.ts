import "server-only";
import type { Capability, CapabilityInput, CapabilityOutput } from "@/lib/intel/capabilities";
import type { Handler } from "@/lib/intel/adapter";
import { asJson, getSetting, intel } from "@/lib/intel/db";
import { cacheKey } from "@/lib/intel/fingerprint";
import { providerFetch } from "@/lib/intel/http";
import { unitCost } from "@/lib/intel/pricing";
import { routeFor } from "@/lib/intel/registry";
import { nextHealth, type SkipReason } from "@/lib/intel/routing";

// The Intelligence Service (docs/02, docs/03): the only way product code gets
// external data. It routes a capability to the best usable provider, loads
// its credential from Vault, calls the adapter, prices and logs the call,
// updates provider health (circuit breaker) and falls back on failure.

/** License terms of the data a call returned (docs/03 "Licensing"). */
export interface SourceLicense {
  scope: string | null;
  redistributable: boolean;
  customerFacing: boolean;
  retentionDays: number | null;
}

export interface CallScope {
  workspaceId: string | null;
  campaignId: string | null;
}

export type CapabilityResult<C extends Capability> =
  | { ok: true; provider: string; data: CapabilityOutput<C>; costUsd: number | null; license: SourceLicense; callId: number | null }
  | { ok: false; reason: "no_provider" | "all_failed"; skipped: { id: string; reason: SkipReason }[]; errors: { provider: string; error: string }[] };

export async function runCapability<C extends Capability>(capability: C, input: CapabilityInput<C>, scope: CallScope): Promise<CapabilityResult<C>> {
  const { decision, providers } = await routeFor(capability);
  if (decision.usable.length === 0) return { ok: false, reason: "no_provider", skipped: decision.skipped, errors: [] };

  const breaker = await getSetting("circuit_breaker", { failures: 5, open_seconds: 300 });
  const db = intel();
  const errors: { provider: string; error: string }[] = [];
  const first = providers.get(decision.usable[0].id)!.row;

  for (const state of decision.usable) {
    const { row, adapter } = providers.get(state.id)!;
    // Fallback only to providers the first choice allows (empty list = any capable provider).
    if (row.id !== first.id && first.fallback_to.length && !first.fallback_to.includes(row.id)) continue;
    const handler = adapter?.handlers[capability] as Handler<C> | undefined;
    if (!handler) continue;

    const started = Date.now();
    let credential: string | null = null;
    if (adapter!.needsCredential) {
      const { data } = await db.rpc("provider_credential", { p_provider: row.id });
      credential = data ?? null;
    }
    let attempts = 0;
    let httpStatus: number | null = null;
    try {
      const result = await handler(input, {
        credential,
        fetch: async (req) => {
          const r = await providerFetch(req);
          attempts += r.attempts;
          httpStatus = r.status;
          return r;
        },
      });
      const price = unitCost(row.pricing, capability);
      const cost = price == null ? null : Math.round(price * result.units * 1_000_000) / 1_000_000;
      const { data: call } = await db.from("provider_calls").insert({
        provider: row.id, capability, operation: capability, workspace_id: scope.workspaceId, campaign_id: scope.campaignId,
        request_hash: cacheKey(capability, JSON.stringify(input)), ok: true, http_status: httpStatus, attempts: Math.max(attempts, 1),
        latency_ms: Date.now() - started, records_returned: Array.isArray(result.data) ? result.data.length : result.data ? 1 : 0,
        cost_usd: cost, // null = unpriced (D-114)
      }).select("id").single();
      await db.from("providers").update({ health: asJson(nextHealth(row.health as object, true, null, breaker)) }).eq("id", row.id);
      const license: SourceLicense = {
        scope: row.license_scope, redistributable: row.redistribution_allowed, customerFacing: row.customer_facing_allowed, retentionDays: row.retention_days,
      };
      return { ok: true, provider: row.id, data: result.data, costUsd: cost, license, callId: call?.id ?? null };
    } catch (e) {
      const error = e instanceof Error ? e.message.slice(0, 500) : "adapter failed";
      errors.push({ provider: row.id, error });
      await db.from("provider_calls").insert({
        provider: row.id, capability, operation: capability, workspace_id: scope.workspaceId, campaign_id: scope.campaignId,
        ok: false, http_status: httpStatus, attempts: Math.max(attempts, 1), latency_ms: Date.now() - started, error,
      });
      await db.from("providers").update({ health: asJson(nextHealth(row.health as object, false, error, breaker)) }).eq("id", row.id);
    }
  }
  return { ok: false, reason: "all_failed", skipped: decision.skipped, errors };
}
