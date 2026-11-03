import "server-only";
import { integrationConfig, integrationSecret } from "@/lib/integrations";

// GEO tracking (D-277): asks one question the way a buyer would, with each
// engine's web search on, and returns the answer and the links it cites.
// Keys come only from the Admin Integrations hub.

export const GEO_ENGINES = ["openai", "gemini", "perplexity"] as const;
export type GeoEngine = (typeof GEO_ENGINES)[number];

export interface EngineAnswer {
  text: string;
  citations: string[];
}

const TIMEOUT_MS = 45_000;

export function engineReady(e: GeoEngine): boolean {
  return Boolean(integrationSecret(e, "api_key"));
}

async function post(url: string, headers: Record<string, string>, body: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(TIMEOUT_MS) });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 300)}`);
  return JSON.parse(text) as Record<string, unknown>;
}

type Any = Record<string, unknown>;
const arr = (v: unknown): Any[] => (Array.isArray(v) ? (v as Any[]) : []);

async function openai(prompt: string): Promise<EngineAnswer> {
  const key = integrationSecret("openai", "api_key")!;
  const j = await post("https://api.openai.com/v1/responses", { Authorization: `Bearer ${key}` }, {
    model: integrationConfig("openai", "model") || "gpt-4.1-mini",
    tools: [{ type: "web_search_preview" }],
    input: prompt,
  });
  const parts = arr(j.output).flatMap((o) => arr(o.content)).filter((c) => c.type === "output_text");
  return {
    text: parts.map((p) => String(p.text ?? "")).join("\n"),
    citations: parts.flatMap((p) => arr(p.annotations)).filter((a) => a.type === "url_citation").map((a) => String(a.url)),
  };
}

async function gemini(prompt: string): Promise<EngineAnswer> {
  const key = integrationSecret("gemini", "api_key")!;
  const model = integrationConfig("gemini", "model") || "gemini-2.5-flash";
  const j = await post(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, { "x-goog-api-key": key }, {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    tools: [{ google_search: {} }],
  });
  const cand = arr(j.candidates)[0] ?? {};
  const content = (cand.content ?? {}) as Any;
  const chunks = arr((cand.groundingMetadata as Any | undefined)?.groundingChunks);
  return {
    text: arr(content.parts).map((p) => String(p.text ?? "")).join(""),
    // Google returns redirect links; the title holds the source's domain.
    citations: chunks.map((c) => (c.web ?? {}) as Any).map((w) => (w.title ? `https://${String(w.title)}` : String(w.uri ?? ""))).filter(Boolean),
  };
}

async function perplexity(prompt: string): Promise<EngineAnswer> {
  const key = integrationSecret("perplexity", "api_key")!;
  const j = await post("https://api.perplexity.ai/chat/completions", { Authorization: `Bearer ${key}` }, {
    model: integrationConfig("perplexity", "model") || "sonar",
    messages: [{ role: "user", content: prompt }],
  });
  const msg = (arr(j.choices)[0]?.message ?? {}) as Any;
  const urls = [...(Array.isArray(j.citations) ? (j.citations as unknown[]).map(String) : []), ...arr(j.search_results).map((r) => String(r.url ?? ""))];
  return { text: String(msg.content ?? ""), citations: [...new Set(urls.filter(Boolean))] };
}

export function ask(engine: GeoEngine, prompt: string): Promise<EngineAnswer> {
  return engine === "openai" ? openai(prompt) : engine === "gemini" ? gemini(prompt) : perplexity(prompt);
}
