import type { Capability } from "@/lib/intel/capabilities";

// Provider selection for one capability (docs/03 "Routing"). Pure: the
// service feeds it the registry, health and spend, so it can be unit tested.
// Ladder steps before "paid" (shared DB, code, public sources) are handled by
// the callers before they ask for a provider.

export type SkipReason =
  | "disabled"
  | "no_adapter"
  | "no_capability"
  | "no_credentials"
  | "circuit_open"
  | "daily_budget"
  | "monthly_budget"
  | "storage_not_allowed";

export interface ProviderState {
  id: string;
  enabled: boolean;
  priority: number;
  /** Capabilities the adapter in code implements. Empty when there is no adapter. */
  implemented: Capability[];
  hasAdapter: boolean;
  needsCredential: boolean;
  hasCredential: boolean;
  unitCostUsd: number | null;
  storageAllowed: boolean;
  dailyBudgetUsd: number | null;
  monthlyBudgetUsd: number | null;
  spentTodayUsd: number;
  spentMonthUsd: number;
  consecutiveFailures: number;
  circuitOpenUntil: string | null;
}

export interface RouteDecision {
  usable: ProviderState[];
  skipped: { id: string; reason: SkipReason }[];
}

export function route(capability: Capability, providers: ProviderState[], now = new Date()): RouteDecision {
  const usable: ProviderState[] = [];
  const skipped: RouteDecision["skipped"] = [];
  for (const p of providers) {
    const reason = skipReason(capability, p, now);
    if (reason) skipped.push({ id: p.id, reason });
    else usable.push(p);
  }
  usable.sort(
    (a, b) =>
      a.priority - b.priority ||
      (a.unitCostUsd ?? Infinity) - (b.unitCostUsd ?? Infinity) ||
      a.consecutiveFailures - b.consecutiveFailures ||
      a.id.localeCompare(b.id),
  );
  return { usable, skipped };
}

function skipReason(capability: Capability, p: ProviderState, now: Date): SkipReason | null {
  if (!p.hasAdapter) return "no_adapter";
  if (!p.implemented.includes(capability)) return "no_capability";
  if (!p.enabled) return "disabled";
  if (p.needsCredential && !p.hasCredential) return "no_credentials";
  if (p.circuitOpenUntil && new Date(p.circuitOpenUntil) > now) return "circuit_open";
  // Results are stored as shared intelligence; a provider whose license forbids storage can't feed it.
  if (!p.storageAllowed) return "storage_not_allowed";
  if (p.dailyBudgetUsd != null && p.spentTodayUsd >= p.dailyBudgetUsd) return "daily_budget";
  if (p.monthlyBudgetUsd != null && p.spentMonthUsd >= p.monthlyBudgetUsd) return "monthly_budget";
  return null;
}

/** Health after a call: failures open the circuit for a while (docs/05). */
export function nextHealth(
  health: { consecutive_failures?: number; circuit_open_until?: string | null; last_error?: string | null; last_success_at?: string | null },
  ok: boolean,
  error: string | null,
  breaker: { failures: number; open_seconds: number },
  now = new Date(),
) {
  if (ok) return { consecutive_failures: 0, circuit_open_until: null, last_error: health.last_error ?? null, last_success_at: now.toISOString() };
  const failures = (health.consecutive_failures ?? 0) + 1;
  return {
    consecutive_failures: failures,
    circuit_open_until: failures >= breaker.failures ? new Date(now.getTime() + breaker.open_seconds * 1000).toISOString() : health.circuit_open_until ?? null,
    last_error: error,
    last_success_at: health.last_success_at ?? null,
  };
}
