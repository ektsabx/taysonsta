// Free times on a booking page (D-267): the page's weekly hours in its time
// zone, as many meetings of `duration` as fit with `buffer` after each, from
// `min notice` ahead up to `window` days, minus the host's scheduled meetings
// (and their break). Pure functions, no imports: tested on their own.

export type Day = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";
export const DAYS: Day[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export interface AvailabilityRules {
  duration_min: number;
  buffer_min: number;
  min_notice_hours: number;
  window_days: number;
  timezone: string;
  hours: Record<Day, [string, string][]>;
}

/** Milliseconds to add to a UTC instant to read it as wall-clock time in `tz`. */
export function tzOffset(at: Date, tz: string): number {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
    .formatToParts(at).filter((x) => x.type !== "literal").map((x) => [x.type, Number(x.value)]));
  return Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second) - Math.floor(at.getTime() / 1000) * 1000;
}

/** The UTC instant of a wall-clock time ("2026-11-02", "10:30") in `tz`, daylight saving included. */
export function zoned(day: string, time: string, tz: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  let at = new Date(wall - tzOffset(new Date(wall), tz));
  at = new Date(wall - tzOffset(at, tz));
  return at;
}

/** "YYYY-MM-DD" and weekday of an instant in `tz`. */
export function localDay(at: Date, tz: string): { day: string; weekday: Day } {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" }).formatToParts(at).map((x) => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, weekday: p.weekday.slice(0, 3).toLowerCase() as Day };
}

const addDays = (day: string, n: number) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

export interface Busy { start: string; end: string }
export interface DaySlots { day: string; slots: string[] }

export function freeSlots(r: AvailabilityRules, busy: Busy[], now = new Date()): DaySlots[] {
  const len = r.duration_min * 60_000;
  const step = (r.duration_min + r.buffer_min) * 60_000;
  const earliest = now.getTime() + r.min_notice_hours * 3_600_000;
  const taken = busy.map((b) => ({ s: Date.parse(b.start) - r.buffer_min * 60_000, e: Date.parse(b.end) + r.buffer_min * 60_000 }));
  const out: DaySlots[] = [];
  const first = localDay(now, r.timezone).day;
  for (let i = 0; i <= r.window_days; i++) {
    const day = addDays(first, i);
    const weekday = DAYS[new Date(`${day}T12:00:00Z`).getUTCDay()];
    const slots: string[] = [];
    for (const [from, to] of r.hours[weekday] ?? []) {
      const end = zoned(day, to, r.timezone).getTime();
      for (let t = zoned(day, from, r.timezone).getTime(); t + len <= end; t += step) {
        if (t < earliest) continue;
        if (taken.some((b) => t < b.e && t + len > b.s)) continue;
        slots.push(new Date(t).toISOString());
      }
    }
    if (slots.length) out.push({ day, slots });
  }
  return out;
}

/** True when `start` is one of the page's free slots right now (checked again when booking). */
export function isFree(r: AvailabilityRules, busy: Busy[], start: string, now = new Date()): boolean {
  const t = new Date(start).toISOString();
  return freeSlots(r, busy, now).some((d) => d.slots.includes(t));
}

/** "HH:MM" from 00:00 to 23:59. */
export const isTime = (v: unknown): v is string => typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
