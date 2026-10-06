"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { canManageTeam, requireSession, requireUser } from "@/lib/session";
import { isBillingPeriod, isPaidPlan, isPlan, PERIOD_COOKIE, PLAN_COOKIE } from "@/lib/plans";
import { billingTestMode, planCharge, startPlan } from "@/lib/billing";
import { grantPack, providerFor, startCheckout, type CheckoutResult as ProviderResult } from "@/lib/payments";
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

// Puts the workspace on the chosen plan. Free needs no payment. A paid plan
// goes to the payment provider connected for the workspace's currency
// (lib/payments); the plan starts when the provider confirms the payment.
// With no provider, billing test mode (local/dev) activates it as a test
// charge — never a pretend real charge.
export async function activatePlan(plan: string, period: string): Promise<CheckoutResult> {
  const session = await requireUser();
  const t = await getDictionary();
  if (!canManageTeam(session)) return { ok: false, error: t.checkout.onlyAdmins };
  if (!isPlan(plan) || !isBillingPeriod(period)) return { ok: false, error: t.checkout.errors.choosePlan };
  const payer = { userId: session.userId, email: session.email, name: session.profile.full_name };

  if (isPaidPlan(plan)) {
    const ws = session.workspace;
    if (await providerFor(await workspaceCurrency(ws))) {
      const r = await startCheckout(ws, { ...payer, country: ws.billing_country ?? (await requestCountry()) }, { kind: "subscription", plan, period });
      if (!r.ok) return providerError(r, t);
      redirect(r.url);
    }
    if (!billingTestMode()) return { ok: false, error: t.checkout.errors.notConnected };
    const charge = await planCharge(ws, plan, period);
    if (!charge) return { ok: false, error: t.checkout.errors.notPriced };
    if ((await startPlan(ws, plan, period, payer, { mode: "test", ...charge })) === false) return { ok: false, error: t.checkout.errors.failed };
  } else if ((await startPlan(session.workspace, plan, period, payer)) === false) {
    return { ok: false, error: t.checkout.errors.failed };
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
  await grantPack(db, ws, pack.prospects, { mode: "test", amount: Number(price), currency }, payer);
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
