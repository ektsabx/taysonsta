import { z } from "zod";

// Email sending rules (D-256, after AgentSDR Settings → Email → Sending
// rules): how many emails a new mailbox sends a day, the random gap between
// two emails from one mailbox, and the days and hours a mailbox may send, in
// its time zone. The workspace keeps the defaults (workspaces.sending_rules);
// each mailbox keeps its own days, hours and zone. Only campaign emails wait
// for the window: a reply the member sends, or an answer to a question, does not.
// The window check follows AgentSDR's src/lib/outreach/workingHours.ts (MIT,
// github.com/Kandid-ai/AgentSDR), written here with Intl instead of date-fns-tz.

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export const sendingRulesSchema = z.object({
  daily_per_mailbox: z.number().int().min(1).max(500),
  gap_min: z.number().int().min(0).max(240),
  gap_max: z.number().int().min(0).max(240),
  days: z.array(z.number().int().min(0).max(6)).max(7),
  start: z.string().regex(HHMM),
  end: z.string().regex(HHMM),
  timezone: z.string().max(64).nullable(),
}).refine((r) => r.gap_max >= r.gap_min, { path: ["gap_max"] });
export type SendingRules = z.infer<typeof sendingRulesSchema>;

/** AgentSDR's defaults: 30 a day, 18 to 24 minutes apart, Monday to Friday 09:00 to 18:00. */
export const DEFAULT_SENDING_RULES: SendingRules = { daily_per_mailbox: 30, gap_min: 18, gap_max: 24, days: [1, 2, 3, 4, 5], start: "09:00", end: "18:00", timezone: null };

/** A stored value read leniently: each bad or missing key falls back to its default. */
export function parseSendingRules(raw: unknown): SendingRules {
  const v = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const out = { ...DEFAULT_SENDING_RULES, days: [...DEFAULT_SENDING_RULES.days] };
  const shape = sendingRulesSchema.shape;
  for (const k of Object.keys(shape) as (keyof SendingRules)[]) {
    const one = shape[k].safeParse(v[k]);
    if (one.success) (out as Record<string, unknown>)[k] = one.data;
  }
  if (out.gap_max < out.gap_min) out.gap_max = out.gap_min;
  if (out.timezone && !validTimeZone(out.timezone)) out.timezone = null;
  out.days = [...new Set(out.days)].sort();
  return out;
}

export function validTimeZone(tz: string): boolean {
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; } catch { return false; }
}

const minutesOf = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** Weekday (0 = Sunday) and minutes since midnight at `now` in `tz`. */
export function localClock(now: Date, tz: string): { day: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { day, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

export interface SendWindow { days: number[]; start: string; end: string; timeZone: string }

/**
 * True when `now` is inside the window. An overnight window (21:00 to 06:00)
 * belongs to the day it starts on, as in AgentSDR; start = end means all day.
 */
export function withinWindow(w: SendWindow, now: Date = new Date()): boolean {
  const tz = validTimeZone(w.timeZone) ? w.timeZone : "UTC";
  const { day, minutes } = localClock(now, tz);
  const s = minutesOf(w.start), e = minutesOf(w.end);
  if (s === e) return w.days.includes(day);
  if (s < e) return w.days.includes(day) && minutes >= s && minutes < e;
  // Overnight: after the start on an enabled day, or before the end on the day after one.
  return (w.days.includes(day) && minutes >= s) || (w.days.includes((day + 6) % 7) && minutes < e);
}

/** The mailbox's window: its own days and hours, in its zone, else the workspace's, else the member's. */
export function mailboxWindow(m: { send_days: number[]; send_start: string; send_end: string; time_zone: string | null }, rules: SendingRules, memberTimeZone: string | null): SendWindow {
  const tz = [m.time_zone, rules.timezone, memberTimeZone, "UTC"].find((z) => z && validTimeZone(z))!;
  return { days: m.send_days, start: m.send_start, end: m.send_end, timeZone: tz };
}

/** The wait after one campaign email, a random whole minute between the gap's ends. */
export function nextGapMs(rules: Pick<SendingRules, "gap_min" | "gap_max">, random: () => number = Math.random): number {
  const min = rules.gap_min, max = Math.max(rules.gap_max, rules.gap_min);
  return (min + Math.floor(random() * (max - min + 1))) * 60_000;
}

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/**
 * The campaign's own running days and contact hours (D-272), in its time zone;
 * null when it sets none (only the mailbox's window applies). Sending needs
 * both windows to be open.
 */
export function campaignWindow(c: { run_days: string[] | null; contact_from: string | null; contact_to: string | null; timezone: string | null }, fallbackZone: string): SendWindow | null {
  const days = (c.run_days ?? []).map((d) => DAY_KEYS.indexOf(d)).filter((d) => d >= 0);
  if (!c.contact_from && !c.contact_to && (!days.length || days.length === 7)) return null;
  return {
    days: days.length ? days : [0, 1, 2, 3, 4, 5, 6],
    start: (c.contact_from ?? "00:00").slice(0, 5), end: (c.contact_to ?? c.contact_from ?? "00:00").slice(0, 5),
    timeZone: c.timezone && validTimeZone(c.timezone) ? c.timezone : fallbackZone,
  };
}
