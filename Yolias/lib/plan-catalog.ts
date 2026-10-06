import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { allPlans, defaultPlans, pricingCurrency, type PlanTerms } from "@/lib/plans";
import { currencyForCountry } from "@/lib/geo";
import { requestCountry } from "@/lib/geo-server";
import type { Currency, Plan, WorkspaceRow } from "@/types/database";

// Plan prices and prospect quotas are configuration (rule 29, D-005): they
// live in public.plan_quotas and are edited in Yolias Admin. The constants in
// lib/plans.ts are only the fallback if the table can't be read.
export const getPlanCatalog = cache(async (): Promise<Record<Plan, PlanTerms>> => {
  const { data, error } = await createAdminClient().from("plan_quotas").select("plan, price_usd, price_egp, prospects_per_month");
  if (error || !data?.length) return defaultPlans;
  const out = { ...defaultPlans };
  for (const row of data) {
    if ((allPlans as string[]).includes(row.plan)) out[row.plan as Plan] = { priceUsd: Number(row.price_usd), priceEgp: row.price_egp == null ? null : Number(row.price_egp), prospects: row.prospects_per_month };
  }
  return out;
});

/** The currency this visitor/workspace sees prices in (lib/plans.ts pricingCurrency). */
export async function currencyFor(country: string | null, fixed?: Currency | null): Promise<Currency> {
  const catalog = await getPlanCatalog();
  return pricingCurrency(fixed ?? currencyForCountry(country), catalog);
}

/** A workspace that already picked a plan keeps its billing currency; a new one gets its country's. */
export async function workspaceCurrency(ws: Pick<WorkspaceRow, "subscription_status" | "billing_currency" | "billing_country">): Promise<Currency> {
  if (ws.subscription_status !== "none") return ws.billing_currency;
  return currencyFor(ws.billing_country ?? (await requestCountry()));
}
