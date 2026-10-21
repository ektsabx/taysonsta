import "server-only";
import * as Sentry from "@sentry/nextjs";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { addMonths, planCharge, renewalEmails, startPlan } from "@/lib/billing";
import { getPlanCatalog, workspaceCurrency } from "@/lib/plan-catalog";
import { priceForEgp } from "@/lib/pricing-math";
import { notify, userRecipient, workspaceRecipients } from "@/lib/email/notify";
import { dictionaries, fmt } from "@/lib/i18n/config";
import { formatNumber } from "@/lib/format";
import type { BillingPeriod, BillingProvider, Currency, PaidPlan, PaymentRow, WorkspaceRow } from "@/types/database";
import { checkoutUrl, intentionBody, motoIntentionBody, outcomeFromTransaction, toMinor, type PaymobConfig } from "./paymob";
import { toEgp, usdToEgp } from "./fx";
import { resumeQuotaPaused } from "@/lib/discovery/campaign-control";
import { switches } from "@/lib/switches";
import { capture } from "@/lib/analytics/server";
import { affiliateNotify } from "@/lib/affiliates/notify";
import type { CheckoutRequest, PaymentOutcome } from "./types";

// Provider-agnostic billing (final spec phase 3). Flow:
//   1. startCheckout: price computed here from configuration (never from the
//      browser), a `pending` payment row, then the provider's hosted checkout.
//   2. The provider's signed callback (webhook, or the signed redirect back)
//      → settlePayment: amount + currency checked against the row, status
//      moved once (conditioned on `pending`), then fulfilment.
//   3. Fulfilment: start/renew the plan or grant the prospect pack, with a
//      paid invoice in the payment's currency.
// Provider secrets come from Vault (public.payment_secret), service role only.
// Money (D-142): prices and invoices are USD. Paymob's Egyptian card
// integration only accepts EGP, so the checkout converts the USD price at
// the day's rate (fx.ts) and the payment keeps both amounts
// (charge_amount / charge_currency / fx_rate). The site shows USD only.
// Gateway (owner 2026-10-21, D-254): Paymob only. Polar and Kashier were
// removed; Kashier's renewals from a saved card now run on Paymob: the card
// the customer saves at the first payment (Paymob's TOKEN callback) is
// charged for renewals through Paymob's MOTO integration (merchant-initiated).
// Without a saved card or a MOTO integration, a renewal is an open invoice the
// customer pays from the invoice page.
// Egypt (D-237): plans bought from Egypt are charged their EGP price.

type Db = ReturnType<typeof createAdminClient>;

export interface PaymobRuntime extends PaymobConfig {
  mode: "test" | "live";
}

/** Paymob settings + Vault secrets, or null when it isn't fully configured and enabled. */
export async function loadPaymob(db: Db = createAdminClient()): Promise<PaymobRuntime | null> {
  const { data: row } = await db.from("payment_providers").select("*").eq("id", "paymob").maybeSingle();
  if (!row?.enabled) return null;
  const cfg = (row.config ?? {}) as { base_url?: string; public_key?: string; integrations?: Partial<Record<"USD" | "EGP", number[]>>; moto_integration?: number | null };
  const [{ data: secretKey }, { data: hmacSecret }] = await Promise.all([
    db.rpc("payment_secret", { p_provider: "paymob", p_name: "secret_key" }),
    db.rpc("payment_secret", { p_provider: "paymob", p_name: "hmac_secret" }),
  ]);
  if (!secretKey || !hmacSecret || !cfg.public_key) return null;
  return {
    mode: row.mode,
    baseUrl: cfg.base_url || "https://accept.paymob.com",
    publicKey: cfg.public_key,
    secretKey,
    hmacSecret,
    // The card integration ids (Admin hub → Paymob). The integration charges EGP.
    integrations: { EGP: cfg.integrations?.EGP?.length ? cfg.integrations.EGP : (cfg.integrations?.USD ?? []) },
    // Renewals from a saved card: Paymob's MOTO integration (asked from Paymob support).
    motoIntegration: Number(cfg.moto_integration) > 0 ? Number(cfg.moto_integration) : null,
  };
}

export type Gateway = { id: "paymob"; mode: "test" | "live"; paymob: PaymobRuntime };

/**
 * A gateway that can take new payments right now: connected in Admin →
 * Integrations and not switched off in Admin → Switches (D-213). Callbacks of
 * a gateway switched off still settle payments already started.
 */
export async function providerFor(): Promise<Gateway | null> {
  const on = await switches();
  if (!on.payments_paymob) return null;
  const p = await loadPaymob();
  return p && (p.integrations.EGP?.length ?? 0) > 0 ? { id: "paymob", mode: p.mode, paymob: p } : null;
}

/** Who bills this workspace: Paymob, the only gateway (D-254). */
export async function billingRoute(ws: WorkspaceRow): Promise<BillingProvider> {
  void ws;
  return "paymob";
}

/** Whether Paymob can take payments right now (connected and not switched off in Admin, D-213). Once per request (D-242). */
export const paymentMethods = cache(async function paymentMethods(): Promise<{ paymob: boolean }> {
  return { paymob: Boolean(await providerFor()) };
});

/**
 * The free trial's length when new visitors can start one, else null. The
 * trial came only with Polar (D-235), removed with it (D-254), and there is no
 * free trial (D-246), so public pages never promise one.
 */
export const trialAvailable = cache(async function trialAvailable(): Promise<number | null> {
  return null;
});

export async function paymentsConnected(ws: WorkspaceRow): Promise<boolean> {
  void ws;
  return (await paymentMethods()).paymob;
}

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3200").replace(/\/$/, "");
}

export type CheckoutTarget =
  | { kind: "subscription"; plan: PaidPlan; period: BillingPeriod; invoiceId?: string }
  | { kind: "prospect_pack"; packId: string };

/** `url`: Paymob's hosted page (the browser goes there). `paymentId` lets the page confirm it. */
export type CheckoutResult = { ok: true; url: string; paymentId: string } | { ok: false; error: "not_connected" | "not_priced" | "not_found" | "failed" };

interface Buyer {
  userId: string;
  email: string;
  name: string | null;
  country: string | null;
  language?: "ar" | "en";
}

/** Egypt pays its own EGP prices (owner, 2026-10-19, D-237): the workspace's billing country, else where the buyer is. */
export function paysInEgp(ws: Pick<WorkspaceRow, "billing_country">, country: string | null): boolean {
  return (ws.billing_country ?? country ?? "").toUpperCase() === "EG";
}

/**
 * What Paymob charges for this purchase, in EGP: a plan bought from Egypt uses
 * its EGP price (Admin → Pricing), anything else the USD price at the day's rate (D-142).
 */
async function chargeFor(db: Db, ws: WorkspaceRow, buyer: Buyer, row: Partial<PaymentRow> & { amount: number }): Promise<{ charge: number; currency: "USD" | "EGP"; rate: number | null } | null> {
  if (row.kind === "subscription" && row.plan && row.billing_period && paysInEgp(ws, buyer.country)) {
    const egp = await egpPlanPrice(row.plan as PaidPlan, row.billing_period);
    if (egp) return { charge: egp, currency: "EGP", rate: row.amount > 0 ? Math.round((egp / row.amount) * 10_000) / 10_000 : null };
  }
  const rate = await usdToEgp(db);
  return rate ? { charge: toEgp(row.amount, rate), currency: "EGP", rate } : null;
}

/** A plan's EGP charge for one period, or null when no EGP price is set. */
export async function egpPlanPrice(plan: PaidPlan, period: BillingPeriod): Promise<number | null> {
  const monthly = (await getPlanCatalog())[plan]?.priceEgp;
  return monthly ? priceForEgp(monthly, period) : null;
}

/** Creates the pending payment and returns where the customer pays. */
export async function startCheckout(ws: WorkspaceRow, buyer: Buyer, target: CheckoutTarget, checkoutId: string | null = null): Promise<CheckoutResult> {
  const db = createAdminClient();
  const currency = await workspaceCurrency(ws);
  const gw = await providerFor();
  if (!gw) return { ok: false, error: "not_connected" };

  // What is bought and its price — always from configuration on the server.
  let row: Partial<PaymentRow> & { amount: number; kind: PaymentRow["kind"] };
  let description: string;
  const t = dictionaries.en;
  if (target.kind === "subscription") {
    if (target.invoiceId) {
      const { data: inv } = await db.from("invoices").select("*").eq("id", target.invoiceId).eq("workspace_id", ws.id).eq("status", "open").maybeSingle();
      if (!inv || !inv.plan || !inv.billing_period) return { ok: false, error: "not_found" };
      row = { kind: "subscription", plan: inv.plan, billing_period: inv.billing_period, amount: Number(inv.amount), invoice_id: inv.id };
      if (inv.currency !== currency) return { ok: false, error: "not_priced" };
    } else {
      const charge = await planCharge(ws, target.plan, target.period);
      if (!charge) return { ok: false, error: "not_priced" };
      row = { kind: "subscription", plan: target.plan, billing_period: target.period, amount: charge.amount };
    }
    description = `${t.plans[row.plan!]} · ${row.billing_period === "annual" ? t.plans.annual : t.plans.monthly}`;
  } else {
    const { data: pack } = await db.from("prospect_packs").select("*").eq("id", target.packId).eq("active", true).maybeSingle();
    if (!pack) return { ok: false, error: "not_found" };
    row = { kind: "prospect_pack", pack_id: pack.id, prospects: pack.prospects, amount: Number(pack.price_usd) };
    description = fmt(t.buyMore.packName, { count: formatNumber(pack.prospects) });
  }

  // A second click, or coming back from the provider's page, reuses the
  // checkout opened minutes ago for the same purchase instead of a new one.
  const reuse = await reusableCheckout(db, ws.id, buyer.userId, gw, row);
  if (reuse) return { ok: true, url: reuse.url, paymentId: reuse.id };

  const priced = await chargeFor(db, ws, buyer, row);
  if (!priced) return { ok: false, error: "not_priced" };
  const { data: payment, error } = await db.from("payments").insert({
    ...row, workspace_id: ws.id, currency, provider: gw.id, mode: gw.mode, created_by: buyer.userId,
    charge_amount: priced.charge, charge_currency: priced.currency, fx_rate: priced.rate, checkout_id: target.kind === "subscription" ? checkoutId : null,
  }).select("*").single();
  if (error || !payment) return { ok: false, error: "failed" };

  try {
    const req: CheckoutRequest = {
      paymentId: payment.id,
      amount: priced.charge,
      currency: "EGP",
      description,
      customer: { email: buyer.email, name: buyer.name, country: buyer.country },
      returnUrl: `${siteUrl()}/api/payments/paymob/return`,
      notifyUrl: `${siteUrl()}/api/payments/paymob`,
    };
    const res = await fetch(new URL("/v1/intention/", gw.paymob.baseUrl), {
      method: "POST",
      headers: { Authorization: `Token ${gw.paymob.secretKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(intentionBody(req, gw.paymob)),
      signal: AbortSignal.timeout(15_000),
    });
    const body = (await res.json().catch(() => null)) as { client_secret?: string; intention_order_id?: number; id?: string } | null;
    if (!res.ok || !body?.client_secret) throw new Error(`paymob intention ${res.status}`);
    const url = checkoutUrl(gw.paymob.baseUrl, gw.paymob.publicKey, body.client_secret);
    // Paymob's order id: its card-token callback names it, which ties a saved card to this workspace.
    const ref = String(body.intention_order_id ?? body.id ?? "") || null;
    await db.from("payments").update({ provider_ref: ref, checkout_url: url }).eq("id", payment.id);
    await capture(buyer.userId, "checkout_started", { workspace_id: ws.id, payment_id: payment.id, kind: row.kind, plan: row.plan ?? null, billing_period: row.billing_period ?? null, prospects: row.prospects ?? null, value: row.amount, currency: "USD", mode: gw.mode, provider: gw.id });
    return { ok: true, url, paymentId: payment.id };
  } catch (e) {
    console.error("[payments] checkout", e instanceof Error ? e.message : e);
    // Ids, kind and mode only: never the buyer, the amount sent or provider secrets.
    Sentry.captureException(e, { tags: { area: "checkout", provider: gw.id, mode: gw.mode, kind: row.kind }, extra: { payment_id: payment.id, workspace_id: ws.id } });
    await db.from("payments").update({ status: "failed", failure_reason: "checkout_failed" }).eq("id", payment.id);
    return { ok: false, error: "failed" };
  }
}

/** Minutes a hosted checkout link is reused for the same purchase. */
const REUSE_MINUTES = 10;

async function reusableCheckout(db: Db, workspaceId: string, userId: string, gw: Gateway, row: Partial<PaymentRow> & { amount: number; kind: PaymentRow["kind"] }): Promise<{ url: string; id: string } | null> {
  const since = new Date(Date.now() - REUSE_MINUTES * 60_000).toISOString();
  let q = db.from("payments").select("id, checkout_url, amount, plan, billing_period, pack_id, invoice_id")
    .eq("workspace_id", workspaceId).eq("created_by", userId).eq("status", "pending").eq("mode", gw.mode).eq("kind", row.kind).eq("provider", gw.id)
    .not("checkout_url", "is", null).gte("created_at", since).order("created_at", { ascending: false }).limit(1);
  if (row.kind === "subscription") q = q.eq("plan", row.plan!).eq("billing_period", row.billing_period!);
  else q = q.eq("pack_id", row.pack_id!);
  const { data } = await q.maybeSingle();
  if (!data?.checkout_url || Number(data.amount) !== row.amount || (data.invoice_id ?? null) !== (row.invoice_id ?? null)) return null;
  return { url: data.checkout_url, id: data.id };
}

/**
 * Applies a verified provider outcome. Idempotent: the status moves only from
 * `pending` (or `succeeded` → `refunded`), so repeated callbacks are no-ops.
 * Returns the payment (or null if it isn't ours / doesn't match).
 */
export async function settlePayment(provider: "paymob", o: PaymentOutcome): Promise<PaymentRow | null> {
  const db = createAdminClient();
  let payment: PaymentRow | null = null;
  if (o.merchantRef && /^[0-9a-f-]{36}$/i.test(o.merchantRef)) {
    payment = (await db.from("payments").select("*").eq("id", o.merchantRef).eq("provider", provider).maybeSingle()).data;
  }
  if (!payment && o.providerRef) {
    payment = (await db.from("payments").select("*").eq("provider", provider).eq("provider_ref", o.providerRef).maybeSingle()).data;
  }
  if (!payment) return null;
  // Never trust a callback that doesn't match what we asked the provider to charge.
  const charged = { amount: Number(payment.charge_amount ?? payment.amount), currency: payment.charge_currency ?? payment.currency };
  if (o.amountMinor !== toMinor(charged.amount) || o.currency.toUpperCase() !== charged.currency) {
    console.error("[payments] amount/currency mismatch", payment.id);
    return payment;
  }

  if (o.status === "refunded") {
    if (payment.status !== "succeeded") return payment;
    const { data: moved } = await db.from("payments").update({ status: "refunded" }).eq("id", payment.id).eq("status", "succeeded").select("*").maybeSingle();
    if (moved) await refunded(db, moved);
    return moved ?? payment;
  }
  // Paid earlier but the fulfilment didn't finish (e.g. a crash): a repeated
  // signed callback finishes it. Never charges anything again.
  if (payment.status === "succeeded" && o.status === "succeeded" && !payment.fulfilled_at) {
    await fulfilOnce(db, payment);
    return payment;
  }
  if (payment.status !== "pending" || o.status === "pending") return payment;

  const now = new Date().toISOString();
  const next = o.status === "succeeded"
    ? { status: "succeeded" as const, paid_at: now, provider_txn: o.providerTxn || null, checkout_url: null, fulfil_claimed_at: now }
    : { status: "failed" as const, failure_reason: o.reason?.slice(0, 200) ?? "declined", provider_txn: o.providerTxn || null, checkout_url: null };
  const { data: moved } = await db.from("payments").update(next).eq("id", payment.id).eq("status", "pending").select("*").maybeSingle();
  if (!moved) return payment;
  await capture(moved.created_by, moved.status === "succeeded" ? "payment_succeeded" : "payment_failed", {
    workspace_id: moved.workspace_id, payment_id: moved.id, kind: moved.kind, plan: moved.plan, billing_period: moved.billing_period,
    prospects: moved.prospects, value: Number(moved.amount), currency: moved.currency, mode: moved.mode,
  });
  if (moved.status === "succeeded") {
    await fulfilOnce(db, moved, true);
  } else await failed(db, moved);
  return moved;
}

/** A claim older than this is considered abandoned (the process died mid-fulfilment). */
const CLAIM_MS = 5 * 60_000;

/**
 * Runs fulfil() for a succeeded payment at most once at a time, and marks it
 * done. `claimed`: the caller already took the claim with the status move.
 * Throws if fulfilment fails, so the callback answers with an error and the
 * provider (or the customer's return) retries.
 */
async function fulfilOnce(db: Db, p: PaymentRow, claimed = false): Promise<void> {
  if (!claimed) {
    const stale = new Date(Date.now() - CLAIM_MS).toISOString();
    const { data: got } = await db.from("payments").update({ fulfil_claimed_at: new Date().toISOString() })
      .eq("id", p.id).eq("status", "succeeded").is("fulfilled_at", null)
      .or(`fulfil_claimed_at.is.null,fulfil_claimed_at.lt.${stale}`).select("id").maybeSingle();
    if (!got) return;
  }
  try {
    await fulfil(db, p);
    await db.from("payments").update({ fulfilled_at: new Date().toISOString() }).eq("id", p.id);
  } catch (e) {
    console.error("[payments] fulfil", p.id, e);
    Sentry.captureException(e, { tags: { area: "payment_fulfil", provider: p.provider, mode: p.mode, kind: p.kind }, extra: { payment_id: p.id, workspace_id: p.workspace_id } });
    // Release the claim so the next callback can retry right away.
    await db.from("payments").update({ fulfil_claimed_at: null }).eq("id", p.id).is("fulfilled_at", null);
    throw e;
  }
}

/**
 * Plan started / renewed, or prospects granted for a succeeded payment.
 * Safe to run again after a partial run: work already recorded for this
 * payment (its invoice, its pack grant) is not repeated.
 */
export async function fulfil(db: Db, p: PaymentRow): Promise<void> {
  const { data: ws } = await db.from("workspaces").select("*").eq("id", p.workspace_id).maybeSingle();
  if (!ws) return;
  if (!p.invoice_id) {
    // A previous run got as far as the invoice: the plan / pack is in place.
    const { data: done } = await db.from("invoices").select("id").eq("payment_id", p.id).limit(1).maybeSingle();
    if (done) {
      await db.from("payments").update({ invoice_id: done.id }).eq("id", p.id);
      return;
    }
  }
  const payer = await payerOf(db, p);
  const charge = { mode: p.mode, amount: Number(p.amount), currency: p.currency, paymentId: p.id, provider: "paymob" as const };

  if (p.kind === "subscription" && p.invoice_id) {
    // Paying an open renewal invoice: the period it covers starts.
    const { data: inv } = await db.from("invoices").update({ status: "paid", payment_id: p.id }).eq("id", p.invoice_id).eq("status", "open").select("*").maybeSingle();
    if (!inv) return;
    await db.from("workspaces").update({ subscription_status: "active", current_period_end: inv.period_end, cancel_at_period_end: false }).eq("id", ws.id);
    await db.from("subscription_events").insert({ workspace_id: ws.id, plan: ws.plan, status: "renewed", amount: charge.amount, currency: charge.currency, billing_period: inv.billing_period ?? ws.billing_period, mode: p.mode, created_by: p.created_by });
    await renewalEmails(ws.id, payer.userId, inv.plan!, inv.billing_period!, { amount: charge.amount, currency: charge.currency, test: p.mode === "test" }, inv.period_end, inv);
    return;
  }
  if (p.kind === "subscription") {
    const invoiceId = await startPlan(ws, p.plan!, p.billing_period!, payer, charge);
    if (invoiceId) await db.from("payments").update({ invoice_id: invoiceId }).eq("id", p.id);
    return;
  }
  // The pack's emails come with its prospects (D-203).
  const { data: pack } = p.pack_id ? await db.from("prospect_packs").select("emails").eq("id", p.pack_id).maybeSingle() : { data: null };
  await grantPack(db, ws, p.prospects!, pack?.emails ?? 0, charge, payer);
}

/** A top-up (Pay As You Go credit, D-247): prospects that never expire + a paid invoice + confirmation emails. */
export async function grantPack(db: Db, ws: WorkspaceRow, prospects: number, emails: number, charge: { mode: "test" | "live"; amount: number; currency: Currency; paymentId?: string | null }, payer: { userId: string | null; email: string; name: string | null }) {
  const now = new Date();
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const periodEnd = addMonths(periodStart, 1);
  const { error } = await db.from("usage_ledger").insert({
    workspace_id: ws.id, kind: "grant", prospects, emails, period_start: periodStart.toISOString().slice(0, 10),
    reason: `prospect_pack:${charge.paymentId ?? "test"}`, created_by: payer.email,
  });
  // 23505: this payment's grant already exists (a retried fulfilment): never grant twice.
  if (error && !(charge.paymentId && error.code === "23505")) throw error;
  // Pay As You Go (D-247): the first top-up opens Yolias without a subscription. It never starts one.
  await db.from("workspaces").update({ credit_started_at: now.toISOString() }).eq("id", ws.id).is("credit_started_at", null);
  const { data: invoice } = await db.from("invoices").insert({
    workspace_id: ws.id, kind: "prospect_pack", prospects, amount: charge.amount, currency: charge.currency, status: "paid", mode: charge.mode,
    period_start: now.toISOString(), period_end: periodEnd.toISOString(), bill_to_name: payer.name, bill_to_email: payer.email, bill_to_company: ws.name,
    payment_id: charge.paymentId ?? null,
  }).select("id, number, created_at").single();
  if (charge.paymentId && invoice) await db.from("payments").update({ invoice_id: invoice.id }).eq("id", charge.paymentId);

  await resumeQuotaPaused(db, ws.id);
  await capture(payer.userId, "prospects_pack_bought", { workspace_id: ws.id, prospects, value: charge.amount, currency: charge.currency, mode: charge.mode });
  const { data: usage } = await db.rpc("usage_summary", { p_ws: ws.id });
  const allowance = usage?.[0]?.allowance ?? 0;
  const label = (l: "en" | "ar") => fmt(dictionaries[l].buyMore.packName, { count: formatNumber(prospects, l) });
  await notify("prospects_added", await workspaceRecipients(ws.id), (l) => ({ added: prospects, allowance, reason: label(l) }), { workspaceId: ws.id, dedupe: invoice?.id });
  if (invoice && payer.userId) {
    await notify("receipt", await userRecipient(payer.userId), (l) => ({
      invoiceId: invoice.id, invoiceNumber: invoice.number, planName: label(l), period: "monthly" as const, amount: charge.amount, currency: charge.currency,
      date: invoice.created_at, periodEnd: periodEnd.toISOString(), test: charge.mode === "test",
    }), { workspaceId: ws.id, dedupe: invoice.id });
  }
  return invoice?.id ?? null;
}

async function payerOf(db: Db, p: PaymentRow) {
  const { data: prof } = p.created_by ? await db.from("profiles").select("email, full_name").eq("id", p.created_by).maybeSingle() : { data: null };
  return { userId: p.created_by ?? "", email: prof?.email ?? "", name: prof?.full_name ?? null };
}

async function failed(db: Db, p: PaymentRow) {
  const payer = await payerOf(db, p);
  if (!payer.userId) return;
  const what = (l: "en" | "ar") => (p.kind === "subscription" ? dictionaries[l].plans[p.plan!] : fmt(dictionaries[l].buyMore.packName, { count: formatNumber(p.prospects!, l) }));
  await notify("payment_failed", await userRecipient(payer.userId), (l) => ({ planName: what(l), amount: Number(p.amount), currency: p.currency, reason: p.failure_reason, retryAt: null }), { workspaceId: p.workspace_id, dedupe: p.id });
}

async function refunded(db: Db, p: PaymentRow) {
  // The database already reversed this payment's affiliate commission (trigger
  // payments_affiliate); tell the affiliate. Never blocks the refund.
  const { data: commission } = await db.from("affiliate_commissions").select("id, affiliate_id, amount_cents, status").eq("payment_id", p.id).eq("kind", "payment").maybeSingle();
  if (commission?.status === "reversed") {
    await affiliateNotify(commission.affiliate_id, "commission_reversed", commission.id, { amountCents: Number(commission.amount_cents), reason: "Payment refunded" }).catch(() => 0);
  }
  if (!p.invoice_id) return;
  const { data: inv } = await db.from("invoices").update({ status: "void" }).eq("id", p.invoice_id).select("number").maybeSingle();
  if (inv) {
    await notify("refund_processed", await workspaceRecipients(p.workspace_id), { invoiceNumber: inv.number, amount: Number(p.amount), currency: p.currency, reason: null }, { workspaceId: p.workspace_id, dedupe: `refund:${p.id}` });
  }
}


// ── Saved cards and renewals (Paymob, D-254; was Kashier, D-235) ───────────

/** The workspace a Paymob order belongs to (the payment that opened it). */
async function workspaceOfOrder(db: Db, orderId: string): Promise<string | null> {
  const { data } = await db.from("payments").select("workspace_id").eq("provider", "paymob").eq("provider_ref", orderId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return data?.workspace_id ?? null;
}

/**
 * Saves the card the customer chose to keep at a Paymob payment (the verified
 * TOKEN callback). The token goes to Vault; members see brand, last 4 and nothing else.
 */
export async function rememberPaymobCard(card: { token: string; orderId: string; maskedPan: string | null; brand: string | null }): Promise<boolean> {
  const db = createAdminClient();
  const workspaceId = await workspaceOfOrder(db, card.orderId);
  if (!workspaceId) return false;
  const last4 = (card.maskedPan ?? "").replace(/\D/g, "").slice(-4);
  const { data: row, error } = await db.from("billing_cards").upsert({
    workspace_id: workspaceId, provider: "paymob", customer_reference: `ws_${workspaceId.replace(/-/g, "").slice(0, 24)}`,
    brand: card.brand?.slice(0, 40) ?? null, last4: /^[0-9]{4}$/.test(last4) ? last4 : null, status: "active",
  }, { onConflict: "workspace_id,provider" }).select("id").single();
  if (error || !row) return false;
  const { error: e2 } = await db.rpc("set_card_token", { p_card: row.id, p_token: card.token });
  return !e2;
}

export type RenewalResult = "charged" | "declined" | "no_card" | "not_connected" | "error";

/**
 * Charges the saved card for an open renewal invoice through Paymob's MOTO
 * integration. The payment row is created first (pending), so the callback and
 * this call settle the same row once; a declined card leaves the invoice open
 * (the member pays from the invoice page, the grace period applies).
 */
export async function chargeRenewal(ws: WorkspaceRow, invoiceId: string): Promise<RenewalResult> {
  const db = createAdminClient();
  const gw = await providerFor();
  const moto = gw?.paymob.motoIntegration;
  if (!gw || !moto) return "not_connected";
  const p = gw.paymob;
  const { data: card } = await db.from("billing_cards").select("id").eq("workspace_id", ws.id).eq("provider", "paymob").eq("status", "active").maybeSingle();
  const { data: token } = card ? await db.rpc("card_token", { p_card: card.id }) : { data: null };
  if (!card || !token) return "no_card";
  const { data: inv } = await db.from("invoices").select("*").eq("id", invoiceId).eq("workspace_id", ws.id).eq("status", "open").maybeSingle();
  if (!inv || !inv.plan || !inv.billing_period) return "error";
  // One automatic attempt a day per invoice.
  const { count } = await db.from("payments").select("id", { count: "exact", head: true }).eq("invoice_id", inv.id).eq("provider", "paymob").gte("created_at", new Date(Date.now() - 20 * 3_600_000).toISOString());
  if ((count ?? 0) > 0) return "declined";
  const rate = await usdToEgp(db);
  if (!rate) return "error";
  const charge = toEgp(Number(inv.amount), rate);
  const { data: owner } = await db.from("workspace_members").select("user_id").eq("workspace_id", ws.id).eq("role", "owner").limit(1).maybeSingle();
  const { data: prof } = owner ? await db.from("profiles").select("email, full_name").eq("id", owner.user_id).maybeSingle() : { data: null };
  const { data: payment } = await db.from("payments").insert({
    workspace_id: ws.id, kind: "subscription", plan: inv.plan, billing_period: inv.billing_period, amount: Number(inv.amount), currency: inv.currency,
    invoice_id: inv.id, provider: "paymob", mode: gw.mode, created_by: owner?.user_id ?? null, charge_amount: charge, charge_currency: "EGP", fx_rate: rate,
  }).select("*").single();
  if (!payment) return "error";
  try {
    // 1) An intention on the MOTO integration (merchant-initiated, no customer, no 3-D Secure).
    const intent = await fetch(new URL("/v1/intention/", p.baseUrl), {
      method: "POST",
      headers: { Authorization: `Token ${p.secretKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(motoIntentionBody({
        paymentId: payment.id, amount: charge, currency: "EGP", description: `Yolias ${inv.plan} renewal`,
        customer: { email: prof?.email ?? "", name: prof?.full_name ?? null, country: "EG" },
        returnUrl: `${siteUrl()}/api/payments/paymob/return`, notifyUrl: `${siteUrl()}/api/payments/paymob`,
      }, moto)),
      signal: AbortSignal.timeout(15_000),
    });
    const ib = (await intent.json().catch(() => null)) as { payment_keys?: { key?: string }[]; intention_order_id?: number } | null;
    const key = ib?.payment_keys?.[0]?.key;
    if (!intent.ok || !key) throw new Error(`paymob moto intention ${intent.status}`);
    await db.from("payments").update({ provider_ref: ib?.intention_order_id ? String(ib.intention_order_id) : null }).eq("id", payment.id);
    // 2) Pay with the saved card token.
    const pay = await fetch(new URL("/api/acceptance/payments/pay", p.baseUrl), {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: { identifier: token, subtype: "TOKEN" }, payment_token: key }),
      signal: AbortSignal.timeout(20_000),
    });
    const txn = (await pay.json().catch(() => null)) as Record<string, unknown> | null;
    if (!txn) throw new Error(`paymob token pay ${pay.status}`);
    const o = outcomeFromTransaction(txn);
    await settlePayment("paymob", { ...o, merchantRef: payment.id });
    return o.status === "succeeded" ? "charged" : "declined";
  } catch (e) {
    console.error("[payments] renewal", e instanceof Error ? e.message : e);
    await db.from("payments").update({ status: "failed", failure_reason: "renewal_error" }).eq("id", payment.id).eq("status", "pending");
    return "error";
  }
}
