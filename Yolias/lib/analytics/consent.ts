// Cookie consent (Cookie Policy): "all" allows analytics cookies (PostHog,
// Microsoft Clarity) and Meta Pixel; "essential" keeps only what the app needs.
// Until a choice is made, PostHog keeps its id in memory only (no cookie)
// and Meta Pixel and Clarity don't load.
export const CONSENT_COOKIE = "yolias_consent";
export const CONSENT_EVENT = "yolias:consent";
export type Consent = "all" | "essential";

export function readConsent(): Consent | null {
  if (typeof document === "undefined") return null;
  const v = document.cookie.match(/(?:^|;\s*)yolias_consent=(all|essential)/)?.[1];
  return (v as Consent | undefined) ?? null;
}

export function writeConsent(value: Consent) {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CONSENT_COOKIE}=${value}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax${secure}`;
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: value }));
}
