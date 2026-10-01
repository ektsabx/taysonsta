import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ProfileRow, WorkspaceRole, WorkspaceRow } from "@/types/database";

export interface Session {
  userId: string;
  email: string;
  emailConfirmed: boolean;
  profile: ProfileRow;
  workspace: WorkspaceRow;
  role: WorkspaceRole;
}

// Resolves the signed-in user, their profile and active workspace once per request.
export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return null;

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
    workspace,
    role: member.role,
  };
});

/** For app pages and actions: signed in, with a workspace, and onboarded. */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect((await isSignedIn()) ? "/auth/signout" : "/login");
  if (!session.profile.onboarded_at) redirect("/onboarding");
  return session;
}

export const canManageTeam = (s: Session) => s.role === "owner" || s.role === "admin";

async function isSignedIn() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return Boolean(data?.claims?.sub);
}
