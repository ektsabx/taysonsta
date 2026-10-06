import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { isMailProvider, mailers } from "@/lib/outreach/mailers";
import { callbackUrl, STATE_COOKIE } from "@/lib/outreach/oauth";

// Starts connecting the member's own Gmail / Outlook mailbox (OAuth, final
// spec phase 8). A one-time state in an httpOnly cookie protects the callback.
export async function GET(request: NextRequest, { params }: RouteContext<"/api/integrations/[provider]/connect">) {
  const { provider } = await params;
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", request.url));
  if (!isMailProvider(provider)) return NextResponse.redirect(new URL("/outreach?mailbox=unknown", request.url));
  const mailer = mailers[provider];
  const app = mailer.app();
  if (!app) return NextResponse.redirect(new URL("/outreach?mailbox=not_configured", request.url));
  const state = randomBytes(24).toString("base64url");
  const res = NextResponse.redirect(mailer.authorizeUrl(app, callbackUrl(request, provider), state));
  res.cookies.set(STATE_COOKIE, `${provider}:${state}:${session.userId}`, { httpOnly: true, sameSite: "lax", secure: request.nextUrl.protocol === "https:", path: "/api/integrations", maxAge: 600 });
  return res;
}
