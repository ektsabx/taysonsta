"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { identify, loadClarity, loadMetaPixel, metaTrack, resetIdentity } from "@/lib/analytics/client";
import { CONSENT_EVENT, readConsent, type Consent } from "@/lib/analytics/consent";
import { ConsentBanner } from "./ConsentBanner";

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
    loadMetaPixel();
    loadClarity();
  }, [consent]);

  return consent === null ? <ConsentBanner /> : null;
}
