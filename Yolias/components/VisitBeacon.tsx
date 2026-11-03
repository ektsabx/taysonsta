"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { CONSENT_EVENT, readConsent } from "@/lib/analytics/consent";

// Counts page views for Yolias Admin (D-276, lib/visits.ts). With analytics
// cookies accepted, a random visitor id is kept in the yolias_vid cookie so
// returning visitors are recognized; without it nothing is stored on the
// device and the server counts the day's visitor on its own.
const VID = "yolias_vid";
// The same page reported twice within a moment (React's development mode runs effects twice) counts once.
let last = { path: "", at: 0 };

function visitorId(): string | null {
  if (readConsent() !== "all") return null;
  const have = document.cookie.match(/(?:^|;\s*)yolias_vid=(v_[a-z0-9]{16,40})/)?.[1];
  if (have) return have;
  const id = `v_${crypto.randomUUID().replace(/-/g, "")}`;
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${VID}=${id}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax${secure}`;
  return id;
}

export function VisitBeacon({ locale }: { locale: string }) {
  const pathname = usePathname();
  const search = useSearchParams();
  useEffect(() => {
    const path = `${pathname}${search.size ? `?${search}` : ""}`;
    if (last.path === path && Date.now() - last.at < 2000) return;
    last = { path, at: Date.now() };
    const payload = JSON.stringify({ p: path, r: document.referrer || null, v: visitorId(), l: locale });
    const sent = navigator.sendBeacon?.("/api/v", new Blob([payload], { type: "application/json" }));
    if (!sent) void fetch("/api/v", { method: "POST", body: payload, headers: { "content-type": "application/json" }, keepalive: true }).catch(() => {});
  }, [pathname, search, locale]);
  // Choosing "essential only" later forgets the visitor id.
  useEffect(() => {
    const onConsent = (e: Event) => { if ((e as CustomEvent).detail === "essential") document.cookie = `${VID}=; Path=/; Max-Age=0; SameSite=Lax`; };
    window.addEventListener(CONSENT_EVENT, onConsent);
    return () => window.removeEventListener(CONSENT_EVENT, onConsent);
  }, []);
  return null;
}
