"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Re-renders the server page every few seconds while `active`. */
export function AutoRefresh({ active, everyMs = 3000 }: { active: boolean; everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => router.refresh(), everyMs);
    return () => window.clearInterval(id);
  }, [active, everyMs, router]);
  return null;
}
