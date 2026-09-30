"use client";

import { Tx } from "@/components/bos/I18n";
import { nowMs } from "@/lib/bos/clock";

import { useEffect, useState } from "react";

// Live HH:MM:SS since a timestamp (current attendance session).
export function LiveTimer({ since }: { since: string }) {
  const [now, setNow] = useState(() => nowMs());
  useEffect(() => {
    const t = setInterval(() => setNow(nowMs()), 1000);
    return () => clearInterval(t);
  }, []);
  const s = Math.max(0, Math.floor((now - new Date(since).getTime()) / 1000));
  const txt = [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, "0")).join(":");
  return <span className="bos-num" suppressHydrationWarning><Tx>{txt}</Tx></span>;
}
