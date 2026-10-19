"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { canManageTeam, requireSession, requireUser } from "@/lib/session";
import { isBillingPeriod, isPaidPlan, PERIOD_COOKIE, PLAN_COOKIE } from "@/lib/plans";
import { billingTestMode, planCharge, startPlan, startTrial } from "@/lib/billing";
import { grantPack, invoiceGateway, lockedProvider, providerFor, startCheckout, type CardGateway, type CheckoutResult as ProviderResult } from "@/lib/payments";
import { loadPolar, polarPortalUrl, productFor } from "@/lib/payments/polar";
import { ensurePolarProducts } from "@/lib/payments/polar-products";
import { createPolarCheckout } from "@/lib/payments/polar-checkout";
import { trialOpen } from "@/lib/trial";
import { confirmKashierPayment } from "@/lib/payments/kashier-confirm";
import { getLocale } from "@/lib/i18n/server";
import { workspaceCurrency } from "@/lib/plan-catalog";
import { requestCountry } from "@/lib/geo-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDictionary } from "@/lib/i18n/server";
import type { Dictionary } from "@/lib/i18n/config";
import { switches } from "@/lib/switches";
import { checkoutStep, currentCheckout } from "@/lib/funnel";

export type CheckoutResult = { ok: false; error: string };

/** Paymob's page is opened in the browser; Kashier's form is framed in /checkout/pay (D-236). */
function goPay(r: Extract<ProviderResult, { ok: true }>): never {
  redirect(r.embed ? `/checkout/pay/${r.paymentId}` : r.url);
}

/** The gateway for a purchase that isn't tied to a subscription: Paymob, else Kashier when only it is connected. */
async function anyGateway(): Promise<CardGateway | null> {
  if (await providerFor("paymob")) return "paymob";
  return (await providerFor("kashier")) ? "kashier" : null;
}

function providerError(r: Exclude<ProviderResult, { ok: true }>, t: Dictionary): CheckoutResult {
  const e = t.checkout.errors;
  return { ok: false, error: r.error === "not_priced" ? e.notPriced : r.error === "not_connected" ? e.notConnected : e.paymentFailed };
}

// Puts the workspace on the chosen plan (owner brief 2026-10-12): paid plans
// only (no $0 plan). The customer picks how to pay (D-209, D-236): Paymob
// (live: its hosted page, the first period paid up front, the plan starts
// when Paymob confirms), Kashier (once its account is active: its form inside
// /checkout/pay) or Polar (its hosted checkout with the 7-day free trial). A running subscription
// keeps its provider (Polar's customer portal changes a Polar plan). With no
// provider connected, billing test mode (local/dev) starts the trial or the
// plan as a test — never a pretend real charge.
export async function activatePlan(plan: string, period: string, method: string = "polar", checkoutId: string | null = null): Promise<CheckoutResult> {
  const session = await requireUser();
  const t = await getDictionary();
  if (!canManageTeam(session)) return { ok: false, error: t.checkout.onlyAdmins };
  if (!isPaidPlan(plan) || !isBillingPeriod(period)) return { ok: false, error: t.checkout.errors.choosePlan };
  if (method !== "polar" && method !== "paymob" && method !== "kashier") return { ok: false, error: t.checkout.errors.chooseMethod };
  const payer = { userId: session.userId, email: session.email, name: session.profile.full_name };
  const ws = session.workspace;
  const route = lockedProvider(ws) ?? method;
  // A method switched off in Admin can't be used even by a stale page (D-213).
  if (!billingTestMode() && !(await switches())[route === "polar" ? "payments_polar" : route === "kashier" ? "payments_kashier" : "payments_paymob"]) return { ok: false, error: t.checkout.errors.notConnected };
  // Journey tracking (D-212): the member started paying.
  const cid = await ownCheckout(checkoutId, ws.id, session.userId);
  const track = { userId: session.userId, workspaceId: ws.id, provider: route, plan, period };
  await checkoutStep(cid, "payment_started", track);

  if (route !== "polar" && (await providerFor(route))) {
    const r = await startCheckout(ws, { ...payer, country: ws.billing_country ?? (await requestCountry()), language: await getLocale() }, { kind: "subscription", plan, period }, cid, route);
    if (!r.ok) {
      await checkoutStep(cid, "payment_error", { ...track, reason: r.error });
      return providerError(r, t);
    }
    await checkoutStep(cid, "redirected", track);
    goPay(r);
  }
  if (route === "polar") {
    const polar = await loadPolar();
    if (polar && ws.polar_subscription_id) redirect(polarPortalUrl(polar.environment));
    const product = polar ? productFor((await ensurePolarProducts(polar)).cfg, plan, period) : null;
    if (product) {
      await checkoutStep(cid, "redirected", track);
      redirect(`/checkout/polar?products=${product}${cid ? `&checkout=${cid}` : ""}`);
    }
  }
  if (!billingTestMode()) {
    await checkoutStep(cid, "payment_error", { ...track, reason: "not_connected" });
    return { ok: false, error: t.checkout.errors.notConnected };
  }
  // Test mode: the Polar route starts the trial (once), the card gateways pay up front.
  if (route === "polar" && (await trialOpen(ws)) && ws.subscription_status !== "active" && ws.subscription_status !== "test") {
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
  if (!(await switches()).buy_more) return { ok: false, error: t.checkout.errors.notConnected };
  const ws = session.workspace;
  const currency = await workspaceCurrency(ws);
  const payer = { userId: session.userId, email: session.email, name: session.profile.full_name };

  const gateway = await anyGateway();
  if (gateway) {
    const r = await startCheckout(ws, { ...payer, country: ws.billing_country ?? (await requestCountry()), language: await getLocale() }, { kind: "prospect_pack", packId }, null, gateway);
    if (!r.ok) return providerError(r, t);
    goPay(r);
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
  const r = await startCheckout(ws, { userId: session.userId, email: session.email, name: session.profile.full_name, country: ws.billing_country, language: await getLocale() }, {
    kind: "subscription", plan: ws.plan === "free" ? "pro" : ws.plan, period: ws.billing_period, invoiceId,
  }, null, invoiceGateway(ws));
  if (!r.ok) return providerError(r, t);
  goPay(r);
}

export type EmbedResult = { ok: true; url: string } | { ok: false; error: string; portal?: string };

/**
 * Embedded Polar checkout (owner decision 2026-10-13): the session is created
 * here and opened inside /checkout (Polar's iframe), so the member never
 * leaves Yolias. Card details stay with Polar. Only for the Polar route; a
 * workspace already subscribed on Polar is sent to Polar's portal instead.
 */
export async function startPolarCheckout(plan: string, period: string, checkoutId: string | null = null): Promise<EmbedResult> {
  const session = await requireUser();
  const t = await getDictionary();
  if (!canManageTeam(session)) return { ok: false, error: t.checkout.onlyAdmins };
  if (!isPaidPlan(plan) || !isBillingPeriod(period)) return { ok: false, error: t.checkout.errors.choosePlan };
  const ws = session.workspace;
  if (!(await switches()).payments_polar) return { ok: false, error: t.checkout.errors.notConnected };
  const cid = await ownCheckout(checkoutId, ws.id, session.userId);
  const track = { userId: session.userId, workspaceId: ws.id, provider: "polar", plan, period };
  await checkoutStep(cid, "payment_started", track);
  const loaded = await loadPolar();
  const polar = loaded ? (await ensurePolarProducts(loaded)).cfg : null;
  const product = polar ? productFor(polar, plan, period) : null;
  if (!polar || !product || (lockedProvider(ws) ?? "polar") !== "polar") return { ok: false, error: t.checkout.errors.notConnected };
  if (ws.polar_subscription_id) return { ok: false, error: t.checkout.errors.managedInPortal, portal: polarPortalUrl(polar.environment) };
  // The page that embeds the checkout (Polar only talks to this origin).
  const h = await headers();
  const origin = h.get("origin");
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  const embedOrigin = origin && (origin === site || /^http:\/\/localhost:\d+$/.test(origin)) ? origin : site || undefined;
  const r = await createPolarCheckout(polar, ws, { userId: session.userId, email: session.email, name: session.profile.full_name }, product, { embedOrigin, checkoutId: cid });
  // The embedded checkout is now open inside /checkout (Polar's iframe): the
  // session is created; whether the member pays is only known from Polar.
  await checkoutStep(cid, r.ok ? "redirected" : "payment_error", { ...track, reason: r.ok ? null : r.error });
  return r.ok ? { ok: true, url: r.url } : { ok: false, error: r.error === "plan" ? t.checkout.errors.choosePlan : t.checkout.errors.paymentFailed };
}

/** The checkout session id sent by the page, if it is this member's; else their latest one. */
async function ownCheckout(id: string | null, workspaceId: string, userId: string): Promise<string | null> {
  const current = await currentCheckout(workspaceId, userId);
  if (id && /^[0-9a-f-]{36}$/i.test(id)) {
    const db = createAdminClient();
    const { data } = await db.from("checkout_sessions").select("id").eq("id", id).eq("workspace_id", workspaceId).eq("user_id", userId).maybeSingle();
    if (data) return data.id;
  }
  return current?.id ?? null;
}

/** The member chose a payment method / period / plan on the checkout page (no payment yet). */
export async function checkoutDetails(checkoutId: string | null, input: { plan?: string; period?: string; method?: string }): Promise<void> {
  const session = await requireUser();
  const cid = await ownCheckout(checkoutId, session.workspace.id, session.userId);
  await checkoutStep(cid, "details", {
    provider: input.method === "polar" || input.method === "paymob" || input.method === "kashier" ? input.method : null,
    plan: isPaidPlan(input.plan) ? input.plan : null, period: isBillingPeriod(input.period) ? input.period : null,
  });
}

/** Polar's embedded checkout told the page it succeeded: the result still comes from Polar's webhook. */
export async function checkoutReturned(checkoutId: string | null, result: "succeeded" | "closed"): Promise<void> {
  const session = await requireUser();
  const cid = await ownCheckout(checkoutId, session.workspace.id, session.userId);
  await checkoutStep(cid, "returned", { provider: "polar", result });
}

/** After Polar's success message: has Polar's webhook started the trial or the plan yet? */
export async function checkoutState(): Promise<{ active: boolean }> {
  const session = await requireUser();
  const s = session.workspace.subscription_status;
  return { active: s === "trialing" || s === "active" || s === "test" };
}

export type KashierEmbed = { ok: true; url: string; paymentId: string } | { ok: false; error: string };

/**
 * Card payment through Kashier (D-235), inside this checkout page: the pending
 * payment and Kashier's Payment Session are created here; the page frames
 * Kashier's payment form. The plan starts only once Kashier confirms.
 */
export async function startKashierCheckout(plan: string, period: string, checkoutId: string | null = null): Promise<KashierEmbed> {
  const session = await requireUser();
  const t = await getDictionary();
  if (!canManageTeam(session)) return { ok: false, error: t.checkout.onlyAdmins };
  if (!isPaidPlan(plan) || !isBillingPeriod(period)) return { ok: false, error: t.checkout.errors.choosePlan };
  const ws = session.workspace;
  const locked = lockedProvider(ws);
  if (locked && locked !== "kashier") return { ok: false, error: t.checkout.errors.notConnected };
  if (!(await providerFor("kashier"))) return { ok: false, error: t.checkout.errors.notConnected };
  const cid = await ownCheckout(checkoutId, ws.id, session.userId);
  const track = { userId: session.userId, workspaceId: ws.id, provider: "kashier", plan, period };
  await checkoutStep(cid, "payment_started", track);
  const r = await startCheckout(ws, { userId: session.userId, email: session.email, name: session.profile.full_name, country: ws.billing_country ?? (await requestCountry()), language: await getLocale() }, { kind: "subscription", plan, period }, cid, "kashier");
  if (!r.ok) {
    await checkoutStep(cid, "payment_error", { ...track, reason: r.error });
    return providerError(r, t);
  }
  await checkoutStep(cid, "redirected", track);
  return { ok: true, url: r.url, paymentId: r.paymentId };
}

/** The embedded Kashier page reported back (or the page checks): what does Kashier say about this payment? */
export async function confirmCheckoutPayment(paymentId: string): Promise<{ status: "pending" | "succeeded" | "failed" | "unknown" }> {
  const session = await requireUser();
  if (!/^[0-9a-f-]{36}$/i.test(paymentId)) return { status: "unknown" };
  const p = await confirmKashierPayment(paymentId, session.workspace.id).catch(() => null);
  if (!p) return { status: "unknown" };
  if (p.status === "succeeded") revalidatePath("/", "layout");
  return { status: p.status === "succeeded" ? "succeeded" : p.status === "failed" ? "failed" : "pending" };
}
