import "server-only";
import { z } from "zod";
import { betaTool } from "@anthropic-ai/sdk/helpers/beta/json-schema";
import type { BetaMessageParam, BetaTextBlockParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { anthropic, YOLIAS_MODEL } from "@/lib/ai/anthropic";
import { priceCall, recordLlmCall } from "@/lib/intel/llm";
import { agentTools, executeTool, type AgentContext } from "@/lib/agent/tools";

// Yolias AI agent loop (docs/07): Claude + the tools in tools.ts through the
// SDK tool runner. Every model call is logged with its cost (rule 28); every
// tool call is authorized and audited inside executeTool (rules 33, 35).

export const AGENT_PROMPT_VERSION = "agent-2026-10-05";
const MAX_ITERATIONS = 8;

const SYSTEM = `You are Yolias AI, the assistant inside Yolias, a B2B prospect discovery product.
Be professional, direct and concise. Reply in the user's language (Arabic or English); in Arabic use clear Modern Standard Arabic unless the user writes in a dialect.

Rules:
- Only state facts that come from your tools in this conversation. Never invent prospects, companies, emails, numbers or statuses.
- If data isn't there, say so plainly ("that data isn't available"). If a tool says "not_connected", tell the user that capability isn't connected yet.
- Never claim an email or phone was verified unless a tool result says so (email_status "verified").
- Report campaign progress exactly as getCampaign returns it; explain "partial" using partial_reason.
- Customers see Prospects, never credits. Usage comes from getUsage only.
- Before createCampaign, restate the search in one line and ask the user to confirm, unless they already clearly asked you to start it. Starting a campaign uses their monthly prospects.
- To change a search ("make it Saudi"), read it with getStrategy, then start a new campaign with the edited request after confirming.
- You can't send emails or messages, scrape websites, or do anything outside these tools.
- If a tool returns "denied", tell the user they don't have permission; don't retry.`;

export const AgentTurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string().trim().min(1).max(4000),
});
export type AgentTurn = z.infer<typeof AgentTurnSchema>;

export class AgentNotConfiguredError extends Error {}

function toolSchema(schema: z.ZodType): { type: "object" } {
  const { $schema: _drop, ...rest } = z.toJSONSchema(schema, { io: "input" }) as Record<string, unknown>;
  void _drop;
  return rest as { type: "object" };
}

function runnableTools(ctx: AgentContext) {
  return agentTools.map((t) =>
    betaTool({
      name: t.name,
      description: t.description,
      // Validation happens in executeTool so even invalid calls are audited.
      inputSchema: toolSchema(t.input),
      run: async (args) => JSON.stringify(await executeTool(ctx, t.name, args)),
    }),
  );
}

/**
 * Runs one assistant turn. The browser sends only plain text turns: tool
 * calls and results never come from the client, they are re-derived here.
 */
export async function runAgent(ctx: AgentContext, history: AgentTurn[]): Promise<{ reply: string; costUsd: number; iterations: number }> {
  if (!process.env.ANTHROPIC_API_KEY) throw new AgentNotConfiguredError("ANTHROPIC_API_KEY is not set");
  const ws = ctx.session.workspace;
  const context: BetaTextBlockParam = {
    type: "text",
    text: `Workspace: ${ws.name}. Plan: ${ws.plan}. User: ${ctx.session.profile.full_name ?? ctx.session.email}. Preferred language: ${ctx.session.profile.language}. Today: ${new Date().toISOString().slice(0, 10)}.`,
  };
  const messages: BetaMessageParam[] = history.map((t) => ({ role: t.role, content: t.text }));

  const runner = anthropic().beta.messages.toolRunner({
    model: YOLIAS_MODEL,
    max_tokens: 16000,
    max_iterations: MAX_ITERATIONS,
    // Stable prefix (tools + rules) is cached; the per-user line comes after it.
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }, context],
    tools: runnableTools(ctx),
    messages,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
  });

  let reply = "";
  let costUsd = 0;
  let iterations = 0;
  const log = { task: "agent", model: YOLIAS_MODEL, promptVersion: AGENT_PROMPT_VERSION, workspaceId: ws.id };
  let started = Date.now();
  try {
    for await (const message of runner) {
      iterations++;
      const cost = (await priceCall(message.model, message.usage).catch(() => null)) ?? (await priceCall(YOLIAS_MODEL, message.usage).catch(() => null));
      costUsd += cost ?? 0;
      await recordLlmCall({ ...log, servedModel: message.model, usage: message.usage, costUsd: cost, ok: message.stop_reason !== "refusal", error: message.stop_reason === "refusal" ? "refusal" : null, latencyMs: Date.now() - started }).catch(() => {});
      started = Date.now();
      const text = message.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
      if (text) reply = text;
    }
  } catch (e) {
    await recordLlmCall({ ...log, ok: false, error: e instanceof Error ? e.message.slice(0, 500) : "failed", latencyMs: Date.now() - started }).catch(() => {});
    throw e;
  }
  return { reply, costUsd, iterations };
}
