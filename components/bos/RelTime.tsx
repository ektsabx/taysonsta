"use client";

import { relativeTime } from "@/lib/bos/format";
import { useLocale } from "@/components/bos/I18n";

// "5 minutes ago" in the interface language (docs/bos/30 §4).
export function RelTime({ value }: { value: string | Date | null | undefined }) {
  const locale = useLocale();
  return <span suppressHydrationWarning>{relativeTime(value, undefined, locale)}</span>;
}
