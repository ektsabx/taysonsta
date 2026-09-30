import en from "./en";

// BOS interface language (docs/bos/30 §4, doc 31 Phase 2). Arabic source
// strings are the keys (gettext style): code keeps readable Arabic, English
// comes from en.json; a missing entry falls back to the Arabic text, and
// tests/unit/i18n.test.ts reports untranslated keys.

export type BosLocale = "ar" | "en";
export type BosTheme = "dark" | "light" | "system";
export type TVars = Record<string, string | number | null | undefined>;
export type TFn = (text: string, vars?: TVars) => string;

// Keys are matched with collapsed whitespace: JSX turns a multi-line text
// node into single-spaced text at runtime.
const norm = (s: string) => s.replace(/\s+/g, " ").trim();
const dict: Record<string, string> = {};
for (const [k, v] of Object.entries(en)) dict[norm(k)] = v;

function interpolate(s: string, vars?: TVars) {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k] ?? "") : m));
}

export function translate(locale: BosLocale, text: string, vars?: TVars): string {
  if (locale === "ar" || !text) return interpolate(text, vars);
  const hit = dict[norm(text)];
  return interpolate(hit ?? text, vars);
}

export function hasTranslation(text: string) {
  return norm(text) in dict;
}

export function dirFor(locale: BosLocale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}

// Intl locale for dates/numbers in the interface language.
export function intlLocale(locale: BosLocale) {
  return locale === "ar" ? "ar-EG" : "en-GB";
}

export const BOS_LOCALE_COOKIE = "bos_locale";
export const BOS_THEME_COOKIE = "bos_theme";
export function isBosLocale(v: unknown): v is BosLocale {
  return v === "ar" || v === "en";
}
export function isBosTheme(v: unknown): v is BosTheme {
  return v === "dark" || v === "light" || v === "system";
}
