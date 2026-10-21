"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { canManageTeam, requireUser } from "@/lib/session";
import { isBillingPeriod, isPaidPlan, offeredPlans, PERIOD_COOKIE, PLAN_COOKIE } from "@/lib/plans";
import { billingTestMode, planCharge, startPlan } from "@/lib/billing";
import { grantPack, providerFor, startCheckout, type CheckoutResult as ProviderResult } from "@/lib/payments";
import { getLocale } from "@/lib/i18n/server";
import { workspaceCurrency } from "@/lib/plan-catalog";
import { requestCountry } from "@/lib/geo-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDictionary } from "@/lib/i18n/server";
import type { Dictionary } from "@/lib/i18n/config";
import { switches } from "@/lib/switches";
import { checkoutStep, currentCheckout } from "@/lib/funnel";

export type CheckoutResult = { ok: false; error: string };

/** Paymob's page is opened in the browser. */
function goPay(r: Extract<ProviderResult, { ok: true }>): never {
  redirect(r.url);
}

function providerError(r: Exclude<ProviderResult, { ok: true }>, t: Dictionary): CheckoutResult {
  const e = t.checkout.errors;
  return { ok: false, error: r.error === "not_priced" ? e.notPriced : r.error === "not_connected" ? e.notConnected : e.paymentFailed };
}

// Puts the workspace on the chosen plan (owner brief 2026-10-12): paid plans
// only (no $0 plan). Paymob only (D-254): its hosted page, the first period
// paid up front, the plan starts when Paymob confirms; the card saved there
// pays the renewals. With Paymob not connected, billing test mode
// (local/dev) starts the plan as a test, never a pretend real charge.
export async function activatePlan(plan: string, period: string, method: string = "paymob", checkoutId: string | null = null): Promise<CheckoutResult> {
  const session = await requireUser();
  const t = await getDictionary();
  if (!canManageTeam(session)) return { ok: false, error: t.checkout.onlyAdmins };
  // New subscriptions: Pro or Growth, monthly only (D-247). Renewals of older plans go through payInvoice.
  if (!isPaidPlan(plan) || !offeredPlans.includes(plan) || period !== "monthly") return { ok: false, error: t.checkout.errors.choosePlan };
  if (method !== "paymob") return { ok: false, error: t.checkout.errors.chooseMethod };
  const payer = { userId: session.userId, email: session.email, name: session.profile.full_name };
  const ws = session.workspace;
  const route = "paymob";
  // Switched off in Admin: not even a stale page can use it (D-213).
  if (!billingTestMode() && !(await switches()).payments_paymob) return { ok: false, error: t.checkout.errors.notConnected };
  // Journey tracking (D-212): the member started paying.
  const cid = await ownCheckout(checkoutId, ws.id, session.userId);
  const track = { userId: session.userId, workspaceId: ws.id, provider: route, plan, period };
  await checkoutStep(cid, "payment_started", track);

  if (await providerFor()) {
    const r = await startCheckout(ws, { ...payer, country: ws.billing_country ?? (await requestCountry()), language: await getLocale() }, { kind: "subscription", plan, period }, cid);
    if (!r.ok) {
      await checkoutStep(cid, "payment_error", { ...track, reason: r.error });
      return providerError(r, t);
    }
    await checkoutStep(cid, "redirected", track);
    goPay(r);
  }
  if (!billingTestMode()) {
    await checkoutStep(cid, "payment_error", { ...track, reason: "not_connected" });
    return { ok: false, error: t.checkout.errors.notConnected };
  }
  // Test mode: the plan starts as a test (paid up front, no trial).
  const charge = await planCharge(ws, plan, period);
  if (!charge) return { ok: false, error: t.checkout.errors.notPriced };
  if ((await startPlan(ws, plan, period, payer, { mode: "test", ...charge })) === false) return { ok: false, error: t.checkout.errors.failed };

  const jar = await cookies();
  jar.delete(PLAN_COOKIE);
  jar.delete(PERIOD_COOKIE);
  revalidatePath("/", "layout");
  redirect(session.profile.onboarded_at ? "/" : "/onboarding");
}

export type PackResult = { ok: true; added: number; test: true } | { ok: false; error: string };

/** Buy More Prospects: provider checkout, or an immediate test grant in billing test mode. */
/** Pay As You Go top-up (D-247). Works with or without a subscription. */
export async function buyProspectPack(packId: string): Promise<PackResult> {
  const session = await requireUser();
  const t = await getDictionary();
  if (!canManageTeam(session)) return { ok: false, error: t.buyMore.onlyAdmins };
  if (!/^[0-9a-f-]{36}$/i.test(packId)) return { ok: false, error: t.checkout.errors.failed };
  if (!(await switches()).buy_more) return { ok: false, error: t.checkout.errors.notConnected };
  const ws = session.workspace;
  const currency = await workspaceCurrency(ws);
  const payer = { userId: session.userId, email: session.email, name: session.profile.full_name };

  if (await providerFor()) {
    const r = await startCheckout(ws, { ...payer, country: ws.billing_country ?? (await requestCountry()), language: await getLocale() }, { kind: "prospect_pack", packId }, null);
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
  }, null);
  if (!r.ok) return providerError(r, t);
  goPay(r);
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
    provider: input.method === "paymob" ? input.method : null,
    plan: isPaidPlan(input.plan) ? input.plan : null, period: isBillingPeriod(input.period) ? input.period : null,
  });
}

/** Has the plan started yet (the payment confirmed)? */
export async function checkoutState(): Promise<{ active: boolean }> {
  const session = await requireUser();
  const s = session.workspace.subscription_status;
  return { active: s === "trialing" || s === "active" || s === "test" };
}
