import type { NextRequest } from "next/server";
import { supportWidget } from "@/lib/support-widget";

// Same-domain proxy for the support chat widget (D-134): the browser talks to
// yolias.com/support-widget/<key>/…, this forwards to Yolias Admin's public
// widget API. Only the configured widget and its four endpoints are served,
// so it can't be used as an open proxy. Admin still checks the page's origin
// against the widget's allowed domains and rate-limits by visitor IP.

const PATHS = new Set(["embed.js", "config", "session", "messages"]);

async function forward(req: NextRequest, params: Promise<{ key: string; path: string[] }>) {
  const { key, path } = await params;
  const w = await supportWidget();
  const p = path.join("/");
  if (!w || key !== w.key || !PATHS.has(p)) return new Response("Not found", { status: 404 });

  const headers = new Headers();
  for (const h of ["content-type", "x-widget-token", "user-agent", "accept-language"]) {
    const v = req.headers.get(h);
    if (v) headers.set(h, v);
  }
  // Browsers omit Origin on same-origin GETs: the page is then on this site
  // (the host the visitor used, also behind a proxy or Cloudflare).
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
  const proto = (req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "")).split(",")[0].trim();
  headers.set("origin", req.headers.get("origin") ?? `${proto}://${host}`);
  const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (ip) headers.set("x-forwarded-for", ip);

  const res = await fetch(`${w.origin}/api/public/widget/${w.key}/${p}${req.nextUrl.search}`, {
    method: req.method,
    headers,
    body: req.method === "GET" || req.method === "HEAD" ? undefined : await req.text(),
    redirect: "manual",
    signal: AbortSignal.timeout(20_000),
  }).catch(() => null);
  if (!res) return new Response(JSON.stringify({ error: "unavailable" }), { status: 502, headers: { "content-type": "application/json" } });

  const out = new Headers();
  for (const h of ["content-type", "cache-control", "access-control-allow-origin", "access-control-allow-headers", "access-control-allow-methods", "vary"]) {
    const v = res.headers.get(h);
    if (v) out.set(h, v);
  }
  return new Response(res.body, { status: res.status, headers: out });
}

type Ctx = { params: Promise<{ key: string; path: string[] }> };
export const GET = (req: NextRequest, { params }: Ctx) => forward(req, params);
export const POST = (req: NextRequest, { params }: Ctx) => forward(req, params);
export const OPTIONS = (req: NextRequest, { params }: Ctx) => forward(req, params);
