import { NextResponse, type NextRequest } from "next/server";
import { isToken, JOIN_COOKIE } from "@/lib/team/join";

// From the invitation page to sign-up or sign-in: the browser keeps the
// invitation for 30 minutes, so the new account joins the team (sign-up) or
// comes back to /join to accept (sign-in, Google).
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isToken(token)) return NextResponse.redirect(new URL("/login", req.url));
  const to = req.nextUrl.searchParams.get("to") === "signup" ? "/signup" : "/login";
  const res = NextResponse.redirect(new URL(to, req.url));
  res.cookies.set(JOIN_COOKIE, token, { path: "/", maxAge: 30 * 60, sameSite: "lax", httpOnly: true, secure: req.nextUrl.protocol === "https:" });
  return res;
}
