"use client";

import { useEffect, useState } from "react";
import { formatSystemDate, formatSystemTime, nowMs, syncClientClock } from "@/lib/bos/clock";

// Header date & time (docs/bos/28 §29), e.g. "Monday, September 28, 2026 ·
// 09:31 PM". Seeded from the server instant so the browser runs on the BOS
// clock, not on the device clock.
export function SystemClock({ serverNowMs, timezone }: { serverNowMs: number; timezone: string }) {
  const [now, setNow] = useState(serverNowMs);
  useEffect(() => {
    syncClientClock(serverNowMs);
    const tick = () => setNow(nowMs());
    const id = setInterval(tick, 15_000);
    tick();
    return () => clearInterval(id);
  }, [serverNowMs]);
  return (
    <div className="bos-system-clock" title={timezone} dir="ltr" suppressHydrationWarning>
      <span className="bos-system-clock-date">{formatSystemDate(now, timezone)}</span>
      <span className="bos-system-clock-time">{formatSystemTime(now, timezone)}</span>
    </div>
  );
}
