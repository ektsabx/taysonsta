import { timingSafeEqual } from "node:crypto";
import * as Sentry from "@sentry/nextjs";
import { NextResponse, type NextRequest } from "next/server";
import { capture } from "@/lib/analytics/server";
import { appEnv } from "@/lib/monitoring/env";

// Sends one test error to Sentry and one test event to PostHog, to check the
// setup on any environment (D-152). Protected by WORKER_SECRET like
// /api/worker; never callable from a browser session.
export async function POST(req: NextRequest) {
  const secret = process.env.WORKER_SECRET;
  const got = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || got.length !== secret.length || !timingSafeEqual(Buffer.from(got), Buffer.from(secret))) return NextResponse.json({ error: "not found" }, { status: 404 });
  const sentryEventId = Sentry.captureException(new Error(`Yolias monitoring test (${appEnv})`));
  const sentryDelivered = await Sentry.flush(5000);
  await capture("monitoring-test", "signed_in", { test: true, environment_check: appEnv });
  return NextResponse.json({ environment: appEnv, sentry: { enabled: Boolean(Sentry.getClient()?.getDsn()), eventId: sentryEventId, delivered: sentryDelivered }, posthog: { enabled: Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY) } });
}
