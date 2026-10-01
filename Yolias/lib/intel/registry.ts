import "server-only";
import { adapters } from "@/lib/intel/adapters";
import { adapterCapabilities, type ProviderAdapter } from "@/lib/intel/adapter";
import type { Capability } from "@/lib/intel/capabilities";
import { intel } from "@/lib/intel/db";
import { unitCost } from "@/lib/intel/pricing";
import { route, type ProviderState, type RouteDecision } from "@/lib/intel/routing";
import type { IntelProviderRow } from "@/types/database";

// Provider registry (docs/03 "Provider registry"): adapters live in code,
// their configuration (on/off, priority, prices, limits, licenses,
// credentials) in intel.providers, edited from Yolias Admin.

export function adapterFor(id: string): ProviderAdapter | undefined {
  return adapters.find((a) => a.id === id);
}

let synced = false;

/** Adds a disabled registry row for every adapter that has none, and keeps declared capabilities current. */
export async function syncRegistry(): Promise<void> {
  if (synced || adapters.length === 0) {
    synced = true;
    return;
  }
  const db = intel();
  const { data: rows } = await db.from("providers").select("id, capabilities");
  const existing = new Map((rows ?? []).map((r) => [r.id, r.capabilities]));
  for (const a of adapters) {
    const caps = adapterCapabilities(a);
    if (!existing.has(a.id)) {
      await db.from("providers").insert({ id: a.id, name: a.name, capabilities: caps });
    } else if (JSON.stringify([...(existing.get(a.id) ?? [])].sort()) !== JSON.stringify([...caps].sort())) {
      await db.from("providers").update({ capabilities: caps }).eq("id", a.id);
    }
  }
  synced = true;
}

function startOfDayUtc(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
function startOfMonthUtc(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export interface LoadedProvider {
  row: IntelProviderRow;
  adapter: ProviderAdapter | undefined;
  state: ProviderState;
}

export async function loadProviders(capability?: Capability): Promise<LoadedProvider[]> {
  await syncRegistry();
  const db = intel();
  const [{ data: rows }, { data: spend }] = await Promise.all([
    db.from("providers").select("*"),
    db.rpc("provider_spend", { p_day_start: startOfDayUtc().toISOString(), p_month_start: startOfMonthUtc().toISOString() }),
  ]);
  const spendBy = new Map((spend ?? []).map((s) => [s.provider, s]));
  return (rows ?? []).map((row) => {
    const adapter = adapterFor(row.id);
    const health = (row.health ?? {}) as { consecutive_failures?: number; circuit_open_until?: string | null };
    const s = spendBy.get(row.id);
    return {
      row,
      adapter,
      state: {
        id: row.id,
        enabled: row.enabled,
        priority: row.priority,
        implemented: adapter ? adapterCapabilities(adapter) : [],
        hasAdapter: Boolean(adapter),
        needsCredential: adapter?.needsCredential ?? true,
        hasCredential: Boolean(row.credential_secret_id),
        unitCostUsd: capability ? unitCost(row.pricing, capability) : null,
        storageAllowed: row.storage_allowed,
        dailyBudgetUsd: row.daily_budget_usd == null ? null : Number(row.daily_budget_usd),
        monthlyBudgetUsd: row.monthly_budget_usd == null ? null : Number(row.monthly_budget_usd),
        spentTodayUsd: Number(s?.spent_today ?? 0),
        spentMonthUsd: Number(s?.spent_month ?? 0),
        consecutiveFailures: health.consecutive_failures ?? 0,
        circuitOpenUntil: health.circuit_open_until ?? null,
      },
    };
  });
}

export async function routeFor(capability: Capability): Promise<{ decision: RouteDecision; providers: Map<string, LoadedProvider> }> {
  const loaded = await loadProviders(capability);
  return { decision: route(capability, loaded.map((l) => l.state)), providers: new Map(loaded.map((l) => [l.row.id, l])) };
}

export async function hasProviderFor(capability: Capability): Promise<boolean> {
  if (!adapters.some((a) => adapterCapabilities(a).includes(capability))) return false;
  return (await routeFor(capability)).decision.usable.length > 0;
}

/** Names of the providers that can run a capability now (the campaign's "Search sources"). */
export async function sourceLabels(capability: Capability = "company.search"): Promise<string[]> {
  if (!adapters.some((a) => adapterCapabilities(a).includes(capability))) return [];
  const { decision, providers } = await routeFor(capability);
  return decision.usable.map((p) => providers.get(p.id)?.row.name ?? p.id);
}
