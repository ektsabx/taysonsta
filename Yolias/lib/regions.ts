import type { Locale } from "@/lib/i18n/config";
import { COUNTRY_ZONES } from "@/lib/time-zones";

// Time zones and countries offered in Settings → General. The time zone is
// used for every date Yolias shows; the country is the home market Yolias AI
// assumes when a search doesn't name one.

export const TIMEZONES: string[] = [...new Set(Object.values(COUNTRY_ZONES).flat()), "UTC"];
export type TimeZone = string;

// Every country, the same list as the campaign's locations.
export const COUNTRIES = Object.keys(COUNTRY_ZONES) as [string, ...string[]];
export type Country = string;

const cityAr: Record<string, string> = {
  "Asia/Riyadh": "الرياض", "Asia/Dubai": "دبي", "Asia/Kuwait": "الكويت", "Asia/Qatar": "الدوحة", "Asia/Bahrain": "المنامة",
  "Asia/Muscat": "مسقط", "Africa/Cairo": "القاهرة", "Asia/Amman": "عمّان", "Asia/Beirut": "بيروت", "Asia/Baghdad": "بغداد",
  "Africa/Casablanca": "الدار البيضاء", "Africa/Tunis": "تونس", "Africa/Algiers": "الجزائر", "Europe/Istanbul": "إسطنبول",
  "Europe/London": "لندن", "Europe/Paris": "باريس", "Europe/Berlin": "برلين", "America/New_York": "نيويورك",
  "America/Chicago": "شيكاغو", "America/Los_Angeles": "لوس أنجلوس", "Asia/Karachi": "كراتشي", "Asia/Kolkata": "كولكاتا",
  "Asia/Singapore": "سنغافورة", UTC: "التوقيت العالمي",
};
const cityEn: Record<string, string> = { "Asia/Qatar": "Doha", "Asia/Bahrain": "Manama", UTC: "Coordinated Universal Time" };

const zoneOwner = new Map(Object.entries(COUNTRY_ZONES).flatMap(([cc, zones]) => zones.map((z) => [z, cc] as const)));

/** "(GMT+03:00) Saudi Arabia" — the offset is computed for today, so daylight saving shows correctly. */
export function timeZoneLabel(tz: string, locale: Locale, now = new Date()): string {
  let offset = "GMT";
  try {
    offset = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "longOffset" })
      .formatToParts(now).find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  } catch {}
  if (offset === "GMT") offset = "GMT+00:00";
  // The country a member recognises, then the city when the country has several zones.
  const cc = zoneOwner.get(tz);
  const city = locale === "ar" ? cityAr[tz] ?? tz.split("/").pop()!.replace(/_/g, " ") : cityEn[tz] ?? tz.split("/").pop()!.replace(/_/g, " ");
  if (!cc) return `(${offset}) ${city}`;
  const country = new Intl.DisplayNames([locale === "ar" ? "ar" : "en"], { type: "region" }).of(cc) ?? cc;
  return COUNTRY_ZONES[cc].length > 1 ? `(${offset}) ${country} · ${city}` : `(${offset}) ${country}`;
}

/** Any real IANA time zone (the device's, or one from the list). */
export function isValidTimeZone(v: unknown): v is string {
  if (typeof v !== "string" || !/^[A-Za-z_]+(\/[A-Za-z0-9_+-]+){0,2}$/.test(v) || v.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: v });
    return true;
  } catch {
    return false;
  }
}

/** Settings → time zone choices: the list, plus the account's own zone when it isn't in it. */
export function timeZoneChoices(current: string, locale: Locale = "en"): string[] {
  const name = (z: string) => timeZoneLabel(z, locale).replace(/^\([^)]*\) /, "");
  const sorted = [...TIMEZONES].sort((x, y) => name(x).localeCompare(name(y), locale));
  return TIMEZONES.includes(current) ? sorted : [current, ...sorted];
}

// The country each listed time zone belongs to. Used once, at onboarding, to
// pick the home country that matches the device's time zone.
const zoneCountry: Record<string, Country> = {
  "Asia/Riyadh": "SA", "Asia/Dubai": "AE", "Asia/Kuwait": "KW", "Asia/Qatar": "QA", "Asia/Bahrain": "BH", "Asia/Muscat": "OM",
  "Africa/Cairo": "EG", "Asia/Amman": "JO", "Asia/Beirut": "LB", "Asia/Baghdad": "IQ", "Africa/Casablanca": "MA", "Africa/Tunis": "TN",
  "Africa/Algiers": "DZ", "Europe/Istanbul": "TR", "Europe/London": "GB", "Europe/Paris": "FR", "Europe/Berlin": "DE",
  "America/New_York": "US", "America/Chicago": "US", "America/Los_Angeles": "US", "America/Denver": "US", "America/Phoenix": "US",
  "Asia/Karachi": "PK", "Asia/Kolkata": "IN", "Asia/Calcutta": "IN", "Asia/Singapore": "SG",
};

export function countryForTimeZone(tz: string | null | undefined): Country | null {
  return tz ? zoneCountry[tz] ?? zoneOwner.get(tz) ?? null : null;
}

/**
 * First sign-up only: the home country and time zone that belong together.
 * The device's time zone decides first (it is the user's own setting); the
 * network country (cf-ipcountry) is used when the zone says nothing. Saved on
 * the account afterwards and never changed automatically again.
 */
export function detectPreferences(deviceTimeZone: unknown, networkCountry: string | null): { timezone?: string; country?: Country } {
  const timezone = isValidTimeZone(deviceTimeZone) ? deviceTimeZone : undefined;
  const country = countryForTimeZone(timezone) ?? (isCountry(networkCountry) ? networkCountry : undefined);
  return { ...(timezone ? { timezone } : {}), ...(country ? { country } : {}) };
}

export function isCountry(v: unknown): v is Country {
  return typeof v === "string" && (COUNTRIES as readonly string[]).includes(v);
}
