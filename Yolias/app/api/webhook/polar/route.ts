import { NextResponse, type NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { webhooks } from "@polar-sh/sdk/2026-10";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadPolar } from "@/lib/payments/polar";
import { syncCustomerState, syncOrderPaid, type SyncResult } from "@/lib/payments/polar-sync";
import type { Json } from "@/types/database";

// Polar webhooks (D-185, applied since the owner's approval of 2026-10-13):
// POST /api/webhook/polar, public (the signature is the authentication). The
// raw body is verified with the SDK's validateEvent and the webhook secret
// from the Integrations hub; a bad signature is 403. Every delivery is stored
// by its webhook-id (Polar re-sends the same id on retries): a delivery that
// was already applied is acknowledged and skipped; one that failed is tried
// again. order.paid and customer.state_changed start / convert / renew / end
// the plan (lib/payments/polar-sync.ts); other events are stored, unused.

const CLAIM_MS = 2 * 60_000;

export async function POST(request: NextRequest) {
  const polar = await loadPolar();
  if (!polar?.webhookSecret) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const body = await request.text();
  const headers = {
    "webhook-id": request.headers.get("webhook-id") ?? "",
    "webhook-timestamp": request.headers.get("webhook-timestamp") ?? "",
    "webhook-signature": request.headers.get("webhook-signature") ?? "",
  };
  let event: Awaited<ReturnType<typeof webhooks.validateEvent>>;
  try {
    event = await webhooks.validateEvent(body, headers, polar.webhookSecret);
  } catch (e) {
    if (e instanceof webhooks.PolarWebhookVerificationError) return NextResponse.json({ received: false }, { status: 403 });
    // Signed but of a type this API version doesn't know: nothing to do.
    if (e instanceof webhooks.PolarWebhookUnknownTypeError) return NextResponse.json({ received: true, ignored: true });
    if (e instanceof webhooks.PolarWebhookError) return NextResponse.json({ received: false }, { status: 400 });
    throw e;
  }

  const handled = event.type === "order.paid" || event.type === "customer.state_changed";
  const db = createAdminClient();
  const id = headers["webhook-id"];
  const ins = await db.from("billing_webhook_events").insert({
    provider: "polar", webhook_id: id, event_type: event.type, payload: JSON.parse(body) as Json, status: handled ? "received" : "ignored",
  }).select("id").maybeSingle();
  let rowId = ins.data?.id ?? null;
  if (ins.error) {
    if (ins.error.code !== "23505") {
      Sentry.captureException(new Error("polar webhook store failed"), { tags: { area: "webhook", provider: "polar" }, extra: { event_type: event.type, code: ins.error.code } });
      return NextResponse.json({ received: false }, { status: 500 });
    }
    // A retry of a delivery we already have: apply it only if it never finished.
    const { data: prev } = await db.from("billing_webhook_events").select("id, status, processed_at, received_at").eq("provider", "polar").eq("webhook_id", id).single();
    if (!prev || prev.status === "processed" || prev.status === "ignored") return NextResponse.json({ received: true, duplicate: true });
    // Another request is applying it right now (claimed less than CLAIM_MS ago).
    if (prev.status === "received" && Date.now() - Date.parse(prev.processed_at ?? prev.received_at) < CLAIM_MS && prev.processed_at) {
      return NextResponse.json({ received: true, duplicate: true });
    }
    rowId = prev.id;
  }
  if (!handled || rowId == null) return NextResponse.json({ received: true, duplicate: false });

  // Claim (processed_at marks the attempt), then apply.
  await db.from("billing_webhook_events").update({ status: "received", processed_at: new Date().toISOString() }).eq("id", rowId);
  try {
    const r: SyncResult = event.type === "order.paid" ? await syncOrderPaid(polar, event.data) : await syncCustomerState(polar, event.data);
    await db.from("billing_webhook_events").update({ status: r.status, note: r.note.slice(0, 1000), processed_at: new Date().toISOString() }).eq("id", rowId);
    return NextResponse.json({ received: true, duplicate: Boolean(ins.error) });
  } catch (e) {
    console.error("[polar] webhook apply failed", event.type);
    Sentry.captureException(e, { tags: { area: "webhook", provider: "polar" }, extra: { event_type: event.type, webhook_row: rowId } });
    await db.from("billing_webhook_events").update({ status: "failed", note: (e instanceof Error ? e.message : "failed").slice(0, 300) }).eq("id", rowId);
    // Polar retries non-2xx deliveries.
    return NextResponse.json({ received: false }, { status: 500 });
  }
}
