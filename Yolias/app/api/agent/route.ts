import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { hasActivePlan } from "@/lib/plans";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AgentNotConfiguredError, runAgent, type AgentEvent, type AgentFocus } from "@/lib/agent/run";
import { titleFrom } from "@/lib/discovery/launch";
import { campaignConversation, conversationTurns } from "@/services/conversations";
import type { ConversationRow, Json } from "@/types/database";

const BodySchema = z.object({
  /** A conversation the member can read (personal, workspace or campaign)… */
  conversationId: z.string().uuid().optional(),
  /** …or a search, whose campaign conversation is used (created on first use). */
  strategyId: z.string().uuid().optional(),
  text: z.string().trim().min(1).max(4000),
}).refine((b) => Boolean(b.conversationId) !== Boolean(b.strategyId), "one of conversationId / strategyId");
const HISTORY_TURNS = 40;
// Per user: protects against runaway LLM cost (rule 25). Counted from saved turns.
const PER_MINUTE = 8;
const PER_DAY = 300;

// Yolias AI: one turn of a conversation (final spec phase 7). History comes
// from the database, never from the browser. The answer streams as NDJSON:
// {type:"thinking"} → {type:"tool", name} … → {type:"done", reply} (or
// {type:"error"}), so the UI can show what Yolias is doing. Authorization for
// what the agent does lives in the tools, not here or in the prompt.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!hasActivePlan(session.workspace) || !session.profile.onboarded_at) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = BodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const db = await createClient();
  const ws = session.workspace.id;
  let conversation: ConversationRow | null = null;
  let focus: AgentFocus;
  if (body.data.strategyId) {
    const { data: strategy } = await db.from("strategies").select("id, workspace_id, title").eq("id", body.data.strategyId).maybeSingle();
    if (!strategy || strategy.workspace_id !== ws) return NextResponse.json({ error: "notFound" }, { status: 404 });
    conversation = await campaignConversation(strategy);
  } else {
    const { data } = await db.from("conversations").select("*").eq("id", body.data.conversationId!).maybeSingle();
    conversation = data;
  }
  if (!conversation || conversation.workspace_id !== ws || conversation.archived_at) return NextResponse.json({ error: "notFound" }, { status: 404 });
  if (conversation.scope === "campaign") {
    const { data: campaign } = await db.from("campaigns").select("id").eq("strategy_id", conversation.strategy_id!).maybeSingle();
    focus = { scope: "campaign", strategyId: conversation.strategy_id!, campaignId: campaign?.id ?? null };
  } else {
    focus = { scope: conversation.scope };
  }

  const since = (ms: number) => new Date(Date.now() - ms).toISOString();
  const [{ count: lastMinute }, { count: lastDay }] = await Promise.all([
    db.from("agent_messages").select("id", { count: "exact", head: true }).eq("user_id", session.userId).eq("role", "user").gte("created_at", since(60_000)),
    db.from("agent_messages").select("id", { count: "exact", head: true }).eq("user_id", session.userId).eq("role", "user").gte("created_at", since(86_400_000)),
  ]);
  if ((lastMinute ?? 0) >= PER_MINUTE || (lastDay ?? 0) >= PER_DAY) return NextResponse.json({ error: "rateLimited" }, { status: 429 });

  // The user's turn is saved first (user's client, RLS), so it's never lost.
  const { data: userTurn, error: saveError } = await db.from("agent_messages")
    .insert({ workspace_id: ws, conversation_id: conversation.id, strategy_id: conversation.strategy_id, user_id: session.userId, role: "user", content: body.data.text })
    .select("id, role, content, created_at").single();
  if (saveError || !userTurn) {
    console.error("agent message save failed", saveError?.message);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
  const admin = createAdminClient();
  // A new personal / workspace conversation is named after its first message.
  await admin.from("conversations").update(conversation.title ? { updated_at: new Date().toISOString() } : { title: titleFrom(body.data.text) }).eq("id", conversation.id);

  const history = await conversationTurns(conversation.id, db, HISTORY_TURNS);
  const encoder = new TextEncoder();
  const conv = conversation;
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: AgentEvent | { type: "done"; reply: unknown; user: unknown } | { type: "error"; error: string }) => controller.enqueue(encoder.encode(`${JSON.stringify(o)}\n`));
      try {
        const { reply, iterations, costUsd, provider, model } = await runAgent(
          { session, db, conversationId: conv.id },
          history.map((m) => ({ role: m.role, text: m.content })),
          focus,
          send,
        );
        if (!reply) {
          send({ type: "error", error: "failed" });
          return;
        }
        // Assistant turns are written by server code only (no insert policy for them).
        const { data: saved } = await admin.from("agent_messages")
          .insert({ workspace_id: ws, conversation_id: conv.id, strategy_id: conv.strategy_id, user_id: null, role: "assistant", content: reply.slice(0, 20000), meta: { iterations, costUsd, provider, model } as Json })
          .select("id, role, content, created_at").single();
        send({ type: "done", user: userTurn, reply: saved ?? { id: Date.now(), role: "assistant", content: reply, created_at: new Date().toISOString() } });
      } catch (e) {
        if (e instanceof AgentNotConfiguredError) send({ type: "error", error: "notConfigured" });
        else {
          console.error("agent failed", e);
          send({ type: "error", error: "failed" });
        }
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Conversation-Id": conv.id } });
}
