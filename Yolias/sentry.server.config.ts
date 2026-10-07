// Sentry on the server (Next.js on Cloudflare Workers via OpenNext; wrangler
// has nodejs_compat and a 2026 compatibility date, which the SDK needs).
// Off unless a DSN is set. Errors from pages, route handlers, server actions
// and the worker reach Sentry through instrumentation.ts (onRequestError).
import * as Sentry from "@sentry/nextjs";
import { appEnv, release } from "@/lib/monitoring/env";
import { scrubEvent, sentryDataCollection } from "@/lib/monitoring/scrub";

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: appEnv,
  release,
  dataCollection: sentryDataCollection,
  tracesSampleRate: appEnv === "production" ? 0.1 : 1,
  beforeSend: scrubEvent,
  beforeSendTransaction: scrubEvent,
});
