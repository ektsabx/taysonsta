import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Pay As You Go credit (owner brief 2026-10-20, D-247). One rate converts
// money to prospects (site_settings "credits".usd_per_prospect, $0.10 since D-270,
// twice the monthly plans' rate). The top-up amounts are the active
// prospect_packs rows; their prospects come from that rate.

export interface TopUp { id: string; priceUsd: number; prospects: number }

export async function creditRate(): Promise<number> {
  const { data } = await createAdminClient().from("site_settings").select("value").eq("key", "credits").maybeSingle();
  const v = Number((data?.value as { usd_per_prospect?: number } | null)?.usd_per_prospect);
  return Number.isFinite(v) && v > 0 ? v : 0.1;
}

export async function topUps(): Promise<TopUp[]> {
  const { data } = await createAdminClient().from("prospect_packs").select("id, prospects, price_usd").eq("active", true).order("sort").order("price_usd");
  return (data ?? []).map((p) => ({ id: p.id, priceUsd: Number(p.price_usd), prospects: p.prospects }));
}
