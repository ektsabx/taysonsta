import type { Locale } from "@/lib/i18n/config";

const arabicMarkets = new Set(["SA", "AE", "EG", "KW", "QA", "BH", "OM", "JO", "LB", "IQ", "MA", "TN", "DZ"]);

/** Speech recognition language: the interface language, in the user's own dialect when we know it. */
export function speechLang(locale: Locale, country: string | null | undefined): string {
  if (locale !== "ar") return "en-US";
  return `ar-${country && arabicMarkets.has(country) ? country : "SA"}`;
}
