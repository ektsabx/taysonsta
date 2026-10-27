// Product analytics in the browser (PostHog) and ad measurement (Meta Pixel).
// PostHog is off unless NEXT_PUBLIC_POSTHOG_KEY is set; Meta Pixel unless
// NEXT_PUBLIC_META_PIXEL_ID is set and the visitor accepted cookies.
// No autocapture and no session recording: only the named events below, so
// prospect names, emails and form contents never reach PostHog.
import posthog from "posthog-js";
import { appEnv, release } from "@/lib/monitoring/env";
import { scrubUrl } from "@/lib/monitoring/scrub";
import { CONSENT_EVENT, readConsent, type Consent } from "./consent";

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";
export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID?.match(/^\d{6,20}$/)?.[0] ?? null;

let started = false;

export function initAnalytics() {
  if (started || !KEY || typeof window === "undefined") return;
  started = true;
  posthog.init(KEY, {
    api_host: HOST,
    defaults: "2026-08-30",
    capture_pageview: "history_change",
    capture_pageleave: true,
    autocapture: false,
    disable_session_recording: true,
    // Yolias uses no feature flags, surveys, tours, experiments or remote
    // config. Their /flags request timed out on slow mobile networks and
    // surfaced as unhandled rejections (YOLIAS-B, YOLIAS-C); without it,
    // PostHog only sends the named events.
    advanced_disable_flags: true,
    disable_surveys: true,
    disable_product_tours: true,
    disable_conversations: true,
    disable_web_experiments: true,
    disable_external_dependency_loading: true,
    person_profiles: "identified_only",
    persistence: readConsent() === "all" ? "localStorage+cookie" : "memory",
    before_send: (event) => {
      if (!event) return event;
      const p = event.properties ?? {};
      for (const k of ["$current_url", "$referrer", "$initial_current_url", "$initial_referrer", "$prev_pageview_pathname"]) {
        if (typeof p[k] === "string") p[k] = scrubUrl(p[k] as string);
      }
      return event;
    },
  });
  posthog.register({ environment: appEnv, release });
  window.addEventListener(CONSENT_EVENT, (e) => {
    const value = (e as CustomEvent<Consent>).detail;
    posthog.set_config({ persistence: value === "all" ? "localStorage+cookie" : "memory" });
  });
}

export type ClientEvent =
  | "checkout_viewed"
  | "checkout_started"
  | "buy_more_opened"
  | "signup_started"
  | "signin_started"
  | "purchase_confirmed";

/** A product event from the browser. Properties must not hold personal data. */
export function track(event: ClientEvent, properties?: Record<string, string | number | boolean | null | undefined>) {
  if (!started) return;
  try {
    posthog.capture(event, properties);
  } catch {
    // Analytics never breaks the product.
  }
}

export function identify(userId: string, props: { workspace_id: string; plan: string | null; role: string; locale: string }) {
  if (!started) return;
  if (posthog.get_distinct_id() !== userId) posthog.identify(userId, props);
  else posthog.setPersonProperties(props);
}

export function resetIdentity() {
  if (started && posthog._isIdentified()) posthog.reset();
}

type Fbq = ((...args: unknown[]) => void) & { callMethod?: (...a: unknown[]) => void; queue?: unknown[][]; push?: unknown; loaded?: boolean; version?: string };
type MetaEvent = "PageView" | "InitiateCheckout" | "Purchase" | "CompleteRegistration" | "Lead";
const pendingMeta: unknown[][] = [];

/** Meta Pixel base code (developers.facebook.com), run only after consent. Sends the first PageView. */
export function loadMetaPixel() {
  const w = window as unknown as { fbq?: Fbq; _fbq?: Fbq };
  if (!META_PIXEL_ID || w.fbq) return;
  // Same as the official snippet: Meta's script reads the arguments object and `this`.
  const n = function (this: unknown) {
    // eslint-disable-next-line prefer-rest-params, prefer-spread
    if (n.callMethod) n.callMethod.apply(n, arguments as unknown as unknown[]);
    // eslint-disable-next-line prefer-rest-params
    else n.queue!.push(arguments as unknown as unknown[]);
  } as unknown as Fbq;
  w.fbq = n; w._fbq = n;
  n.push = n; n.loaded = true; n.version = "2.0"; n.queue = [];
  const t = document.createElement("script");
  t.async = true;
  t.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(t);
  // No automatic events: they make Meta's script scan the page's elements
  // (signals/iwl.js), which threw "getBoundingClientRect is not a function"
  // on our pages (YOLIAS-5). Yolias sends its own named events.
  n("set", "autoConfig", false, META_PIXEL_ID);
  n("init", META_PIXEL_ID);
  n("track", "PageView");
  for (const args of pendingMeta.splice(0)) n(...args);
}

const CLARITY_ID = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID?.trim().match(/^[a-z0-9]+$/i)?.[0] ?? null;

/** Microsoft Clarity tag (clarity.microsoft.com), run only after consent. */
export function loadClarity() {
  const w = window as unknown as { clarity?: unknown };
  if (!CLARITY_ID || w.clarity) return;
  const c = function (...args: unknown[]) { (c.q = c.q || []).push(args); } as ((...a: unknown[]) => void) & { q?: unknown[][] };
  w.clarity = c;
  const t = document.createElement("script");
  t.async = true;
  t.src = `https://www.clarity.ms/tag/${CLARITY_ID}`;
  document.head.appendChild(t);
}

/**
 * A standard Meta Pixel event. Sent only with consent; if the pixel isn't
 * loaded yet it waits for it. eventID lets Meta drop duplicates.
 */
export function metaTrack(name: MetaEvent, params?: Record<string, unknown>, eventId?: string) {
  if (!META_PIXEL_ID || readConsent() !== "all") return;
  const args: unknown[] = eventId ? ["track", name, params ?? {}, { eventID: eventId }] : params ? ["track", name, params] : ["track", name];
  const fbq = (window as unknown as { fbq?: Fbq }).fbq;
  if (fbq) fbq(...args);
  else pendingMeta.push(args);
}

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim().match(/^G-[A-Z0-9]{4,16}$/)?.[0] ?? null;

/**
 * Google Analytics 4 (gtag.js), run only after consent, for organic-search
 * sessions by landing page in Admin → SEO (D-257). No user id and no ad
 * features; page changes are tracked by GA4's own history-change measurement.
 */
export function loadGa4() {
  const w = window as unknown as { dataLayer?: unknown[]; gtag?: (...a: unknown[]) => void };
  if (!GA_ID || w.gtag) return;
  w.dataLayer = w.dataLayer || [];
  // gtag reads the arguments object, as in Google's snippet.
  w.gtag = function () {
    // eslint-disable-next-line prefer-rest-params
    w.dataLayer!.push(arguments);
  };
  w.gtag("js", new Date());
  w.gtag("config", GA_ID, { allow_google_signals: false, allow_ad_personalization_signals: false });
  const t = document.createElement("script");
  t.async = true;
  t.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(t);
}
