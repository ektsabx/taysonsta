/** The invitation a browser is following through sign-up or sign-in (audit, 2026-11-10). */
export const JOIN_COOKIE = "yolias_join";
export const isToken = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
