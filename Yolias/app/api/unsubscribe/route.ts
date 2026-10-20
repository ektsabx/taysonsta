import { NextResponse, type NextRequest } from "next/server";
import { unsubscribeByToken } from "@/lib/messaging/unsubscribe";

// One-click unsubscribe (RFC 8058, the List-Unsubscribe-Post header): mail
// apps POST here without showing a page. GET never unsubscribes (link
// scanners open links); it sends people to the confirmation page.
export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("t") ?? "";
  const done = await unsubscribeByToken(token);
  return NextResponse.json({ ok: Boolean(done) }, { status: done ? 200 : 404 });
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("t") ?? "";
  return NextResponse.redirect(new URL(`/unsubscribe/${encodeURIComponent(token)}`, request.url));
}
