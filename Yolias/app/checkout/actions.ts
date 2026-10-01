"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { canManageTeam, requireUser } from "@/lib/session";
import { isBillingPeriod, isPaidPlan, isPlan, PERIOD_COOKIE, PLAN_COOKIE } from "@/lib/plans";
import { billingTestMode, startPlan } from "@/lib/billing";
import { getDictionary } from "@/lib/i18n/server";

export type CheckoutResult = { ok: false; error: string };

// Puts the workspace on the chosen plan. Free needs no payment. No payment
// provider is connected yet, so paid plans only activate in billing test mode
// (local/dev) and are recorded as test charges — never a pretend real charge.
// Next step: onboarding (first time) or back to Yolias.
export async function activatePlan(plan: string, period: string): Promise<CheckoutResult> {
  const session = await requireUser();
  const t = await getDictionary();
  if (!canManageTeam(session)) return { ok: false, error: t.checkout.onlyAdmins };
  if (!isPlan(plan) || !isBillingPeriod(period)) return { ok: false, error: t.checkout.errors.choosePlan };
  if (isPaidPlan(plan) && !billingTestMode()) return { ok: false, error: t.checkout.errors.notConnected };

  const ok = await startPlan(session.workspace, plan, period, {
    userId: session.userId,
    email: session.email,
    name: session.profile.full_name,
  });
  if (!ok) return { ok: false, error: t.checkout.errors.failed };

  const jar = await cookies();
  jar.delete(PLAN_COOKIE);
  jar.delete(PERIOD_COOKIE);
  revalidatePath("/", "layout");
  redirect(session.profile.onboarded_at ? "/" : "/onboarding");
}
