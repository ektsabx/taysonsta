import "server-only";
import { createPolar } from "@polar-sh/sdk/2026-10";
import { createAdminClient } from "@/lib/supabase/admin";
import { integrationConfig, integrationSecret, loadIntegrations } from "@/lib/integrations";
import { paidPlans } from "@/lib/plans";
import type { BillingPeriod, PaidPlan } from "@/types/database";

// Polar (owner brief 2026-10-12, D-185): billing for every country except
// Egypt (Paymob). Polar is the merchant of record: its hosted checkout takes
// the card and starts the subscription with the free trial, charges at the
// end of the trial and renews; customers manage cards, invoices and
// cancellation in Polar's hosted customer portal. SDK: @polar-sh/sdk (API
// version 2026-10), no framework adapter.
//
// Keys live in Yolias Admin → Settings → Integrations → Polar (one place for
// every key, D-132), synced to Yolias's Vault: access token and webhook
// secret (secrets) and environment (config). Nothing is read from
// environment variables. The plan products are created by Yolias itself
// (lib/payments/polar-products.ts, D-191) and their ids kept in site_settings
// "polar_products"; a product id typed in the hub (product_<plan>_<period>)
// still wins, for tests and emergencies.

export type PolarEnvironment = "production" | "sandbox";
export type ProductKey = `${PaidPlan}_${BillingPeriod}`;

export interface PolarConfig {
  accessToken: string;
  webhookSecret: string | null;
  environment: PolarEnvironment;
  /** Polar product id per plan and period (each product carries its price and trial). */
  products: Partial<Record<ProductKey, string>>;
  /** Tests only: a local stand-in for Polar's API. */
  baseUrl?: string;
}

export const productKeys: ProductKey[] = paidPlans.flatMap((p) => (["monthly", "annual"] as const).map((period) => `${p}_${period}` as ProductKey));

/** Polar settings from the Integrations hub, or null when it isn't connected. */
export async function loadPolar(): Promise<PolarConfig | null> {
  await loadIntegrations();
  const accessToken = integrationSecret("polar", "access_token");
  if (!accessToken) return null;
  const env = integrationConfig("polar", "server");
  const environment: PolarEnvironment = env === "sandbox" ? "sandbox" : "production";
  const products: Partial<Record<ProductKey, string>> = {};
  const stored = (await readPolarProducts())[environment] ?? {};
  for (const k of productKeys) {
    const id = stored[k]?.id;
    if (typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id)) products[k] = id;
  }
  for (const k of productKeys) {
    const id = integrationConfig("polar", `product_${k}`);
    if (id && /^[0-9a-f-]{36}$/i.test(id)) products[k] = id;
  }
  return { accessToken, webhookSecret: integrationSecret("polar", "webhook_secret"), environment, products };
}

export const POLAR_PRODUCTS_KEY = "polar_products";

/** The stored product map: { [environment]: { [plan_period]: { id, cents } } }. */
export async function readPolarProducts(): Promise<Partial<Record<PolarEnvironment, Partial<Record<ProductKey, { id?: string; cents?: number }>>>>> {
  try {
    const { data } = await createAdminClient().from("site_settings").select("value").eq("key", POLAR_PRODUCTS_KEY).maybeSingle();
    return data?.value && typeof data.value === "object" && !Array.isArray(data.value) ? (data.value as never) : {};
  } catch {
    return {};
  }
}

export function productFor(cfg: PolarConfig, plan: PaidPlan, period: BillingPeriod): string | null {
  return cfg.products[`${plan}_${period}`] ?? null;
}

/** The plan and period a configured product id stands for (never trusts anything else). */
export function planForProduct(cfg: PolarConfig, productId: string): { plan: PaidPlan; period: BillingPeriod } | null {
  for (const k of productKeys) {
    if (cfg.products[k] === productId) {
      const [plan, period] = k.split("_") as [PaidPlan, BillingPeriod];
      return { plan, period };
    }
  }
  return null;
}

export function polarClient(cfg: PolarConfig) {
  return createPolar({ accessToken: cfg.accessToken, environment: cfg.environment, timeout: 20, ...(cfg.baseUrl ? { baseUrl: cfg.baseUrl } : {}) });
}

/** Organization slug on Polar (dashboard: polar.sh/dashboard/yolias). */
export const POLAR_ORG_SLUG = "yolias";

/** Polar's hosted customer portal: customers sign in there with their email. */
export function polarPortalUrl(env: PolarEnvironment = "production"): string {
  return `https://${env === "sandbox" ? "sandbox." : ""}polar.sh/${POLAR_ORG_SLUG}/portal`;
}
