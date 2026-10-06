import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// USD → EGP for Paymob (D-142). Prices are USD everywhere; Paymob's card
// integration on an Egyptian account only takes EGP ("incorrect combination
// of Integration ID + Currency" for USD), so the checkout sends the USD price
// converted at the day's rate. The rate lives in site_settings.yolias_fx_usd_egp,
// refreshed at most every 12 hours from a public rates feed (no key); a
// `fixed` value there wins over the feed.

type Db = ReturnType<typeof createAdminClient>;

const KEY = "yolias_fx_usd_egp";
const MAX_AGE_MS = 12 * 3_600_000;
const FEED = "https://open.er-api.com/v6/latest/USD";

interface Stored {
  rate?: number;
  fixed?: number | null;
  fetched_at?: string;
}

const sane = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n > 5 && n < 1000;

/** Today's USD→EGP rate, or null when none is known. */
export async function usdToEgp(db: Db = createAdminClient()): Promise<number | null> {
  const { data } = await db.from("site_settings").select("value").eq("key", KEY).maybeSingle();
  const v = (data?.value ?? {}) as Stored;
  if (sane(v.fixed)) return v.fixed;
  if (sane(v.rate) && v.fetched_at && Date.now() - Date.parse(v.fetched_at) < MAX_AGE_MS) return v.rate;
  try {
    const res = await fetch(FEED, { cache: "no-store", signal: AbortSignal.timeout(8_000) });
    const body = (await res.json()) as { result?: string; rates?: Record<string, number> };
    const rate = body.rates?.EGP;
    if (!res.ok || body.result !== "success" || !sane(rate)) throw new Error(`fx feed ${res.status}`);
    const at = new Date().toISOString();
    await db.from("site_settings").upsert({ key: KEY, value: { ...v, rate, fetched_at: at }, updated_at: at });
    return rate;
  } catch (e) {
    console.error("[payments] fx", e);
    return sane(v.rate) ? v.rate : null; // the last known rate beats no checkout
  }
}

/** USD price → EGP charge, rounded up to the whole pound. */
export function toEgp(usd: number, rate: number): number {
  return Math.ceil(Math.round(usd * rate * 100) / 100);
}
