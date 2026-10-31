import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { siteUrl } from "@/lib/email/notify";
import { authorizeUrl, CalendarError } from "@/lib/meetings/google";

// Connect Google Calendar for the booking page (D-267). A random state in an
// httpOnly cookie ties Google's answer to this browser.
const STATE = "yolias_calendar_state";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", siteUrl()));
  const nonce = crypto.randomUUID();
  try {
    const res = NextResponse.redirect(await authorizeUrl(nonce, `${siteUrl()}/api/calendar/google/callback`));
    res.cookies.set(STATE, nonce, { httpOnly: true, secure: siteUrl().startsWith("https://"), sameSite: "lax", path: "/api/calendar", maxAge: 600 });
    return res;
  } catch (e) {
    return NextResponse.redirect(new URL(`/integrations?card=calendar&calendar=${e instanceof CalendarError && e.kind === "not_configured" ? "not_configured" : "failed"}`, siteUrl()));
  }
}
