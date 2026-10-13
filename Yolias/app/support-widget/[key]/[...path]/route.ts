import type { NextRequest } from "next/server";
import { createHmac } from "node:crypto";
import { supportWidget } from "@/lib/support-widget";
import { createClient } from "@/lib/supabase/server";
import { integrationSecret, loadIntegrations } from "@/lib/integrations";
import { searchHelp } from "@/lib/support/help-search";
import { getLocale } from "@/lib/i18n/server";

// Same-domain proxy for the support messenger (D-134, D-180): the browser
// talks to yolias.com/support-widget/<key>/…, this forwards to Yolias Admin's
// public widget API. Only the configured widget and its endpoints are served,
// so it can't be used as an open proxy. Admin still checks the page's origin
// against the widget's allowed domains and rate-limits by visitor IP.
//  - Signed-in users: this server vouches for them with a short-lived signed
//    identity (x-widget-identity, HMAC with the widget's identity secret from
//    Admin → Vault), so their conversations follow their account. The header
//    is always built here; a browser can't send its own.
//  - Help: answered here from the Yolias Help Center and docs.

const PATHS = new Set(["embed.js", "config", "session", "messages", "conversations", "rating", "handoff", "agent-photo", "help"]);

function b64url(s: string | Buffer) {
  return Buffer.from(s).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** The signed-in user, signed for Admin (null when signed out or no secret yet). */
async function identityHeader(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    const u = data.user;
    if (!u) return null;
    await loadIntegrations();
    const secret = integrationSecret("support_widget", "identity_secret");
    if (!secret) return null;
    const meta = (u.user_metadata ?? {}) as { full_name?: unknown };
    const payload = b64url(JSON.stringify({ u: u.id, e: u.email ?? null, n: typeof meta.full_name === "string" ? meta.full_name : null, t: Math.floor(Date.now() / 1000) }));
    return `${payload}.${b64url(createHmac("sha256", secret).update(payload).digest())}`;
  } catch {
    return null;
  }
}

async function forward(req: NextRequest, params: Promise<{ key: string; path: string[] }>) {
  const { key, path } = await params;
  const w = await supportWidget();
  const p = path.join("/");
  if (!w || key !== w.key || !PATHS.has(p)) return new Response("Not found", { status: 404 });

  if (p === "help" && req.method === "GET") {
    const q = (req.nextUrl.searchParams.get("q") ?? "").slice(0, 100);
    const lang = req.nextUrl.searchParams.get("lang");
    const locale = lang === "ar" || lang === "en" ? lang : await getLocale();
    const results = q.trim().length >= 2 ? await searchHelp(q, locale) : [];
    return Response.json({ results: results.map((r) => ({ ...r, body: null })) }, { headers: { "cache-control": "no-store" } });
  }

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
  if (p !== "embed.js") {
    const identity = await identityHeader();
    if (identity) headers.set("x-widget-identity", identity);
  }

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
