import "server-only";
import { z } from "zod";
import { YOLIAS_MODEL } from "@/lib/ai/anthropic";
import { getSetting } from "@/lib/intel/db";
import { priceCall, recordLlmCall } from "@/lib/intel/llm";
import { loadIntegrations } from "@/lib/integrations";
import { anthropicAdapter } from "./anthropic";
import { geminiAdapter } from "./gemini";
import { openaiAdapter } from "./openai";
import { LlmProviderError, type ChatRequest, type ChatResult, type LlmAdapter, type LlmProvider, type LlmRoute, type LlmUsageCount, type StructuredRequest } from "./types";

// LLM routing with fallback across providers (rule 25, D-118). The order per
// task is configuration (intel.settings "llm_routing", edited in Yolias
// Admin): e.g. {"default": [{"provider":"anthropic","model":"…"},
// {"provider":"openai","model":"…"}, {"provider":"gemini","model":"…"}]}.
// A provider is used only when its key is set in Yolias Admin → Settings →
// Integrations (lib/integrations.ts, D-132). If a call fails (network, rate limit,
// outage, refusal, invalid output), the next one is tried. Every attempt is
// logged in intel.llm_calls with its cost (rule 28); a model without a price
// in "llm_prices" is logged as unpriced (D-114).

export type { LlmRoute, LlmProvider } from "./types";
export { LlmProviderError } from "./types";

const adapters: Record<LlmProvider, LlmAdapter> = { anthropic: anthropicAdapter, openai: openaiAdapter, gemini: geminiAdapter };

export const RouteSchema = z.object({ provider: z.enum(["anthropic", "openai", "gemini"]), model: z.string().trim().min(1).max(100) });
export const RoutingSchema = z.record(z.string(), z.array(RouteSchema).min(1).max(6));
export type Routing = z.infer<typeof RoutingSchema>;

export const DEFAULT_ROUTING: Routing = { default: [{ provider: "anthropic", model: YOLIAS_MODEL }] };

export class LlmNotConfiguredError extends Error {}

/** Configured routes for a task, in order, keeping only providers with a key. */
export async function routesFor(task: string): Promise<LlmRoute[]> {
  await loadIntegrations();
  const raw = await getSetting<unknown>("llm_routing", DEFAULT_ROUTING).catch(() => DEFAULT_ROUTING);
  const parsed = RoutingSchema.safeParse(raw);
  const routing = parsed.success ? parsed.data : DEFAULT_ROUTING;
  const list = routing[task] ?? routing.default ?? DEFAULT_ROUTING.default;
  return list.filter((r) => adapters[r.provider].configured());
}

export async function anyLlmConfigured(): Promise<boolean> {
  await loadIntegrations();
  return Object.values(adapters).some((a) => a.configured());
}

export interface LlmLog {
  task: string;
  promptVersion?: string | null;
  workspaceId?: string | null;
  campaignId?: string | null;
  strategyId?: string | null;
  conversationId?: string | null;
}

async function logStep(log: LlmLog, route: LlmRoute, servedModel: string | null, usage: LlmUsageCount | null, ok: boolean, error: string | null, latencyMs: number) {
  const priced = usage ? ((await priceCall(servedModel ?? route.model, usage).catch(() => null)) ?? (await priceCall(route.model, usage).catch(() => null))) : null;
  await recordLlmCall({
    ...log, model: route.model, servedModel: servedModel ?? route.model, usage, costUsd: usage ? priced : null, ok, error, latencyMs,
  }).catch(() => {});
  // null = unpriced (D-114): counted separately by the callers, never as free.
  return usage ? priced : 0;
}

export interface StructuredOutcome<T> {
  data: T;
  route: LlmRoute;
  servedModel: string;
  usage: LlmUsageCount;
  costUsd: number;
  /** Calls whose model has no price configured (cost unknown, not zero). */
  unpricedCalls: number;
  attempts: number;
}

/**
 * Structured extraction with fallback. `validate` returns the typed value or
 * null; null counts as a bad output and the next provider is tried.
 */
export async function runStructured<T>(task: string, req: StructuredRequest, validate: (data: unknown) => T | null, log: Omit<LlmLog, "task">, only?: LlmRoute[]): Promise<StructuredOutcome<T>> {
  // `only`: a fixed route list (evals); still limited to providers with a key.
  if (only) await loadIntegrations();
  const routes = only ? only.filter((r) => adapters[r.provider].configured()) : await routesFor(task);
  if (!routes.length) throw new LlmNotConfiguredError(task);
  let last: LlmProviderError | null = null;
  let costUsd = 0;
  let unpricedCalls = 0;
  for (const [i, route] of routes.entries()) {
    const started = Date.now();
    try {
      const r = await adapters[route.provider].structured(route.model, req);
      const value = r.refused ? null : validate(r.data);
      const error = r.refused ? "refusal" : value === null ? "invalid output" : null;
      const step = await logStep({ ...log, task }, route, r.servedModel, r.usage, !error, error, Date.now() - started);
      if (step === null) unpricedCalls++;
      else costUsd += step;
      if (value !== null) return { data: value, route, servedModel: r.servedModel, usage: r.usage, costUsd, unpricedCalls, attempts: i + 1 };
      last = new LlmProviderError(`${route.provider}: ${error}`, r.refused ? "refused" : "bad_output");
    } catch (e) {
      last = e instanceof LlmProviderError ? e : new LlmProviderError(e instanceof Error ? e.message : "failed", "unavailable");
      await logStep({ ...log, task }, route, null, null, false, last.message.slice(0, 500), Date.now() - started);
    }
  }
  throw last ?? new LlmProviderError("no provider answered", "unavailable");
}

export interface ChatOutcome extends ChatResult {
  route: LlmRoute;
  costUsd: number;
  /** Model calls whose price isn't configured (cost unknown, not zero). */
  unpricedCalls: number;
}

/**
 * A tool-using conversation turn with fallback. `canFallBack()` is asked
 * before switching providers: when a tool with side effects already ran
 * (e.g. a campaign was started), we stop instead of risking doing it twice.
 */
export async function runChat(task: string, req: ChatRequest, log: Omit<LlmLog, "task">, canFallBack: () => boolean = () => true): Promise<ChatOutcome> {
  const routes = await routesFor(task);
  if (!routes.length) throw new LlmNotConfiguredError(task);
  let last: LlmProviderError | null = null;
  for (const route of routes) {
    if (last && !canFallBack()) break;
    try {
      const r = await adapters[route.provider].chat(route.model, req);
      let costUsd = 0;
      let unpricedCalls = 0;
      for (const s of r.steps) {
        const step = await logStep({ ...log, task }, route, s.servedModel, s.usage, !s.refused, s.refused ? "refusal" : null, s.latencyMs);
        if (step === null) unpricedCalls++;
        else costUsd += step;
      }
      if (!r.reply) {
        last = new LlmProviderError(`${route.provider}: no reply`, "bad_output");
        continue;
      }
      return { ...r, route, costUsd, unpricedCalls };
    } catch (e) {
      last = e instanceof LlmProviderError ? e : new LlmProviderError(e instanceof Error ? e.message : "failed", "unavailable");
      for (const s of last.steps) await logStep({ ...log, task }, route, s.servedModel, s.usage, !s.refused, s.refused ? "refusal" : null, s.latencyMs);
      await logStep({ ...log, task }, route, null, null, false, last.message.slice(0, 500), 0);
    }
  }
  throw last ?? new LlmProviderError("no provider answered", "unavailable");
}
