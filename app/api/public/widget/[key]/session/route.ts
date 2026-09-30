import type { NextRequest } from "next/server";
import { clientIp, guard, json, preflight } from "@/lib/bos/widget-http";
import { rateOk, startSession } from "@/services/bos/widgets";
import { logServerError } from "@/lib/bos/errors";

// Starts a visitor session; the token is returned once and only its hash is stored.
export async function POST(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const g = await guard(req, key, { rate: [60, 120] });
  if ("response" in g) return g.response;
  if (!(await rateOk(`widget:${g.widget.id}:session:${clientIp(req)}`, 3600, 20))) return json({ error: "rate_limited" }, 429, g.origin);
  try {
    const body = (await req.json().catch(() => ({}))) as { page?: string };
    const token = await startSession(g.widget, { origin: g.origin, pageUrl: typeof body.page === "string" ? body.page : null, userAgent: req.headers.get("user-agent") });
    return json({ token }, 200, g.origin);
  } catch (e) {
    logServerError("widget:session", e);
    return json({ error: "server" }, 500, g.origin);
  }
}

export async function OPTIONS(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  return preflight(req, (await params).key);
}
