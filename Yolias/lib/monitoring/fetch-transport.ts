import { createTransport, type BaseTransportOptions } from "@sentry/core";

// Sentry's server transport uses Node's https.request, which doesn't deliver
// from a Cloudflare Worker (events were captured but never sent). This one
// uses fetch, which Workers support natively (Sentry's own advice for
// Next.js on Workers). Same envelope, headers and rate-limit handling.
export function makeFetchTransport(options: BaseTransportOptions) {
  return createTransport(options, async (request) => {
    const res = await fetch(options.url, { method: "POST", body: request.body as BodyInit, headers: options.headers });
    return {
      statusCode: res.status,
      headers: { "x-sentry-rate-limits": res.headers.get("X-Sentry-Rate-Limits"), "retry-after": res.headers.get("Retry-After") },
    };
  });
}
