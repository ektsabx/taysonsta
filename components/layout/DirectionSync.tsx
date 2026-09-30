"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { defaultLocale, directionForLocale, isLocale } from "@/lib/i18n";

export function DirectionSync() {
  const pathname = usePathname();

  useEffect(() => {
    // The admin sets lang/dir from the user's BOS language (I18nProvider).
    if (pathname.startsWith("/admin")) return;
    const segment = pathname.split("/").filter(Boolean)[0] ?? "";
    const locale = isLocale(segment) ? segment : defaultLocale;
    document.documentElement.lang = locale;
    document.documentElement.dir = directionForLocale(locale);
  }, [pathname]);

  return null;
}
