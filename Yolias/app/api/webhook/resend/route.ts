import { NextResponse, type NextRequest } from "next/server";
import { integrationSecret, loadIntegrations } from "@/lib/integrations";
import { applyResendEvent, verifySvix, type ResendEvent } from "@/lib/messaging/webhook";

// Resend delivery events (D-243): POST /api/webhook/resend, public (the Svix
// signature is the authentication). Without a signing secret the endpoint
// refuses everything; nothing is accepted unsigned.
export async function POST(request: NextRequest) {
  await loadIntegrations();
  const secret = integrationSecret("resend_webhook", "webhook_secret");
  if (!secret) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  const body = await request.text();
  const headers = { id: request.headers.get("svix-id") ?? "", timestamp: request.headers.get("svix-timestamp") ?? "", signature: request.headers.get("svix-signature") ?? "" };
  if (!(await verifySvix(secret, headers, body))) return NextResponse.json({ error: "invalid_signature" }, { status: 403 });
  let event: ResendEvent;
  try {
    event = JSON.parse(body) as ResendEvent;
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  if (typeof event?.type !== "string") return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  try {
    const result = await applyResendEvent(headers.id, event);
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    console.error("[resend webhook]", e instanceof Error ? e.message : e);
    // 500: Resend retries the delivery later.
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
