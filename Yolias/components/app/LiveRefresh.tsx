"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Keeps a page live while Yolias is working (D-269): a campaign being written
// and sent, or its conversations filling up. Refreshes the server data every
// few seconds while `active`, and stops when the tab is hidden.
export function LiveRefresh({ active, seconds = 5 }: { active: boolean; seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, seconds * 1000);
    return () => clearInterval(id);
  }, [active, seconds, router]);
  return null;
}
