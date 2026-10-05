import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { hasActivePlan } from "@/lib/plans";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AgentNotConfiguredError, runAgent } from "@/lib/agent/run";
import { conversationFor } from "@/services/conversations";
import type { Json } from "@/types/database";

const BodySchema = z.object({
  strategyId: z.string().uuid(),
  text: z.string().trim().min(1).max(4000),
});
const HISTORY_TURNS = 40;
// Per user: protects against runaway LLM cost (rule 25). Counted from saved turns.
const PER_MINUTE = 8;
const PER_DAY = 300;

// Yolias AI agent: one turn of the conversation saved on a search (D-115).
// History comes from the database, never from the browser. Authorization for
// what the agent does lives in the tools (lib/agent), not here or in the prompt.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!hasActivePlan(session.workspace) || !session.profile.onboarded_at) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = BodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const db = await createClient();
  const ws = session.workspace.id;
  const { data: strategy } = await db.from("strategies").select("id, workspace_id").eq("id", body.data.strategyId).maybeSingle();
  if (!strategy || strategy.workspace_id !== ws) return NextResponse.json({ error: "notFound" }, { status: 404 });

  const since = (ms: number) => new Date(Date.now() - ms).toISOString();
  const [{ count: lastMinute }, { count: lastDay }] = await Promise.all([
    db.from("agent_messages").select("id", { count: "exact", head: true }).eq("user_id", session.userId).eq("role", "user").gte("created_at", since(60_000)),
    db.from("agent_messages").select("id", { count: "exact", head: true }).eq("user_id", session.userId).eq("role", "user").gte("created_at", since(86_400_000)),
  ]);
  if ((lastMinute ?? 0) >= PER_MINUTE || (lastDay ?? 0) >= PER_DAY) return NextResponse.json({ error: "rateLimited" }, { status: 429 });

  // The user's turn is saved first (user's client, RLS), so it's never lost.
  const { error: saveError } = await db.from("agent_messages").insert({ workspace_id: ws, strategy_id: strategy.id, user_id: session.userId, role: "user", content: body.data.text });
  if (saveError) {
    console.error("agent message save failed", saveError.message);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }

  const [history, { data: campaign }] = await Promise.all([
    conversationFor(strategy.id, db, HISTORY_TURNS),
    db.from("campaigns").select("id").eq("strategy_id", strategy.id).maybeSingle(),
  ]);

  try {
    const { reply, iterations, costUsd } = await runAgent(
      { session, db, conversationId: strategy.id },
      history.map((m) => ({ role: m.role, text: m.content })),
      { strategyId: strategy.id, campaignId: campaign?.id ?? null },
    );
    if (!reply) return NextResponse.json({ error: "failed" }, { status: 502 });
    // Assistant turns are written by server code only (no insert policy for them).
    const { data: saved } = await createAdminClient().from("agent_messages")
      .insert({ workspace_id: ws, strategy_id: strategy.id, user_id: null, role: "assistant", content: reply.slice(0, 20000), meta: { iterations, costUsd } as Json })
      .select("id, role, content, created_at").single();
    return NextResponse.json({ reply: saved ?? { id: Date.now(), role: "assistant", content: reply, created_at: new Date().toISOString() } });
  } catch (e) {
    if (e instanceof AgentNotConfiguredError) return NextResponse.json({ error: "notConfigured" }, { status: 503 });
    console.error("agent failed", e);
    return NextResponse.json({ error: "failed" }, { status: 502 });
  }
}
