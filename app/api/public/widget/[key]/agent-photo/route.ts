import type { NextRequest } from "next/server";
import { agentPhoto, rateOk, resolveSession, sessionFor, verifyIdentity, widgetByKey } from "@/services/bos/widgets";
import { clientIp } from "@/lib/bos/widget-http";

// A staff member's photo next to their reply, only for the visitor of that
// conversation and only if the staff member allowed it. Streams the image (no
// storage URL leaves the server). The session token comes as ?t= because an
// <img> can't send headers; it is the visitor's secret, like the header.
export async function GET(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const widget = await widgetByKey(key);
  if (!widget) return new Response(null, { status: 404 });
  if (!(await rateOk(`widget:${widget.id}:photo:${clientIp(req)}`, 60, 240))) return new Response(null, { status: 429 });
  const found = await sessionFor(widget, req.nextUrl.searchParams.get("t"));
  const session = found ? await resolveSession(found, await verifyIdentity(widget, req.headers.get("x-widget-identity"))) : null;
  if (!session) return new Response(null, { status: 404 });
  const photo = await agentPhoto(widget, session, req.nextUrl.searchParams.get("m") ?? "");
  if (!photo) return new Response(null, { status: 404 });
  return new Response(photo.bytes, { headers: { "content-type": photo.type, "cache-control": "private, max-age=600" } });
}
