import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPaidPlan, priceFor } from "@/lib/plans";
import { getPlanCatalog } from "@/lib/plan-catalog";
import { planCanceled, planEnded, planStarted } from "@/lib/email/events";
import { notify, userRecipient, workspaceRecipients } from "@/lib/email/notify";
import { dictionaries } from "@/lib/i18n/config";
import type { BillingPeriod, PaidPlan, Plan, WorkspaceRow } from "@/types/database";

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

  const amount = paid ? priceFor((await getPlanCatalog())[plan].priceUsd, period) : 0;
  await db.from("subscription_events").insert({
    workspace_id: ws.id,
    plan,
    status: ws.subscription_status === "none" ? "activated" : "changed",
    amount_usd: amount,
    billing_period: period,
    mode: "test",
    created_by: payer.userId,
  });

  let invoice: { id: string; number: string; created_at: string } | null = null;
  if (paid && periodEnd) {
    const { data } = await db.from("invoices").insert({
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
    invoice = data;
  }
  // Receipt + welcome / activated / upgraded / downgraded (lib/email/events.ts).
  await planStarted(ws, plan, period, amount, periodEnd?.toISOString() ?? null, invoice, payer.userId);
  return true;
}

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
    amount_usd: 0,
    billing_period: ws.billing_period,
    mode: "test",
    created_by: userId,
  });
  await planCanceled(ws, cancel);
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
  await planEnded(ws);
  return { ...ws, ...next };
}

const DAY = 86_400_000;
const RENEWAL_NOTICE_DAYS = 7;
const ENDING_NOTICE_DAYS = 3;

/**
 * Daily billing work, run by the worker (job "billing.sweep"):
 *  - "renews soon" 7 days before a paid plan renews,
 *  - "is ending" 3 days before a canceled plan ends,
 *  - test-mode renewals: a paid test plan whose period ended starts a new
 *    period with a test invoice (no payment provider yet, D-007).
 * Idempotent: every email is deduplicated per workspace and period.
 */
export async function billingSweep(now = new Date()): Promise<{ reminders: number; ending: number; renewed: number }> {
  const db = createAdminClient();
  const out = { reminders: 0, ending: 0, renewed: 0 };
  const { data: subs } = await db.from("workspaces").select("*").in("plan", ["pro", "growth"]).in("subscription_status", ["test", "active"]).not("current_period_end", "is", null);
  const catalog = await getPlanCatalog();
  for (const ws of subs ?? []) {
    const end = new Date(ws.current_period_end!);
    const left = end.getTime() - now.getTime();
    const name = (l: "en" | "ar") => dictionaries[l].plans[ws.plan];
    const admins = await workspaceRecipients(ws.id);
    if (ws.cancel_at_period_end) {
      if (left > 0 && left <= ENDING_NOTICE_DAYS * DAY) {
        out.ending += await notify("subscription_ending", admins, (l) => ({ planName: name(l), endsAt: ws.current_period_end! }), { workspaceId: ws.id, dedupe: `${ws.id}:${ws.current_period_end}` });
      }
      continue;
    }
    const amount = priceFor(catalog[ws.plan].priceUsd, ws.billing_period);
    if (left > 0 && left <= RENEWAL_NOTICE_DAYS * DAY) {
      out.reminders += await notify("renewal_upcoming", admins, (l) => ({ planName: name(l), period: ws.billing_period, amountUsd: amount, periodEnd: ws.current_period_end!, test: ws.subscription_status === "test" }), { workspaceId: ws.id, dedupe: `${ws.id}:${ws.current_period_end}` });
      continue;
    }
    if (left <= 0 && ws.subscription_status === "test") {
      const nextEnd = addMonths(end, ws.billing_period === "annual" ? 12 : 1);
      // Move the period first, conditioned on the old end: two sweeps can't renew twice.
      const { data: moved } = await db.from("workspaces").update({ current_period_end: nextEnd.toISOString() }).eq("id", ws.id).eq("current_period_end", ws.current_period_end!).select("id").maybeSingle();
      if (!moved) continue;
      const { data: owner } = await db.from("workspace_members").select("user_id").eq("workspace_id", ws.id).eq("role", "owner").limit(1).maybeSingle();
      const { data: ownerProfile } = owner ? await db.from("profiles").select("email, full_name").eq("id", owner.user_id).maybeSingle() : { data: null };
      const { data: invoice } = await db.from("invoices").insert({
        workspace_id: ws.id, plan: ws.plan as PaidPlan, billing_period: ws.billing_period, amount_usd: amount, status: "paid", mode: "test",
        period_start: end.toISOString(), period_end: nextEnd.toISOString(), bill_to_name: ownerProfile?.full_name ?? null, bill_to_email: ownerProfile?.email ?? "", bill_to_company: ws.name,
      }).select("id, number, created_at").single();
      await db.from("subscription_events").insert({ workspace_id: ws.id, plan: ws.plan, status: "renewed", amount_usd: amount, billing_period: ws.billing_period, mode: "test" });
      if (invoice) {
        await notify("subscription_renewed", admins, (l) => ({ planName: name(l), period: ws.billing_period, amountUsd: amount, periodEnd: nextEnd.toISOString(), test: true, invoiceId: invoice.id, invoiceNumber: invoice.number }), { workspaceId: ws.id, dedupe: invoice.id });
        if (owner) {
          await notify("receipt", await userRecipient(owner.user_id), (l) => ({ invoiceId: invoice.id, invoiceNumber: invoice.number, planName: name(l), period: ws.billing_period, amountUsd: amount, date: invoice.created_at, periodEnd: nextEnd.toISOString(), test: true }), { workspaceId: ws.id, dedupe: invoice.id });
        }
      }
      out.renewed++;
    }
  }
  return out;
}

function addMonths(d: Date, months: number) {
  const out = new Date(d);
  out.setUTCMonth(out.getUTCMonth() + months);
  return out;
}
