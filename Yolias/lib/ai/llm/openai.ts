import { errorKind, LlmProviderError, type ChatRequest, type ChatResult, type ChatStep, type InputPart, type LlmAdapter, type StructuredRequest, type StructuredResult } from "./types.ts";

// OpenAI Chat Completions over plain fetch (no SDK dependency). Request and
// response fields follow the official API reference (structured outputs via
// response_format json_schema; function tools; tool role messages).
//   OPENAI_API_KEY  required to enable it
//   OPENAI_API_URL  optional (default https://api.openai.com/v1; any compatible endpoint)

const base = () => (process.env.OPENAI_API_URL || "https://api.openai.com/v1").replace(/\/$/, "");

type Msg =
  | { role: "system" | "user"; content: string | unknown[] }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };
interface ToolCall { id: string; type: "function"; function: { name: string; arguments: string } }
interface Completion {
  model: string;
  choices: { finish_reason: string; message: { content: string | null; refusal?: string | null; tool_calls?: ToolCall[] } }[];
  usage?: { prompt_tokens: number; completion_tokens: number; prompt_tokens_details?: { cached_tokens?: number } };
}

async function call(body: Record<string, unknown>): Promise<Completion> {
  let res: Response;
  try {
    res = await fetch(`${base()}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    });
  } catch (e) {
    throw new LlmProviderError(`openai: ${e instanceof Error ? e.message : "network error"}`, "unavailable");
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new LlmProviderError(`openai ${res.status}: ${text.slice(0, 300)}`, errorKind(res.status));
  }
  return (await res.json()) as Completion;
}

const usageOf = (c: Completion) => ({
  input_tokens: c.usage?.prompt_tokens ?? 0,
  output_tokens: c.usage?.completion_tokens ?? 0,
  cache_read_input_tokens: c.usage?.prompt_tokens_details?.cached_tokens ?? 0,
});

function content(parts: InputPart[]): unknown[] {
  return parts.map((p) => {
    if (p.kind === "text") return { type: "text", text: p.text };
    if (p.kind === "image") return { type: "image_url", image_url: { url: `data:${p.mediaType};base64,${p.base64}` } };
    if (p.kind === "pdf") return { type: "file", file: { filename: p.name, file_data: `data:application/pdf;base64,${p.base64}` } };
    return { type: "text", text: `<document name="${p.name}">\n${p.text}\n</document>` };
  });
}

export const openaiAdapter: LlmAdapter = {
  configured: () => Boolean(process.env.OPENAI_API_KEY),

  async structured(model: string, req: StructuredRequest): Promise<StructuredResult> {
    const c = await call({
      model,
      max_completion_tokens: req.maxTokens,
      messages: [{ role: "system", content: req.system }, { role: "user", content: content(req.parts) }],
      // Non-strict: our schemas have optional fields; the caller validates with zod.
      response_format: { type: "json_schema", json_schema: { name: req.schemaName, schema: req.schema, strict: false } },
    });
    const msg = c.choices[0]?.message;
    if (!msg || msg.refusal) return { data: null, usage: usageOf(c), servedModel: c.model, refused: Boolean(msg?.refusal) };
    try {
      return { data: JSON.parse(msg.content ?? ""), usage: usageOf(c), servedModel: c.model, refused: false };
    } catch {
      throw new LlmProviderError("openai: output is not JSON", "bad_output");
    }
  },

  async chat(model: string, req: ChatRequest): Promise<ChatResult> {
    const messages: Msg[] = [{ role: "system", content: req.context ? `${req.system}\n\n${req.context}` : req.system }, ...req.messages.map((m) => ({ role: m.role, content: m.text }) as Msg)];
    const tools = req.tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.schema } }));
    const steps: ChatStep[] = [];
    for (let i = 0; i < req.maxIterations; i++) {
      const started = Date.now();
      let c: Completion;
      try {
        c = await call({ model, max_completion_tokens: req.maxTokens, messages, tools });
      } catch (e) {
        if (e instanceof LlmProviderError) e.steps = steps;
        throw e;
      }
      const msg = c.choices[0]?.message;
      steps.push({ servedModel: c.model, usage: usageOf(c), latencyMs: Date.now() - started, refused: Boolean(msg?.refusal) });
      if (!msg) throw new LlmProviderError("openai: empty response", "bad_output", steps);
      if (msg.refusal) throw new LlmProviderError("openai: refused", "refused", steps);
      if (!msg.tool_calls?.length) return { reply: (msg.content ?? "").trim(), steps };
      messages.push({ role: "assistant", content: msg.content, tool_calls: msg.tool_calls });
      for (const tc of msg.tool_calls) {
        const tool = req.tools.find((t) => t.name === tc.function.name);
        let input: unknown = {};
        try {
          input = JSON.parse(tc.function.arguments || "{}");
        } catch {
          input = {};
        }
        const out = tool ? await tool.run(input) : JSON.stringify({ ok: false, outcome: "invalid", message: "Unknown tool." });
        messages.push({ role: "tool", tool_call_id: tc.id, content: out });
      }
    }
    return { reply: "", steps };
  },
};
