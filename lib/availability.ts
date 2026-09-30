import { nowMs } from "@/lib/bos/clock";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { addDays, addMinutes, format, isBefore } from "date-fns";

export interface AvailabilityRule {
  weekday: number;
  start_time: string;
  end_time: string;
  slot_minutes: number;
  timezone: string;
}

export interface TimeSlot {
  startIso: string;
  endIso: string;
}

export function generateAvailableSlots(
  rules: AvailabilityRule[],
  bookedStartIsos: string[],
  daysAhead = 21,
  now: Date = new Date(nowMs()),
  durationMinutesOverride?: number
): Record<string, TimeSlot[]> {
  const bookedSet = new Set(bookedStartIsos);
  const result: Record<string, TimeSlot[]> = {};

  if (rules.length === 0) {
    return result;
  }

  const timezone = rules[0].timezone;
  const nowInTz = toZonedTime(now, timezone);
  const todayStartInTz = new Date(nowInTz.getFullYear(), nowInTz.getMonth(), nowInTz.getDate());

  for (let dayOffset = 0; dayOffset < daysAhead; dayOffset++) {
    const dayInTz = addDays(todayStartInTz, dayOffset);
    const weekday = dayInTz.getDay();
    const rule = rules.find((r) => r.weekday === weekday);
    if (!rule) {
      continue;
    }

    const dateKey = format(dayInTz, "yyyy-MM-dd");
    const [startH, startM] = rule.start_time.split(":").map(Number);
    const [endH, endM] = rule.end_time.split(":").map(Number);

    const dayStartWallClock = new Date(
      dayInTz.getFullYear(),
      dayInTz.getMonth(),
      dayInTz.getDate(),
      startH,
      startM,
      0,
      0
    );
    const dayEndWallClock = new Date(
      dayInTz.getFullYear(),
      dayInTz.getMonth(),
      dayInTz.getDate(),
      endH,
      endM,
      0,
      0
    );

    let cursorUtc = fromZonedTime(dayStartWallClock, rule.timezone);
    const endUtc = fromZonedTime(dayEndWallClock, rule.timezone);

    const slotMinutes = durationMinutesOverride ?? rule.slot_minutes;
    const slots: TimeSlot[] = [];
    while (isBefore(cursorUtc, endUtc)) {
      const slotEndUtc = addMinutes(cursorUtc, slotMinutes);
      const startIso = cursorUtc.toISOString();
      if (!isBefore(endUtc, slotEndUtc) && !bookedSet.has(startIso) && isBefore(now, cursorUtc)) {
        slots.push({ startIso, endIso: slotEndUtc.toISOString() });
      }
      cursorUtc = slotEndUtc;
    }

    if (slots.length > 0) {
      result[dateKey] = slots;
    }
  }

  return result;
}
