import type { NextRequest } from "next/server";
import { guard, json, preflight } from "@/lib/bos/widget-http";
import { rateConversation, rateOk } from "@/services/bos/widgets";
import { ValidationError, logServerError } from "@/lib/bos/errors";

// Rating a resolved conversation (POST {conversation, rating 1–5, comment?}).
export async function POST(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const g = await guard(req, key, { session: true, rate: [600, 60] });
  if ("response" in g) return g.response;
  if (!(await rateOk(`widget:rating:${g.session!.id}`, 3600, 20))) return json({ error: "rate_limited" }, 429, g.origin);
  try {
    const b = (await req.json().catch(() => ({}))) as { conversation?: unknown; rating?: unknown; comment?: unknown };
    const r = await rateConversation(g.widget, g.session!, typeof b.conversation === "string" ? b.conversation : "", Number(b.rating), typeof b.comment === "string" ? b.comment : null);
    return json(r, 200, g.origin);
  } catch (e) {
    if (e instanceof ValidationError) return json({ error: e.message }, 400, g.origin);
    logServerError("widget:rating", e);
    return json({ error: "server" }, 500, g.origin);
  }
}

export async function OPTIONS(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  return preflight(req, (await params).key);
}
