import { intlLocale, type Locale } from "@/lib/i18n/config";

export function initials(name: string | null | undefined, fallback = "?"): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function formatNumber(n: number, locale: Locale = "en"): string {
  return new Intl.NumberFormat(intlLocale(locale)).format(n);
}

export function formatDate(iso: string | Date, locale: Locale = "en", timeZone?: string): string {
  return new Intl.DateTimeFormat(intlLocale(locale), { month: "long", day: "numeric", year: "numeric", timeZone }).format(new Date(iso));
}

const shortCountry: Record<string, string> = { SA: "KSA", AE: "UAE", EG: "Egypt", GB: "UK", US: "USA" };

/** Country display name in the interface language (ISO alpha-2 in). */
export function countryLabel(code: string | null | undefined, locale: Locale = "en", short = false): string {
  if (!code) return "";
  const c = code.toUpperCase();
  if (locale === "en" && short && shortCountry[c]) return shortCountry[c];
  try {
    return new Intl.DisplayNames([intlLocale(locale)], { type: "region" }).of(c) ?? c;
  } catch {
    return c;
  }
}

export function location(city: string | null | undefined, country: string | null | undefined, locale: Locale = "en"): string {
  return [city, countryLabel(country, locale, true)].filter(Boolean).join(locale === "ar" ? "، " : ", ");
}
