// Sentry on the server (Next.js on Cloudflare Workers via OpenNext; wrangler
// has nodejs_compat and a 2026 compatibility date, which the SDK needs).
// Off unless a DSN is set. Errors from pages, route handlers, server actions
// and the worker reach Sentry through instrumentation.ts (onRequestError).
import * as Sentry from "@sentry/nextjs";
import { appEnv, release } from "@/lib/monitoring/env";
import { makeFetchTransport } from "@/lib/monitoring/fetch-transport";
import { scrubEvent, sentryDataCollection } from "@/lib/monitoring/scrub";

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
const WORKER_UNSAFE = new Set(["ContextLines", "LocalVariables", "LocalVariablesAsync", "ChildProcess", "WorkerThreads", "ProcessSession", "Modules", "OnUncaughtException", "OnUnhandledRejection"]);

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  transport: makeFetchTransport,
  // Node integrations that read files, use the inspector or watch processes
  // can't work in a Cloudflare Worker and held events back from being sent.
  integrations: (defaults) => defaults.filter((i) => !WORKER_UNSAFE.has(i.name)),
  environment: appEnv,
  release,
  dataCollection: sentryDataCollection,
  tracesSampleRate: appEnv === "production" ? 0.1 : 1,
  beforeSend: scrubEvent,
  beforeSendTransaction: scrubEvent,
});
