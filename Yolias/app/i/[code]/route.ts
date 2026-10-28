import { NextResponse, type NextRequest } from "next/server";
import { REFERRAL_COOKIE, REFERRAL_DAYS, validReferralCode } from "@/lib/referrals";

// Invite link of the referral program (owner, 2026-10-28): www.yolias.com/i/<code>.
// Keeps the code in a first-party cookie, then opens sign-up. The reward is
// decided at sign-up, on the server (lib/referrals recordReferral). A bad code
// just opens sign-up: a link never errors for the visitor.
export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.toLowerCase();
  const res = NextResponse.redirect(new URL("/signup", req.nextUrl.origin), 302);
  res.headers.set("x-robots-tag", "noindex");
  res.headers.set("cache-control", "no-store");
  if (validReferralCode(code)) {
    res.cookies.set(REFERRAL_COOKIE, code, { httpOnly: true, sameSite: "lax", secure: req.nextUrl.protocol === "https:", path: "/", maxAge: REFERRAL_DAYS * 86_400 });
  }
  return res;
}
