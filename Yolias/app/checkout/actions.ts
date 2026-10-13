"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { canManageTeam, requireSession, requireUser } from "@/lib/session";
import { isBillingPeriod, isPaidPlan, PERIOD_COOKIE, PLAN_COOKIE } from "@/lib/plans";
import { billingTestMode, planCharge, startPlan, startTrial } from "@/lib/billing";
import { billingRoute, grantPack, providerFor, startCheckout, type CheckoutResult as ProviderResult } from "@/lib/payments";
import { loadPolar, polarPortalUrl, productFor } from "@/lib/payments/polar";
import { ensurePolarProducts } from "@/lib/payments/polar-products";
import { createPolarCheckout } from "@/lib/payments/polar-checkout";
import { canStartTrial } from "@/lib/trial";
import { workspaceCurrency } from "@/lib/plan-catalog";
import { requestCountry } from "@/lib/geo-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDictionary } from "@/lib/i18n/server";
import type { Dictionary } from "@/lib/i18n/config";

export type CheckoutResult = { ok: false; error: string };

function providerError(r: Exclude<ProviderResult, { ok: true }>, t: Dictionary): CheckoutResult {
  const e = t.checkout.errors;
  return { ok: false, error: r.error === "not_priced" ? e.notPriced : r.error === "not_connected" ? e.notConnected : e.paymentFailed };
}

// Puts the workspace on the chosen plan (owner brief 2026-10-12): paid plans
// only (no $0 plan). Egypt → Paymob: the first period is paid up front, the
// plan starts when Paymob confirms the payment. Every other country → Polar:
// the hosted checkout takes the card and starts the 7-day free trial
// (/checkout/polar); a workspace already subscribed on Polar changes its plan
// in Polar's customer portal. With no provider connected, billing test mode
// (local/dev) starts the trial or the plan as a test — never a pretend real
// charge.
export async function activatePlan(plan: string, period: string): Promise<CheckoutResult> {
  const session = await requireUser();
  const t = await getDictionary();
  if (!canManageTeam(session)) return { ok: false, error: t.checkout.onlyAdmins };
  if (!isPaidPlan(plan) || !isBillingPeriod(period)) return { ok: false, error: t.checkout.errors.choosePlan };
  const payer = { userId: session.userId, email: session.email, name: session.profile.full_name };
  const ws = session.workspace;
  const route = await billingRoute(ws);

  if (route === "paymob" && (await providerFor(await workspaceCurrency(ws)))) {
    const r = await startCheckout(ws, { ...payer, country: ws.billing_country ?? (await requestCountry()) }, { kind: "subscription", plan, period });
    if (!r.ok) return providerError(r, t);
    redirect(r.url);
  }
  if (route === "polar") {
    const polar = await loadPolar();
    if (polar && ws.polar_subscription_id) redirect(polarPortalUrl(polar.environment));
    const product = polar ? productFor((await ensurePolarProducts(polar)).cfg, plan, period) : null;
    if (product) redirect(`/checkout/polar?products=${product}`);
  }
  if (!billingTestMode()) return { ok: false, error: t.checkout.errors.notConnected };
  // Test mode: Polar countries start the trial (once), Egypt pays up front.
  if (route === "polar" && canStartTrial(ws) && ws.subscription_status !== "active" && ws.subscription_status !== "test") {
    if (!(await startTrial(ws, plan, period, payer, { mode: "test", provider: "polar" }))) return { ok: false, error: t.checkout.errors.failed };
  } else {
    const charge = await planCharge(ws, plan, period);
    if (!charge) return { ok: false, error: t.checkout.errors.notPriced };
    if ((await startPlan(ws, plan, period, payer, { mode: "test", ...charge })) === false) return { ok: false, error: t.checkout.errors.failed };
  }

  const jar = await cookies();
  jar.delete(PLAN_COOKIE);
  jar.delete(PERIOD_COOKIE);
  revalidatePath("/", "layout");
  redirect(session.profile.onboarded_at ? "/" : "/onboarding");
}

export type PackResult = { ok: true; added: number; test: true } | { ok: false; error: string };

/** Buy More Prospects: provider checkout, or an immediate test grant in billing test mode. */
export async function buyProspectPack(packId: string): Promise<PackResult> {
  const session = await requireSession();
  const t = await getDictionary();
  if (!canManageTeam(session)) return { ok: false, error: t.buyMore.onlyAdmins };
  if (!/^[0-9a-f-]{36}$/i.test(packId)) return { ok: false, error: t.checkout.errors.failed };
  const ws = session.workspace;
  const currency = await workspaceCurrency(ws);
  const payer = { userId: session.userId, email: session.email, name: session.profile.full_name };

  if (await providerFor(currency)) {
    const r = await startCheckout(ws, { ...payer, country: ws.billing_country ?? (await requestCountry()) }, { kind: "prospect_pack", packId });
    if (!r.ok) return providerError(r, t);
    redirect(r.url);
  }
  if (!billingTestMode()) return { ok: false, error: t.checkout.errors.notConnected };
  const db = createAdminClient();
  const { data: pack } = await db.from("prospect_packs").select("*").eq("id", packId).eq("active", true).maybeSingle();
  const price = pack ? pack.price_usd : null;
  if (!pack || price == null) return { ok: false, error: t.checkout.errors.notPriced };
  await grantPack(db, ws, pack.prospects, pack.emails, { mode: "test", amount: Number(price), currency }, payer);
  revalidatePath("/", "layout");
  return { ok: true, added: pack.prospects, test: true };
}

/** Pays an open renewal invoice (a live subscription renews by paying it). */
export async function payInvoice(invoiceId: string): Promise<CheckoutResult> {
  const session = await requireUser();
  const t = await getDictionary();
  if (!canManageTeam(session)) return { ok: false, error: t.checkout.onlyAdmins };
  if (!/^[0-9a-f-]{36}$/i.test(invoiceId)) return { ok: false, error: t.checkout.errors.failed };
  const ws = session.workspace;
  const r = await startCheckout(ws, { userId: session.userId, email: session.email, name: session.profile.full_name, country: ws.billing_country }, {
    kind: "subscription", plan: ws.plan === "free" ? "pro" : ws.plan, period: ws.billing_period, invoiceId,
  });
  if (!r.ok) return providerError(r, t);
  redirect(r.url);
}

export type EmbedResult = { ok: true; url: string } | { ok: false; error: string; portal?: string };

/**
 * Embedded Polar checkout (owner decision 2026-10-13): the session is created
 * here and opened inside /checkout (Polar's iframe), so the member never
 * leaves Yolias. Card details stay with Polar. Only for the Polar route; a
 * workspace already subscribed on Polar is sent to Polar's portal instead.
 */
export async function startPolarCheckout(plan: string, period: string): Promise<EmbedResult> {
  const session = await requireUser();
  const t = await getDictionary();
  if (!canManageTeam(session)) return { ok: false, error: t.checkout.onlyAdmins };
  if (!isPaidPlan(plan) || !isBillingPeriod(period)) return { ok: false, error: t.checkout.errors.choosePlan };
  const ws = session.workspace;
  const loaded = await loadPolar();
  const polar = loaded ? (await ensurePolarProducts(loaded)).cfg : null;
  const product = polar ? productFor(polar, plan, period) : null;
  if (!polar || !product || (await billingRoute(ws)) !== "polar") return { ok: false, error: t.checkout.errors.notConnected };
  if (ws.polar_subscription_id) return { ok: false, error: t.checkout.errors.managedInPortal, portal: polarPortalUrl(polar.environment) };
  // The page that embeds the checkout (Polar only talks to this origin).
  const h = await headers();
  const origin = h.get("origin");
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  const embedOrigin = origin && (origin === site || /^http:\/\/localhost:\d+$/.test(origin)) ? origin : site || undefined;
  const r = await createPolarCheckout(polar, ws, { userId: session.userId, email: session.email, name: session.profile.full_name }, product, { embedOrigin });
  return r.ok ? { ok: true, url: r.url } : { ok: false, error: r.error === "plan" ? t.checkout.errors.choosePlan : t.checkout.errors.paymentFailed };
}

/** After Polar's success message: has Polar's webhook started the trial or the plan yet? */
export async function checkoutState(): Promise<{ active: boolean }> {
  const session = await requireUser();
  const s = session.workspace.subscription_status;
  return { active: s === "trialing" || s === "active" || s === "test" };
}
