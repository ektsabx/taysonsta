import "server-only";
import { businessLines } from "@/lib/company-profile";
import { z } from "zod";
import { LlmNotConfiguredError, routesFor, runChat } from "@/lib/ai/llm";
import type { ChatTool } from "@/lib/ai/llm/types";
import { agentTools, executeTool, type AgentContext } from "@/lib/agent/tools";
import { allowedTools, buildSystemPrompt, type ActivePolicy } from "@/lib/agent/policy";
import { DEFAULT_POLICY } from "@/lib/agent/policy-schema";
import { toMessages, type AgentTurn } from "@/lib/agent/messages";

// Yolias AI agent loop (docs/07): the configured LLM providers in order
// (Claude first by default; OpenAI / Gemini as fallbacks, D-118) with the
// tools in tools.ts. Every model call is logged with its cost (rule 28);
// every tool call is authorized and audited inside executeTool (rules 33, 35).

export const AGENT_PROMPT_VERSION = "agent-2026-10-07c";

// The system prompt comes from the published policy (lib/agent/policy.ts, D-141).


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
export type AgentEvent = { type: "thinking" } | { type: "tool"; name: string } | { type: "tool_done"; name: string; ok: boolean };

export type AgentFocus =
  | { scope: "campaign"; strategyId: string; campaignId: string | null }
  | { scope: "user" | "workspace" };

export async function runAgent(
  ctx: AgentContext,
  history: AgentTurn[],
  focus: AgentFocus,
  onEvent: (e: AgentEvent) => void = () => {},
  active?: ActivePolicy,
  memories: { id: string; content: string }[] = [],
): Promise<{ reply: string; costUsd: number; iterations: number; provider: string; model: string; toolCalls: number }> {
  const { policy, version } = active ?? { policy: ctx.policy ?? DEFAULT_POLICY, version: 0 };
  ctx.policy = policy;
  ctx.counters ??= { research: 0 };
  if (!(await routesFor("agent")).length) throw new AgentNotConfiguredError("no LLM provider is configured");
  const ws = ctx.session.workspace;
  const about = focus.scope === "campaign"
    ? ` This conversation is about search ${focus.strategyId}${focus.campaignId ? ` (campaign ${focus.campaignId})` : ""}; "this search" means it.`
    : focus.scope === "workspace" ? " This conversation is shared with the whole workspace." : " This is the user's private conversation.";
  const remembered = memories.length ? `\nSaved facts about this workspace (from earlier conversations; use when relevant, forget with forgetFact):\n${memories.map((m) => `- ${m.content} [${m.id}]`).join("\n")}` : "";
  const profile = businessLines({ ...ws, name: null });
  const business = profile ? `\nThe workspace's business (use it to suggest who to look for and to judge fit; what the user asks always wins):\n${profile}` : "";
  const context = `Workspace: ${ws.name}. Plan: ${ws.plan}. User: ${ctx.session.profile.full_name ?? ctx.session.email}. Role: ${ctx.session.role}. Preferred language: ${ctx.session.profile.language}. Today: ${new Date().toISOString().slice(0, 10)}.${about}${business}${remembered}`;
  onEvent({ type: "thinking" });
  // A tool that changes something (e.g. starts a campaign) must not run twice
  // because we switched provider mid-turn.
  let changedSomething = false;
  let toolCalls = 0;
  const offered = allowedTools(policy, ctx.session.role);
  const tools: ChatTool[] = agentTools.filter((t) => offered.has(t.name)).map((t) => ({
    name: t.name,
    description: t.description,
    // Validation happens in executeTool so even invalid calls are audited.
    schema: toolSchema(t.input),
    run: async (args) => {
      onEvent({ type: "tool", name: t.name });
      toolCalls++;
      const result = await executeTool(ctx, t.name, args);
      if (result.ok && t.permission !== "read") changedSomething = true;
      onEvent({ type: "tool_done", name: t.name, ok: result.ok });
      return JSON.stringify(result);
    },
  }));
  try {
    const r = await runChat("agent", {
      system: buildSystemPrompt(policy), context, tools, maxTokens: policy.limits.maxOutputTokens, maxIterations: policy.limits.maxIterations,
      messages: toMessages(history).map((m) => ({ role: m.role as "user" | "assistant", text: m.content as string })),
    }, {
      promptVersion: `${AGENT_PROMPT_VERSION}/p${version}`, workspaceId: ws.id, conversationId: ctx.conversationId,
      strategyId: focus.scope === "campaign" ? focus.strategyId : null, campaignId: focus.scope === "campaign" ? focus.campaignId : null,
    }, () => !changedSomething);
    return { reply: r.reply, costUsd: r.costUsd, iterations: r.steps.length, provider: r.route.provider, model: r.route.model, toolCalls };
  } catch (e) {
    if (e instanceof LlmNotConfiguredError) throw new AgentNotConfiguredError(e.message);
    throw e;
  }
}
