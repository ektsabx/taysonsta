import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getSession } from "@/lib/session";
import { siteUrl } from "@/lib/email/notify";
import { createAdminClient } from "@/lib/supabase/admin";
import { calendarExists, createCalendar, exchange } from "@/lib/meetings/google";
import { ensureBookingPage } from "@/lib/meetings";

const STATE = "yolias_calendar_state";

// Google's answer (D-267): the code becomes a refresh token in Vault, and
// Yolias creates its own "Yolias meetings" calendar right away. Reconnecting
// the same Google account keeps the calendar it already has, so meetings stay
// in one place and nothing is duplicated.
export async function GET(req: NextRequest) {
  const back = (status: string) => {
    const res = NextResponse.redirect(new URL(`/integrations?card=calendar&calendar=${status}`, siteUrl()));
    res.cookies.delete({ name: STATE, path: "/api/calendar" });
    return res;
  };
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", siteUrl()));
  const q = req.nextUrl.searchParams;
  const expected = (await cookies()).get(STATE)?.value;
  if (!expected || q.get("state") !== expected) return back("failed");
  if (q.get("error")) return back("denied");
  const code = q.get("code");
  if (!code) return back("failed");
  try {
    const g = await exchange(code, `${siteUrl()}/api/calendar/google/callback`);
    const page = await ensureBookingPage(session.userId, session.workspace.id, session.profile.full_name, session.email, session.profile.timezone ?? null, session.profile.language);
    const db = createAdminClient();
    const { data: prev } = await db.from("calendar_connections").select("email, calendar_id").eq("user_id", session.userId).maybeSingle();
    const same = prev?.calendar_id && prev.email && g.email && prev.email.toLowerCase() === g.email.toLowerCase() && (await calendarExists(g.accessToken, prev.calendar_id));
    const calendarId = same ? prev!.calendar_id! : await createCalendar(g.accessToken, page.timezone);
    await db.rpc("clear_calendar_token", { p_user: session.userId });
    const { error } = await db.from("calendar_connections").insert({ user_id: session.userId, workspace_id: session.workspace.id, email: g.email, calendar_id: calendarId, status: "connected" });
    if (error) throw error;
    await db.rpc("set_calendar_token", { p_user: session.userId, p_token: g.refreshToken });
    return back("connected");
  } catch (e) {
    console.error("[calendar] connect failed", e instanceof Error ? e.message : e);
    return back("failed");
  }
}
