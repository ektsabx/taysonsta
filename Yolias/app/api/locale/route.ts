import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isLocale, LOCALE_COOKIE } from "@/lib/i18n/config";

// Switches the interface language. A route handler (not a server action) so it
// works from every page, including 404s and pages the proxy redirects.
// Signed-in users also get it saved on their profile and auth metadata, so
// Yolias AI output and sign-in emails follow it.
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { locale?: unknown } | null;
  const locale = body?.locale;
  if (!isLocale(locale)) return NextResponse.json({ ok: false }, { status: 400 });

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const uid = data?.claims?.sub;
  if (uid) {
    await Promise.all([
      supabase.from("profiles").update({ language: locale }).eq("id", uid),
      supabase.auth.updateUser({ data: { locale } }),
    ]);
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  return response;
}
