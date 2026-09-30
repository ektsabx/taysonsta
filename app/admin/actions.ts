"use server";
import { nowIso } from "@/lib/bos/clock";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/bos/db";
import { requestMeta } from "@/lib/bos/auth";
import { getSetting } from "@/lib/bos/settings";
import { recordLogin } from "@/lib/bos/login-log";
import { markInvitationAccepted, staffSignInCheck } from "@/services/bos/users";

export interface LoginState {
  error: string | null;
}

export async function signInAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "البريد الإلكتروني وكلمة المرور مطلوبان" };
  }

  // Rate limit per email and per IP (§75).
  const security = await getSetting("security");
  const { ip } = await requestMeta();
  const windowSeconds = security.login_window_minutes * 60;
  const [{ data: emailOk }, { data: ipOk }] = await Promise.all([
    db().rpc("bos_rate_limit_hit", { p_key: `login:email:${email}`, p_window_seconds: windowSeconds, p_max: security.login_max_attempts }),
    db().rpc("bos_rate_limit_hit", { p_key: `login:ip:${ip ?? "unknown"}`, p_window_seconds: windowSeconds, p_max: security.login_max_attempts * 4 }),
  ]);
  if (emailOk === false || ipOk === false) {
    await recordLogin(email, null, false, "rate_limited");
    return { error: "محاولات دخول كثيرة. حاول مرة أخرى لاحقاً." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    await recordLogin(email, null, false, "invalid_credentials");
    return { error: "البريد أو كلمة المرور غير صحيحة" };
  }

  const appRole = data.user.app_metadata?.role;
  if (appRole === "proposal_client" || appRole === "client") {
    await supabase.auth.signOut();
    await recordLogin(email, data.user.id, false, "not_staff");
    return { error: "البريد أو كلمة المرور غير صحيحة" };
  }

  const check = await staffSignInCheck(data.user.id, email, "password");
  if (!check.ok) {
    await supabase.auth.signOut();
    await recordLogin(email, data.user.id, false, check.reason);
    return { error: check.message };
  }

  await recordLogin(email, data.user.id, true, null);
  await markInvitationAccepted(data.user.id);
  await db().from("employees").update({ last_activity_at: nowIso() }).eq("user_id", data.user.id);

  redirect("/admin/dashboard");
}

// Google sign-in (docs/bos/30 §6): only when enabled in Settings → Security;
// the callback admits existing active employees only.
export async function signInWithGoogleAction(): Promise<LoginState> {
  const security = await getSetting("security");
  if (!security.google_sign_in) return { error: "الدخول عبر Google غير مفعّل." };
  const h = await headers();
  const origin = h.get("origin") ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/admin/auth/callback`,
      queryParams: security.google_allowed_domains.length === 1 ? { hd: security.google_allowed_domains[0], prompt: "select_account" } : { prompt: "select_account" },
    },
  });
  if (error || !data.url) return { error: "تعذر بدء الدخول عبر Google. تأكد من تفعيل مزود Google في إعدادات Supabase Auth." };
  redirect(data.url);
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
