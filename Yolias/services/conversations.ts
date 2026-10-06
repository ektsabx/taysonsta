import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AgentMessageRow, ConversationRow, Database } from "@/types/database";

// Yolias AI conversations (final spec phase 7): personal (user), shared with
// the workspace, or the conversation of a search / campaign. Reads use the
// member's own client (RLS decides who sees what).

export type ConversationTurn = Pick<AgentMessageRow, "id" | "role" | "content" | "created_at"> & {
  /** The reader's own like (1) / dislike (-1) on an assistant turn. */
  rating?: -1 | 1 | null;
};

/** Turns of a conversation, oldest first, with the reader's feedback. */
export async function conversationTurns(conversationId: string, db?: SupabaseClient<Database>, limit = 200): Promise<ConversationTurn[]> {
  const supabase = db ?? (await createClient());
  const { data } = await supabase.from("agent_messages").select("id, role, content, created_at")
    .eq("conversation_id", conversationId).order("id", { ascending: false }).limit(limit);
  const turns = (data ?? []).reverse();
  const ids = turns.filter((t) => t.role === "assistant").map((t) => t.id);
  if (!ids.length) return turns;
  const { data: fb } = await supabase.from("agent_feedback").select("message_id, rating").in("message_id", ids);
  const byId = new Map((fb ?? []).map((f) => [f.message_id, f.rating as -1 | 1]));
  return turns.map((t) => ({ ...t, rating: byId.get(t.id) ?? null }));
}

/**
 * The conversation of a search (scope "campaign"), created on first use.
 * Server code creates it (members can't create campaign conversations
 * directly); the caller must already have checked the strategy is theirs.
 */
export async function campaignConversation(strategy: { id: string; workspace_id: string; title: string }): Promise<ConversationRow> {
  const admin = createAdminClient();
  const { data: existing } = await admin.from("conversations").select("*").eq("scope", "campaign").eq("strategy_id", strategy.id).maybeSingle();
  if (existing) return existing;
  const { data: campaign } = await admin.from("campaigns").select("id").eq("strategy_id", strategy.id).maybeSingle();
  const { data, error } = await admin.from("conversations")
    .insert({ workspace_id: strategy.workspace_id, scope: "campaign", strategy_id: strategy.id, campaign_id: campaign?.id ?? null, title: strategy.title })
    .select("*").single();
  if (error || !data) {
    // Created by a parallel request: use theirs.
    const { data: again } = await admin.from("conversations").select("*").eq("scope", "campaign").eq("strategy_id", strategy.id).single();
    return again!;
  }
  return data;
}

/** A search's conversation turns (empty until someone writes). */
export async function conversationFor(strategyId: string): Promise<ConversationTurn[]> {
  const db = await createClient();
  const { data: c } = await db.from("conversations").select("id").eq("scope", "campaign").eq("strategy_id", strategyId).maybeSingle();
  return c ? conversationTurns(c.id, db) : [];
}
