import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { securityAlert, signedIn } from "@/lib/email/events";

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
  }

  return NextResponse.redirect(new URL("/", url.origin));
}
