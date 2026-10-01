import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isPaidPlan, PLAN_COOKIE } from "@/lib/plans";

// Magic link verification. Supports both link formats Supabase can send:
//  - token_hash + type (Yolias email templates; works across devices)
//  - code (PKCE redirect from the default Supabase template)
const allowedTypes: EmailOtpType[] = ["email", "magiclink", "signup", "invite"];

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

  // Not onboarded yet → the (app) layout sends them to /onboarding, which then
  // continues to checkout. Already onboarded with a picked plan → checkout now.
  const plan = request.cookies.get(PLAN_COOKIE)?.value;
  const { data } = await supabase.auth.getUser();
  if (isPaidPlan(plan) && data.user) {
    const { data: profile } = await supabase.from("profiles").select("onboarded_at").eq("id", data.user.id).maybeSingle();
    if (profile?.onboarded_at) return NextResponse.redirect(new URL(`/checkout?plan=${plan}`, url.origin));
  }
  return NextResponse.redirect(new URL("/", url.origin));
}
