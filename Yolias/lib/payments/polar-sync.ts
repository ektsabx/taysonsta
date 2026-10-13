import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { addMonths, renewalEmails, startPlan, startTrial } from "@/lib/billing";
import { planEnded } from "@/lib/email/events";
import { resumeQuotaPaused } from "@/lib/discovery/campaign-control";
import { capture } from "@/lib/analytics/server";
import { checkoutStep } from "@/lib/funnel";
import { planForProduct, type PolarConfig } from "./polar";
import type { BillingPeriod, PaidPlan, WorkspaceRow } from "@/types/database";

// Polar → Yolias (owner approval 2026-10-13, design in docs/21 §9). Each
// verified webhook delivery is applied once (billing_webhook_events by
// webhook-id), and every action here is also safe to repeat:
//   order.paid $0 (subscription_create)  → the trial starts (once per workspace)
//   order.paid  > $0                      → a `payments` row (unique per order),
//     then: trialing → the plan starts (trial converted, carry-over);
//           same plan, cycle → renewal (period from Polar, invoice);
//           otherwise → plan started / changed.
//     Marking the payment fulfilled fires the affiliate commission trigger.
//   customer.state_changed                → trial start (if no $0 order came),
//     cancel-at-period-end mirrored, and no active subscription → plan ends.
// The workspace is the Polar customer (external id); plan and period come
// only from the configured product ids, never from the payload's text.

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" ? (v as Obj) : {});
const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const uuid = /^[0-9a-f-]{36}$/i;
type Db = ReturnType<typeof createAdminClient>;

export interface SyncResult {
  status: "processed" | "ignored";
  note: string;
}

async function workspaceOf(db: Db, id: string | null): Promise<WorkspaceRow | null> {
  if (!id || !uuid.test(id)) return null;
  return (await db.from("workspaces").select("*").eq("id", id).maybeSingle()).data as WorkspaceRow | null;
}

/** Who the plan emails and invoices go to: the buyer from the checkout, else the owner. */
async function payerOf(db: Db, ws: WorkspaceRow, userId: string | null) {
  let id = userId && uuid.test(userId) ? userId : null;
  if (id) {
    const { data: member } = await db.from("workspace_members").select("user_id").eq("workspace_id", ws.id).eq("user_id", id).maybeSingle();
    if (!member) id = null;
  }
  if (!id) id = (await db.from("workspace_members").select("user_id").eq("workspace_id", ws.id).eq("role", "owner").limit(1).maybeSingle()).data?.user_id ?? null;
  const { data: prof } = id ? await db.from("profiles").select("email, full_name").eq("id", id).maybeSingle() : { data: null };
  return { userId: id ?? "", email: prof?.email ?? "", name: prof?.full_name ?? null };
}

/** The Yolias checkout session the Polar checkout was opened from (metadata.checkout_id), if it is this workspace's (D-212). */
async function checkoutOf(db: Db, workspaceId: string, meta: Obj): Promise<string | null> {
  const id = str(meta.checkout_id);
  if (!id || !uuid.test(id)) return null;
  const { data } = await db.from("checkout_sessions").select("id").eq("id", id).eq("workspace_id", workspaceId).maybeSingle();
  return data?.id ?? null;
}

const modeOf = (cfg: PolarConfig) => (cfg.environment === "sandbox" ? ("test" as const) : ("live" as const));

/** Starts the trial from Polar's subscription (dates from Polar). */
async function trialFromPolar(db: Db, cfg: PolarConfig, ws: WorkspaceRow, plan: PaidPlan, period: BillingPeriod, customerId: string | null, sub: Obj, userId: string | null): Promise<SyncResult> {
  if (ws.trial_started_at) {
    await db.from("workspaces").update({ polar_customer_id: customerId ?? ws.polar_customer_id, polar_subscription_id: str(sub.id) ?? ws.polar_subscription_id }).eq("id", ws.id);
    return { status: "ignored", note: "trial already started for this workspace" };
  }
  const payer = await payerOf(db, ws, userId);
  const ok = await startTrial(ws, plan, period, payer, { mode: modeOf(cfg), provider: "polar", polarCustomerId: customerId, polarSubscriptionId: str(sub.id) });
  if (!ok) return { status: "ignored", note: "trial not started (already had one)" };
  const ends = str(sub.trial_end) ?? str(sub.current_period_end);
  if (ends) await db.from("workspaces").update({ trial_ends_at: ends, current_period_end: ends }).eq("id", ws.id);
  return { status: "processed", note: `trial started: ${plan} ${period}` };
}

export async function syncOrderPaid(cfg: PolarConfig, data: unknown): Promise<SyncResult> {
  const db = createAdminClient();
  const d = obj(data);
  const meta = obj(d.metadata);
  const ws = await workspaceOf(db, str(obj(d.customer).external_id) ?? str(meta.workspace_id));
  if (!ws) return { status: "ignored", note: "no Yolias workspace for this customer" };
  const productId = str(d.product_id);
  const picked = productId ? planForProduct(cfg, productId) : null;
  if (!picked) return { status: "ignored", note: `product ${productId ?? "?"} isn't a configured Yolias plan` };
  const sub = obj(d.subscription);
  const customerId = str(obj(d.customer).id) ?? str(d.customer_id);
  const total = typeof d.total_amount === "number" ? d.total_amount : null;
  const reason = str(d.billing_reason);
  const orderId = str(d.id);
  if (!orderId || total == null) return { status: "ignored", note: "order without id or amount" };

  // $0 first order = the trial begins.
  if (total === 0) {
    if (reason !== "subscription_create") return { status: "ignored", note: `$0 order (${reason})` };
    return trialFromPolar(db, cfg, ws, picked.plan, picked.period, customerId, sub, str(meta.user_id));
  }
  if (String(d.currency ?? "").toLowerCase() !== "usd") return { status: "ignored", note: `order in ${String(d.currency)} (Yolias prices are USD)` };

  const mode = modeOf(cfg);
  const amount = total / 100;
  const payer = await payerOf(db, ws, str(meta.user_id));
  // One payments row per Polar order (unique provider + provider_ref).
  let { data: payment } = await db.from("payments").select("*").eq("provider", "polar").eq("provider_ref", orderId).maybeSingle();
  if (!payment) {
    const ins = await db.from("payments").insert({
      workspace_id: ws.id, kind: "subscription", plan: picked.plan, billing_period: picked.period, amount, currency: "USD",
      provider: "polar", provider_ref: orderId, provider_txn: orderId, mode, status: "succeeded", paid_at: str(d.created_at) ?? new Date().toISOString(),
      created_by: payer.userId || null, checkout_id: await checkoutOf(db, ws.id, meta),
    }).select("*").single();
    payment = ins.data ?? (await db.from("payments").select("*").eq("provider", "polar").eq("provider_ref", orderId).maybeSingle()).data;
  }
  if (!payment) throw new Error("polar payment not recorded");
  if (payment.fulfilled_at) return { status: "ignored", note: `order ${orderId} already applied` };

  const periodEnd = str(sub.current_period_end) ?? addMonths(new Date(), picked.period === "annual" ? 12 : 1).toISOString();
  const charge = { mode, amount, currency: "USD" as const, paymentId: payment.id, provider: "polar" as const };
  let note: string;
  const renewing = reason === "subscription_cycle" && ws.subscription_status !== "trialing" && ws.plan === picked.plan && ws.billing_period === picked.period
    && (ws.subscription_status === "active" || ws.subscription_status === "test" || ws.subscription_status === "past_due");
  if (renewing) {
    // Renewal: Polar charged the saved card; the new period comes from Polar.
    const start = ws.current_period_end ?? new Date().toISOString();
    const { data: invoice } = await db.from("invoices").insert({
      workspace_id: ws.id, kind: "subscription", plan: picked.plan, billing_period: picked.period, amount, currency: "USD", status: "paid", mode,
      period_start: start, period_end: periodEnd, bill_to_name: payer.name, bill_to_email: payer.email, bill_to_company: ws.name, payment_id: payment.id,
    }).select("id, number, created_at").single();
    await db.from("workspaces").update({ subscription_status: mode === "live" ? "active" : "test", current_period_end: periodEnd, cancel_at_period_end: Boolean(sub.cancel_at_period_end) }).eq("id", ws.id);
    await db.from("subscription_events").insert({ workspace_id: ws.id, plan: picked.plan, status: "renewed", amount, currency: "USD", billing_period: picked.period, mode, created_by: payer.userId || null });
    await resumeQuotaPaused(db, ws.id);
    if (invoice) {
      await db.from("payments").update({ invoice_id: invoice.id }).eq("id", payment.id);
      await renewalEmails(ws.id, payer.userId || null, picked.plan, picked.period, { amount, currency: "USD", test: mode === "test" }, periodEnd, invoice);
    }
    note = `renewed ${picked.plan} ${picked.period} until ${periodEnd}`;
  } else {
    // First charge after the trial (converts it), a paid start, or a plan change.
    const converting = ws.subscription_status === "trialing";
    const invoiceId = await startPlan(ws, picked.plan, picked.period, payer, charge);
    if (invoiceId === false) throw new Error("plan not started");
    await db.from("workspaces").update({
      current_period_end: periodEnd, cancel_at_period_end: Boolean(sub.cancel_at_period_end),
      polar_customer_id: customerId ?? ws.polar_customer_id, polar_subscription_id: str(sub.id) ?? ws.polar_subscription_id,
    }).eq("id", ws.id);
    if (invoiceId) {
      await db.from("payments").update({ invoice_id: invoiceId }).eq("id", payment.id);
      await db.from("invoices").update({ period_end: periodEnd }).eq("id", invoiceId);
    }
    note = `${converting ? "trial converted to" : "plan started:"} ${picked.plan} ${picked.period} until ${periodEnd}`;
  }
  // Fulfilled → the database creates the affiliate commission (trigger payments_affiliate).
  await db.from("payments").update({ fulfilled_at: new Date().toISOString() }).eq("id", payment.id).is("fulfilled_at", null);
  await capture(payer.userId || null, "payment_succeeded", { workspace_id: ws.id, payment_id: payment.id, kind: "subscription", plan: picked.plan, billing_period: picked.period, value: amount, currency: "USD", mode, provider: "polar" });
  return { status: "processed", note };
}

export async function syncCustomerState(cfg: PolarConfig, data: unknown): Promise<SyncResult> {
  const db = createAdminClient();
  const d = obj(data);
  const ws = await workspaceOf(db, str(d.external_id));
  if (!ws) return { status: "ignored", note: "no Yolias workspace for this customer" };
  const subs = (Array.isArray(d.active_subscriptions) ? d.active_subscriptions : []).map(obj)
    .filter((s) => { const p = str(s.product_id); return p ? Boolean(planForProduct(cfg, p)) : false; });
  const sub = subs[0];

  if (!sub) {
    // No Yolias subscription left on Polar: the plan ends (data kept, no Free).
    const billedByPolar = ws.billing_provider === "polar" && ws.polar_subscription_id;
    if (!billedByPolar || !["trialing", "active", "test", "past_due"].includes(ws.subscription_status)) return { status: "ignored", note: "nothing active to end" };
    const { data: moved } = await db.from("workspaces").update({ subscription_status: "canceled", current_period_end: null, cancel_at_period_end: false })
      .eq("id", ws.id).eq("subscription_status", ws.subscription_status).select("id").maybeSingle();
    if (!moved) return { status: "ignored", note: "already changed" };
    await db.from("subscription_events").insert({
      workspace_id: ws.id, plan: ws.plan, status: ws.subscription_status === "trialing" ? "trial_ended" : "ended", amount: 0, currency: "USD", billing_period: ws.billing_period, mode: modeOf(cfg),
    });
    await planEnded(ws, ws.subscription_status === "trialing" ? "trial" : "canceled");
    return { status: "processed", note: "subscription ended on Polar: plan ended" };
  }

  const picked = planForProduct(cfg, str(sub.product_id)!)!;
  if (sub.status === "trialing" && ws.subscription_status !== "trialing" && !ws.trial_started_at) {
    return trialFromPolar(db, cfg, ws, picked.plan, picked.period, str(d.id), sub, null);
  }
  // Mirror what the customer did in Polar's portal (cancel / resume) and the ids.
  const cancel = Boolean(sub.cancel_at_period_end);
  await db.from("workspaces").update({ cancel_at_period_end: cancel, polar_customer_id: str(d.id) ?? ws.polar_customer_id, polar_subscription_id: str(sub.id) ?? ws.polar_subscription_id }).eq("id", ws.id);
  if (cancel !== ws.cancel_at_period_end) {
    await db.from("subscription_events").insert({ workspace_id: ws.id, plan: ws.plan, status: cancel ? "canceled" : "resumed", amount: 0, currency: "USD", billing_period: ws.billing_period, mode: modeOf(cfg) });
  }
  return { status: "processed", note: `subscription ${String(sub.status)}${cancel ? " (cancels at period end)" : ""}` };
}

/**
 * checkout.updated (D-212): what Polar says about the checkout session itself.
 * "failed" is a confirmed failure; "expired" closes the attempt; "confirmed"
 * means the payment is being processed. Success is applied by order.paid /
 * customer.state_changed, never here. Only sessions opened from Yolias
 * (metadata.checkout_id) are tracked.
 */
export async function syncCheckoutUpdated(data: unknown): Promise<SyncResult> {
  const d = obj(data);
  const meta = obj(d.metadata);
  const db = createAdminClient();
  const ws = str(meta.workspace_id);
  const cid = ws ? await checkoutOf(db, ws, meta) : null;
  if (!cid) return { status: "ignored", note: "checkout not opened from a Yolias checkout session" };
  const status = str(d.status);
  const key = `polar_checkout:${str(d.id) ?? "?"}:${status ?? "?"}`;
  if (status === "failed") {
    await checkoutStep(cid, "payment_error", { provider: "polar", reason: "polar_payment_failed", key });
    await db.from("checkout_sessions").update({ reason_category: "payment_failed" }).eq("id", cid).eq("status", "payment_failed");
  } else if (status === "expired") {
    await checkoutStep(cid, "returned", { provider: "polar", result: "expired", key, signed: true });
  } else if (status === "confirmed") {
    await checkoutStep(cid, "returned", { provider: "polar", result: "processing", key, signed: true });
  } else {
    return { status: "ignored", note: `checkout ${status ?? "?"}` };
  }
  return { status: "processed", note: `checkout ${status}` };
}
