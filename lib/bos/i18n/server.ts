import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { db } from "@/lib/bos/db";
import { getBosSession } from "@/lib/bos/auth";
import { getSetting } from "@/lib/bos/settings";
import { translate, dirFor, isBosLocale, isBosTheme, BOS_LOCALE_COOKIE, BOS_THEME_COOKIE, type BosLocale, type BosTheme, type TFn } from "./core";

// Resolution: user preference → (signed-out pages: last choice cookie) →
// company default; a language the company disabled falls back to the
// company default.
export const getUiPrefs = cache(async (): Promise<{ locale: BosLocale; theme: BosTheme; dir: "rtl" | "ltr" }> => {
  const [session, company, jar] = await Promise.all([getBosSession(), getSetting("company"), cookies()]);
  let pref: { language: string | null; theme: string | null } | null = null;
  if (session.status === "ok") {
    const { data } = await db().from("user_preferences").select("language, theme").eq("user_id", session.bos.userId).maybeSingle();
    pref = data;
  }
  const cookieLocale = jar.get(BOS_LOCALE_COOKIE)?.value;
  const cookieTheme = jar.get(BOS_THEME_COOKIE)?.value;
  const locale: BosLocale = isBosLocale(pref?.language) ? pref.language : session.status !== "ok" && isBosLocale(cookieLocale) ? cookieLocale : company.default_language;
  const theme: BosTheme = isBosTheme(pref?.theme) ? pref.theme : session.status !== "ok" && isBosTheme(cookieTheme) ? cookieTheme : company.default_theme;
  return { locale, theme, dir: dirFor(locale) };
});

export async function getT(): Promise<TFn> {
  const { locale } = await getUiPrefs();
  return (text, vars) => translate(locale, text, vars);
}

export async function getLocale(): Promise<BosLocale> {
  return (await getUiPrefs()).locale;
}
