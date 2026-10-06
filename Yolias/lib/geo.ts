import type { Locale } from "@/lib/i18n/config";

// Final spec phase 2: the visitor's country picks the first interface
// language (Arabic-speaking countries → Arabic). Prices are one USD price
// for every country (D-131).

/** Members of the Arab League (ISO 3166-1 alpha-2). */
const ARABIC_COUNTRIES = new Set([
  "SA", "AE", "EG", "KW", "QA", "BH", "OM", "JO", "LB", "IQ", "SY", "PS", "YE",
  "MA", "TN", "DZ", "LY", "SD", "MR", "SO", "DJ", "KM",
]);

export function normalizeCountry(v: string | null | undefined): string | null {
  const c = (v ?? "").trim().toUpperCase();
  // "XX" / "T1" are Cloudflare's unknown / Tor markers.
  return /^[A-Z]{2}$/.test(c) && c !== "XX" ? c : null;
}

export function localeForCountry(country: string | null): Locale | null {
  if (!country) return null;
  return ARABIC_COUNTRIES.has(country) ? "ar" : "en";
}

/** Region of the first Accept-Language tag with one ("ar-EG,ar;q=0.9" → "EG"). */
export function countryFromAcceptLanguage(header: string | null | undefined): string | null {
  for (const part of (header ?? "").split(",")) {
    const m = /^\s*[a-z]{2,3}-([a-z]{2})\b/i.exec(part);
    if (m) return normalizeCountry(m[1]);
  }
  return null;
}
