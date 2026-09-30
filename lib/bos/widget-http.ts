import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { originOk, rateOk, sessionFor, widgetByKey, type Widget, type WidgetSession } from "@/services/bos/widgets";

// Shared guard for the public widget API (/api/public/widget/<key>/…):
// active widget + Origin in its allowed domains + per-IP rate limit. CORS is
// granted to that one origin only; no cookies are used (token header).

export function clientIp(req: NextRequest) {
  return (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
}

export function corsHeaders(origin: string | null): Record<string, string> {
  return origin
    ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "content-type, x-widget-token", "Access-Control-Max-Age": "600", Vary: "Origin" }
    : {};
}

export function json(body: unknown, status: number, origin: string | null) {
  return NextResponse.json(body, { status, headers: { ...corsHeaders(origin), "Cache-Control": "no-store" } });
}

type Guarded = { widget: Widget; origin: string; session: WidgetSession | null } | { response: NextResponse };

export async function guard(req: NextRequest, key: string, opts: { session?: boolean; rate: [number, number] }): Promise<Guarded> {
  const origin = req.headers.get("origin");
  const widget = await widgetByKey(key);
  if (!widget || !origin || !originOk(widget, origin)) return { response: NextResponse.json({ error: "not_allowed" }, { status: 403, headers: { "Cache-Control": "no-store" } }) };
  if (!(await rateOk(`widget:${widget.id}:ip:${clientIp(req)}`, opts.rate[0], opts.rate[1]))) return { response: json({ error: "rate_limited" }, 429, origin) };
  let session: WidgetSession | null = null;
  if (opts.session) {
    session = await sessionFor(widget, req.headers.get("x-widget-token"));
    if (!session) return { response: json({ error: "session" }, 401, origin) };
  }
  return { widget, origin, session };
}

export async function preflight(req: NextRequest, key: string) {
  const origin = req.headers.get("origin");
  const widget = await widgetByKey(key);
  if (!widget || !origin || !originOk(widget, origin)) return new NextResponse(null, { status: 403 });
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}
