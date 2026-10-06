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
import { activePolicy, applyGuardrails, cachedAnswer, detectLanguage, isGeneralQuestion, storeAnswer } from "@/lib/agent/policy";

const BodySchema = z.object({
  /** The search (sidebar "Recent") whose conversation is used — created on first use. Every chat is a search's chat. */
  strategyId: z.string().uuid(),
  text: z.string().trim().min(1).max(4000),
});
// History length and per-user rate limits come from the agent policy
// (Yolias Admin → Platform → Yolias AI, D-141); they protect against runaway
// LLM cost (rule 25) and are counted from saved turns.

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
  const { data: strategy } = await db.from("strategies").select("id, workspace_id, title").eq("id", body.data.strategyId).maybeSingle();
  if (!strategy || strategy.workspace_id !== ws) return NextResponse.json({ error: "notFound" }, { status: 404 });
  const conversation: ConversationRow | null = await campaignConversation(strategy);
  if (!conversation || conversation.workspace_id !== ws || conversation.archived_at) return NextResponse.json({ error: "notFound" }, { status: 404 });
  const { data: campaign } = await db.from("campaigns").select("id").eq("strategy_id", strategy.id).order("created_at").limit(1).maybeSingle();
  const focus: AgentFocus = { scope: "campaign", strategyId: strategy.id, campaignId: campaign?.id ?? null };

  const active = await activePolicy();
  const { policy } = active;
  const since = (ms: number) => new Date(Date.now() - ms).toISOString();
  const [{ count: lastMinute }, { count: lastDay }] = await Promise.all([
    db.from("agent_messages").select("id", { count: "exact", head: true }).eq("user_id", session.userId).eq("role", "user").gte("created_at", since(60_000)),
    db.from("agent_messages").select("id", { count: "exact", head: true }).eq("user_id", session.userId).eq("role", "user").gte("created_at", since(86_400_000)),
  ]);
  if ((lastMinute ?? 0) >= policy.limits.perMinute || (lastDay ?? 0) >= policy.limits.perDay) return NextResponse.json({ error: "rateLimited" }, { status: 429 });

  // The user's turn is saved first (user's client, RLS), so it's never lost.
  const { data: userTurn, error: saveError } = await db.from("agent_messages")
    .insert({ workspace_id: ws, conversation_id: conversation.id, strategy_id: conversation.strategy_id, user_id: session.userId, role: "user", content: body.data.text })
    .select("id, role, content, created_at").single();
  if (saveError || !userTurn) {
    console.error("agent message save failed", saveError?.message);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
  const admin = createAdminClient();
  await admin.from("conversations").update(conversation.title ? { updated_at: new Date().toISOString() } : { title: titleFrom(body.data.text) }).eq("id", conversation.id);

  const history = await conversationTurns(conversation.id, db, policy.limits.historyTurns);
  // Long-term memory of this workspace (RLS: members only).
  const { data: memories } = policy.memory.enabled && policy.memory.maxItems > 0
    ? await db.from("agent_memories").select("id, content").eq("workspace_id", ws).order("created_at", { ascending: false }).limit(policy.memory.maxItems)
    : { data: [] as { id: string; content: string }[] };
  const lang = detectLanguage(body.data.text);
  // The shared answer cache only serves a conversation's first question (no context to depend on).
  const firstQuestion = history.filter((m) => m.role === "user").length === 1 && history.length === 1 && isGeneralQuestion(body.data.text);
  const encoder = new TextEncoder();
  const conv = conversation;
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: AgentEvent | { type: "done"; reply: unknown; user: unknown } | { type: "error"; error: string }) => controller.enqueue(encoder.encode(`${JSON.stringify(o)}\n`));
      try {
        const save = (content: string, meta: Record<string, unknown>) =>
          // Assistant turns are written by server code only (no insert policy for them).
          admin.from("agent_messages")
            .insert({ workspace_id: ws, conversation_id: conv.id, strategy_id: conv.strategy_id, user_id: null, role: "assistant", content: content.slice(0, 20000), meta: { policyVersion: active.version, ...meta } as Json })
            .select("id, role, content, created_at").single();

        // Same general question asked before: reuse the answer, no model call (D-141).
        const hit = policy.cache.enabled && firstQuestion ? await cachedAnswer(body.data.text, active.version) : null;
        if (hit) {
          const { data: saved } = await save(hit, { cached: true, costUsd: 0 });
          send({ type: "done", user: userTurn, reply: saved ?? { id: Date.now(), role: "assistant", content: hit, created_at: new Date().toISOString() } });
          return;
        }

        const launched: string[] = [];
        const pending: string[] = [];
        const { reply: raw, iterations, costUsd, provider, model, toolCalls } = await runAgent(
          { session, db, conversationId: conv.id, strategyId: strategy.id, launched, pending },
          history.map((m) => ({ role: m.role, text: m.content })),
          focus,
          send,
          active,
          memories ?? [],
        );
        if (!raw) {
          send({ type: "error", error: "failed" });
          return;
        }
        // Guardrail: no sentence naming a blocked term (vendors, internals…) reaches the user.
        const { text: reply, hits } = applyGuardrails(raw, policy, lang);
        const { data: saved } = await save(reply, {
          iterations, costUsd, provider, model, toolCalls,
          ...(hits ? { guardrailHits: hits } : {}),
          ...(launched.length ? { campaigns: launched } : {}),
          ...(pending.length ? { approvals: pending } : {}),
        });
        // Only general answers are shared: no tool used, nothing about this workspace or user in it.
        const personal = [session.workspace.name, session.profile.full_name].filter((v): v is string => Boolean(v && v.length > 2)).some((v) => reply.includes(v));
        if (policy.cache.enabled && firstQuestion && toolCalls === 0 && !hits && !personal) await storeAnswer(body.data.text, reply, active.version, policy.cache.ttlHours).catch(() => {});
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
