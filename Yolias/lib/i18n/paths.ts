import type { Locale } from "./config";

// Language URLs for the public website (D-258): English at the plain path,
// Arabic under /ar ("/pricing" ↔ "/ar/pricing", "/" ↔ "/ar"), so search
// engines index both and can tell they are the same page (hreflang). The
// app, sign-in, checkout and APIs keep one URL and follow the language
// cookie as before.

export const AR_PREFIX = "/ar";
/** Request header the front door (proxy.ts) sets to the language of the URL. */
export const LOCALE_HEADER = "x-yolias-locale";

const sections = ["product", "pricing", "solutions", "use-cases", "compare", "alternatives", "templates", "about", "contact", "affiliates", "partners/terms", "community", "careers", "status", "help-center", "docs", "blog", "legal"];

/** Public website pages that exist in both languages. */
export function isLocalizedPath(path: string): boolean {
  const p = path.split(/[?#]/)[0];
  return p === "/" || sections.some((s) => p === `/${s}` || p.startsWith(`/${s}/`));
}

/** "/ar/pricing" → { locale: "ar", path: "/pricing" }; "/pricing" → { locale: null, path: "/pricing" }. */
export function splitLocale(path: string): { locale: "ar" | null; path: string } {
  if (path === AR_PREFIX || path.startsWith(`${AR_PREFIX}/`) || path.startsWith(`${AR_PREFIX}?`) || path.startsWith(`${AR_PREFIX}#`)) {
    const rest = path.slice(AR_PREFIX.length);
    return { locale: "ar", path: rest === "" || rest.startsWith("?") || rest.startsWith("#") ? `/${rest}` : rest };
  }
  return { locale: null, path };
}

/** The URL of a page in a language: only website pages get /ar; anything else is returned as is. */
export function localizedHref(href: string, locale: Locale): string {
  if (!href.startsWith("/") || href.startsWith("//")) return href;
  const { path } = splitLocale(href);
  if (locale !== "ar" || !isLocalizedPath(path)) return path;
  return path === "/" ? AR_PREFIX : path.startsWith("/?") || path.startsWith("/#") ? `${AR_PREFIX}${path.slice(1)}` : `${AR_PREFIX}${path}`;
}
