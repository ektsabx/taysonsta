// Integration test for GEO tracking (D-277) against the local Supabase. The
// three AI APIs are answered in this process (response shapes as in their
// official APIs: OpenAI Responses, Gemini generateContent, Perplexity chat);
// nothing leaves the machine. Checks: a run fills one question per active
// prompt and engine, answers are analysed (mention, first pick, citation,
// brands), a failing engine is retried then marked failed, the run closes.
//   npm run test:geo
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { setIntegrationsForTests } from "../lib/integrations.ts";
import { geoSweep } from "../lib/ai-visibility/run.ts";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const realFetch = globalThis.fetch;
let perplexityFails = true;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input instanceof Request ? input.url : input);
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
  if (url.startsWith("https://api.openai.com/v1/responses")) {
    return json({ output: [{ type: "message", content: [{ type: "output_text", text: "Yolias books meetings; Apollo.io has data.", annotations: [{ type: "url_citation", url: "https://www.yolias.com/" }] }] }] });
  }
  if (url.startsWith("https://generativelanguage.googleapis.com/")) {
    return json({ candidates: [{ content: { parts: [{ text: "Try Apollo.io or Clay. Yolias also works." }] }, groundingMetadata: { groundingChunks: [{ web: { uri: "https://vertexaisearch.cloud.google.com/x", title: "apollo.io" } }] } }] });
  }
  if (url.startsWith("https://api.perplexity.ai/")) {
    return perplexityFails ? json({ error: "rate limited" }, 429) : json({ choices: [{ message: { content: "Instantly and Smartlead." } }], citations: ["https://instantly.ai"] });
  }
  return realFetch(input, init);
}) as typeof fetch;

setIntegrationsForTests({ openai: { api_key: "test" }, gemini: { api_key: "test" }, perplexity: { api_key: "test" } });

// Only this test's prompts are active while it runs.
const { data: before } = await db.from("geo_prompts").select("id").eq("active", true);
await db.from("geo_prompts").update({ active: false }).eq("active", true);
const { data: prompts } = await db.from("geo_prompts").insert([{ text: "geo test prompt one", lang: "en" }, { text: "geo test prompt two", lang: "en" }]).select("id");
// Runs already in progress locally (the dev worker's weekly run) are set aside so this one is answered.
const { data: others } = await db.from("geo_runs").select("id").eq("status", "running");
if (others?.length) await db.from("geo_runs").update({ status: "done" }).in("id", others.map((o) => o.id));
const { data: run } = await db.from("geo_runs").insert({ trigger: "manual" }).select("id").single();
try {
  for (let i = 0; i < 6; i++) await geoSweep();
  const { data: r } = await db.from("geo_runs").select("*").eq("id", run!.id).single();
  assert.equal(r!.total, 6, "2 prompts × 3 engines");
  const { data: answers } = await db.from("geo_answers").select("*").eq("run_id", run!.id);
  const by = (e: string) => answers!.filter((a) => a.engine === e);
  assert.ok(by("openai").every((a) => a.status === "done" && a.mentioned && a.first_pick && a.cited));
  assert.deepEqual(by("gemini")[0].brands, ["Apollo.io", "Clay", "Yolias"]);
  assert.ok(by("gemini").every((a) => a.mentioned && !a.first_pick && !a.cited));
  assert.ok(by("perplexity").every((a) => a.status === "failed" && a.attempts === 2 && /429/.test(a.error)), "failed after two attempts");
  assert.equal(r!.status, "done");
  console.log("GEO tracking: ok");
} finally {
  if (others?.length) await db.from("geo_runs").update({ status: "running", finished_at: null }).in("id", others.map((o) => o.id));
  await db.from("geo_runs").delete().eq("id", run!.id);
  await db.from("geo_prompts").delete().in("id", prompts!.map((p) => p.id));
  if (before?.length) await db.from("geo_prompts").update({ active: true }).in("id", before.map((p) => p.id));
  perplexityFails = false;
}
