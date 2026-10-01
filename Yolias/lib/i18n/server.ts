import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { defaultLocale, dictionaries, isLocale, LOCALE_COOKIE, type Locale } from "./config";

// Resolves the interface language for this request:
// explicit choice (cookie) → signed-in user's saved language → browser → English.
export const getLocale = cache(async (): Promise<Locale> => {
  const fromCookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const uid = data?.claims?.sub;
  if (uid) {
    const { data: profile } = await supabase.from("profiles").select("language").eq("id", uid).maybeSingle();
    if (isLocale(profile?.language)) return profile.language;
  }

  const accept = (await headers()).get("accept-language") ?? "";
  return /^\s*ar\b/i.test(accept) ? "ar" : defaultLocale;
});

export async function getDictionary() {
  return dictionaries[await getLocale()];
}
