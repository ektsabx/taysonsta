import "server-only";
import { cache } from "react";
import { nowMs, formatSystemDate, formatSystemTime } from "@/lib/bos/clock";
import { DEFAULT_TZ, todayIn } from "@/lib/bos/format";
import { getSetting } from "@/lib/bos/settings";

// The system date/time context for one request (docs/bos/28 §29): one
// instant and the company timezone, shared by every server component,
// service and action rendered in that request.
export interface SystemTime {
  ms: number;
  iso: string;
  timezone: string;
  today: string;
  dateLabel: string;
  timeLabel: string;
}

export const getSystemTime = cache(async (): Promise<SystemTime> => {
  const company = (await getSetting("company")) as { timezone?: string | null };
  const timezone = company.timezone || DEFAULT_TZ;
  const ms = nowMs();
  return {
    ms,
    iso: new Date(ms).toISOString(),
    timezone,
    today: todayIn(timezone, new Date(ms)),
    dateLabel: formatSystemDate(ms, timezone),
    timeLabel: formatSystemTime(ms, timezone),
  };
});

// Company "today" (YYYY-MM-DD).
export async function companyToday(): Promise<string> {
  return (await getSystemTime()).today;
}
