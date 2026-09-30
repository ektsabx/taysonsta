import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/bos/db";
import { nowIso } from "@/lib/bos/clock";
import { recordLogin } from "@/lib/bos/login-log";
import { markInvitationAccepted, staffSignInCheck } from "@/services/bos/users";

// Google sign-in callback (docs/bos/30 §6). Admits existing, active
// employees only. An auth user that Supabase created just for this attempt
// (unknown email) is removed again, so Google can never self-register staff.
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const fail = (reason: string) => NextResponse.redirect(new URL(`/admin/login?error=${encodeURIComponent(reason)}`, url.origin));
  if (!code) return fail("google_cancelled");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return fail("google_failed");

  const user = data.user;
  const email = (user.email ?? "").toLowerCase();
  const appRole = user.app_metadata?.role;
  const check = appRole === "proposal_client" || appRole === "client" ? ({ ok: false, reason: "not_staff" } as const) : await staffSignInCheck(user.id, email, "google");
  if (!check.ok) {
    await supabase.auth.signOut();
    await recordLogin(email, user.id, false, check.reason, "google");
    const { data: linked } = await db().from("employees").select("id").eq("user_id", user.id).maybeSingle();
    const onlyGoogle = (user.identities ?? []).every((i) => i.provider === "google");
    const justCreated = Date.now() - new Date(user.created_at).getTime() < 10 * 60_000;
    if (!linked && !appRole && onlyGoogle && justCreated) await db().auth.admin.deleteUser(user.id);
    return fail(check.reason);
  }

  await recordLogin(email, user.id, true, null, "google");
  await markInvitationAccepted(user.id);
  await db().from("employees").update({ last_activity_at: nowIso() }).eq("user_id", user.id);
  return NextResponse.redirect(new URL("/admin/dashboard", url.origin));
}
