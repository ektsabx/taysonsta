import "server-only";
import { db } from "@/lib/bos/db";
import { getSetting } from "@/lib/bos/settings";
import { ValidationError } from "@/lib/bos/errors";
import { providerFetch, resolveConnection, type ResolvedConnection } from "@/services/bos/integrations";
import type { AiProvider } from "@/lib/bos/integrations/catalog";

// Unified AI client (docs/bos/30 §7, doc 31 Phase 4). One call shape for
// Claude / OpenAI / Gemini; tries providers in the configured order and falls
// back on failure; every attempt is logged with tokens and estimated cost;
// a monthly budget stops calls once reached. Callers must pass only data the
// requesting user may see (permission checks happen before this layer).

export interface AiRequest {
  feature: string;            // e.g. "support.reply_draft" — for usage reports
  system?: string;
  prompt: string;
  json?: boolean;             // ask for a JSON object response
  maxTokens?: number;
  temperature?: number;
  userId?: string | null;
  providers?: AiProvider[];   // override the configured order
}

export type AiResult =
  | { ok: true; text: string; provider: AiProvider; model: string; inputTokens: number; outputTokens: number; costUsd: number | null; fallbackFrom: AiProvider[] }
  | { ok: false; error: string; tried: { provider: AiProvider; error: string }[] };

interface Attempt { ok: boolean; text: string; inputTokens: number; outputTokens: number; error: string | null }

async function callProvider(provider: AiProvider, r: ResolvedConnection, req: AiRequest): Promise<Attempt & { model: string }> {
  const model = (r.connection.config as Record<string, string>).model;
  const maxTokens = Math.min(Math.max(req.maxTokens ?? 1024, 16), 8192);
  const temperature = req.temperature ?? 0.4;
  const base = { provider, connectionId: r.connection.id, operation: `ai.${req.feature}`, secrets: r.secrets, actorId: req.userId ?? null, retries: 1, timeoutMs: 60_000, meta: { model, feature: req.feature } };

  if (provider === "anthropic") {
    const res = await providerFetch({ ...base, url: "https://api.anthropic.com/v1/messages", init: { method: "POST", headers: { "x-api-key": r.secrets.api_key, "anthropic-version": "2023-06-01", "content-type": "application/json" }, body: JSON.stringify({ model, max_tokens: maxTokens, temperature, ...(req.system ? { system: req.system + (req.json ? "\nRespond with a single JSON object only." : "") } : req.json ? { system: "Respond with a single JSON object only." } : {}), messages: [{ role: "user", content: req.prompt }] }) } });
    const b = res.body as { content?: { type: string; text?: string }[]; usage?: { input_tokens?: number; output_tokens?: number } } | null;
    return { model, ok: res.ok, text: (b?.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join(""), inputTokens: b?.usage?.input_tokens ?? 0, outputTokens: b?.usage?.output_tokens ?? 0, error: res.error };
  }
  if (provider === "openai") {
    const org = (r.connection.config as Record<string, string>).organization;
    const res = await providerFetch({ ...base, url: "https://api.openai.com/v1/chat/completions", init: { method: "POST", headers: { Authorization: `Bearer ${r.secrets.api_key}`, "content-type": "application/json", ...(org ? { "OpenAI-Organization": org } : {}) }, body: JSON.stringify({ model, max_completion_tokens: maxTokens, temperature, messages: [...(req.system ? [{ role: "system", content: req.system }] : []), { role: "user", content: req.prompt }], ...(req.json ? { response_format: { type: "json_object" } } : {}) }) } });
    const b = res.body as { choices?: { message?: { content?: string } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } } | null;
    return { model, ok: res.ok, text: b?.choices?.[0]?.message?.content ?? "", inputTokens: b?.usage?.prompt_tokens ?? 0, outputTokens: b?.usage?.completion_tokens ?? 0, error: res.error };
  }
  const res = await providerFetch({ ...base, url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, init: { method: "POST", headers: { "x-goog-api-key": r.secrets.api_key, "content-type": "application/json" }, body: JSON.stringify({ ...(req.system ? { systemInstruction: { parts: [{ text: req.system }] } } : {}), contents: [{ role: "user", parts: [{ text: req.prompt }] }], generationConfig: { maxOutputTokens: maxTokens, temperature, ...(req.json ? { responseMimeType: "application/json" } : {}) } }) } });
  const b = res.body as { candidates?: { content?: { parts?: { text?: string }[] } }[]; usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } } | null;
  return { model, ok: res.ok, text: (b?.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join(""), inputTokens: b?.usageMetadata?.promptTokenCount ?? 0, outputTokens: b?.usageMetadata?.candidatesTokenCount ?? 0, error: res.error };
}

export async function monthSpendMicros(): Promise<number> {
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const { data } = await db().from("ai_usage_log").select("cost_micros").gte("created_at", start.toISOString());
  return (data ?? []).reduce((s, r) => s + Number(r.cost_micros ?? 0), 0);
}

export async function aiGenerate(req: AiRequest): Promise<AiResult> {
  if (!req.prompt.trim()) throw new ValidationError("النص المطلوب فارغ.");
  if (req.prompt.length > 200_000) throw new ValidationError("النص طويل جداً للمعالجة.");
  const settings = await getSetting("ai");
  if (settings.monthly_budget_usd > 0 && (await monthSpendMicros()) >= settings.monthly_budget_usd * 1_000_000) {
    return { ok: false, error: "تم بلوغ حد ميزانية الذكاء الاصطناعي لهذا الشهر.", tried: [] };
  }
  const order = req.providers?.length ? req.providers : settings.fallback_order;
  const tried: { provider: AiProvider; error: string }[] = [];
  for (const provider of order) {
    const conn = await resolveConnection(provider);
    if (!conn) continue;
    const a = await callProvider(provider, conn, req);
    const price = settings.prices.find((p) => p.model === a.model);
    const costMicros = price ? Math.round(a.inputTokens * price.input_per_mtok + a.outputTokens * price.output_per_mtok) : 0;
    const ok = a.ok && a.text.trim().length > 0;
    await db().from("ai_usage_log").insert({ connection_id: conn.connection.id, provider, model: a.model, feature: req.feature, input_tokens: a.inputTokens, output_tokens: a.outputTokens, cost_micros: costMicros, ok, fallback_from: tried.length ? tried.map((t) => t.provider).join(",") : null, error: ok ? null : (a.error ?? "empty response").slice(0, 500), user_id: req.userId ?? null });
    if (ok) return { ok: true, text: a.text, provider, model: a.model, inputTokens: a.inputTokens, outputTokens: a.outputTokens, costUsd: price ? costMicros / 1_000_000 : null, fallbackFrom: tried.map((t) => t.provider) };
    tried.push({ provider, error: a.error ?? "empty response" });
  }
  return { ok: false, error: tried.length ? "فشلت كل مزودات الذكاء الاصطناعي المضبوطة." : "لا يوجد مزود ذكاء اصطناعي مضبوط في مركز التكاملات.", tried };
}

// Parses a JSON answer defensively (models sometimes wrap it in ``` fences).
export function parseAiJson<T = unknown>(text: string): T | null {
  const m = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]) as T;
  } catch {
    return null;
  }
}
