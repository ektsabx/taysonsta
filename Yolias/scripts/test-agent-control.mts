// Yolias AI control center end to end (D-141), against the local Supabase
// with a local stand-in for the model (nothing leaves this machine):
//   npm run test:agent-control
// Covers: published policy loading, the evaluation runner (guardrail applied,
// must / must-not checks, cost), and the shared answer cache.
import assert from "node:assert/strict";
import http from "node:http";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.ts";

const PORT = 4961;
process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${PORT}`;
let calls = 0;
const server = http.createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    calls++;
    const body = JSON.parse(raw || "{}");
    assert.match(JSON.stringify(body.system ?? ""), /You are Yolias AI/);
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ id: "msg", type: "message", role: "assistant", model: "claude-opus-5-5", stop_reason: "end_turn", stop_sequence: null,
      content: [{ type: "text", text: "I am Yolias AI, I help you find prospects. Under the hood I run on Claude by Anthropic. Ask me about your campaigns." }],
      usage: { input_tokens: 800, output_tokens: 40, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } }));
  });
}).listen(PORT);

(await import("@/lib/integrations.ts")).setIntegrationsForTests({ anthropic: { api_key: "test-anthropic" } });
const { activePolicy, cachedAnswer, storeAnswer } = await import("@/lib/agent/policy.ts");
const { runEval } = await import("@/lib/agent/eval.ts");
const db = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
let runId: string | null = null;
const question = `What is a good length for a cold email ${Date.now().toString(36)}?`;
try {
  const active = await activePolicy();
  assert.ok(active.version >= 1, "a published policy exists");

  // Evaluation of the published version.
  // Inserted as "running" so the local dev worker never picks it up with real keys.
  const { data: run } = await db.from("agent_eval_runs").insert({ policy_version: active.version, created_by: "test", status: "running" }).select("id").single();
  runId = run!.id;
  await runEval(runId!, active.version);
  const { data: done } = await db.from("agent_eval_runs").select("*").eq("id", runId).single();
  assert.equal(done!.status, "done", done!.error ?? "");
  const results = done!.results as { name: string; passed: boolean; reply: string; guardrailHits: number }[];
  assert.ok(results.length >= 3);
  for (const r of results) {
    assert.ok(!/Claude|Anthropic/.test(r.reply), `guardrail removed the vendor sentence (${r.name})`);
    assert.equal(r.guardrailHits, 1);
  }
  assert.equal(done!.passed, done!.total, JSON.stringify(results.filter((r) => !r.passed)));
  assert.ok(calls >= 3);

  // Shared answer cache: stored once, served to anyone asking the same thing (any spelling).
  assert.equal(await cachedAnswer(question, active.version), null);
  await storeAnswer(question, "Keep it under 120 words.", active.version, 1);
  assert.equal(await cachedAnswer(question.toUpperCase().replace("?", " ?!"), active.version), "Keep it under 120 words.");
  assert.equal(await cachedAnswer(question, active.version + 1), null, "a new policy version starts a fresh cache");
  console.log("✓ agent control: published policy, evaluation (guardrail + checks), shared answer cache");
} finally {
  if (runId) await db.from("agent_eval_runs").delete().eq("id", runId);
  await db.from("agent_answer_cache").delete().ilike("question", "What is a good length for a cold email%");
  server.close();
}
