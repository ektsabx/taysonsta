// Autopilot (owner 2026-10-21, D-253) against the LOCAL Supabase only, with a
// local stand-in for the AI (nothing is sent, nobody is emailed):
//   npm run test:autopilot
// Covers: a finished search gets one campaign prepared (leads, steps, one
// first email written, nothing sent), an Approve card in the search's chat
// and a notification; the next sweep doesn't prepare it again; a search
// finished before autopilot shipped is left alone; a continuous search's new
// prospects join the approved, running campaign after its next run.
import assert from "node:assert/strict";
import http from "node:http";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.ts";

const PORT = 4952;
process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${PORT}`;
const reply = (body: unknown) => JSON.stringify({ id: "msg", type: "message", role: "assistant", model: "claude-test", stop_reason: "end_turn", stop_sequence: null, content: [{ type: "text", text: JSON.stringify(body) }], usage: { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } });
const prompts: string[] = [];
const server = http.createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    prompts.push(raw);
    res.setHeader("content-type", "application/json");
    res.end(reply({ subject: "Fleet tracking for your drivers", body: "Hi,\n\nWe help delivery teams cut late deliveries.\n\nWould a short call work? https://cal.example/mona\n\nMona", personalization_used: [], cta: "a short call", tone: "direct" }));
  });
}).listen(PORT);
(await import("@/lib/integrations.ts")).setIntegrationsForTests({ anthropic: { api_key: "test-anthropic" } });
const { autopilotSweep } = await import("@/lib/outreach/autopilot.ts");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
if (!/127\.0\.0\.1|localhost/.test(url)) throw new Error("Local database only.");
const db = createClient<Database>(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const users: string[] = [];
const stamp = Date.now().toString(36);

async function member() {
  const { data, error } = await db.auth.admin.createUser({ email: `autopilot-${stamp}@yolias.local`, email_confirm: true });
  if (error) throw error;
  users.push(data.user.id);
  const { data: prof } = await db.from("profiles").select("workspace_id").eq("id", data.user.id).single();
  await db.from("workspaces").update({ subscription_status: "active", plan: "growth", name: "Nile Logistics Tech", offering: "Fleet tracking software" }).eq("id", prof!.workspace_id!);
  await db.from("profiles").update({ language: "ar", full_name: "Mona Adel" }).eq("id", data.user.id);
  return { userId: data.user.id, wsId: prof!.workspace_id! };
}
async function search(ws: string, userId: string, name: string, people: number) {
  const { data: strat } = await db.from("strategies").insert({ workspace_id: ws, created_by: userId, title: name, prompt: name, status: "ready" }).select("id").single();
  const { data: c } = await db.from("campaigns").insert({ workspace_id: ws, strategy_id: strat!.id, created_by: userId, name, criteria: {}, status: "completed", search_type: "companies", prospects_found: people, completed_at: new Date().toISOString() }).select("id").single();
  for (let i = 0; i < people; i++) await person(ws, c!.id, `${name}-${i}`);
  return { strategyId: strat!.id, searchId: c!.id };
}
async function person(ws: string, campaignId: string, tag: string) {
  const slug = tag.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const { data: co } = await db.from("companies").insert({ workspace_id: ws, campaign_id: campaignId, name: `Co ${tag}`, domain: `${slug}-${stamp}.example`, source: "test", country: "SA", delivered_at: new Date().toISOString(), saved_at: new Date().toISOString() }).select("id").single();
  await db.from("prospects").insert({ workspace_id: ws, campaign_id: campaignId, company_id: co!.id, full_name: `Person ${tag}`, title: "Head of Operations", email: `${slug}-${stamp}@example.com`, email_status: "verified", source: "test", saved_at: new Date().toISOString() });
}

try {
  const A = await member();
  const s = await search(A.wsId, A.userId, "Riyadh logistics", 3);
  // Finished before autopilot shipped: left alone.
  const old = await search(A.wsId, A.userId, "Old search", 1);
  await db.from("campaigns").update({ completed_at: "2026-10-01T00:00:00Z" }).eq("id", old.searchId);

  // ── 1. A finished search gets a campaign waiting for one approval ──
  const r = await autopilotSweep();
  assert.ok(r.proposed >= 1, "proposed");
  const { data: camps } = await db.from("outreach_campaigns").select("*").eq("workspace_id", A.wsId);
  assert.equal(camps!.length, 1, "one campaign, none for the old search");
  const camp = camps![0];
  assert.equal(camp.source_campaign_id, s.searchId);
  assert.equal(camp.approved_at, null, "not started");
  assert.equal(camp.language, "ar");
  const enr = (await db.from("outreach_enrollments").select("id, lead:sales_leads(prospect_id, company_id)").eq("campaign_id", camp.id)).data ?? [];
  assert.equal(enr.length, 3, "the search's people joined");
  assert.ok(((await db.from("outreach_steps").select("id", { count: "exact", head: true }).eq("campaign_id", camp.id)).count ?? 0) >= 2, "first email + follow-ups");
  const { data: msgs } = await db.from("outreach_messages").select("status").eq("outreach_campaign_id", camp.id);
  assert.equal(msgs!.length, 1, "one first email written");
  assert.ok(!msgs!.some((m) => m.status === "sent" || m.status === "sending"), "nothing sent");
  const { data: pa } = await db.from("agent_pending_actions").select("*").eq("workspace_id", A.wsId).eq("tool", "startOutreachCampaign").single();
  assert.deepEqual(pa!.input, { id: camp.id, sendFromMailbox: true, autoReply: true }, "approving starts it with auto-replies");
  assert.ok(Date.parse(pa!.expires_at) - Date.now() > 6 * 86_400_000, "the approval waits a week");
  const { data: msg } = await db.from("agent_messages").select("content, meta").eq("strategy_id", s.strategyId).single();
  assert.deepEqual((msg!.meta as { approvals: string[] }).approvals, [pa!.id], "the Approve card is under the message");
  assert.match(msg!.content, /Fleet tracking for your drivers/, "the message shows the first email");
  assert.equal((await db.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", A.userId).like("link", `%${camp.id}%`)).count, 1, "a notification");
  console.log("✓ a finished search gets a campaign, an Approve card and a notification; nothing sent");

  // ── 2. Once only ──
  await db.from("campaigns").update({ name: "Riyadh logistics" }).eq("id", s.searchId); // touched again
  await autopilotSweep();
  assert.equal((await db.from("outreach_campaigns").select("id", { count: "exact", head: true }).eq("workspace_id", A.wsId)).count, 1, "not prepared twice");
  console.log("✓ prepared once");

  // ── 3. A continuous search: new people join the approved campaign ──
  await db.from("outreach_campaigns").update({ approved_at: new Date().toISOString(), approved_by: A.userId, status: "active" }).eq("id", camp.id);
  await autopilotSweep(); // remembers the current run
  await person(A.wsId, s.searchId, "new-run");
  await db.from("campaigns").update({ status: "scheduled", runs_count: 1, prospects_found: 4 }).eq("id", s.searchId);
  const t = await autopilotSweep();
  assert.equal(t.topped, 1, "topped up after the new run");
  assert.equal((await db.from("outreach_enrollments").select("id", { count: "exact", head: true }).eq("campaign_id", camp.id)).count, 4, "the new person joined");
  await autopilotSweep();
  assert.equal((await db.from("outreach_enrollments").select("id", { count: "exact", head: true }).eq("campaign_id", camp.id)).count, 4, "no duplicates");
  console.log("✓ a continuous search's new people join the running campaign");
  console.log("\nAll autopilot checks passed.");
} finally {
  server.close();
  for (const u of users) {
    const { data: prof } = await db.from("profiles").select("workspace_id").eq("id", u).maybeSingle();
    if (prof?.workspace_id) await db.from("workspaces").delete().eq("id", prof.workspace_id);
    await db.auth.admin.deleteUser(u);
  }
}
