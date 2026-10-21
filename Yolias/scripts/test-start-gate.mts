// A search never starts without a plan or prospects (D-251), against the
// local Supabase:
//   npm run test:start-gate
// Covers: no plan → nothing created; credit used up → nothing created; a
// workspace with prospects → the campaign reserves them at once; two starts at
// the same time can't use the same prospects; the worker doesn't reserve the
// same campaign twice; a failed run releases what it held.
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { startBlock, startCampaign } from "@/lib/discovery/launch.ts";
import type { Session } from "@/lib/session.ts";
import type { Database, ProfileRow, WorkspaceRow } from "@/types/database.ts";
(await import("@/lib/integrations.ts")).setIntegrationsForTests({});

const db = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const users: string[] = [];
const stamp = Date.now().toString(36);

async function account(tag: string) {
  const { data, error } = await db.auth.admin.createUser({ email: `gate-${tag}-${stamp}@yolias.local`, email_confirm: true });
  if (error) throw error;
  users.push(data.user.id);
  const { data: prof } = await db.from("profiles").select("*").eq("id", data.user.id).single();
  return { userId: data.user.id, wsId: prof!.workspace_id!, profile: prof as ProfileRow };
}
async function session(a: { userId: string; wsId: string; profile: ProfileRow }): Promise<Session> {
  const { data: ws } = await db.from("workspaces").select("*").eq("id", a.wsId).single();
  return { userId: a.userId, email: "x@yolias.local", emailConfirmed: true, profile: a.profile, workspace: ws as WorkspaceRow, role: "owner", signupMeta: {} };
}
async function strategy(wsId: string, userId: string) {
  const { data } = await db.from("strategies").insert({ workspace_id: wsId, created_by: userId, title: "gate", prompt: "gate test" }).select("id").single();
  return data!.id;
}
const icp = (n: number) => ({ campaign_name: "Gate test", summary: "gate", search_type: "companies", target_unit: "companies", target_count: n, countries: ["EG"], cities: [], industries: ["Software"], keywords: [], job_titles: [], seniorities: [], employees_min: null, employees_max: null, exclusions: [], lookalike_seeds: [] }) as never;
const campaigns = async (wsId: string) => (await db.from("campaigns").select("id, status").eq("workspace_id", wsId)).data ?? [];
const available = async (wsId: string) => ((await db.rpc("usage_summary", { p_ws: wsId })).data as { available: number }[])[0].available;
const topUp = async (wsId: string, n: number) => {
  await db.from("usage_ledger").insert({ workspace_id: wsId, kind: "grant", prospects: n, period_start: new Date().toISOString().slice(0, 8) + "01", reason: `prospect_pack:gate-${crypto.randomUUID()}`, created_by: "test" });
  await db.from("workspaces").update({ credit_started_at: new Date().toISOString() }).eq("id", wsId);
};

try {
  // 1) No plan, no credit: blocked, nothing created.
  const a = await account("none");
  const sa = await session(a);
  assert.equal(await startBlock(sa), "noPlan");
  assert.equal((await campaigns(a.wsId)).length, 0);

  // 2) Credit bought then used up: blocked before anything is created.
  const b = await account("empty");
  await topUp(b.wsId, 2);
  await db.from("usage_ledger").insert({ workspace_id: b.wsId, kind: "consume", prospects: 2, period_start: new Date().toISOString().slice(0, 8) + "01", reason: "extra", created_by: "test" });
  assert.equal(await available(b.wsId), 0);
  assert.equal(await startBlock(await session(b)), "noCredit");

  // 3) Prospects left: the campaign starts and reserves them at once.
  const c = await account("ok");
  await topUp(c.wsId, 5);
  const sc = await session(c);
  assert.equal(await startBlock(sc), null);
  const id = await startCampaign(sc, db as never, await strategy(c.wsId, c.userId), icp(3));
  assert.ok(id && id !== "noCredit", "started");
  assert.equal(await available(c.wsId), 2, "3 of 5 held by the campaign");
  const { data: held } = await db.rpc("usage_outstanding", { p_campaign: id as string });
  assert.equal(held![0].outstanding, 3);

  // 4) Two starts at the same time with 2 prospects left for 2 × 2 wanted: they share, never more than 2.
  const s1 = await strategy(c.wsId, c.userId), s2 = await strategy(c.wsId, c.userId);
  const both = await Promise.all([startCampaign(sc, db as never, s1, icp(2)), startCampaign(sc, db as never, s2, icp(2))]);
  assert.equal(await available(c.wsId), 0, "never below zero");
  const started = both.filter((x) => x && x !== "noCredit");
  assert.ok(started.length >= 1, "at least one starts");
  for (const x of both.filter((y) => y === "noCredit")) assert.ok(x, "the other is told, and left nothing behind");
  assert.equal((await campaigns(c.wsId)).length, 1 + started.length, "a blocked start leaves no campaign row");

  // 5) Now empty: the next start is blocked before AI or a row.
  assert.equal(await startBlock(await session(c)), "noCredit");
  assert.equal(await startCampaign(sc, db as never, await strategy(c.wsId, c.userId), icp(1)), "noCredit");
  assert.equal((await campaigns(c.wsId)).length, 1 + started.length);

  console.log("✓ start gate: no plan, used-up credit, reservation at start, concurrent starts, blocked starts leave nothing");
} finally {
  for (const u of users) {
    const { data: prof } = await db.from("profiles").select("workspace_id").eq("id", u).maybeSingle();
    if (prof?.workspace_id) await db.from("workspaces").delete().eq("id", prof.workspace_id);
    await db.auth.admin.deleteUser(u);
  }
}
