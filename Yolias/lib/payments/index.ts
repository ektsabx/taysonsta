import "server-only";
import * as Sentry from "@sentry/nextjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { addMonths, planCharge, renewalEmails, startPlan } from "@/lib/billing";
import { workspaceCurrency } from "@/lib/plan-catalog";
import { notify, userRecipient, workspaceRecipients } from "@/lib/email/notify";
import { dictionaries, fmt } from "@/lib/i18n/config";
import { formatNumber } from "@/lib/format";
import type { BillingPeriod, BillingProvider, Currency, PaidPlan, PaymentRow, WorkspaceRow } from "@/types/database";
import { ensurePolarProducts } from "./polar-products";
import { loadPolar } from "./polar";
import { checkoutUrl, intentionBody, toMinor, type PaymobConfig } from "./paymob";
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

type Db = ReturnType<typeof createAdminClient>;

export interface PaymobRuntime extends PaymobConfig {
  mode: "test" | "live";
}

/** Paymob settings + Vault secrets, or null when it isn't fully configured and enabled. */
export async function loadPaymob(db: Db = createAdminClient()): Promise<PaymobRuntime | null> {
  const { data: row } = await db.from("payment_providers").select("*").eq("id", "paymob").maybeSingle();
  if (!row?.enabled) return null;
  const cfg = (row.config ?? {}) as { base_url?: string; public_key?: string; integrations?: Partial<Record<"USD" | "EGP", number[]>> };
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
  };
}

/** A provider that can take this workspace's (USD) prices right now: Paymob, charging EGP cards. */
export async function providerFor(currency: Currency): Promise<PaymobRuntime | null> {
  void currency; // every price is USD (D-131); Paymob charges its EGP equivalent
  // Switched off in Admin → Switches (D-213): no new Paymob checkouts. Its
  // callbacks still settle payments already started (loadPaymob).
  if (!(await switches()).payments_paymob) return null;
  const paymob = await loadPaymob();
  return paymob && (paymob.integrations.EGP?.length ?? 0) > 0 ? paymob : null;
}

/**
 * Who bills this workspace. The customer picks the payment method on the
 * checkout page (owner decision 2026-10-13, D-209): an international card →
 * Polar, a card from Egypt → Paymob — never by country or IP. A workspace
 * already billed by one keeps it; before the first payment Polar is shown.
 */
export async function billingRoute(ws: WorkspaceRow): Promise<BillingProvider> {
  return ws.billing_provider ?? "polar";
}

/** The provider of a running subscription (trial or paid), which the checkout can't switch. */
export function lockedProvider(ws: WorkspaceRow): BillingProvider | null {
  if (!ws.billing_provider) return null;
  if (ws.billing_provider === "polar") return ws.polar_subscription_id ? "polar" : null;
  return ws.subscription_status === "active" ? "paymob" : null;
}

/** Which payment methods are connected right now (and not switched off in Admin, D-213). */
export async function paymentMethods(): Promise<Record<BillingProvider, boolean>> {
  const on = await switches();
  const polar = on.payments_polar ? await loadPolar() : null;
  const [polarReady, paymob] = await Promise.all([
    polar ? ensurePolarProducts(polar).then((r) => Object.keys(r.cfg.products).length > 0) : Promise.resolve(false),
    providerFor("USD"),
  ]);
  return { polar: polarReady, paymob: Boolean(paymob) };
}

export async function paymentsConnected(ws: WorkspaceRow): Promise<boolean> {
  const m = await paymentMethods();
  const locked = lockedProvider(ws);
  return locked ? m[locked] : m.polar || m.paymob;
}

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3200").replace(/\/$/, "");
}

export type CheckoutTarget =
  | { kind: "subscription"; plan: PaidPlan; period: BillingPeriod; invoiceId?: string }
  | { kind: "prospect_pack"; packId: string };

export type CheckoutResult = { ok: true; url: string } | { ok: false; error: "not_connected" | "not_priced" | "not_found" | "failed" };

interface Buyer {
  userId: string;
  email: string;
  name: string | null;
  country: string | null;
}

/** Creates the pending payment and returns the provider's checkout URL. */
export async function startCheckout(ws: WorkspaceRow, buyer: Buyer, target: CheckoutTarget, checkoutId: string | null = null): Promise<CheckoutResult> {
  const db = createAdminClient();
  const currency = await workspaceCurrency(ws);
  const provider = await providerFor(currency);
  if (!provider) return { ok: false, error: "not_connected" };

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
    description = `${t.plans[row.plan!]} — ${row.billing_period === "annual" ? t.plans.annual : t.plans.monthly}`;
  } else {
    const { data: pack } = await db.from("prospect_packs").select("*").eq("id", target.packId).eq("active", true).maybeSingle();
    if (!pack) return { ok: false, error: "not_found" };
    row = { kind: "prospect_pack", pack_id: pack.id, prospects: pack.prospects, amount: Number(pack.price_usd) };
    description = fmt(t.buyMore.packName, { count: formatNumber(pack.prospects) });
  }

  // A second click, or coming back from the provider's page, reuses the
  // checkout opened minutes ago for the same purchase instead of a new one.
  const reuse = await reusableCheckout(db, ws.id, buyer.userId, provider.mode, row);
  if (reuse) return { ok: true, url: reuse };

  const rate = await usdToEgp(db);
  if (!rate) return { ok: false, error: "not_priced" };
  const charge = toEgp(row.amount, rate);
  const { data: payment, error } = await db.from("payments").insert({
    ...row, workspace_id: ws.id, currency, provider: "paymob", mode: provider.mode, created_by: buyer.userId,
    charge_amount: charge, charge_currency: "EGP", fx_rate: rate, checkout_id: target.kind === "subscription" ? checkoutId : null,
  }).select("*").single();
  if (error || !payment) return { ok: false, error: "failed" };

  const req: CheckoutRequest = {
    paymentId: payment.id,
    amount: charge,
    currency: "EGP",
    description,
    customer: { email: buyer.email, name: buyer.name, country: buyer.country },
    returnUrl: `${siteUrl()}/api/payments/paymob/return`,
    notifyUrl: `${siteUrl()}/api/payments/paymob`,
  };
  try {
    const res = await fetch(new URL("/v1/intention/", provider.baseUrl), {
      method: "POST",
      headers: { Authorization: `Token ${provider.secretKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(intentionBody(req, provider)),
      signal: AbortSignal.timeout(15_000),
    });
    const body = (await res.json().catch(() => null)) as { client_secret?: string; intention_order_id?: number; id?: string } | null;
    if (!res.ok || !body?.client_secret) throw new Error(`paymob intention ${res.status}`);
    const url = checkoutUrl(provider.baseUrl, provider.publicKey, body.client_secret);
    await db.from("payments").update({ provider_ref: String(body.intention_order_id ?? body.id ?? "") || null, checkout_url: url }).eq("id", payment.id);
    await capture(buyer.userId, "checkout_started", { workspace_id: ws.id, payment_id: payment.id, kind: row.kind, plan: row.plan ?? null, billing_period: row.billing_period ?? null, prospects: row.prospects ?? null, value: row.amount, currency: "USD", mode: provider.mode });
    return { ok: true, url };
  } catch (e) {
    console.error("[payments] checkout", e);
    // Ids, kind and mode only: never the buyer, the amount sent or provider secrets.
    Sentry.captureException(e, { tags: { area: "checkout", provider: "paymob", mode: provider.mode, kind: row.kind }, extra: { payment_id: payment.id, workspace_id: ws.id } });
    await db.from("payments").update({ status: "failed", failure_reason: "checkout_failed" }).eq("id", payment.id);
    return { ok: false, error: "failed" };
  }
}

/** Minutes a hosted checkout link is reused for the same purchase. */
const REUSE_MINUTES = 10;

async function reusableCheckout(db: Db, workspaceId: string, userId: string, mode: "test" | "live", row: Partial<PaymentRow> & { amount: number; kind: PaymentRow["kind"] }): Promise<string | null> {
  const since = new Date(Date.now() - REUSE_MINUTES * 60_000).toISOString();
  let q = db.from("payments").select("checkout_url, amount, plan, billing_period, pack_id, invoice_id")
    .eq("workspace_id", workspaceId).eq("created_by", userId).eq("status", "pending").eq("mode", mode).eq("kind", row.kind)
    .not("checkout_url", "is", null).gte("created_at", since).order("created_at", { ascending: false }).limit(1);
  if (row.kind === "subscription") q = q.eq("plan", row.plan!).eq("billing_period", row.billing_period!);
  else q = q.eq("pack_id", row.pack_id!);
  const { data } = await q.maybeSingle();
  if (!data?.checkout_url || Number(data.amount) !== row.amount || (data.invoice_id ?? null) !== (row.invoice_id ?? null)) return null;
  return data.checkout_url;
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
  // Never trust a callback that doesn't match what we asked for.
  // Never trust a callback that doesn't match what we asked Paymob to charge.
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
  if (moved.status === "succeeded") await fulfilOnce(db, moved, true);
  else await failed(db, moved);
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

/** Buy more: prospects + emails (never expire) + a paid invoice + confirmation emails. */
export async function grantPack(db: Db, ws: WorkspaceRow, prospects: number, emails: number, charge: { mode: "test" | "live"; amount: number; currency: Currency; paymentId?: string | null }, payer: { userId: string | null; email: string; name: string | null }) {
  const now = new Date();
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const periodEnd = addMonths(periodStart, 1);
  const { error } = await db.from("usage_ledger").insert({
    workspace_id: ws.id, kind: "grant", prospects, emails, period_start: periodStart.toISOString().slice(0, 10),
    reason: `prospect_pack:${charge.paymentId ?? "test"}`, created_by: payer.email,
  });
  // 23505: this payment's grant already exists (a retried fulfilment) — never grant twice.
  if (error && !(charge.paymentId && error.code === "23505")) throw error;
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

