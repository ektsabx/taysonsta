import "server-only";

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

export async function transcribe(audio: File, language: "ar" | "en" | undefined): Promise<string> {
  const base = (process.env.STT_API_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const fd = new FormData();
  fd.set("file", audio, audio.name || "voice.webm");
  fd.set("model", process.env.STT_MODEL || "gpt-4o-mini-transcribe");
  if (language) fd.set("language", language);
  fd.set("response_format", "json");

  const res = await fetch(`${base}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.STT_API_KEY}` },
    body: fd,
  });
  if (!res.ok) throw new SttProviderError(`STT provider returned ${res.status}`);
  const body = (await res.json()) as { text?: string };
  return (body.text ?? "").trim();
}
