import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { addMonths, planCharge, renewalEmails, startPlan } from "@/lib/billing";
import { workspaceCurrency } from "@/lib/plan-catalog";
import { notify, userRecipient, workspaceRecipients } from "@/lib/email/notify";
import { dictionaries, fmt } from "@/lib/i18n/config";
import { formatNumber } from "@/lib/format";
import type { BillingPeriod, Currency, PaidPlan, PaymentRow, WorkspaceRow } from "@/types/database";
import { checkoutUrl, intentionBody, toMinor, type PaymobConfig } from "./paymob";
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

type Db = ReturnType<typeof createAdminClient>;

export interface PaymobRuntime extends PaymobConfig {
  mode: "test" | "live";
}

/** Paymob settings + Vault secrets, or null when it isn't fully configured and enabled. */
export async function loadPaymob(db: Db = createAdminClient()): Promise<PaymobRuntime | null> {
  const { data: row } = await db.from("payment_providers").select("*").eq("id", "paymob").maybeSingle();
  if (!row?.enabled) return null;
  const cfg = (row.config ?? {}) as { base_url?: string; public_key?: string; integrations?: Partial<Record<Currency, number[]>> };
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
    integrations: cfg.integrations ?? {},
  };
}

/** A provider that can charge this currency right now (Paymob today). */
export async function providerFor(currency: Currency): Promise<PaymobRuntime | null> {
  const paymob = await loadPaymob();
  return paymob && (paymob.integrations[currency]?.length ?? 0) > 0 ? paymob : null;
}

export async function paymentsConnected(ws: WorkspaceRow): Promise<boolean> {
  return Boolean(await providerFor(await workspaceCurrency(ws)));
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
export async function startCheckout(ws: WorkspaceRow, buyer: Buyer, target: CheckoutTarget): Promise<CheckoutResult> {
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
    const price = currency === "EGP" ? pack.price_egp : pack.price_usd;
    if (price == null) return { ok: false, error: "not_priced" };
    row = { kind: "prospect_pack", pack_id: pack.id, prospects: pack.prospects, amount: Number(price) };
    description = fmt(t.buyMore.packName, { count: formatNumber(pack.prospects) });
  }

  const { data: payment, error } = await db.from("payments").insert({
    ...row, workspace_id: ws.id, currency, provider: "paymob", mode: provider.mode, created_by: buyer.userId,
  }).select("*").single();
  if (error || !payment) return { ok: false, error: "failed" };

  const req: CheckoutRequest = {
    paymentId: payment.id,
    amount: Number(payment.amount),
    currency,
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
    await db.from("payments").update({ provider_ref: String(body.intention_order_id ?? body.id ?? "") || null }).eq("id", payment.id);
    return { ok: true, url: checkoutUrl(provider.baseUrl, provider.publicKey, body.client_secret) };
  } catch (e) {
    console.error("[payments] checkout", e);
    await db.from("payments").update({ status: "failed", failure_reason: "checkout_failed" }).eq("id", payment.id);
    return { ok: false, error: "failed" };
  }
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
  if (o.amountMinor !== toMinor(Number(payment.amount)) || o.currency.toUpperCase() !== payment.currency) {
    console.error("[payments] amount/currency mismatch", payment.id);
    return payment;
  }

  if (o.status === "refunded") {
    if (payment.status !== "succeeded") return payment;
    const { data: moved } = await db.from("payments").update({ status: "refunded" }).eq("id", payment.id).eq("status", "succeeded").select("*").maybeSingle();
    if (moved) await refunded(db, moved);
    return moved ?? payment;
  }
  if (payment.status !== "pending" || o.status === "pending") return payment;

  const next = o.status === "succeeded"
    ? { status: "succeeded" as const, paid_at: new Date().toISOString(), provider_txn: o.providerTxn || null }
    : { status: "failed" as const, failure_reason: o.reason?.slice(0, 200) ?? "declined", provider_txn: o.providerTxn || null };
  const { data: moved } = await db.from("payments").update(next).eq("id", payment.id).eq("status", "pending").select("*").maybeSingle();
  if (!moved) return payment;
  if (moved.status === "succeeded") await fulfil(db, moved);
  else await failed(db, moved);
  return moved;
}

/** Plan started / renewed, or prospects granted — once per succeeded payment. */
export async function fulfil(db: Db, p: PaymentRow): Promise<void> {
  const { data: ws } = await db.from("workspaces").select("*").eq("id", p.workspace_id).maybeSingle();
  if (!ws) return;
  const payer = await payerOf(db, p);
  const charge = { mode: p.mode, amount: Number(p.amount), currency: p.currency, paymentId: p.id };

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
  await grantPack(db, ws, p.prospects!, charge, payer);
}

/** Buy More Prospects: a grant for the current month + a paid invoice + emails. */
export async function grantPack(db: Db, ws: WorkspaceRow, prospects: number, charge: { mode: "test" | "live"; amount: number; currency: Currency; paymentId?: string | null }, payer: { userId: string | null; email: string; name: string | null }) {
  const now = new Date();
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const periodEnd = addMonths(periodStart, 1);
  const { error } = await db.from("usage_ledger").insert({
    workspace_id: ws.id, kind: "grant", prospects, period_start: periodStart.toISOString().slice(0, 10),
    reason: `prospect_pack:${charge.paymentId ?? "test"}`, created_by: payer.email,
  });
  if (error) throw error;
  const { data: invoice } = await db.from("invoices").insert({
    workspace_id: ws.id, kind: "prospect_pack", prospects, amount: charge.amount, currency: charge.currency, status: "paid", mode: charge.mode,
    period_start: now.toISOString(), period_end: periodEnd.toISOString(), bill_to_name: payer.name, bill_to_email: payer.email, bill_to_company: ws.name,
    payment_id: charge.paymentId ?? null,
  }).select("id, number, created_at").single();
  if (charge.paymentId && invoice) await db.from("payments").update({ invoice_id: invoice.id }).eq("id", charge.paymentId);

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
  if (!p.invoice_id) return;
  const { data: inv } = await db.from("invoices").update({ status: "void" }).eq("id", p.invoice_id).select("number").maybeSingle();
  if (inv) {
    await notify("refund_processed", await workspaceRecipients(p.workspace_id), { invoiceNumber: inv.number, amount: Number(p.amount), currency: p.currency, reason: null }, { workspaceId: p.workspace_id, dedupe: `refund:${p.id}` });
  }
}

