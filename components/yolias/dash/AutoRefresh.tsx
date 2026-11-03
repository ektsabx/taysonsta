"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Reloads the page's numbers on the server every few seconds (D-276, live users).
export function AutoRefresh({ seconds = 30 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}
