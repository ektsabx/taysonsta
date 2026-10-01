"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { canManageTeam, requireUser } from "@/lib/session";
import { isBillingPeriod, isPaidPlan, PERIOD_COOKIE, PLAN_COOKIE, plans, priceFor } from "@/lib/plans";
import { billingTestMode } from "@/lib/billing";
import { getDictionary } from "@/lib/i18n/server";

export type CheckoutResult = { ok: false; error: string };

// Activates a plan. No payment provider is connected yet, so this only works
// in billing test mode (local/dev) and is recorded as a test subscription —
// it never pretends a real charge happened. Next step: onboarding (first
// time) or back to Yolias.
export async function activatePlan(plan: string, period: string): Promise<CheckoutResult> {
  const session = await requireUser();
  const t = await getDictionary();
  if (!canManageTeam(session)) return { ok: false, error: t.checkout.onlyAdmins };
  if (!isPaidPlan(plan) || !isBillingPeriod(period)) return { ok: false, error: t.checkout.errors.choosePlan };
  if (!billingTestMode()) return { ok: false, error: t.checkout.errors.notConnected };

  const db = createAdminClient();
  const periodEnd = new Date();
  periodEnd.setUTCMonth(periodEnd.getUTCMonth() + (period === "annual" ? 12 : 1));
  const firstPlan = session.workspace.subscription_status === "none";

  const { error } = await db
    .from("workspaces")
    .update({ plan, billing_period: period, subscription_status: "test", current_period_end: periodEnd.toISOString() })
    .eq("id", session.workspace.id);
  if (error) return { ok: false, error: t.checkout.errors.failed };

  await db.from("subscription_events").insert({
    workspace_id: session.workspace.id,
    plan,
    status: firstPlan ? "activated" : "changed",
    amount_usd: priceFor(plans[plan].priceUsd, period),
    billing_period: period,
    mode: "test",
    created_by: session.userId,
  });

  const jar = await cookies();
  jar.delete(PLAN_COOKIE);
  jar.delete(PERIOD_COOKIE);
  revalidatePath("/", "layout");
  redirect(session.profile.onboarded_at ? "/" : "/onboarding");
}
