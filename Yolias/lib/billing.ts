import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPaidPlan, planPrice, priceFor } from "@/lib/plans";
import { resumeQuotaPaused } from "@/lib/discovery/campaign-control";
import { getPlanCatalog, workspaceCurrency } from "@/lib/plan-catalog";
import { requestCountry } from "@/lib/geo-server";
import { planCanceled, planEnded, planStarted } from "@/lib/email/events";
import { notify, userRecipient, workspaceRecipients } from "@/lib/email/notify";
import { dictionaries } from "@/lib/i18n/config";
import type { BillingPeriod, Currency, PaidPlan, Plan, WorkspaceRow } from "@/types/database";

/**
 * Local/dev only: with no payment provider connected for the workspace's
 * currency, paid plans and packs activate without a charge, recorded as tests.
 */
export function billingTestMode(): boolean {
  return process.env.BILLING_TEST_MODE === "true";
}

interface Payer {
  userId: string;
  email: string;
  name: string | null;
}

/** What was charged: the provider's live/test mode and the amount in the workspace currency. */
export interface Charge {
  mode: "test" | "live";
  amount: number;
  currency: Currency;
  paymentId?: string | null;
}

/** Price of a plan for this workspace, in its currency (never converted). Null = not priced in it. */
export async function planCharge(ws: WorkspaceRow, plan: PaidPlan, period: BillingPeriod): Promise<{ amount: number; currency: Currency } | null> {
  const [catalog, currency] = await Promise.all([getPlanCatalog(), workspaceCurrency(ws)]);
  const monthly = planPrice(catalog[plan], currency);
  return monthly == null ? null : { amount: priceFor(monthly, period), currency };
}

/** The first plan fixes the workspace's billing country and currency (Egypt → EGP, else USD). */
async function billingIdentity(ws: WorkspaceRow, currency: Currency) {
  if (ws.subscription_status !== "none") return {};
  return { billing_currency: currency, billing_country: ws.billing_country ?? (await requestCountry()) };
}

/**
 * Puts a workspace on a plan. Free needs no payment. A paid plan needs its
 * charge: settled by a payment provider (lib/payments) or, in billing test
 * mode, a test charge. Writes the subscription event and the paid invoice.
 * Returns the invoice id (null for Free), or false if the update failed.
 */
export async function startPlan(ws: WorkspaceRow, plan: Plan, period: BillingPeriod, payer: Payer, charge?: Charge): Promise<string | null | false> {
  const db = createAdminClient();
  const now = new Date();
  const paid = isPaidPlan(plan);
  if (paid && !charge) return false;
  const periodEnd = paid ? addMonths(now, period === "annual" ? 12 : 1) : null;
  const currency = charge?.currency ?? (await workspaceCurrency(ws));
  const mode = charge?.mode ?? "test";

  const { error } = await db
    .from("workspaces")
    .update({
      ...(await billingIdentity(ws, currency)),
      plan,
      billing_period: paid ? period : "monthly",
      subscription_status: paid ? (mode === "live" ? "active" : "test") : "active",
      current_period_end: periodEnd?.toISOString() ?? null,
      cancel_at_period_end: false,
    })
    .eq("id", ws.id);
  if (error) return false;

  const amount = charge?.amount ?? 0;
  await db.from("subscription_events").insert({
    workspace_id: ws.id,
    plan,
    status: ws.subscription_status === "none" ? "activated" : "changed",
    amount,
    currency,
    billing_period: period,
    mode,
    created_by: payer.userId,
  });

  let invoice: { id: string; number: string; created_at: string } | null = null;
  if (paid && periodEnd) {
    const { data } = await db.from("invoices").insert({
      workspace_id: ws.id,
      kind: "subscription",
      plan,
      billing_period: period,
      amount,
      currency,
      status: "paid",
      mode,
      period_start: now.toISOString(),
      period_end: periodEnd.toISOString(),
      bill_to_name: payer.name,
      bill_to_email: payer.email,
      bill_to_company: ws.name,
      payment_id: charge?.paymentId ?? null,
    }).select("id, number, created_at").single();
    invoice = data;
  }
  if (paid) await resumeQuotaPaused(db, ws.id);
  // Receipt + welcome / activated / upgraded / downgraded (lib/email/events.ts).
  await planStarted(ws, plan, period, { amount, currency, test: mode === "test" }, periodEnd?.toISOString() ?? null, invoice, payer.userId);
  return invoice?.id ?? null;
}

const eventMode = (ws: WorkspaceRow) => (ws.subscription_status === "test" ? ("test" as const) : ("live" as const));

/** Cancel (keep the plan until the period ends) or resume a paid plan. */
export async function setCancelAtPeriodEnd(ws: WorkspaceRow, cancel: boolean, userId: string): Promise<boolean> {
  if (!isPaidPlan(ws.plan)) return false;
  const db = createAdminClient();
  const { error } = await db.from("workspaces").update({ cancel_at_period_end: cancel }).eq("id", ws.id);
  if (error) return false;
  await db.from("subscription_events").insert({
    workspace_id: ws.id,
    plan: ws.plan,
    status: cancel ? "canceled" : "resumed",
    amount: 0,
    currency: ws.billing_currency,
    billing_period: ws.billing_period,
    mode: eventMode(ws),
    created_by: userId,
  });
  await planCanceled(ws, cancel);
  return true;
}

const DAY = 86_400_000;
/** A live renewal left unpaid this long after the period ended moves the workspace to Free. */
export const RENEWAL_GRACE_DAYS = 7;

/**
 * A canceled plan whose period has ended, or an unpaid renewal past its
 * grace period, moves to Free. Runs when the workspace is loaded and in the
 * daily sweep. Returns the updated row.
 */
export async function settleSubscription(ws: WorkspaceRow, now = new Date()): Promise<WorkspaceRow> {
  const end = ws.current_period_end ? new Date(ws.current_period_end) : null;
  const canceledEnded = Boolean(ws.cancel_at_period_end && end && end <= now);
  const unpaid = Boolean(ws.subscription_status === "past_due" && end && end.getTime() + RENEWAL_GRACE_DAYS * DAY <= now.getTime());
  if (!canceledEnded && !unpaid) return ws;
  const db = createAdminClient();
  const next = { plan: "free" as const, subscription_status: "active" as const, current_period_end: null, cancel_at_period_end: false, billing_period: "monthly" as const };
  // Conditioned on the old period end, so two requests can't end it twice.
  const { data: moved } = await db.from("workspaces").update(next).eq("id", ws.id).eq("current_period_end", ws.current_period_end!).select("id").maybeSingle();
  if (!moved) return ws;
  if (unpaid) {
    await db.from("invoices").update({ status: "void" }).eq("workspace_id", ws.id).eq("status", "open").eq("kind", "subscription");
  }
  await db.from("subscription_events").insert({
    workspace_id: ws.id, plan: ws.plan, status: "ended", amount: 0, currency: ws.billing_currency, billing_period: ws.billing_period, mode: eventMode(ws),
  });
  await planEnded(ws);
  return { ...ws, ...next };
}

const RENEWAL_NOTICE_DAYS = 7;
const ENDING_NOTICE_DAYS = 3;

/**
 * Daily billing work, run by the worker (job "billing.sweep"):
 *  - "renews soon" 7 days before a paid plan renews,
 *  - "is ending" 3 days before a canceled plan ends,
 *  - test-mode renewals: a test plan whose period ended starts a new period
 *    with a test invoice,
 *  - live renewals: nothing is charged automatically (no stored payment
 *    method); the period's invoice is opened, the workspace is past due and
 *    the admins get "invoice ready" with a pay link. Still unpaid after the
 *    grace period → Free (settleSubscription).
 * Idempotent: every change is conditioned on the old state and every email
 * is deduplicated per workspace and period.
 */
export async function billingSweep(now = new Date()): Promise<{ reminders: number; ending: number; renewed: number; due: number; ended: number }> {
  const db = createAdminClient();
  const out = { reminders: 0, ending: 0, renewed: 0, due: 0, ended: 0 };
  // Housekeeping: sign-in link requests only matter for an hour.
  await db.from("sign_in_requests").delete().lt("created_at", new Date(now.getTime() - DAY).toISOString());
  const { data: subs } = await db.from("workspaces").select("*").in("plan", ["pro", "growth"]).in("subscription_status", ["test", "active", "past_due"]).not("current_period_end", "is", null);
  const catalog = await getPlanCatalog();
  for (const ws of subs ?? []) {
    if (ws.subscription_status === "past_due") {
      if ((await settleSubscription(ws, now)).plan === "free") out.ended++;
      continue;
    }
    const end = new Date(ws.current_period_end!);
    const left = end.getTime() - now.getTime();
    const name = (l: "en" | "ar") => dictionaries[l].plans[ws.plan];
    const admins = await workspaceRecipients(ws.id);
    const test = ws.subscription_status === "test";
    if (ws.cancel_at_period_end) {
      if (left > 0 && left <= ENDING_NOTICE_DAYS * DAY) {
        out.ending += await notify("subscription_ending", admins, (l) => ({ planName: name(l), endsAt: ws.current_period_end! }), { workspaceId: ws.id, dedupe: `${ws.id}:${ws.current_period_end}` });
      }
      continue;
    }
    const monthly = planPrice(catalog[ws.plan], ws.billing_currency);
    if (monthly == null) continue; // not priced in this currency: the admin sets the price first
    const amount = priceFor(monthly, ws.billing_period);
    const currency = ws.billing_currency;
    if (left > 0 && left <= RENEWAL_NOTICE_DAYS * DAY) {
      out.reminders += await notify("renewal_upcoming", admins, (l) => ({ planName: name(l), period: ws.billing_period, amount, currency, periodEnd: ws.current_period_end!, test }), { workspaceId: ws.id, dedupe: `${ws.id}:${ws.current_period_end}` });
      continue;
    }
    if (left > 0) continue;
    const nextEnd = addMonths(end, ws.billing_period === "annual" ? 12 : 1);
    const { data: owner } = await db.from("workspace_members").select("user_id").eq("workspace_id", ws.id).eq("role", "owner").limit(1).maybeSingle();
    const { data: ownerProfile } = owner ? await db.from("profiles").select("email, full_name").eq("id", owner.user_id).maybeSingle() : { data: null };
    const billTo = { bill_to_name: ownerProfile?.full_name ?? null, bill_to_email: ownerProfile?.email ?? "", bill_to_company: ws.name };

    if (!test) {
      // Live: open the renewal invoice and wait for the payment.
      const { data: moved } = await db.from("workspaces").update({ subscription_status: "past_due" }).eq("id", ws.id).eq("subscription_status", "active").eq("current_period_end", ws.current_period_end!).select("id").maybeSingle();
      if (!moved) continue;
      const { data: invoice } = await db.from("invoices").insert({
        workspace_id: ws.id, kind: "subscription", plan: ws.plan as PaidPlan, billing_period: ws.billing_period, amount, currency, status: "open", mode: "live",
        period_start: end.toISOString(), period_end: nextEnd.toISOString(), ...billTo,
      }).select("id, number").single();
      await db.from("subscription_events").insert({ workspace_id: ws.id, plan: ws.plan, status: "past_due", amount, currency, billing_period: ws.billing_period, mode: "live" });
      if (invoice) {
        const dueAt = new Date(end.getTime() + RENEWAL_GRACE_DAYS * DAY).toISOString();
        await notify("invoice_ready", admins, (l) => ({ invoiceId: invoice.id, invoiceNumber: invoice.number, planName: name(l), amount, currency, dueAt, test: false }), { workspaceId: ws.id, dedupe: invoice.id });
      }
      out.due++;
      continue;
    }

    // Test mode: renew with a test invoice.
    const { data: moved } = await db.from("workspaces").update({ current_period_end: nextEnd.toISOString() }).eq("id", ws.id).eq("current_period_end", ws.current_period_end!).select("id").maybeSingle();
    if (!moved) continue;
    const { data: invoice } = await db.from("invoices").insert({
      workspace_id: ws.id, kind: "subscription", plan: ws.plan as PaidPlan, billing_period: ws.billing_period, amount, currency, status: "paid", mode: "test",
      period_start: end.toISOString(), period_end: nextEnd.toISOString(), ...billTo,
    }).select("id, number, created_at").single();
    await db.from("subscription_events").insert({ workspace_id: ws.id, plan: ws.plan, status: "renewed", amount, currency, billing_period: ws.billing_period, mode: "test" });
    if (invoice) {
      await renewalEmails(ws.id, owner?.user_id ?? null, ws.plan as PaidPlan, ws.billing_period, { amount, currency, test: true }, nextEnd.toISOString(), invoice);
    }
    out.renewed++;
  }
  return out;
}

/** "Subscription renewed" to the admins + receipt to the owner. */
export async function renewalEmails(
  workspaceId: string, ownerId: string | null, plan: PaidPlan, period: BillingPeriod,
  charge: { amount: number; currency: Currency; test: boolean }, periodEnd: string, invoice: { id: string; number: string; created_at: string },
) {
  const name = (l: "en" | "ar") => dictionaries[l].plans[plan];
  const admins = await workspaceRecipients(workspaceId);
  await notify("subscription_renewed", admins, (l) => ({ planName: name(l), period, ...charge, periodEnd, invoiceId: invoice.id, invoiceNumber: invoice.number }), { workspaceId, dedupe: invoice.id });
  if (ownerId) {
    await notify("receipt", await userRecipient(ownerId), (l) => ({ invoiceId: invoice.id, invoiceNumber: invoice.number, planName: name(l), period, ...charge, date: invoice.created_at, periodEnd }), { workspaceId, dedupe: invoice.id });
  }
}

export function addMonths(d: Date, months: number) {
  const out = new Date(d);
  out.setUTCMonth(out.getUTCMonth() + months);
  return out;
}
