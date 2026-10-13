import "server-only";
import * as Sentry from "@sentry/nextjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlanCatalog } from "@/lib/plan-catalog";
import { priceFor } from "@/lib/plans";
import { POLAR_PRODUCTS_KEY, polarClient, productKeys, readPolarProducts, type PolarConfig, type PolarEnvironment, type ProductKey } from "./polar";
import type { BillingPeriod, Json, PaidPlan } from "@/types/database";

// Polar products are created by Yolias, not by hand (owner decision
// 2026-10-13, D-191). One product per paid plan and period, priced from
// plan_quotas (edited in Yolias Admin). The ids are kept in site_settings
// "polar_products" per environment, so checkout and webhooks never ask Polar
// for them. When a price in plan_quotas changes, the product gets the new
// price on the next checkout: Polar archives the old price, and existing
// subscribers stay on the price they signed up at. Products are found again
// by their metadata (yolias_plan / yolias_period), so a lost map or a second
// installation never creates duplicates.

const NAMES: Record<PaidPlan, string> = { pro: "Pro", growth: "Growth", scale: "Scale" };

type Stored = Partial<Record<PolarEnvironment, Partial<Record<ProductKey, { id: string; cents: number }>>>>;

async function readStored(): Promise<Stored> {
  return (await readPolarProducts()) as Stored;
}

interface Wanted {
  key: ProductKey;
  plan: PaidPlan;
  period: BillingPeriod;
  cents: number;
  name: string;
  description: string;
}

async function wanted(): Promise<Wanted[]> {
  const catalog = await getPlanCatalog();
  return productKeys.map((key) => {
    const [plan, period] = key.split("_") as [PaidPlan, BillingPeriod];
    const t = catalog[plan];
    return {
      key, plan, period,
      cents: Math.round(priceFor(t.priceUsd, period) * 100),
      name: `Yolias ${NAMES[plan]} (${period === "annual" ? "Annual" : "Monthly"})`,
      description: `${t.prospects.toLocaleString("en-US")} prospects, ${t.emails.toLocaleString("en-US")} emails and ${t.contacts.toLocaleString("en-US")} uploaded contacts per month.`,
    };
  });
}

function activeCents(p: { prices: unknown[] }): number | null {
  for (const raw of p.prices) {
    const price = raw as { amount_type?: string; is_archived?: boolean; price_amount?: number };
    if (price.amount_type === "fixed" && !price.is_archived && typeof price.price_amount === "number") return price.price_amount;
  }
  return null;
}

export type EnsureResult = { ok: true; cfg: PolarConfig; created: number; repriced: number } | { ok: false; cfg: PolarConfig };

/**
 * Makes sure Polar has the six plan products at the current prices and
 * returns the config with their ids. Calls Polar only when something is
 * missing or a price changed since the last sync.
 */
export async function ensurePolarProducts(cfg: PolarConfig): Promise<EnsureResult> {
  const want = await wanted();
  const stored = await readStored().catch((): Stored => ({}));
  const mine = stored[cfg.environment] ?? {};
  if (want.every((w) => mine[w.key]?.id && mine[w.key]!.cents === w.cents)) {
    return { ok: true, cfg: { ...cfg, products: { ...cfg.products, ...Object.fromEntries(want.map((w) => [w.key, mine[w.key]!.id])) } }, created: 0, repriced: 0 };
  }

  const polar = polarClient(cfg);
  let created = 0;
  let repriced = 0;
  try {
    // Every Yolias product in the organization, found by metadata.
    const found = new Map<string, Awaited<ReturnType<typeof polar.products.create>>>();
    for await (const p of polar.products.iterList({ is_archived: false, is_recurring: true, limit: 100 })) {
      const plan = p.metadata?.yolias_plan;
      const period = p.metadata?.yolias_period;
      if (typeof plan === "string" && typeof period === "string" && !found.has(`${plan}_${period}`)) found.set(`${plan}_${period}`, p);
    }

    const next: Partial<Record<ProductKey, { id: string; cents: number }>> = {};
    for (const w of want) {
      const metadata = { yolias_plan: w.plan, yolias_period: w.period };
      const price = { amount_type: "fixed" as const, price_currency: "usd" as const, price_amount: w.cents };
      const existing = found.get(w.key);
      if (!existing) {
        const p = await polar.products.create({ name: w.name, description: w.description, recurring_interval: w.period === "annual" ? "year" : "month", prices: [price], metadata });
        next[w.key] = { id: p.id, cents: w.cents };
        created++;
        continue;
      }
      if (activeCents(existing) !== w.cents) {
        // Replacing the price list archives the old price; subscribers keep theirs.
        await polar.products.update(existing.id, { name: w.name, description: w.description, prices: [price] });
        repriced++;
      }
      next[w.key] = { id: existing.id, cents: w.cents };
    }

    await createAdminClient().from("site_settings").upsert({ key: POLAR_PRODUCTS_KEY, value: { ...stored, [cfg.environment]: next } as unknown as Json, updated_at: new Date().toISOString() });
    if (created || repriced) console.info("[polar] products synced", cfg.environment, { created, repriced });
    return { ok: true, cfg: { ...cfg, products: { ...cfg.products, ...Object.fromEntries(Object.entries(next).map(([k, v]) => [k, v!.id])) } }, created, repriced };
  } catch (e) {
    // Never the token or the response body.
    Sentry.captureException(e, { tags: { area: "checkout", provider: "polar", step: "products", env: cfg.environment } });
    console.error("[polar] product sync failed", e instanceof Error ? e.name : "error");
    return { ok: false, cfg };
  }
}
