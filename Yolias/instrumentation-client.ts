// Runs in the browser before the app becomes interactive.
import * as Sentry from "@sentry/nextjs";
import { initAnalytics } from "@/lib/analytics/client";
import { appEnv, release } from "@/lib/monitoring/env";
import { scrubEvent, sentryDataCollection } from "@/lib/monitoring/scrub";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
const THIRD_PARTY_SCRIPTS = [/connect\.facebook\.net/i, /clarity\.ms/i, /^chrome-extension:\/\//i, /^moz-extension:\/\//i, /^safari-(web-)?extension:\/\//i];

// Client errors and page-load performance. No session replay and no
// personal data (lib/monitoring/scrub.ts).
Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: appEnv,
  release,
  dataCollection: sentryDataCollection,
  tracesSampleRate: appEnv === "production" ? 0.1 : 1,
  beforeSend: scrubEvent,
  beforeSendTransaction: scrubEvent,
  // Errors thrown inside third-party scripts (Meta Pixel, Clarity, browser
  // extensions) are not Yolias defects and can't be fixed here (YOLIAS-5).
  denyUrls: THIRD_PARTY_SCRIPTS,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

initAnalytics();
