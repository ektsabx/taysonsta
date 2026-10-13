"use client";

import { useEffect } from "react";

// "Yolias is open" (D-214): pings /api/activity when the app opens and every
// minute while the tab is visible. The server groups pings into sessions
// (a new session after 30 quiet minutes). Nothing about the page is sent.
export function ActivityPing() {
  useEffect(() => {
    const ping = () => {
      if (document.visibilityState !== "visible") return;
      void fetch("/api/activity", { method: "POST", keepalive: true }).catch(() => {});
    };
    ping();
    const timer = window.setInterval(ping, 60_000);
    document.addEventListener("visibilitychange", ping);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", ping);
    };
  }, []);
  return null;
}
