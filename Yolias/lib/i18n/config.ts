import { ar } from "./dictionaries/ar";
import { en, type Dictionary } from "./dictionaries/en";

export type Locale = "en" | "ar";
export const locales: Locale[] = ["en", "ar"];
export const defaultLocale: Locale = "en";
/** Interface language for visitors and signed-in users (kept in sync with profiles.language). */
export const LOCALE_COOKIE = "yolias_locale";

export const dictionaries: Record<Locale, Dictionary> = { en, ar };

export function isLocale(v: unknown): v is Locale {
  return v === "en" || v === "ar";
}

export function dirOf(locale: Locale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}

/** Intl locale for numbers/dates — Arabic text with Latin digits, as in the design. */
export function intlLocale(locale: Locale): string {
  return locale === "ar" ? "ar-u-nu-latn" : "en-US";
}

/** Fills {placeholders}: fmt("Hi {name}", { name: "Sara" }). */
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

export type { Dictionary };
