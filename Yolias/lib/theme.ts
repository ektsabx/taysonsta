// Theme (Light / Dark). Yolias is dark by default. The account is the source
// of truth (profiles.theme); the cookie mirrors it so every page — public,
// sign-in, checkout and the app — renders the same theme on the server, with
// no flash and no dependence on the device's system setting.
export type ThemePref = "light" | "dark";

export const THEME_COOKIE = "yolias_theme";
export const DEFAULT_THEME: ThemePref = "dark";

export function isThemePref(v: unknown): v is ThemePref {
  return v === "light" || v === "dark";
}

/** The account's choice, else this browser's last choice, else dark. */
export function resolveTheme(profileTheme: unknown, cookieTheme: unknown): ThemePref {
  return isThemePref(profileTheme) ? profileTheme : isThemePref(cookieTheme) ? cookieTheme : DEFAULT_THEME;
}

export const themeCookieOptions = { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" as const };
