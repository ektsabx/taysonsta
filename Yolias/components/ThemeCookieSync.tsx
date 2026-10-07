"use client";

import { useEffect } from "react";
import { THEME_COOKIE } from "@/lib/theme";

// Signed in: the account's theme is the source of truth. Keep this browser's
// cookie equal to it, so pages rendered without the account (sign-in, public
// pages, a new tab before the session loads) show the same theme.
export function ThemeCookieSync({ theme }: { theme: string }) {
  useEffect(() => {
    if (document.cookie.match(/(?:^|;\s*)yolias_theme=(\w+)/)?.[1] === theme) return;
    const secure = location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${THEME_COOKIE}=${theme}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax${secure}`;
  }, [theme]);
  return null;
}
