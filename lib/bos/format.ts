import { nowMs } from "@/lib/bos/clock";
// Date/time display helpers. Timestamps are stored UTC and shown in the
// viewer's (or company's) timezone (§103).

export const DEFAULT_TZ = "Africa/Cairo";

export function formatDate(value: string | Date | null | undefined, tz = DEFAULT_TZ): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value.length === 10 ? `${value}T00:00:00Z` : value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: typeof value === "string" && value.length === 10 ? "UTC" : tz,
  }).format(date);
}

export function formatDateTime(value: string | Date | null | undefined, tz = DEFAULT_TZ): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: tz,
  }).format(date);
}

export function formatTime(value: string | Date | null | undefined, tz = DEFAULT_TZ): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz }).format(date);
}

export function formatMinutes(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return "—";
  const sign = minutes < 0 ? "-" : "";
  const abs = Math.abs(Math.round(minutes));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${h}h ${String(m).padStart(2, "0")}m`;
}

export function relativeTime(value: string | Date | null | undefined, now = new Date(nowMs()), locale: "ar" | "en" = "ar"): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  const diff = Math.round((now.getTime() - date.getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(-diff, "second");
  if (abs < 3600) return rtf.format(-Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(-Math.round(diff / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(-Math.round(diff / 86400), "day");
  return formatDate(date);
}

// Today's date (YYYY-MM-DD) in a timezone.
export function todayIn(tz = DEFAULT_TZ, now = new Date(nowMs())): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

// Local wall-clock date+time in an IANA zone → UTC ISO string (DST-safe:
// computes the zone offset at that instant).
export function zonedToUtc(date: string, time: string, tz: string): string {
  const guess = new Date(`${date}T${time}:00Z`);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(guess)
      .map((p) => [p.type, p.value]),
  );
  const asZone = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
  const offset = asZone - guess.getTime();
  return new Date(guess.getTime() - offset).toISOString();
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function startOfMonth(isoDate: string): string {
  return `${isoDate.slice(0, 7)}-01`;
}

export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}
