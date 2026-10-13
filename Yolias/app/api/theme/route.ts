import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isThemePref, THEME_COOKIE, themeCookieOptions } from "@/lib/theme";

// Switches Light / Dark from the header (next to the language menu). Like
// /api/locale: works on every page; signed-in users also get it saved on
// their profile (the account is the source of truth, lib/theme.ts).
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { theme?: unknown } | null;
  if (!isThemePref(body?.theme)) return NextResponse.json({ ok: false }, { status: 400 });
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const uid = data?.claims?.sub;
  if (uid) await supabase.from("profiles").update({ theme: body.theme }).eq("id", uid);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(THEME_COOKIE, body.theme, themeCookieOptions);
  return response;
}
