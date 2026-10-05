import "server-only";
import { getSetting, intel, asJson } from "@/lib/intel/db";
import { llmCostUsd, type LlmPrice, type LlmUsage } from "@/lib/intel/pricing";

// LLM cache and cost logging (docs/07 "Cost & quality", docs/06 "Cost engine").

export async function llmPrices(): Promise<Record<string, LlmPrice>> {
  return getSetting<Record<string, LlmPrice>>("llm_prices", {});
}

export async function readLlmCache<T>(key: string): Promise<{ output: T; costUsd: number } | null> {
  const db = intel();
  const { data } = await db.from("llm_cache").select("output, cost_usd, hits, expires_at").eq("key", key).maybeSingle();
  if (!data || (data.expires_at && new Date(data.expires_at) < new Date())) return null;
  await db.from("llm_cache").update({ hits: data.hits + 1, last_hit_at: new Date().toISOString() }).eq("key", key);
  return { output: data.output as T, costUsd: Number(data.cost_usd) };
}

export async function writeLlmCache(entry: { key: string; task: string; model: string; promptVersion: string; output: unknown; usage: LlmUsage; costUsd: number | null }) {
  await intel().from("llm_cache").upsert({
    key: entry.key, task: entry.task, model: entry.model, prompt_version: entry.promptVersion, output: asJson(entry.output),
    input_tokens: entry.usage.input_tokens, output_tokens: entry.usage.output_tokens, cost_usd: entry.costUsd ?? 0,
  });
}

export interface LlmCallLog {
  task: string;
  model: string;
  servedModel?: string | null;
  promptVersion?: string | null;
  workspaceId?: string | null;
  campaignId?: string | null;
  strategyId?: string | null;
  usage?: LlmUsage | null;
  costUsd?: number | null;
  cacheHit?: boolean;
  ok: boolean;
  error?: string | null;
  latencyMs?: number | null;
}

export async function recordLlmCall(c: LlmCallLog) {
  await intel().from("llm_calls").insert({
    task: c.task, model: c.model, served_model: c.servedModel ?? null, prompt_version: c.promptVersion ?? null,
    workspace_id: c.workspaceId ?? null, campaign_id: c.campaignId ?? null, strategy_id: c.strategyId ?? null,
    input_tokens: c.usage?.input_tokens ?? 0, output_tokens: c.usage?.output_tokens ?? 0,
    cache_read_tokens: c.usage?.cache_read_input_tokens ?? 0, cache_write_tokens: c.usage?.cache_creation_input_tokens ?? 0,
    // Unknown price ⇒ null ("unpriced", D-114); a cache hit really costs nothing.
    cost_usd: c.costUsd ?? (c.cacheHit ? 0 : null), cache_hit: c.cacheHit ?? false, ok: c.ok, error: c.error ?? null, latency_ms: c.latencyMs ?? null,
  });
}

export async function priceCall(model: string, usage: LlmUsage): Promise<number | null> {
  return llmCostUsd(usage, (await llmPrices())[model]);
}
