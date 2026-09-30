// Global BOS date & time source (docs/bos/28 §29). Every module — server
// pages, services, actions and client components — reads "now" through
// these helpers instead of calling Date.now()/new Date() itself, so the
// whole system shares one clock:
//   • server: the host clock, or a fixed instant from BOS_NOW (ISO string,
//     non-production only) for deterministic tests and demos;
//   • browser: the server clock, via the offset the SystemClockProvider
//     records from the server-rendered timestamp.

let clientOffsetMs = 0;

function fixedNow(): number | null {
  if (typeof process === "undefined" || !process.env) return null;
  const raw = process.env.BOS_NOW;
  if (!raw || process.env.NODE_ENV === "production") return null;
  const t = Date.parse(raw);
  return Number.isNaN(t) ? null : t;
}

export function nowMs(): number {
  return fixedNow() ?? Date.now() + clientOffsetMs;
}

export function nowIso(): string {
  return new Date(nowMs()).toISOString();
}

export function nowDate(): Date {
  return new Date(nowMs());
}

// Called once in the browser with the server's timestamp.
export function syncClientClock(serverNowMs: number): void {
  if (typeof window === "undefined") return;
  clientOffsetMs = serverNowMs - Date.now();
}

// "Monday, September 28, 2026" / "09:31 PM" in a timezone (header format).
export function formatSystemDate(ms: number, tz: string, locale = "en-US"): string {
  return new Intl.DateTimeFormat(locale, { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: tz }).format(new Date(ms));
}

export function formatSystemTime(ms: number, tz: string, locale = "en-US"): string {
  return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: tz }).format(new Date(ms));
}
