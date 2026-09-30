import { NextResponse, type NextRequest } from "next/server";
import { receiveWebhook, verifyMetaSubscription } from "@/services/bos/webhooks";
import { logServerError } from "@/lib/bos/errors";

// Public webhook endpoint for Integration Hub providers
// (docs/bos/30 §7): /api/bos/webhooks/<provider>. Signature-verified,
// idempotent, fast (heavy work belongs to the provider handler / cron).

export async function POST(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (!/^[a-z0-9_]{2,40}$/.test(provider)) return new NextResponse("not found", { status: 404 });
  try {
    const raw = await request.text();
    // Twilio signs the public URL it called; behind a proxy use the forwarded host.
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
    const url = host ? `${proto}://${host}${request.nextUrl.pathname}${request.nextUrl.search}` : request.url;
    const r = await receiveWebhook(provider, request.headers, raw, url);
    return new NextResponse(r.body, { status: r.status });
  } catch (e) {
    logServerError(`webhook:${provider}`, e);
    return new NextResponse("error", { status: 500 }); // provider retries later
  }
}

// Meta-style subscription verification (hub.mode / hub.verify_token / hub.challenge).
export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const sp = request.nextUrl.searchParams;
  const r = await verifyMetaSubscription(provider, sp.get("hub.mode"), sp.get("hub.verify_token"), sp.get("hub.challenge"));
  return new NextResponse(r.body, { status: r.status });
}
