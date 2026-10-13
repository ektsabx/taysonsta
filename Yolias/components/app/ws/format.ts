import type { Locale } from "@/lib/i18n/config";

// Small formatters for CRM / Outreach / Inbox (any ISO currency, date + time).

const intl = (l: Locale) => (l === "ar" ? "ar-EG" : "en-US");

export function money(value: number | null | undefined, currency: string, locale: Locale): string {
  if (value == null) return "—";
  try {
    return new Intl.NumberFormat(intl(locale), { style: "currency", currency, maximumFractionDigits: Number.isInteger(value) ? 0 : 2, numberingSystem: "latn" }).format(value);
  } catch {
    return `${value} ${currency}`;
  }
}

export function dateTime(iso: string | null | undefined, locale: Locale, timeZone?: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(intl(locale), { dateStyle: "medium", timeStyle: "short", timeZone: timeZone || undefined, numberingSystem: "latn" }).format(new Date(iso));
}

export function shortDate(iso: string | null | undefined, locale: Locale, timeZone?: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(intl(locale), { month: "short", day: "numeric", timeZone: timeZone || undefined, numberingSystem: "latn" }).format(new Date(iso));
}

/** Value for <input type="datetime-local"> in the browser's time zone. */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** <input type="datetime-local"> value (browser time) → ISO, or null. */
export function fromLocalInput(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
