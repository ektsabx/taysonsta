import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { canUseApp, isBillingPeriod, isPlan, PERIOD_COOKIE, PLAN_COOKIE } from "@/lib/plans";
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
// One round trip (D-251): the token is verified on the server (getClaims with
// the project's ES256 keys, no Auth call), then public.session_context()
// returns the profile, workspace and role, and refuses deleted or banned users
// and a second factor that wasn't entered, as getUser did.
export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return null;
  const { data } = await supabase.rpc("session_context");
  const ctx = data as unknown as { needs_mfa?: boolean; email: string; email_confirmed: boolean; user_metadata: Session["signupMeta"]; profile: ProfileRow; workspace: WorkspaceRow; role: WorkspaceRole } | null;
  if (!ctx || ctx.needs_mfa) return null;

  return {
    userId,
    email: ctx.email ?? ctx.profile.email,
    emailConfirmed: ctx.email_confirmed,
    profile: ctx.profile,
    workspace: await settleSubscription(ctx.workspace),
    role: ctx.role,
    signupMeta: ctx.user_metadata ?? {},
  };
});

/** Signed in with a workspace — no plan/onboarding checks (checkout, onboarding). */
export async function requireUser(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect((await mfaPending()) ? "/two-factor" : (await isSignedIn()) ? "/auth/signout" : "/login");
  return session;
}

// Order of the journey (owner, 2026-10-29): pricing → signup → magic link →
// onboarding (website, company, ideal customer) → checkout (plan) → Yolias.
// App pages and actions require all of it.
export async function requireSession(): Promise<Session> {
  const session = await requireUser();
  if (!session.profile.onboarded_at) redirect("/onboarding");
  if (!canUseApp(session.workspace)) {
    const plan = await pendingPlan(session);
    redirect(plan ? `/checkout?plan=${plan}` : "/checkout");
  }
  return session;
}

/**
 * App pages (not actions): a signed-in member may look around Yolias before
 * choosing a plan (owner brief 2026-10-19). The shell then asks them to pick
 * a plan and add a card to start the free trial; every action still calls
 * requireSession(), so nothing runs without a plan. With a plan, onboarding
 * comes first as before.
 */
export async function requireViewer(): Promise<Session> {
  const session = await requireUser();
  if (!session.profile.onboarded_at) redirect("/onboarding");
  return session;
}

/** Where a signed-in user should continue to next. */
export function nextStep(session: Session): "/checkout" | "/onboarding" | "/" {
  if (!session.profile.onboarded_at) return "/onboarding";
  if (!canUseApp(session.workspace)) return "/checkout";
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

/** The plan the user picked on /pricing before signing up ("payg": Pay As You Go, D-247). */
export async function pendingPlan(session: Session): Promise<Plan | "payg" | null> {
  const fromCookie = (await cookies()).get(PLAN_COOKIE)?.value;
  const plan = fromCookie ?? session.signupMeta.plan_intent;
  return plan === "payg" ? "payg" : isPlan(plan) ? plan : null;
}

/** The billing period picked on /pricing before signing up. */
export async function pendingPeriod(): Promise<BillingPeriod | null> {
  const v = (await cookies()).get(PERIOD_COOKIE)?.value;
  return isBillingPeriod(v) ? v : null;
}
