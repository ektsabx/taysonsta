import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaJSONSchemaOutputFormat, betaTool } from "@anthropic-ai/sdk/helpers/beta/json-schema";
import type { BetaContentBlockParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { anthropic } from "@/lib/ai/anthropic";
import { integrationSecret } from "@/lib/integrations";
import { LlmProviderError, type ChatRequest, type ChatResult, type ChatStep, type InputPart, type LlmAdapter, type StructuredRequest, type StructuredResult } from "./types";

// Claude through the official SDK: structured outputs for extraction, the
// SDK tool runner for the agent, prompt caching on the system prompt and the
// server-side refusal fallback.

const BETAS = ["server-side-fallback-2026-07-01"];

function toError(e: unknown, steps: ChatStep[] = []): LlmProviderError {
  if (e instanceof LlmProviderError) return e;
  const msg = e instanceof Error ? e.message.slice(0, 300) : "failed";
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) return new LlmProviderError(`anthropic: ${msg}`, "auth", steps);
  if (e instanceof Anthropic.RateLimitError) return new LlmProviderError(`anthropic: ${msg}`, "rate_limited", steps);
  if (e instanceof Anthropic.BadRequestError) return new LlmProviderError(`anthropic: ${msg}`, "bad_request", steps);
  return new LlmProviderError(`anthropic: ${msg}`, "unavailable", steps);
}

function blocks(parts: InputPart[]): BetaContentBlockParam[] {
  return parts.map((p): BetaContentBlockParam => {
    if (p.kind === "text") return { type: "text", text: p.text };
    if (p.kind === "image") return { type: "image", source: { type: "base64", media_type: p.mediaType as "image/png", data: p.base64 } };
    if (p.kind === "pdf") return { type: "document", source: { type: "base64", media_type: "application/pdf", data: p.base64 }, title: p.name };
    return { type: "document", source: { type: "text", media_type: "text/plain", data: p.text }, title: p.name };
  });
}

export const anthropicAdapter: LlmAdapter = {
  configured: () => Boolean(integrationSecret("anthropic", "api_key")),

  async structured(model: string, req: StructuredRequest): Promise<StructuredResult> {
    try {
      const r = await anthropic().beta.messages.parse({
        model,
        max_tokens: req.maxTokens,
        // Extraction: low effort keeps it fast and cheap.
        output_config: { effort: "low", format: betaJSONSchemaOutputFormat(req.schema as { type: "object" }) },
        betas: BETAS,
        fallbacks: "default",
        system: [{ type: "text", text: req.system, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: blocks(req.parts) }],
      });
      return { data: r.parsed_output ?? null, usage: r.usage, servedModel: r.model, refused: r.stop_reason === "refusal" };
    } catch (e) {
      throw toError(e);
    }
  },

  async chat(model: string, req: ChatRequest): Promise<ChatResult> {
    const steps: ChatStep[] = [];
    const runner = anthropic().beta.messages.toolRunner({
      model,
      max_tokens: req.maxTokens,
      max_iterations: req.maxIterations,
      system: [{ type: "text", text: req.system, cache_control: { type: "ephemeral" } }, ...(req.context ? [{ type: "text" as const, text: req.context }] : [])],
      tools: req.tools.map((t) => betaTool({ name: t.name, description: t.description, inputSchema: t.schema as { type: "object" }, run: (args) => t.run(args) })),
      messages: req.messages.map((m) => ({ role: m.role, content: m.text })),
      betas: BETAS,
      fallbacks: "default",
    });
    let reply = "";
    let started = Date.now();
    try {
      for await (const message of runner) {
        const refused = message.stop_reason === "refusal";
        steps.push({ servedModel: message.model, usage: message.usage, latencyMs: Date.now() - started, refused });
        started = Date.now();
        if (refused) throw new LlmProviderError("anthropic: refused", "refused", steps);
        const text = message.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
        if (text) reply = text;
      }
    } catch (e) {
      throw toError(e, steps);
    }
    return { reply, steps };
  },
};
