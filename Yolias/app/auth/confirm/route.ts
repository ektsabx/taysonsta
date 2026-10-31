import { NextResponse, type NextRequest } from "next/server";
import { TEMPLATE_COOKIE } from "@/lib/content/seo-pages";
import { recordReferral, REFERRAL_COOKIE } from "@/lib/referrals";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { securityAlert, signedIn } from "@/lib/email/events";
import { capture } from "@/lib/analytics/server";
import { attributeSignup } from "@/lib/affiliates";
import { AFFILIATE_COOKIE } from "@/lib/affiliates/program";
import { NEXT_COOKIE } from "@/lib/partners";
import { FIRST_TOUCH_COOKIE } from "@/lib/attribution";
import { recordSignupSource } from "@/lib/attribution-server";

// Magic link verification. Supports both link formats Supabase can send:
//  - token_hash + type (Yolias email templates; works across devices)
//  - code (PKCE redirect from the default Supabase template)
// Afterwards the app's guards continue the journey: checkout → onboarding → home.
const allowedTypes: EmailOtpType[] = ["email", "magiclink", "signup", "invite", "email_change"];

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const code = url.searchParams.get("code");
  const fail = (reason: string) => NextResponse.redirect(new URL(`/recover?error=${reason}`, url.origin));

  const supabase = await createClient();
  if (tokenHash && type && allowedTypes.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) return fail("link_invalid");
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return fail("link_invalid");
  } else {
    return fail("link_missing");
  }

  // "New sign-in detected" for a device this user hasn't used before.
  const { data: auth } = await supabase.auth.getUser();
  if (auth.user) {
    const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    await signedIn(auth.user.id, request.headers.get("user-agent") ?? "", ip);
    if (type === "email_change") await securityAlert(auth.user.id, "email_changed");
    // New account: the sign-up confirmation link, or a first Google sign-in.
    const isNew = type === "signup" || (Boolean(code) && Date.now() - new Date(auth.user.created_at).getTime() < 10 * 60_000);
    // Where the new account came from: the first public page of the visit (SEO reports, D-257).
    const source = isNew ? await recordSignupSource(auth.user.id, request.cookies.get(FIRST_TOUCH_COOKIE)?.value, url.hostname) : null;
    if (type !== "email_change") await capture(auth.user.id, isNew ? "signed_up" : "signed_in", { method: code ? (auth.user.app_metadata?.provider ?? "oauth") : "magic_link", ...(source ? { channel: source.channel, landing_path: source.landing } : {}) });
    // Referral link visited before signing up: the database decides whether
    // it counts (new account, valid window, not the affiliate themself).
    const ref = request.cookies.get(AFFILIATE_COOKIE)?.value;
    if (ref) await attributeSignup(auth.user.id, ref, ip);
    // Invite link of the referral program (owner, 2026-10-28): a new account rewards the inviting workspace.
    const invite = request.cookies.get(REFERRAL_COOKIE)?.value;
    if (invite && isNew) await recordReferral(auth.user.id, invite, ip).catch((e) => console.error("[referral]", e));
  }

  // Yolias Partners (D-206): back to the partner portal — this browser started
  // there (cookie), or the account is a partner account without a plan.
  const next = request.cookies.get(NEXT_COOKIE)?.value;
  // The dashboard is the account's home (D-270); a template opened from the website waits in Yolias AI's box.
  let dest = request.cookies.get(TEMPLATE_COOKIE) ? "/" : "/dashboard";
  if (next === "/partners") dest = "/partners";
  else if (auth.user?.user_metadata?.partner === true) {
    const { data: prof } = await supabase.from("profiles").select("workspace:workspaces(subscription_status)").eq("id", auth.user.id).maybeSingle();
    const status = (prof?.workspace as unknown as { subscription_status?: string } | null)?.subscription_status;
    if (!status || status === "none" || status === "canceled") dest = "/partners";
  }
  const res = NextResponse.redirect(new URL(dest, url.origin));
  if (next) res.cookies.delete(NEXT_COOKIE);
  if (request.cookies.get(REFERRAL_COOKIE)) res.cookies.delete(REFERRAL_COOKIE);
  return res;
}
