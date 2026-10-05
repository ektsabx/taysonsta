import "server-only";
import { z } from "zod";
import { LlmNotConfiguredError, routesFor, runChat } from "@/lib/ai/llm";
import type { ChatTool } from "@/lib/ai/llm/types";
import { agentTools, executeTool, type AgentContext } from "@/lib/agent/tools";
import { toMessages, type AgentTurn } from "@/lib/agent/messages";

// Yolias AI agent loop (docs/07): the configured LLM providers in order
// (Claude first by default; OpenAI / Gemini as fallbacks, D-118) with the
// tools in tools.ts. Every model call is logged with its cost (rule 28);
// every tool call is authorized and audited inside executeTool (rules 33, 35).

export const AGENT_PROMPT_VERSION = "agent-2026-10-05b";
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
- If a tool returns "denied", tell the user they don't have permission; don't retry.
- Write plain text: short paragraphs or simple "-" lists. No markdown headings, tables or bold. Keep it brief.`;


export class AgentNotConfiguredError extends Error {}

function toolSchema(schema: z.ZodType): Record<string, unknown> {
  const { $schema: _drop, ...rest } = z.toJSONSchema(schema, { io: "input" }) as Record<string, unknown>;
  void _drop;
  return rest;
}

/**
 * Runs one assistant turn. The browser sends only plain text turns: tool
 * calls and results never come from the client, they are re-derived here.
 */
export async function runAgent(
  ctx: AgentContext,
  history: AgentTurn[],
  focus?: { strategyId: string; campaignId: string | null },
): Promise<{ reply: string; costUsd: number; iterations: number; provider: string }> {
  if (!(await routesFor("agent")).length) throw new AgentNotConfiguredError("no LLM provider is configured");
  const ws = ctx.session.workspace;
  const context = `Workspace: ${ws.name}. Plan: ${ws.plan}. User: ${ctx.session.profile.full_name ?? ctx.session.email}. Preferred language: ${ctx.session.profile.language}. Today: ${new Date().toISOString().slice(0, 10)}.${
    focus ? ` This conversation is about search ${focus.strategyId}${focus.campaignId ? ` (campaign ${focus.campaignId})` : ""}; "this search" means it.` : ""
  }`;
  // A tool that changes something (e.g. starts a campaign) must not run twice
  // because we switched provider mid-turn.
  let changedSomething = false;
  const tools: ChatTool[] = agentTools.map((t) => ({
    name: t.name,
    description: t.description,
    // Validation happens in executeTool so even invalid calls are audited.
    schema: toolSchema(t.input),
    run: async (args) => {
      const result = await executeTool(ctx, t.name, args);
      if (result.ok && t.permission !== "read") changedSomething = true;
      return JSON.stringify(result);
    },
  }));
  try {
    const r = await runChat("agent", {
      system: SYSTEM, context, tools, maxTokens: 16000, maxIterations: MAX_ITERATIONS,
      messages: toMessages(history).map((m) => ({ role: m.role as "user" | "assistant", text: m.content as string })),
    }, { promptVersion: AGENT_PROMPT_VERSION, workspaceId: ws.id }, () => !changedSomething);
    return { reply: r.reply, costUsd: r.costUsd, iterations: r.steps.length, provider: r.route.provider };
  } catch (e) {
    if (e instanceof LlmNotConfiguredError) throw new AgentNotConfiguredError(e.message);
    throw e;
  }
}
