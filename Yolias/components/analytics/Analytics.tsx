"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { identify, loadClarity, loadGa4, loadMetaPixel, metaTrack, resetIdentity } from "@/lib/analytics/client";
import { CONSENT_EVENT, readConsent, type Consent } from "@/lib/analytics/consent";
import { ConsentBanner } from "./ConsentBanner";
import { encodeFirstTouch, firstTouch, FIRST_TOUCH_COOKIE, FIRST_TOUCH_MAX_AGE, isLandingPath } from "@/lib/attribution";

// The page this visit started on and the site that sent it, kept in memory
// only; written to the attribution cookie once the visitor accepts all cookies.
const landing = typeof window === "undefined" ? null : { href: window.location.href, referrer: document.referrer };

function rememberFirstTouch() {
  if (!landing || document.cookie.includes(`${FIRST_TOUCH_COOKIE}=`)) return;
  const url = new URL(landing.href);
  if (!isLandingPath(url.pathname)) return;
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${FIRST_TOUCH_COOKIE}=${encodeFirstTouch(firstTouch(url, landing.referrer || null))}; Path=/; Max-Age=${FIRST_TOUCH_MAX_AGE}; SameSite=Lax${secure}`;
}

export interface AnalyticsUser {
  userId: string;
  workspaceId: string;
  plan: string | null;
  role: string;
}

// Who is signed in (PostHog person = user id, no email), the cookie banner,
// and the scripts that need consent: Meta Pixel and Microsoft Clarity.
export function Analytics({ user, locale }: { user: AnalyticsUser | null; locale: string }) {
  const [consent, setConsent] = useState<Consent | null | undefined>(undefined);
  const pathname = usePathname();

  useEffect(() => {
    // Read the cookie after hydration (the server can't know it for cached pages).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConsent(readConsent());
    const on = (e: Event) => setConsent((e as CustomEvent<Consent>).detail);
    window.addEventListener(CONSENT_EVENT, on);
    return () => window.removeEventListener(CONSENT_EVENT, on);
  }, []);

  useEffect(() => {
    if (user) identify(user.userId, { workspace_id: user.workspaceId, plan: user.plan, role: user.role, locale });
    else resetIdentity();
  }, [user, locale]);

  // Meta PageView on every page (the first one is sent by the base code).
  const [firstPath] = useState(pathname);
  useEffect(() => {
    if (pathname !== firstPath) metaTrack("PageView");
  }, [pathname, firstPath]);

  useEffect(() => {
    if (consent !== "all") return;
    if (!user) rememberFirstTouch();
    loadMetaPixel();
    loadClarity();
    loadGa4();
  }, [consent, user]);

  return consent === null ? <ConsentBanner /> : null;
}
