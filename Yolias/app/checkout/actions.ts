"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { canManageTeam, requireSession } from "@/lib/session";
import { isPaidPlan, PLAN_COOKIE, plans } from "@/lib/plans";
import { billingTestMode } from "@/lib/billing";

export type CheckoutResult = { ok: false; error: string };

// Activates a plan. No payment provider is connected yet, so this only works
// in billing test mode (local/dev) and is recorded as a test subscription —
// it never pretends a real charge happened.
export async function activatePlan(plan: string): Promise<CheckoutResult> {
  const session = await requireSession();
  if (!canManageTeam(session)) return { ok: false, error: "Only the workspace owner or an admin can change the plan." };
  if (!isPaidPlan(plan)) return { ok: false, error: "Choose a plan." };
  if (!billingTestMode()) return { ok: false, error: "Online payments aren't connected yet." };

  const db = createAdminClient();
  const periodEnd = new Date();
  periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1);
  const previous = session.workspace.plan;

  const { error } = await db
    .from("workspaces")
    .update({ plan, subscription_status: "test", current_period_end: periodEnd.toISOString() })
    .eq("id", session.workspace.id);
  if (error) return { ok: false, error: "Couldn't activate the plan. Please try again." };

  await db.from("subscription_events").insert({
    workspace_id: session.workspace.id,
    plan,
    status: previous === "free" ? "activated" : "changed",
    amount_usd: plans[plan].priceUsd,
    mode: "test",
    created_by: session.userId,
  });

  (await cookies()).delete(PLAN_COOKIE);
  revalidatePath("/", "layout");
  redirect("/?subscribed=1");
}
