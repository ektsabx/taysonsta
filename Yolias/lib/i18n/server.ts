import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { localeForCountry, normalizeCountry } from "@/lib/geo";
import { defaultLocale, dictionaries, isLocale, LOCALE_COOKIE, type Locale } from "./config";
import { LOCALE_HEADER } from "./paths";

// Resolves the interface language for this request:
// the website URL's language (/ar/… or the plain English URL, set by proxy.ts, D-258) →
// explicit choice (cookie) → signed-in user's saved language → the
// visitor's country (Arabic-speaking → Arabic, else English) → browser → English.
export const getLocale = cache(async (): Promise<Locale> => {
  const fromUrl = (await headers()).get(LOCALE_HEADER);
  if (isLocale(fromUrl)) return fromUrl;
  const fromCookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const uid = data?.claims?.sub;
  if (uid) {
    const { data: profile } = await supabase.from("profiles").select("language").eq("id", uid).maybeSingle();
    if (isLocale(profile?.language)) return profile.language;
  }

  const h = await headers();
  const byCountry = localeForCountry(normalizeCountry(h.get("cf-ipcountry")));
  if (byCountry) return byCountry;

  const accept = h.get("accept-language") ?? "";
  return /^\s*ar\b/i.test(accept) ? "ar" : defaultLocale;
});

export async function getDictionary() {
  return dictionaries[await getLocale()];
}
