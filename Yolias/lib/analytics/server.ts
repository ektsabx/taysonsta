import "server-only";
import { after } from "next/server";
import { appEnv, release } from "@/lib/monitoring/env";

// Product events from the server (PostHog capture API): the ones that must
// count even when the browser blocks scripts — payments, deliveries, sends.
// Off unless NEXT_PUBLIC_POSTHOG_KEY is set. The user's id is the distinct id;
// properties are counts, ids and plan names — never emails, names, message
// text or card data.

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = (process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com").replace(/\/$/, "");

export type ServerEvent =
  | "signed_up"
  | "signed_in"
  | "onboarding_completed"
  | "company_profile_updated"
  | "search_started"
  | "campaign_started"
  | "results_delivered"
  | "qualification_completed"
  | "people_revealed"
  | "decision_makers_requested"
  | "outreach_started"
  | "outreach_sent"
  | "outreach_failed"
  | "checkout_started"
  | "payment_succeeded"
  | "payment_failed"
  | "plan_started"
  | "plan_canceled"
  | "prospects_pack_bought";

type Props = Record<string, string | number | boolean | null | undefined>;

async function send(distinctId: string, event: ServerEvent, properties: Props) {
  try {
    await fetch(`${HOST}/i/v0/e/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: KEY,
        event,
        distinct_id: distinctId,
        timestamp: new Date().toISOString(),
        properties: { ...properties, environment: appEnv, release, $lib: "yolias-server" },
      }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Analytics never breaks the product.
  }
}

/** Records an event after the response is sent (or right away outside a request, e.g. the worker). */
export async function capture(distinctId: string | null | undefined, event: ServerEvent, properties: Props = {}) {
  if (!KEY || !distinctId) return;
  try {
    after(() => send(distinctId, event, properties));
  } catch {
    await send(distinctId, event, properties);
  }
}
