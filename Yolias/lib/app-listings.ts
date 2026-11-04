// Integrations and add-ons (owner, 2026-11-05): one list for the Integrations
// page, one detail page for each, and what Yolias Admin may change for each
// (screenshots, version, download, Chrome Web Store link).

export type AppKey = "gmail" | "imap" | "google-calendar" | "pixel-helper";
export type AppCategory = "email" | "calendar" | "tracking";
export const APP_KEYS: AppKey[] = ["gmail", "imap", "google-calendar", "pixel-helper"];
export const APP_CATEGORY: Record<AppKey, AppCategory> = { gmail: "email", imap: "email", "google-calendar": "calendar", "pixel-helper": "tracking" };
export const APP_HELP: Partial<Record<AppKey, string>> = { gmail: "/help-center/connect-gmail", imap: "/help-center/connect-imap-smtp", "google-calendar": "/help-center/google-calendar", "pixel-helper": "/help-center/pixel-and-events" };
export const isAppKey = (v: unknown): v is AppKey => typeof v === "string" && (APP_KEYS as string[]).includes(v);

export interface AppListing { screenshots: string[]; version: string | null; downloadUrl: string | null; storeUrl: string | null }

const HELPER_ZIP = "/downloads/yolias-pixel-helper.zip";
const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.length > 0) : []);

/** What Admin saved for one app, over the defaults that ship with Yolias. Pure. */
export function listingOf(key: AppKey, saved: unknown, locale: "en" | "ar"): AppListing {
  const s = (saved && typeof saved === "object" ? (saved as Record<string, unknown>)[key] : null) as Record<string, unknown> | null;
  const shots = list(s?.screenshots);
  const fallback = key === "pixel-helper" ? [`/integrations/pixel-helper-${locale}.png`] : [`/integrations/${key}-${locale}.png`];
  return {
    screenshots: shots.length ? shots : fallback,
    version: text(s?.version) ?? (key === "pixel-helper" ? "1.0.0" : null),
    downloadUrl: text(s?.download_url) ?? (key === "pixel-helper" ? HELPER_ZIP : null),
    storeUrl: text(s?.store_url),
  };
}
