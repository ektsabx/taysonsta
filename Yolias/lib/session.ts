import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { hasActivePlan, isBillingPeriod, isPlan, PERIOD_COOKIE, PLAN_COOKIE } from "@/lib/plans";
import { createClient } from "@/lib/supabase/server";
import { settleSubscription } from "@/lib/billing";
import type { BillingPeriod, Plan, ProfileRow, WorkspaceRole, WorkspaceRow } from "@/types/database";

export interface Session {
  userId: string;
  email: string;
  emailConfirmed: boolean;
  profile: ProfileRow;
  workspace: WorkspaceRow;
  role: WorkspaceRole;
  /** Values given at signup (pricing form): full_name, company, plan_intent. */
  signupMeta: { full_name?: string; company?: string; plan_intent?: string };
}

// Resolves the signed-in user, their profile and active workspace once per request.
export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return null;
  // Two-factor users must finish the code step before anything else works.
  if (await needsSecondFactor(supabase)) return null;

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (!profile?.workspace_id) return null;

  const [{ data: workspace }, { data: member }] = await Promise.all([
    supabase.from("workspaces").select("*").eq("id", profile.workspace_id).maybeSingle(),
    supabase.from("workspace_members").select("role").eq("workspace_id", profile.workspace_id).eq("user_id", user.id).maybeSingle(),
  ]);
  if (!workspace || !member) return null;

  return {
    userId: user.id,
    email: user.email ?? profile.email,
    emailConfirmed: Boolean(user.email_confirmed_at),
    profile,
    workspace: await settleSubscription(workspace),
    role: member.role,
    signupMeta: (user.user_metadata ?? {}) as Session["signupMeta"],
  };
});

/** Signed in with a workspace — no plan/onboarding checks (checkout, onboarding). */
export async function requireUser(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect((await mfaPending()) ? "/two-factor" : (await isSignedIn()) ? "/auth/signout" : "/login");
  return session;
}

// Order of the journey: pricing → signup → magic link → checkout (plan) →
// onboarding → Yolias. App pages and actions require all of it.
export async function requireSession(): Promise<Session> {
  const session = await requireUser();
  if (!hasActivePlan(session.workspace)) {
    const plan = await pendingPlan(session);
    const period = await pendingPeriod();
    redirect(plan ? `/checkout?plan=${plan}${period ? `&period=${period}` : ""}` : "/checkout");
  }
  if (!session.profile.onboarded_at) redirect("/onboarding");
  return session;
}

/** Where a signed-in user should continue to next. */
export function nextStep(session: Session): "/checkout" | "/onboarding" | "/" {
  if (!hasActivePlan(session.workspace)) return "/checkout";
  if (!session.profile.onboarded_at) return "/onboarding";
  return "/";
}

export const canManageTeam = (s: Session) => s.role === "owner" || s.role === "admin";

type Client = Awaited<ReturnType<typeof createClient>>;

/** Signed in with the link but the account has 2FA and the code isn't entered yet. */
export async function needsSecondFactor(supabase: Client): Promise<boolean> {
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return Boolean(data && data.nextLevel === "aal2" && data.currentLevel !== "aal2");
}

export async function mfaPending(): Promise<boolean> {
  return needsSecondFactor(await createClient());
}

async function isSignedIn() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return Boolean(data?.claims?.sub);
}

/** The plan the user picked on /pricing before signing up. */
export async function pendingPlan(session: Session): Promise<Plan | null> {
  const fromCookie = (await cookies()).get(PLAN_COOKIE)?.value;
  const plan = fromCookie ?? session.signupMeta.plan_intent;
  return isPlan(plan) ? plan : null;
}

/** The billing period picked on /pricing before signing up. */
export async function pendingPeriod(): Promise<BillingPeriod | null> {
  const v = (await cookies()).get(PERIOD_COOKIE)?.value;
  return isBillingPeriod(v) ? v : null;
}
