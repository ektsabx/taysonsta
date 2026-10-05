import "server-only";
import { ydb } from "@/lib/yolias/db";

// Yolias AI usage and its audit trail for Yolias Admin (docs/09 §B, rule 35).
// Metadata only: the admin sees tool calls and counts, not conversation text.

export interface AgentMetrics {
  conversations: number;
  workspaces: number;
  user_turns: number;
  assistant_turns: number;
  tool_calls: number;
  by_outcome: Record<string, number>;
  by_tool: { tool: string; calls: number; failures: number; avg_ms: number | null }[];
  llm_calls: number;
  llm_cost_usd: number;
}

export async function agentOverview(days = 30) {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const [{ data, error }, { data: calls, error: callsError }] = await Promise.all([
    ydb().rpc("admin_agent_metrics", { p_since: since }),
    ydb().from("agent_tool_calls").select("id, workspace_id, tool, outcome, error, latency_ms, created_at").order("id", { ascending: false }).limit(50),
  ]);
  if (error) throw error;
  if (callsError) throw callsError;
  const wsIds = [...new Set((calls ?? []).map((c) => c.workspace_id))];
  const { data: ws } = wsIds.length ? await ydb().from("workspaces").select("id, name").in("id", wsIds) : { data: [] as { id: string; name: string }[] };
  const names = new Map((ws ?? []).map((w) => [w.id, w.name]));
  const m = data as unknown as AgentMetrics;
  return {
    days,
    metrics: { ...m, llm_cost_usd: Number(m.llm_cost_usd) },
    recent: (calls ?? []).map((c) => ({ ...c, workspaceName: names.get(c.workspace_id) ?? null })),
  };
}
