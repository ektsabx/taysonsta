import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Platform switches (owner brief 2026-10-13, D-213): parts of Yolias the owner
// turns on and off from Admin → Platform → Switches, stored in
// site_settings.platform_switches. A missing key means "on", so nothing
// changes until the owner switches something off. Off = hidden from
// customers and refused on the server (not only hidden).

export const SWITCHES = ["payments_polar", "payments_paymob", "buy_more"] as const;
export type SwitchKey = (typeof SWITCHES)[number];

const TTL_MS = 15_000;
let cache: { at: number; value: Record<SwitchKey, boolean> } | null = null;

export async function switches(): Promise<Record<SwitchKey, boolean>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  const value = Object.fromEntries(SWITCHES.map((k) => [k, true])) as Record<SwitchKey, boolean>;
  try {
    const { data } = await createAdminClient().from("site_settings").select("value").eq("key", "platform_switches").maybeSingle();
    const v = (data?.value ?? {}) as Record<string, unknown>;
    for (const k of SWITCHES) if (v[k] === false) value[k] = false;
  } catch {
    if (cache) return cache.value;
  }
  cache = { at: Date.now(), value };
  return value;
}

export async function switchOn(key: SwitchKey): Promise<boolean> {
  return (await switches())[key];
}

/** Tests only. */
export function resetSwitchCache() {
  cache = null;
}
