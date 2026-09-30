export const locales = ["ar", "en"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "ar";

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

export function directionForLocale(locale: Locale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}

export function localizedPath(locale: Locale, path: string): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  if (locale === defaultLocale) {
    return cleanPath;
  }
  return `/${locale}${cleanPath === "/" ? "" : cleanPath}`;
}

export function switchLocalePath(pathname: string, targetLocale: Locale): string {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length > 0 && isLocale(parts[0])) {
    parts.shift();
  }
  const rest = parts.join("/");
  return localizedPath(targetLocale, rest ? `/${rest}` : "/");
}
