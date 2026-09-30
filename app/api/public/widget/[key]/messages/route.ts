import { after, type NextRequest } from "next/server";
import { guard, json, preflight } from "@/lib/bos/widget-http";
import { postVisitorMessage, rateOk, visitorMessages } from "@/services/bos/widgets";
import { agentRespond } from "@/services/bos/ai-agents";
import { ValidationError, logServerError } from "@/lib/bos/errors";

export const maxDuration = 60;

// Visitor polling (GET ?since=) and sending (POST {body, name?, email?}).
export async function GET(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const g = await guard(req, key, { session: true, rate: [60, 240] });
  if ("response" in g) return g.response;
  return json(await visitorMessages(g.session!, req.nextUrl.searchParams.get("since")), 200, g.origin);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const g = await guard(req, key, { session: true, rate: [600, 100] });
  if ("response" in g) return g.response;
  if (!(await rateOk(`widget:session:${g.session!.id}`, 600, 30))) return json({ error: "rate_limited" }, 429, g.origin);
  try {
    const b = (await req.json().catch(() => ({}))) as { body?: unknown; name?: unknown; email?: unknown };
    const str = (v: unknown) => (typeof v === "string" ? v : null);
    const r = await postVisitorMessage(g.widget, g.session!, { body: str(b.body) ?? "", name: str(b.name), email: str(b.email) });
    if (r.aiShouldRespond) after(() => agentRespond(r.conversationId).catch((e) => logServerError("widget:agent", e)));
    return json({ ok: true, ai: r.aiShouldRespond }, 200, g.origin);
  } catch (e) {
    if (e instanceof ValidationError) return json({ error: e.message, fields: e.fieldErrors }, 400, g.origin);
    logServerError("widget:message", e);
    return json({ error: "server" }, 500, g.origin);
  }
}

export async function OPTIONS(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  return preflight(req, (await params).key);
}
