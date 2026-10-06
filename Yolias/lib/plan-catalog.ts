import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { allPlans, defaultPlans, type PlanTerms } from "@/lib/plans";
import type { Currency, Plan, WorkspaceRow } from "@/types/database";

// Plan prices and prospect quotas are configuration (rule 29, D-005): they
// live in public.plan_quotas and are edited in Yolias Admin. The constants in
// lib/plans.ts are only the fallback if the table can't be read.
export const getPlanCatalog = cache(async (): Promise<Record<Plan, PlanTerms>> => {
  const { data, error } = await createAdminClient().from("plan_quotas").select("plan, price_usd, prospects_per_month");
  if (error || !data?.length) return defaultPlans;
  const out = { ...defaultPlans };
  for (const row of data) {
    if ((allPlans as string[]).includes(row.plan)) out[row.plan as Plan] = { priceUsd: Number(row.price_usd), prospects: row.prospects_per_month };
  }
  return out;
});

/** The currency prices are shown and charged in: one USD price everywhere (D-131). */
export async function currencyFor(): Promise<Currency> {
  return "USD";
}

/** A workspace's billing currency (always USD, D-131). */
export async function workspaceCurrency(ws: Pick<WorkspaceRow, "billing_currency">): Promise<Currency> {
  return ws.billing_currency;
}
