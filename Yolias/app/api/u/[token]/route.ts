import { NextResponse, type NextRequest } from "next/server";
import { unsubscribeLead } from "@/lib/outreach/unsubscribe";

// One-click unsubscribe from campaign emails (RFC 8058): mail apps POST the
// List-Unsubscribe address without showing a page. GET never unsubscribes
// (link scanners open links); it shows the confirmation page.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const done = await unsubscribeLead(token);
  return NextResponse.json({ ok: done }, { status: done ? 200 : 404 });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return NextResponse.redirect(new URL(`/u/${encodeURIComponent(token)}`, request.url));
}
