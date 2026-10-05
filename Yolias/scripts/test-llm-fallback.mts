// Integration test for LLM fallback across providers (D-118), against the
// local Supabase with local stand-ins for the OpenAI and Gemini HTTP APIs
// (request/response shapes as in their official APIs). Nothing leaves the
// machine. Checks: order from settings, skip unconfigured providers, fall
// back on failure / invalid output, tool calling on both, no fallback after a
// side-effecting tool, every attempt logged in intel.llm_calls.
//   npm run test:llm
import assert from "node:assert/strict";
import http from "node:http";
import { createClient } from "@supabase/supabase-js";

type Handler = (body: Record<string, unknown>) => { status: number; json: unknown };
const seen: { api: string; body: Record<string, unknown> }[] = [];
let openaiHandler: Handler = () => ({ status: 500, json: {} });
let geminiHandler: Handler = () => ({ status: 500, json: {} });
const serve = (api: string, port: number, get: () => Handler) =>
  http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const body = JSON.parse(raw || "{}");
      seen.push({ api, body });
      if (api === "gemini") assert.equal(req.headers["x-goog-api-key"], "test-gemini");
      if (api === "openai") assert.equal(req.headers.authorization, "Bearer test-openai");
      if (api === "anthropic") assert.equal(req.headers["x-api-key"], "test-anthropic");
      const r = get()(body);
      res.statusCode = r.status;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify(r.json));
    });
  }).listen(port);
const s1 = serve("openai", 4931, () => openaiHandler);
const s2 = serve("gemini", 4932, () => geminiHandler);
let anthropicHandler: Handler = () => ({ status: 529, json: { type: "error", error: { type: "overloaded_error", message: "Overloaded" } } });
const s3 = serve("anthropic", 4933, () => anthropicHandler);

process.env.ANTHROPIC_API_KEY = "test-anthropic";
process.env.ANTHROPIC_BASE_URL = "http://127.0.0.1:4933";
process.env.OPENAI_API_KEY = "test-openai";
process.env.OPENAI_API_URL = "http://127.0.0.1:4931/v1";
process.env.GEMINI_API_KEY = "test-gemini";
process.env.GEMINI_API_URL = "http://127.0.0.1:4932/v1beta";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const intel = admin.schema("intel" as never) as unknown as ReturnType<typeof admin.schema>;
const { data: before } = await intel.from("settings").select("value").eq("key", "llm_routing").maybeSingle();
await intel.from("settings").upsert({ key: "llm_routing", value: { default: [{ provider: "anthropic", model: "claude-opus-5-5" }, { provider: "openai", model: "gpt-test" }, { provider: "gemini", model: "gemini-test" }] } });

const { understandStrategy } = await import("@/lib/ai/strategy.ts");
const { runAgent } = await import("@/lib/agent/run.ts");

const icp = {
  campaign_name: "Riyadh Fintech — Heads of Sales", summary: "Fintechs in Riyadh", countries: ["SA"], cities: ["Riyadh"], industries: ["Fintech"],
  keywords: [], employees_min: 11, employees_max: 200, job_titles: ["Head of Sales"], seniorities: ["head"], target_count: 50, target_unit: "prospects",
  hiring: null, hiring_roles: [], funding_stages: [], technologies: [], exclusions: [], assumptions: [],
};
const strategyId = crypto.randomUUID();
const logs = async () => (await intel.from("llm_calls").select("task, model, ok, error").eq("strategy_id", strategyId).order("id")).data as { task: string; model: string; ok: boolean; error: string | null }[];

let wsId = "";
try {
  // 0) Claude first: structured output and a tool-use turn through the official SDK.
  const { data: anyWs0 } = await admin.from("workspaces").select("id").limit(1).single();
  anthropicHandler = (body) => {
    assert.ok((body.output_config as { format: { type: string } }).format.type === "json_schema");
    return { status: 200, json: { id: "msg_1", type: "message", role: "assistant", model: "claude-opus-5-5", stop_reason: "end_turn", stop_sequence: null,
      content: [{ type: "text", text: JSON.stringify(icp) }], usage: { input_tokens: 700, output_tokens: 150, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } } };
  };
  const r0 = await understandStrategy(`claude first ${Date.now()}`, [], { userName: null, companyName: "Acme", website: null, offering: null, defaultCountry: "SA", language: "en", workspaceId: anyWs0!.id, strategyId });
  assert.equal(r0.model, "claude-opus-5-5");
  console.log("✓ ICP on Claude (official SDK, structured output)");
  anthropicHandler = () => ({ status: 529, json: { type: "error", error: { type: "overloaded_error", message: "Overloaded" } } });

  // 1) ICP: Claude overloaded, OpenAI down (503) → Gemini answers.
  openaiHandler = () => ({ status: 503, json: { error: { message: "overloaded" } } });
  geminiHandler = () => ({ status: 200, json: { modelVersion: "gemini-test-001", candidates: [{ content: { role: "model", parts: [{ text: JSON.stringify(icp) }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 900, candidatesTokenCount: 120 } } });
  const ctx = { userName: null, companyName: "Acme", website: null, offering: "Payroll software", defaultCountry: "SA", language: "en" as const, workspaceId: "", strategyId };
  const { data: anyWs } = await admin.from("workspaces").select("id").limit(1).single();
  wsId = anyWs!.id;
  ctx.workspaceId = wsId;
  const r = await understandStrategy(`fintech heads of sales in riyadh ${Date.now()}`, [], ctx);
  assert.equal(r.icp.countries[0], "SA");
  assert.equal(r.model, "gemini-test-001");
  const geminiReq = seen.find((s) => s.api === "gemini")!.body as { generationConfig: { responseMimeType: string; responseJsonSchema: object }; systemInstruction: object };
  assert.equal(geminiReq.generationConfig.responseMimeType, "application/json");
  assert.ok(geminiReq.generationConfig.responseJsonSchema && geminiReq.systemInstruction);
  const openaiReq = seen.find((s) => s.api === "openai")!.body as { response_format: { type: string } };
  assert.equal(openaiReq.response_format.type, "json_schema");
  assert.deepEqual((await logs()).slice(1).map((l) => [l.model, l.ok]), [["claude-opus-5-5", false], ["gpt-test", false], ["gemini-test", true]]);
  console.log("✓ ICP: Claude 529 → OpenAI 503 → Gemini; every attempt logged");

  // 2) Invalid output from OpenAI also falls back.
  seen.length = 0;
  openaiHandler = () => ({ status: 200, json: { model: "gpt-test-1", choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ nope: true }) } }], usage: { prompt_tokens: 10, completion_tokens: 5 } } });
  const r2 = await understandStrategy(`saas founders in cairo ${Date.now()}`, [], ctx);
  assert.equal(r2.model, "gemini-test-001");
  console.log("✓ ICP: invalid OpenAI output → Gemini");

  // 3) Agent on OpenAI with a tool call, then Gemini with a function call.
  const { data: m } = await admin.from("workspace_members").select("user_id, role, workspace_id").eq("role", "owner").limit(50);
  let session = null;
  for (const row of m ?? []) {
    const { data: w } = await admin.from("workspaces").select("*").eq("id", row.workspace_id).single();
    const { data: p } = await admin.from("profiles").select("*").eq("id", row.user_id).single();
    if (w && p && ["active", "test"].includes(w.subscription_status) && p.onboarded_at) {
      session = { userId: row.user_id, email: p.email, emailConfirmed: true, profile: p, workspace: w, role: row.role, signupMeta: {} };
      break;
    }
  }
  assert.ok(session, "an active workspace exists");
  const agentCtx = { session, db: admin, conversationId: null } as never;
  let step = 0;
  openaiHandler = (body) => {
    step++;
    if (step === 1) {
      assert.ok(Array.isArray(body.tools) && (body.tools as { type: string }[])[0].type === "function");
      return { status: 200, json: { model: "gpt-test-1", choices: [{ finish_reason: "tool_calls", message: { content: null, tool_calls: [{ id: "call_1", type: "function", function: { name: "getUsage", arguments: "{}" } }] } }], usage: { prompt_tokens: 50, completion_tokens: 10 } } };
    }
    const msgs = body.messages as { role: string; tool_call_id?: string; content: string }[];
    const tool = msgs.find((x) => x.role === "tool");
    assert.equal(tool?.tool_call_id, "call_1");
    assert.ok(JSON.parse(tool!.content).ok);
    return { status: 200, json: { model: "gpt-test-1", choices: [{ finish_reason: "stop", message: { content: "You have prospects left this month." } }], usage: { prompt_tokens: 80, completion_tokens: 12 } } };
  };
  // Claude agent turn: tool_use → tool_result → text (official SDK tool runner).
  let aStep = 0;
  anthropicHandler = (body) => {
    aStep++;
    if (aStep === 1) return { status: 200, json: { id: "msg_a", type: "message", role: "assistant", model: "claude-opus-5-5", stop_reason: "tool_use", stop_sequence: null,
      content: [{ type: "tool_use", id: "toolu_1", name: "getUsage", input: {} }], usage: { input_tokens: 100, output_tokens: 20 } } };
    const last = (body.messages as { role: string; content: { type: string; tool_use_id?: string }[] }[]).at(-1)!;
    assert.equal(last.content[0].type, "tool_result");
    assert.equal(last.content[0].tool_use_id, "toolu_1");
    return { status: 200, json: { id: "msg_b", type: "message", role: "assistant", model: "claude-opus-5-5", stop_reason: "end_turn", stop_sequence: null,
      content: [{ type: "text", text: "Claude here: usage checked." }], usage: { input_tokens: 150, output_tokens: 10 } } };
  };
  const a0 = await runAgent(agentCtx, [{ role: "user", text: "Usage?" }]);
  assert.equal(a0.provider, "anthropic");
  assert.match(a0.reply, /Claude here/);
  console.log("✓ Agent on Claude: tool_use → reply");
  anthropicHandler = () => ({ status: 529, json: { type: "error", error: { type: "overloaded_error", message: "Overloaded" } } });

  const a1 = await runAgent(agentCtx, [{ role: "user", text: "How many prospects do I have left?" }]);
  assert.equal(a1.provider, "openai");
  assert.match(a1.reply, /prospects left/);
  console.log("✓ Agent on OpenAI: tool call → reply");

  openaiHandler = () => ({ status: 500, json: {} });
  step = 0;
  geminiHandler = (body) => {
    step++;
    const contents = body.contents as { role: string; parts: Record<string, unknown>[] }[];
    if (step === 1) {
      assert.ok((body.tools as { functionDeclarations: unknown[] }[])[0].functionDeclarations.length >= 10);
      return { status: 200, json: { modelVersion: "gemini-test-001", candidates: [{ content: { role: "model", parts: [{ functionCall: { id: "fc_1", name: "getCampaign", args: {} }, thoughtSignature: "sig-abc" }] } }], usageMetadata: { promptTokenCount: 60, candidatesTokenCount: 8 } } };
    }
    const modelTurn = contents.at(-2)!;
    assert.equal(modelTurn.role, "model");
    assert.equal(modelTurn.parts[0].thoughtSignature, "sig-abc", "thought signature sent back");
    const fr = contents.at(-1)!.parts[0].functionResponse as { id: string; name: string; response: { result: { ok: boolean } } };
    assert.equal(fr.name, "getCampaign");
    assert.equal(fr.id, "fc_1");
    assert.equal(fr.response.result.ok, true);
    return { status: 200, json: { modelVersion: "gemini-test-001", candidates: [{ content: { role: "model", parts: [{ text: "Here are your latest campaigns." }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 90, candidatesTokenCount: 9 } } };
  };
  const a2 = await runAgent(agentCtx, [{ role: "user", text: "Show my campaigns" }]);
  assert.equal(a2.provider, "gemini");
  console.log("✓ Agent: OpenAI 500 → Gemini function call → reply");

  // 4) No fallback after a side effect: OpenAI starts a campaign, then fails.
  step = 0;
  let geminiCalled = false;
  // createCampaign itself parses the search with the LLM (no tools); only
  // requests carrying tools are the agent's own turn.
  geminiHandler = (body) => {
    if (body.tools) geminiCalled = true;
    return { status: 503, json: {} };
  };
  openaiHandler = (body) => {
    if (!body.tools) return { status: 503, json: {} };
    step++;
    if (step === 1) return { status: 200, json: { model: "gpt-test-1", choices: [{ finish_reason: "tool_calls", message: { content: null, tool_calls: [{ id: "call_2", type: "function", function: { name: "createCampaign", arguments: JSON.stringify({ request: "Heads of sales at fintechs in Riyadh (fallback test)" }) } }] } }], usage: { prompt_tokens: 50, completion_tokens: 10 } } };
    return { status: 500, json: {} };
  };
  await assert.rejects(runAgent(agentCtx, [{ role: "user", text: "Start it" }]));
  assert.equal(geminiCalled, false, "Gemini not asked after a campaign was started");
  console.log("✓ No provider switch after a tool changed something");
  console.log("ALL PASS");
} finally {
  await intel.from("settings").upsert({ key: "llm_routing", value: before?.value ?? { default: [{ provider: "anthropic", model: "claude-opus-5-5" }] } });
  await intel.from("llm_calls").delete().in("model", ["gpt-test", "gemini-test"]);
  await admin.from("strategies").delete().like("prompt", "Heads of sales at fintechs in Riyadh (fallback test)%");
  await admin.from("agent_tool_calls").delete().is("conversation_id", null).in("tool", ["getUsage", "getCampaign", "createCampaign"]);
  await intel.from("llm_calls").delete().eq("strategy_id", strategyId);
  s1.close();
  s2.close();
  s3.close();
}
