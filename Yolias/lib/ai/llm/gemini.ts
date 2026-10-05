import { errorKind, LlmProviderError, type ChatRequest, type ChatResult, type ChatStep, type InputPart, type LlmAdapter, type StructuredRequest, type StructuredResult } from "./types.ts";

// Google Gemini API (generateContent) over plain fetch. Field names follow the
// official API (as used by the @google/genai SDK): systemInstruction,
// contents[{role, parts}], tools[{functionDeclarations}], generationConfig
// {responseMimeType, responseJsonSchema, maxOutputTokens}, functionCall /
// functionResponse parts, usageMetadata. The model's own parts (including any
// thoughtSignature) are sent back unchanged in multi-step tool use.
//   GEMINI_API_KEY  required to enable it
//   GEMINI_API_URL  optional (default https://generativelanguage.googleapis.com/v1beta)

const base = () => (process.env.GEMINI_API_URL || "https://generativelanguage.googleapis.com/v1beta").replace(/\/$/, "");

interface Part {
  text?: string;
  thought?: boolean;
  thoughtSignature?: string;
  inlineData?: { mimeType: string; data: string };
  functionCall?: { id?: string; name: string; args?: Record<string, unknown> };
  functionResponse?: { id?: string; name: string; response: Record<string, unknown> };
}
interface Content { role: "user" | "model"; parts: Part[] }
interface Generated {
  modelVersion?: string;
  candidates?: { content?: Content; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number; cachedContentTokenCount?: number };
}

async function call(model: string, body: Record<string, unknown>): Promise<Generated> {
  let res: Response;
  try {
    res = await fetch(`${base()}/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": process.env.GEMINI_API_KEY ?? "", "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    });
  } catch (e) {
    throw new LlmProviderError(`gemini: ${e instanceof Error ? e.message : "network error"}`, "unavailable");
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new LlmProviderError(`gemini ${res.status}: ${text.slice(0, 300)}`, errorKind(res.status));
  }
  return (await res.json()) as Generated;
}

const usageOf = (g: Generated) => ({
  input_tokens: g.usageMetadata?.promptTokenCount ?? 0,
  // Thinking tokens are billed as output.
  output_tokens: (g.usageMetadata?.candidatesTokenCount ?? 0) + (g.usageMetadata?.thoughtsTokenCount ?? 0),
  cache_read_input_tokens: g.usageMetadata?.cachedContentTokenCount ?? 0,
});
const blocked = (g: Generated) => Boolean(g.promptFeedback?.blockReason) || ["SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "RECITATION"].includes(g.candidates?.[0]?.finishReason ?? "");
const textOf = (c?: Content) => (c?.parts ?? []).filter((p) => p.text && !p.thought).map((p) => p.text).join("").trim();

function parts(input: InputPart[]): Part[] {
  return input.map((p) => {
    if (p.kind === "text") return { text: p.text };
    if (p.kind === "image") return { inlineData: { mimeType: p.mediaType, data: p.base64 } };
    if (p.kind === "pdf") return { inlineData: { mimeType: "application/pdf", data: p.base64 } };
    return { text: `<document name="${p.name}">\n${p.text}\n</document>` };
  });
}

export const geminiAdapter: LlmAdapter = {
  configured: () => Boolean(process.env.GEMINI_API_KEY),

  async structured(model: string, req: StructuredRequest): Promise<StructuredResult> {
    const g = await call(model, {
      systemInstruction: { parts: [{ text: req.system }] },
      contents: [{ role: "user", parts: parts(req.parts) }],
      generationConfig: { responseMimeType: "application/json", responseJsonSchema: req.schema, maxOutputTokens: req.maxTokens },
    });
    const servedModel = g.modelVersion ?? model;
    if (blocked(g)) return { data: null, usage: usageOf(g), servedModel, refused: true };
    try {
      return { data: JSON.parse(textOf(g.candidates?.[0]?.content)), usage: usageOf(g), servedModel, refused: false };
    } catch {
      throw new LlmProviderError("gemini: output is not JSON", "bad_output");
    }
  },

  async chat(model: string, req: ChatRequest): Promise<ChatResult> {
    const contents: Content[] = req.messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.text }] }));
    const tools = [{ functionDeclarations: req.tools.map((t) => ({ name: t.name, description: t.description, parametersJsonSchema: t.schema })) }];
    const steps: ChatStep[] = [];
    for (let i = 0; i < req.maxIterations; i++) {
      const started = Date.now();
      let g: Generated;
      try {
        g = await call(model, { systemInstruction: { parts: [{ text: req.context ? `${req.system}\n\n${req.context}` : req.system }] }, contents, tools, generationConfig: { maxOutputTokens: req.maxTokens } });
      } catch (e) {
        if (e instanceof LlmProviderError) e.steps = steps;
        throw e;
      }
      const refused = blocked(g);
      steps.push({ servedModel: g.modelVersion ?? model, usage: usageOf(g), latencyMs: Date.now() - started, refused });
      if (refused) throw new LlmProviderError("gemini: blocked", "refused", steps);
      const content = g.candidates?.[0]?.content;
      if (!content) throw new LlmProviderError("gemini: empty response", "bad_output", steps);
      const calls = content.parts.filter((p) => p.functionCall);
      if (!calls.length) return { reply: textOf(content), steps };
      contents.push({ role: "model", parts: content.parts });
      const responses: Part[] = [];
      for (const p of calls) {
        const fc = p.functionCall!;
        const tool = req.tools.find((t) => t.name === fc.name);
        const out = tool ? await tool.run(fc.args ?? {}) : JSON.stringify({ ok: false, outcome: "invalid", message: "Unknown tool." });
        let response: Record<string, unknown>;
        try {
          response = { result: JSON.parse(out) };
        } catch {
          response = { result: out };
        }
        responses.push({ functionResponse: { ...(fc.id ? { id: fc.id } : {}), name: fc.name, response } });
      }
      contents.push({ role: "user", parts: responses });
    }
    return { reply: "", steps };
  },
};
