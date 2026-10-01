"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { canManageTeam, requireUser } from "@/lib/session";
import { isPaidPlan, PLAN_COOKIE, plans } from "@/lib/plans";
import { billingTestMode } from "@/lib/billing";
import { getDictionary } from "@/lib/i18n/server";

export type CheckoutResult = { ok: false; error: string };

// Activates a plan. No payment provider is connected yet, so this only works
// in billing test mode (local/dev) and is recorded as a test subscription —
// it never pretends a real charge happened. Next step: onboarding (first
// time) or back to Yolias.
export async function activatePlan(plan: string): Promise<CheckoutResult> {
  const session = await requireUser();
  const t = await getDictionary();
  if (!canManageTeam(session)) return { ok: false, error: t.checkout.onlyAdmins };
  if (!isPaidPlan(plan)) return { ok: false, error: t.checkout.errors.choosePlan };
  if (!billingTestMode()) return { ok: false, error: t.checkout.errors.notConnected };

  const db = createAdminClient();
  const periodEnd = new Date();
  periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1);
  const firstPlan = session.workspace.subscription_status === "none";

  const { error } = await db
    .from("workspaces")
    .update({ plan, subscription_status: "test", current_period_end: periodEnd.toISOString() })
    .eq("id", session.workspace.id);
  if (error) return { ok: false, error: t.checkout.errors.failed };

  await db.from("subscription_events").insert({
    workspace_id: session.workspace.id,
    plan,
    status: firstPlan ? "activated" : "changed",
    amount_usd: plans[plan].priceUsd,
    mode: "test",
    created_by: session.userId,
  });

  (await cookies()).delete(PLAN_COOKIE);
  revalidatePath("/", "layout");
  redirect(session.profile.onboarded_at ? "/" : "/onboarding");
}
