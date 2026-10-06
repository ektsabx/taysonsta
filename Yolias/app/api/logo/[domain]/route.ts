import { NextResponse } from "next/server";

// A company's icon by its domain, for result cards without a provider logo
// (D-147). Served from Yolias (cached a week) so the page never calls a
// third party directly; 404 when there's no real icon (the card shows the
// company's initials instead).
const DOMAIN = /^(?!-)[a-z0-9-]{1,63}(\.[a-z0-9-]{1,63})+$/i;

export async function GET(_req: Request, { params }: { params: Promise<{ domain: string }> }) {
  const domain = decodeURIComponent((await params).domain).toLowerCase().replace(/^www\./, "");
  if (!DOMAIN.test(domain) || domain.endsWith(".example") || domain.endsWith(".local")) return new NextResponse(null, { status: 404 });
  try {
    const res = await fetch(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`, { signal: AbortSignal.timeout(5_000) });
    const type = res.headers.get("content-type") ?? "";
    const body = res.ok && type.startsWith("image/") ? await res.arrayBuffer() : null;
    // Unknown domains come back 404 (with a generic globe), so only a 200 counts.
    if (!body || body.byteLength < 100) return new NextResponse(null, { status: 404, headers: { "Cache-Control": "public, max-age=86400" } });
    return new NextResponse(body, { headers: { "Content-Type": type, "Cache-Control": "public, max-age=604800, immutable" } });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
