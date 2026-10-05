import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { AgentMessageRow, Database } from "@/types/database";

export type ConversationTurn = Pick<AgentMessageRow, "id" | "role" | "content" | "created_at">;

/** A search's saved Yolias AI conversation, oldest first (RLS: workspace members only). */
export async function conversationFor(strategyId: string, db?: SupabaseClient<Database>, limit = 200): Promise<ConversationTurn[]> {
  const supabase = db ?? (await createClient());
  const { data } = await supabase.from("agent_messages").select("id, role, content, created_at")
    .eq("strategy_id", strategyId).order("id", { ascending: false }).limit(limit);
  return (data ?? []).reverse();
}
