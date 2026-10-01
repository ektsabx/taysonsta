import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPaidPlan, plans, priceFor } from "@/lib/plans";
import { dictionaries } from "@/lib/i18n/config";
import { sendEmail } from "@/lib/email/send";
import { planEndingEmail, receiptEmail } from "@/lib/email/templates";
import type { BillingPeriod, Plan, WorkspaceRow } from "@/types/database";

/** No payment provider yet: paid plans can only be activated when this is on (local/dev). */
export function billingTestMode(): boolean {
  return process.env.BILLING_TEST_MODE === "true";
}

interface Payer {
  userId: string;
  email: string;
  name: string | null;
}

/**
 * Puts a workspace on a plan. Free needs no payment. Paid plans are charged
 * in test mode only (no provider yet) and get an invoice marked as a test.
 */
export async function startPlan(ws: WorkspaceRow, plan: Plan, period: BillingPeriod, payer: Payer): Promise<boolean> {
  const db = createAdminClient();
  const now = new Date();
  const paid = isPaidPlan(plan);
  const periodEnd = paid ? addMonths(now, period === "annual" ? 12 : 1) : null;

  const { error } = await db
    .from("workspaces")
    .update({
      plan,
      billing_period: paid ? period : "monthly",
      subscription_status: paid ? "test" : "active",
      current_period_end: periodEnd?.toISOString() ?? null,
      cancel_at_period_end: false,
    })
    .eq("id", ws.id);
  if (error) return false;

  const amount = paid ? priceFor(plans[plan].priceUsd, period) : 0;
  await db.from("subscription_events").insert({
    workspace_id: ws.id,
    plan,
    status: ws.subscription_status === "none" ? "activated" : "changed",
    amount_usd: amount,
    billing_period: period,
    mode: "test",
    created_by: payer.userId,
  });

  if (paid && periodEnd) {
    const { data: invoice } = await db.from("invoices").insert({
      workspace_id: ws.id,
      plan,
      billing_period: period,
      amount_usd: amount,
      status: "paid",
      mode: "test",
      period_start: now.toISOString(),
      period_end: periodEnd.toISOString(),
      bill_to_name: payer.name,
      bill_to_email: payer.email,
      bill_to_company: ws.name,
    }).select("id, number, created_at").single();
    if (invoice) {
      const to = await billingRecipient(payer.userId);
      if (to) {
        await sendEmail(payer.email, receiptEmail(to.locale, {
          siteUrl: siteUrl(), invoiceId: invoice.id, invoiceNumber: invoice.number, planName: dictionaries[to.locale].plans[plan],
          period, amountUsd: amount, date: invoice.created_at, periodEnd: periodEnd.toISOString(), test: true,
        }));
      }
    }
  }
  return true;
}

/** The payer's email language, or null when they turned billing emails off. */
async function billingRecipient(userId: string): Promise<{ locale: "en" | "ar" } | null> {
  const { data } = await createAdminClient().from("profiles").select("language, notify_billing").eq("id", userId).maybeSingle();
  if (data && !data.notify_billing) return null;
  return { locale: data?.language === "ar" ? "ar" : "en" };
}

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3200").replace(/\/$/, "");
}

/** Cancel (keep the plan until the period ends) or resume a paid plan. */
export async function setCancelAtPeriodEnd(ws: WorkspaceRow, cancel: boolean, userId: string, email?: string): Promise<boolean> {
  if (!isPaidPlan(ws.plan)) return false;
  const db = createAdminClient();
  const { error } = await db.from("workspaces").update({ cancel_at_period_end: cancel }).eq("id", ws.id);
  if (error) return false;
  await db.from("subscription_events").insert({
    workspace_id: ws.id,
    plan: ws.plan,
    status: cancel ? "canceled" : "resumed",
    amount_usd: 0,
    billing_period: ws.billing_period,
    mode: "test",
    created_by: userId,
  });
  if (cancel && email && ws.current_period_end) {
    const to = await billingRecipient(userId);
    if (to) {
      await sendEmail(email, planEndingEmail(to.locale, { siteUrl: siteUrl(), planName: dictionaries[to.locale].plans[ws.plan], endsAt: ws.current_period_end }));
    }
  }
  return true;
}

/**
 * A canceled plan whose period has ended moves to Free. Runs when the
 * workspace is loaded (no scheduler needed). Returns the updated row.
 */
export async function settleSubscription(ws: WorkspaceRow): Promise<WorkspaceRow> {
  const ended = ws.cancel_at_period_end && ws.current_period_end && new Date(ws.current_period_end) <= new Date();
  if (!ended) return ws;
  const db = createAdminClient();
  const next = { plan: "free" as const, subscription_status: "active" as const, current_period_end: null, cancel_at_period_end: false, billing_period: "monthly" as const };
  const { error } = await db.from("workspaces").update(next).eq("id", ws.id);
  if (error) return ws;
  await db.from("subscription_events").insert({
    workspace_id: ws.id, plan: ws.plan, status: "ended", amount_usd: 0, billing_period: ws.billing_period, mode: "test",
  });
  return { ...ws, ...next };
}

function addMonths(d: Date, months: number) {
  const out = new Date(d);
  out.setUTCMonth(out.getUTCMonth() + months);
  return out;
}
