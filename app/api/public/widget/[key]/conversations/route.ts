import type { NextRequest } from "next/server";
import { guard, json, preflight } from "@/lib/bos/widget-http";
import { visitorConversations } from "@/services/bos/widgets";

// The Messages tab: this visitor's own conversations (never anyone else's).
export async function GET(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const g = await guard(req, key, { session: true, rate: [60, 120] });
  if ("response" in g) return g.response;
  return json(await visitorConversations(g.widget, g.session!), 200, g.origin);
}

export async function OPTIONS(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  return preflight(req, (await params).key);
}
