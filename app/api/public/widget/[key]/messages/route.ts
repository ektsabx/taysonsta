import { after, type NextRequest } from "next/server";
import { guard, json, preflight } from "@/lib/bos/widget-http";
import { postVisitorMessage, rateOk, visitorMessages } from "@/services/bos/widgets";
import { agentRespond } from "@/services/bos/ai-agents";
import { ValidationError, logServerError } from "@/lib/bos/errors";

export const maxDuration = 60;

// One of the visitor's conversations: polling (GET ?c=<id>&since=) and sending
// (POST {body, conversation?, name?, email?}; no conversation = a new one).
export async function GET(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const g = await guard(req, key, { session: true, rate: [60, 240] });
  if ("response" in g) return g.response;
  const sp = req.nextUrl.searchParams;
  return json(await visitorMessages(g.widget, g.session!, sp.get("c"), sp.get("since")), 200, g.origin);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const g = await guard(req, key, { session: true, rate: [600, 100] });
  if ("response" in g) return g.response;
  if (!(await rateOk(`widget:session:${g.session!.id}`, 600, 30))) return json({ error: "rate_limited" }, 429, g.origin);
  try {
    const b = (await req.json().catch(() => ({}))) as { body?: unknown; name?: unknown; email?: unknown; conversation?: unknown };
    const str = (v: unknown) => (typeof v === "string" ? v : null);
    const r = await postVisitorMessage(g.widget, g.session!, { body: str(b.body) ?? "", name: str(b.name), email: str(b.email), conversationId: str(b.conversation) });
    if (r.aiShouldRespond) after(() => agentRespond(r.conversationId).catch((e) => logServerError("widget:agent", e)));
    return json({ ok: true, conversation: r.conversationId, ai: r.aiShouldRespond }, 200, g.origin);
  } catch (e) {
    if (e instanceof ValidationError) return json({ error: e.message, fields: e.fieldErrors }, 400, g.origin);
    logServerError("widget:message", e);
    return json({ error: "server" }, 500, g.origin);
  }
}

export async function OPTIONS(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  return preflight(req, (await params).key);
}
