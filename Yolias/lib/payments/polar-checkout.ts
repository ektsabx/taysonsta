import "server-only";
import { headers } from "next/headers";
import * as Sentry from "@sentry/nextjs";
import { capture } from "@/lib/analytics/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canStartTrial, trialLimits } from "@/lib/trial";
import { planForProduct, polarClient, type PolarConfig } from "./polar";
import type { WorkspaceRow } from "@/types/database";

// One Polar checkout session for a workspace (D-185). Used by the checkout
// embedded in Yolias's /checkout page (embedOrigin set) and by the plain
// redirect /checkout/polar. The product must be a configured plan product;
// the Polar customer is the workspace; the trial (once per workspace) lasts
// the configured days; the buyer's IP is forwarded so Polar shows the right
// country and currency (sessions created on a server otherwise look like
// they come from the server).

function site() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3200").replace(/\/$/, "");
}

async function buyerIp(): Promise<string | undefined> {
  try {
    const h = await headers();
    const ip = h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip");
    return ip && /^[0-9a-f.:]{3,45}$/i.test(ip) ? ip : undefined;
  } catch {
    return undefined;
  }
}

export type PolarCheckoutResult = { ok: true; url: string; trial: boolean } | { ok: false; error: "plan" | "failed" };

export async function createPolarCheckout(cfg: PolarConfig, ws: WorkspaceRow, buyer: { userId: string; email: string; name: string | null }, productId: string, opts: { embedOrigin?: string; checkoutId?: string | null } = {}): Promise<PolarCheckoutResult> {
  const picked = planForProduct(cfg, productId);
  if (!picked) return { ok: false, error: "plan" };
  const trial = await trialLimits();
  const allowTrial = canStartTrial(ws);
  const body = {
    products: [productId],
    external_customer_id: ws.id,
    customer_email: buyer.email,
    customer_name: buyer.name ?? undefined,
    customer_ip_address: await buyerIp(),
    // checkout_id links Polar's order back to Yolias's checkout session (D-212).
    metadata: { workspace_id: ws.id, user_id: buyer.userId, plan: picked.plan, period: picked.period, ...(opts.checkoutId ? { checkout_id: opts.checkoutId } : {}) },
    allow_trial: allowTrial,
    ...(allowTrial ? { trial_interval: "day" as const, trial_interval_count: trial.days } : {}),
    return_url: `${site()}/checkout`,
    ...(opts.embedOrigin ? { embed_origin: opts.embedOrigin } : {}),
  };
  try {
    const polar = polarClient(cfg);
    // Polar refuses an email it can't deliver to (checked at its end); the
    // buyer then types it in the checkout instead.
    const checkout = await polar.checkouts.create(body).catch((e: unknown) => {
      if (e instanceof Error && /422/.test(e.message) && /customer_email/.test(e.message)) return polar.checkouts.create({ ...body, customer_email: undefined });
      throw e;
    });
    const url = new URL(checkout.url);
    if (!/(^|\.)polar\.sh$/.test(url.hostname)) throw new Error("unexpected checkout host");
    await capture(buyer.userId, "checkout_started", { workspace_id: ws.id, kind: "subscription", plan: picked.plan, billing_period: picked.period, provider: "polar", trial: allowTrial, embedded: Boolean(opts.embedOrigin), mode: cfg.environment === "sandbox" ? "test" : "live" });
    if (opts.checkoutId) await createAdminClient().from("checkout_sessions").update({ provider_checkout_id: checkout.id }).eq("id", opts.checkoutId);
    return { ok: true, url: url.toString(), trial: allowTrial };
  } catch (e) {
    // Ids only: never the token, the buyer or the response body.
    Sentry.captureException(e, { tags: { area: "checkout", provider: "polar", env: cfg.environment }, extra: { workspace_id: ws.id } });
    console.error("[polar] checkout failed", e instanceof Error ? e.name : "error");
    return { ok: false, error: "failed" };
  }
}
