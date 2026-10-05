import "server-only";
import { priceCall, recordLlmCall } from "@/lib/intel/llm";

// Speech-to-Text provider for /api/transcribe (used when the browser has no
// speech engine of its own). Speaks the OpenAI-compatible
// POST {base}/audio/transcriptions API, which several providers implement.
// Configure in .env.local:
//   STT_API_KEY=...                       (required to enable it)
//   STT_API_URL=https://api.openai.com/v1 (or https://api.groq.com/openai/v1)
//   STT_MODEL=gpt-4o-mini-transcribe      (or whisper-large-v3-turbo on Groq)

export function sttConfigured(): boolean {
  return Boolean(process.env.STT_API_KEY);
}

export class SttProviderError extends Error {}

// Providers report usage as tokens (gpt-4o-*-transcribe) or seconds (whisper).
interface SttUsage {
  type?: "tokens" | "duration";
  input_tokens?: number;
  output_tokens?: number;
  seconds?: number;
}

/**
 * Every call is logged in intel.llm_calls (task "stt", rule 28). Token usage
 * is priced from the llm_prices setting; anything else is logged unpriced
 * (cost null, D-114), never as free.
 */
export async function transcribe(audio: File, language: "ar" | "en" | undefined, workspaceId?: string | null): Promise<string> {
  const model = process.env.STT_MODEL || "gpt-4o-mini-transcribe";
  const started = Date.now();
  const log = { task: "stt", model, servedModel: model, workspaceId: workspaceId ?? null };
  try {
    const { text, usage } = await callProvider(audio, language, model);
    const tokens = usage?.type === "tokens" || usage?.input_tokens != null ? { input_tokens: usage?.input_tokens ?? 0, output_tokens: usage?.output_tokens ?? 0 } : null;
    const costUsd = tokens ? await priceCall(model, tokens).catch(() => null) : null;
    await recordLlmCall({ ...log, usage: tokens, costUsd, ok: true, latencyMs: Date.now() - started }).catch(() => {});
    return text;
  } catch (e) {
    await recordLlmCall({ ...log, ok: false, error: e instanceof Error ? e.message : "failed", latencyMs: Date.now() - started }).catch(() => {});
    throw e;
  }
}

async function callProvider(audio: File, language: "ar" | "en" | undefined, model: string): Promise<{ text: string; usage: SttUsage | null }> {
  const base = (process.env.STT_API_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const fd = new FormData();
  fd.set("file", audio, audio.name || "voice.webm");
  fd.set("model", model);
  if (language) fd.set("language", language);
  fd.set("response_format", "json");

  const res = await fetch(`${base}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.STT_API_KEY}` },
    body: fd,
  });
  if (!res.ok) throw new SttProviderError(`STT provider returned ${res.status}`);
  const body = (await res.json()) as { text?: string; usage?: SttUsage };
  return { text: (body.text ?? "").trim(), usage: body.usage ?? null };
}
