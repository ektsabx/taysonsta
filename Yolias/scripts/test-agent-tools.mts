// Integration test for the Yolias AI agent tools (docs/07), no LLM needed:
// authorization in code, workspace scoping, RLS, "not connected" honesty and
// the audit log. Runs against the local Supabase:
//   npm run test:agent
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { executeTool, type AgentContext } from "@/lib/agent/tools.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, svc = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(url, svc, { auth: { persistSession: false } });
// Two workspaces with an active plan (create them by signing up locally if missing).
const { data: active } = await admin.from("workspaces").select("id").in("subscription_status", ["active", "test"]).limit(2);
if (!active || active.length < 2) throw new Error("Need two workspaces with an active plan in the local database.");
const [A, B] = active.map((w) => w.id);

async function sessionFor(ws: string) {
  const { data: m } = await admin.from("workspace_members").select("user_id, role").eq("workspace_id", ws).single();
  const { data: profile } = await admin.from("profiles").select("*").eq("id", m!.user_id).single();
  const { data: workspace } = await admin.from("workspaces").select("*").eq("id", ws).single();
  const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: profile!.email });
  const db = createClient(url, anon, { auth: { persistSession: false } });
  const { error } = await db.auth.verifyOtp({ type: "magiclink", token_hash: link!.properties!.hashed_token });
  if (error) throw error;
  return { session: { userId: m!.user_id, email: profile!.email, emailConfirmed: true, profile, workspace, role: m!.role, signupMeta: {} }, db, conversationId: null } as unknown as AgentContext;
}

async function seed(ws: string, name: string) {
  const { data: c } = await admin.from("campaigns").insert({ workspace_id: ws, name: `IT ${name}`, criteria: {}, quota: 5, status: "partial", partial_reason: "no provider" }).select("id").single();
  const { data: co } = await admin.from("companies").insert({ workspace_id: ws, campaign_id: c!.id, name: `${name} Co`, source: "test" }).select("id").single();
  const { data: p } = await admin.from("prospects").insert({ workspace_id: ws, campaign_id: c!.id, company_id: co!.id, full_name: `${name} Person`, title: "Head of Sales", country: "SA", match_score: 80, source: "test" }).select("id").single();
  return { campaign: c!.id, company: co!.id, prospect: p!.id };
}

const a = await seed(A, "Alpha"), b = await seed(B, "Beta");
const ctxA = await sessionFor(A);
try {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let r: any = await executeTool(ctxA, "searchProspects", { query: "Person" });
  assert.equal(r.ok, true); assert.deepEqual(r.data.prospects.map((x: { id: string }) => x.id), [a.prospect]);
  r = await executeTool(ctxA, "getProspect", { prospectId: b.prospect }); assert.equal(r.outcome, "not_found");
  r = await executeTool(ctxA, "getProspect", { prospectId: a.prospect }); assert.equal(r.ok, true);
  r = await executeTool(ctxA, "getCampaign", { campaignId: b.campaign }); assert.equal(r.outcome, "not_found");
  r = await executeTool(ctxA, "getCampaign", { campaignId: a.campaign }); assert.equal(r.data.campaign.partial_reason, "no provider");
  r = await executeTool(ctxA, "filterProspects", { country: "sa", minMatch: 50 }); assert.equal(r.data.total, 1);
  r = await executeTool(ctxA, "getUsage", {}); assert.equal(r.ok, true); assert.equal(typeof r.data.available, "number");
  r = await executeTool(ctxA, "getAnalytics", { days: 30 }); assert.equal(r.ok, true); assert.equal(r.data.prospects, 1);
  r = await executeTool(ctxA, "enrichProspect", { prospectId: a.prospect, want: "email" }); assert.equal(r.outcome, "not_connected");
  r = await executeTool(ctxA, "enrichProspect", { prospectId: b.prospect, want: "email" }); assert.equal(r.outcome, "not_found");
  r = await executeTool(ctxA, "researchCompany", { companyId: a.company }); assert.equal(r.outcome, "not_connected");
  r = await executeTool(ctxA, "getProspect", { prospectId: "nope" }); assert.equal(r.outcome, "invalid");
  r = await executeTool(ctxA, "dropTables", {}); assert.equal(r.outcome, "invalid");
  // A workspace without an active plan is denied before anything runs.
  const inactive = { ...ctxA, session: { ...ctxA.session, workspace: { ...ctxA.session.workspace, subscription_status: "none" } } } as never;
  r = await executeTool(inactive, "getUsage", {}); assert.equal(r.outcome, "denied");
  // RLS is the second line: even a raw query with A's client can't read B.
  const { data: leak } = await ctxA.db.from("prospects").select("id").eq("id", b.prospect); assert.equal(leak!.length, 0);
  // createCampaign without an Anthropic key: the search is saved and marked failed honestly.
  r = await executeTool(ctxA, "createCampaign", { request: "Heads of sales at fintechs in Riyadh" }); assert.equal(r.ok, true);
  console.log("createCampaign →", JSON.stringify(r.data));
  const { data: log } = await admin.from("agent_tool_calls").select("tool, outcome").eq("workspace_id", A).order("id");
  console.log("audit:", log!.map((l) => `${l.tool}:${l.outcome}`).join(" "));
  assert.equal(log!.length, 15);
  console.log("ALL PASS");
} finally {
  await admin.from("agent_tool_calls").delete().eq("workspace_id", A);
  await admin.from("strategies").delete().eq("workspace_id", A).ilike("prompt", "Heads of sales%");
  for (const s of [a, b]) await admin.from("campaigns").delete().eq("id", s.campaign);
}
