import * as Sentry from "@sentry/nextjs";

// Next.js loads this once per server instance (docs/17-production.md).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.server.config");
  }
}

// Every server error Next.js catches (pages, route handlers, server actions,
// the proxy) goes to Sentry.
export const onRequestError = Sentry.captureRequestError;
