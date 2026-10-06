// Test of Yolias AI (final spec phase 7) against the local Supabase, with
// local stand-ins for Gemini / Claude and a web provider registered only in
// this process — nothing leaves the machine:
//   npm run test:ai
// Covers: conversation privacy (private vs workspace, RLS), feedback only on
// replies, the new tools (reveal recorded, campaign control, billing for
// owners/admins only, companies), and research through the orchestrator
// (Gemini → summary, small model → facts) with cost per tool call and LLM
// calls attributed to the conversation.
import assert from "node:assert/strict";
import http from "node:http";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.ts";

const PORTS = { gemini: 4942, anthropic: 4943 };
process.env.GEMINI_API_URL = `http://127.0.0.1:${PORTS.gemini}/v1beta`;
process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${PORTS.anthropic}`;

const llmSeen: string[] = [];
const serve = (api: "gemini" | "anthropic", port: number) => http.createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const body = JSON.parse(raw || "{}");
    llmSeen.push(api);
    res.setHeader("content-type", "application/json");
    if (api === "gemini") {
      res.end(JSON.stringify({ modelVersion: "gemini-test", candidates: [{ content: { role: "model", parts: [{ text: "- Nakhla Pay runs payments for Saudi merchants.\n- Hiring sales staff.\nSources: https://web.example/nakhla" }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 500, candidatesTokenCount: 60 } }));
    } else {
      assert.ok(body.output_config, "extraction uses structured output");
      res.end(JSON.stringify({ id: "msg", type: "message", role: "assistant", model: "claude-haiku-4-5-20251001", stop_reason: "end_turn", stop_sequence: null,
        content: [{ type: "text", text: JSON.stringify({ industry: "Payments", employee_range: null, headquarters_city: "Riyadh", country: "SA", sells_to: "merchants", hiring: true }) }],
        usage: { input_tokens: 300, output_tokens: 40, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } }));
    }
  });
}).listen(port);
const servers = [serve("gemini", PORTS.gemini), serve("anthropic", PORTS.anthropic)];

// Keys normally come from Yolias Admin → Integrations (D-132); the test injects its own.
(await import("@/lib/integrations.ts")).setIntegrationsForTests({ gemini: { api_key: "test-gemini" }, anthropic: { api_key: "test-anthropic" } });
const { adapters } = await import("@/lib/intel/adapters/index.ts");
const { syncRegistry } = await import("@/lib/intel/registry.ts");
const { executeTool } = await import("@/lib/agent/tools.ts");
type Ctx = Parameters<typeof executeTool>[0];

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, svc = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient<Database>(url, svc, { auth: { persistSession: false } });
const intel = createClient(url, svc, { auth: { persistSession: false }, db: { schema: "intel" } });
const ID = "yolias_test_web";
const tag = Date.now().toString(36);

adapters.push({
  id: ID, name: "Test web stub (test process only)", needsCredential: false,
  handlers: {
    "web.search": async () => ({ data: [{ url: "https://web.example/nakhla", title: "Nakhla Pay", snippet: "Payments for merchants" }, { url: "https://web.example/news", title: "News", snippet: null }], units: 1 }),
    "web.extract": async ({ url: u }) => ({ data: { url: u, title: "Page", text: "Nakhla Pay is a Riyadh payments company hiring sales staff." }, units: 1 }),
  },
});

const users: string[] = [];
let wsId: string | null = null;
async function user(email: string) {
  const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (error) throw error;
  users.push(data.user.id);
  return data.user.id;
}
async function clientFor(email: string): Promise<SupabaseClient<Database>> {
  const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const db = createClient<Database>(url, anon, { auth: { persistSession: false } });
  const { error } = await db.auth.verifyOtp({ type: "magiclink", token_hash: link!.properties!.hashed_token });
  if (error) throw error;
  return db;
}
async function ctxFor(userId: string, db: SupabaseClient<Database>, conversationId: string | null): Promise<Ctx> {
  const { data: profile } = await admin.from("profiles").select("*").eq("id", userId).single();
  const { data: workspace } = await admin.from("workspaces").select("*").eq("id", wsId!).single();
  const { data: m } = await admin.from("workspace_members").select("role").eq("workspace_id", wsId!).eq("user_id", userId).single();
  return { session: { userId, email: profile!.email, emailConfirmed: true, profile, workspace, role: m!.role, signupMeta: {} }, db, conversationId } as unknown as Ctx;
}

try {
  await syncRegistry();
  await intel.from("providers").update({ enabled: true, storage_allowed: true, pricing: { "web.search": { unit: "request", unit_cost_usd: 0.01 }, "web.extract": { unit: "page", unit_cost_usd: 0.002 } } }).eq("id", ID);

  // Workspace with an owner (A) and a member (B).
  const emailA = `ai-a-${tag}@yolias.local`, emailB = `ai-b-${tag}@yolias.local`;
  const a = await user(emailA);
  wsId = (await admin.from("profiles").select("workspace_id").eq("id", a).single()).data!.workspace_id!;
  const b = await user(emailB);
  const ownWs = (await admin.from("profiles").select("workspace_id").eq("id", b).single()).data!.workspace_id!;
  await admin.from("workspace_members").insert({ workspace_id: wsId, user_id: b, role: "member" });
  await admin.from("profiles").update({ workspace_id: wsId, onboarded_at: new Date().toISOString() }).eq("id", b);
  await admin.from("profiles").update({ onboarded_at: new Date().toISOString() }).eq("id", a);
  await admin.from("workspaces").delete().eq("id", ownWs);
  await admin.from("workspaces").update({ name: "AI Test", plan: "pro", subscription_status: "test" }).eq("id", wsId);
  const dbA = await clientFor(emailA), dbB = await clientFor(emailB);

  // 1) Conversation privacy.
  const { data: priv } = await dbA.from("conversations").insert({ workspace_id: wsId, user_id: a, scope: "user", title: "A private" }).select("id").single();
  const { data: shared } = await dbA.from("conversations").insert({ workspace_id: wsId, user_id: a, scope: "workspace", title: "Team" }).select("id").single();
  assert.ok(priv && shared);
  const { data: seenByB } = await dbB.from("conversations").select("id").eq("workspace_id", wsId);
  assert.deepEqual(seenByB!.map((c) => c.id), [shared!.id], "B sees the shared chat only");
  const intrude = await dbB.from("agent_messages").insert({ workspace_id: wsId, conversation_id: priv!.id, user_id: b, role: "user", content: "hi" });
  assert.ok(intrude.error, "B can't write into A's private chat");
  const { error: okB } = await dbB.from("agent_messages").insert({ workspace_id: wsId, conversation_id: shared!.id, user_id: b, role: "user", content: "hello team" });
  assert.equal(okB, null);
  const forged = await dbB.from("agent_messages").insert({ workspace_id: wsId, conversation_id: shared!.id, user_id: b, role: "assistant", content: "fake" });
  assert.ok(forged.error, "nobody forges an assistant reply");
  const camp = await dbA.from("conversations").insert({ workspace_id: wsId, user_id: a, scope: "campaign", title: "x" });
  assert.ok(camp.error, "campaign conversations are created by the server only");

  // 2) Feedback: on replies only, own rows only.
  const { data: reply } = await admin.from("agent_messages").insert({ workspace_id: wsId, conversation_id: shared!.id, role: "assistant", content: "Here you go." }).select("id").single();
  const { data: userTurn } = await admin.from("agent_messages").select("id").eq("conversation_id", shared!.id).eq("role", "user").limit(1).single();
  assert.equal((await dbB.from("agent_feedback").upsert({ message_id: reply!.id, user_id: b, rating: 1 })).error, null);
  assert.ok((await dbB.from("agent_feedback").insert({ message_id: userTurn!.id, user_id: b, rating: -1 })).error, "no rating of user turns");
  assert.ok((await dbB.from("agent_feedback").insert({ message_id: reply!.id, user_id: a, rating: -1 })).error, "no rating for someone else");

  // Results to work with.
  const { data: c } = await admin.from("campaigns").insert({ workspace_id: wsId, name: "AI test campaign", criteria: {}, search_type: "companies", quota: 10, status: "scheduled", continuous: true, next_run_at: new Date(Date.now() + 3_600_000).toISOString() }).select("id").single();
  const { data: co } = await admin.from("companies").insert({ workspace_id: wsId, campaign_id: c!.id, name: `Nakhla Pay ${tag}`, domain: `nakhla-${tag}.example`, city: "Riyadh", country: "SA", source: "test", delivered_at: new Date().toISOString(), saved_at: new Date().toISOString(), match_score: 80 }).select("id").single();
  const { data: p } = await admin.from("prospects").insert({ workspace_id: wsId, campaign_id: c!.id, company_id: co!.id, full_name: "Sara Test", title: "CEO", email: "sara@nakhla.example", email_status: "verified", phone: "+966500000000", source: "test", saved_at: new Date().toISOString() }).select("id").single();

  // 3) Tools.
  const ctxB = await ctxFor(b, dbB, shared!.id);
  const ctxA = await ctxFor(a, dbA, priv!.id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let r: any = await executeTool(ctxB, "getBilling", {});
  assert.equal(r.outcome, "denied", "billing is for owners and admins");
  r = await executeTool(ctxA, "getBilling", {});
  assert.equal(r.ok, true); assert.equal(r.data.plan, "pro");

  r = await executeTool(ctxB, "getProspect", { prospectId: p!.id });
  assert.equal(r.ok, true); assert.equal(r.data.email, undefined, "no contact details without a reveal");
  r = await executeTool(ctxB, "revealContact", { prospectId: p!.id });
  assert.equal(r.data.email, "sara@nakhla.example");
  const { data: revealed } = await admin.from("prospects").select("revealed_at, revealed_by").eq("id", p!.id).single();
  assert.ok(revealed!.revealed_at); assert.equal(revealed!.revealed_by, b);

  r = await executeTool(ctxB, "listCompanies", { query: "Nakhla" });
  assert.equal(r.data.total, 1);
  r = await executeTool(ctxB, "getCompany", { companyId: co!.id });
  assert.equal(r.data.decisionMakers.length, 1);

  r = await executeTool(ctxB, "updateCampaign", { campaignId: c!.id, action: "pause" });
  assert.equal(r.data.campaign.status, "paused");
  r = await executeTool(ctxB, "updateCampaign", { campaignId: c!.id, action: "settings", goal: 25, everyHours: 168 });
  assert.equal(r.data.campaign.quota, 25); assert.equal(r.data.campaign.run_every_hours, 168);
  r = await executeTool(ctxB, "updateCampaign", { campaignId: c!.id, action: "pause" });
  assert.equal(r.outcome, "invalid", "can't pause twice");

  // 4) Research: web provider → Gemini summary → small model facts; cost per tool call.
  r = await executeTool(ctxB, "researchCompany", { companyId: co!.id });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.match(r.data.summary, /payments/i);
  assert.equal(r.data.facts.headquarters_city, "Riyadh");
  assert.equal(r.data.sources.length, 2);
  assert.deepEqual(llmSeen, ["gemini", "anthropic"], "research on Gemini, extraction on the small Claude model");
  const { data: call } = await admin.from("agent_tool_calls").select("cost_usd, unpriced_calls").eq("workspace_id", wsId).eq("tool", "researchCompany").single();
  // 1 search ($0.01) + 2 extracts ($0.002 each) + the small Claude model at its configured price
  // (300 in / 40 out tokens = $0.0005); the Gemini route has no price here → counted as unpriced (D-114).
  assert.equal(Number(call!.cost_usd), 0.0145);
  assert.equal(call!.unpriced_calls, 1);
  const { count: llmCalls } = await intel.from("llm_calls").select("id", { count: "exact", head: true }).eq("conversation_id", shared!.id);
  assert.equal(llmCalls, 2, "LLM calls are attributed to the conversation");

  console.log("✓ Yolias AI: private/shared conversations, feedback, reveal, campaign control, billing permission, research orchestrator, cost per tool call");
} finally {
  if (wsId) await admin.from("workspaces").delete().eq("id", wsId);
  for (const u of users) await admin.auth.admin.deleteUser(u);
  await intel.from("provider_calls").delete().eq("provider", ID);
  await intel.from("providers").delete().eq("id", ID);
  if (wsId) await intel.from("llm_calls").delete().eq("workspace_id", wsId);
  servers.forEach((s) => s.close());
}
