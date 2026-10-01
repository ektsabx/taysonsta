import type { Locale } from "@/lib/i18n/config";

// Time zones and countries offered in Settings → General. The time zone is
// used for every date Yolias shows; the country is the home market Yolias AI
// assumes when a search doesn't name one.

export const TIMEZONES = [
  "Asia/Riyadh", "Asia/Dubai", "Asia/Kuwait", "Asia/Qatar", "Asia/Bahrain", "Asia/Muscat",
  "Africa/Cairo", "Asia/Amman", "Asia/Beirut", "Asia/Baghdad", "Africa/Casablanca", "Africa/Tunis", "Africa/Algiers",
  "Europe/Istanbul", "Europe/London", "Europe/Paris", "Europe/Berlin",
  "America/New_York", "America/Chicago", "America/Los_Angeles",
  "Asia/Karachi", "Asia/Kolkata", "Asia/Singapore", "UTC",
] as const;
export type TimeZone = (typeof TIMEZONES)[number];

export const COUNTRIES = [
  "SA", "AE", "EG", "KW", "QA", "BH", "OM", "JO", "LB", "IQ", "MA", "TN", "DZ",
  "TR", "GB", "US", "DE", "FR", "IN", "PK", "SG",
] as const;
export type Country = (typeof COUNTRIES)[number];

const cityAr: Record<string, string> = {
  "Asia/Riyadh": "الرياض", "Asia/Dubai": "دبي", "Asia/Kuwait": "الكويت", "Asia/Qatar": "الدوحة", "Asia/Bahrain": "المنامة",
  "Asia/Muscat": "مسقط", "Africa/Cairo": "القاهرة", "Asia/Amman": "عمّان", "Asia/Beirut": "بيروت", "Asia/Baghdad": "بغداد",
  "Africa/Casablanca": "الدار البيضاء", "Africa/Tunis": "تونس", "Africa/Algiers": "الجزائر", "Europe/Istanbul": "إسطنبول",
  "Europe/London": "لندن", "Europe/Paris": "باريس", "Europe/Berlin": "برلين", "America/New_York": "نيويورك",
  "America/Chicago": "شيكاغو", "America/Los_Angeles": "لوس أنجلوس", "Asia/Karachi": "كراتشي", "Asia/Kolkata": "كولكاتا",
  "Asia/Singapore": "سنغافورة", UTC: "التوقيت العالمي",
};
const cityEn: Record<string, string> = { "Asia/Qatar": "Doha", "Asia/Bahrain": "Manama", UTC: "Coordinated Universal Time" };

/** "(GMT+03:00) Riyadh" — the offset is computed for today, so daylight saving shows correctly. */
export function timeZoneLabel(tz: string, locale: Locale, now = new Date()): string {
  let offset = "GMT";
  try {
    offset = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "longOffset" })
      .formatToParts(now).find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  } catch {}
  if (offset === "GMT") offset = "GMT+00:00";
  const city = locale === "ar" ? cityAr[tz] ?? tz : cityEn[tz] ?? tz.split("/").pop()!.replace(/_/g, " ");
  return `(${offset}) ${city}`;
}

export function isTimeZone(v: unknown): v is TimeZone {
  return typeof v === "string" && (TIMEZONES as readonly string[]).includes(v);
}
