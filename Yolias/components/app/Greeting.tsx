"use client";

import { useSyncExternalStore } from "react";
import { useI18n } from "@/lib/i18n/client";

// "Good afternoon, Sara" on Yolias AI and Analytics (owner brief 2026-10-19).
// The part of the day comes from the visitor's own clock, so it is read in
// the browser only (nothing is rendered on the server, no hydration mismatch).
const noop = () => () => {};
function partOfDay(): "morning" | "afternoon" | "evening" {
  const h = new Date().getHours();
  return h >= 5 && h < 12 ? "morning" : h >= 12 && h < 17 ? "afternoon" : "evening";
}

export function Greeting({ name, className = "app-greeting" }: { name: string | null; className?: string }) {
  const { t, locale } = useI18n();
  const part = useSyncExternalStore(noop, partOfDay, () => null);
  if (!part) return <p className={className} aria-hidden="true">&nbsp;</p>;
  return <p className={className}>{t.greeting[part]}{name ? `${locale === "ar" ? "، " : ", "}${name}` : ""}</p>;
}
