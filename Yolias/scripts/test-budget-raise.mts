// Integration test (audit, 2026-11-10): raising a launched campaign's total
// budget gives the growth to its running audiences, split by their shares;
// each audience's search gets a larger quota, held from the balance.
//   npm run test:budget-raise
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.ts";
import { fundAudiences, runningAudiences } from "@/lib/campaigns/schedule.ts";

const db = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const email = `budget-raise-${Date.now()}@yolias.local`;
const { data: created, error } = await db.auth.admin.createUser({ email, email_confirm: true });
if (error) throw error;
const userId = created.user!.id;
try {
  const wsId = (await db.from("profiles").select("workspace_id").eq("id", userId).single()).data!.workspace_id!;
  await db.from("usage_ledger").insert({ workspace_id: wsId, kind: "grant", prospects: 100, period_start: new Date().toISOString().slice(0, 10), reason: "prospect_pack:test-budget-raise" });
  const { data: camp } = await db.from("outreach_campaigns").insert({ workspace_id: wsId, name: "Raise test", status: "active", budget_type: "total", budget_usd: 10, budget_prospects: 40 }).select("id").single();
  const searches = [];
  for (const name of ["Owners", "Sales leaders", "Paused"]) {
    const { data: s } = await db.from("campaigns").insert({ workspace_id: wsId, name, criteria: {}, status: "completed", search_type: "companies", quota: 20 }).select("id").single();
    searches.push(s!.id);
  }
  const { error: ge } = await db.from("audience_groups").insert([
    { workspace_id: wsId, campaign_id: camp!.id, name: "Owners", status: "active", source: "find_new", targeting: {}, search_campaign_id: searches[0], budget_share: 0.75 },
    { workspace_id: wsId, campaign_id: camp!.id, name: "Sales leaders", status: "active", source: "find_new", targeting: {}, search_campaign_id: searches[1], budget_share: 0.25 },
    { workspace_id: wsId, campaign_id: camp!.id, name: "Paused", status: "paused", source: "find_new", targeting: {}, search_campaign_id: searches[2], budget_share: null },
  ] as never);
  if (ge) throw ge;

  const running = await runningAudiences(db as never, camp!.id);
  assert.equal(running.length, 2, "only active audiences take more budget");
  const added = await fundAudiences(db as never, wsId, camp!.id, 40, running, (n) => `Total budget raised: up to ${n} more prospects for this audience.`);
  assert.equal(added, 40);
  const quota = async (id: string) => (await db.from("campaigns").select("quota, status").eq("id", id).single()).data!;
  assert.deepEqual(await quota(searches[0]), { quota: 50, status: "scheduled" }, "75% of 40 → +30, and the search runs again");
  assert.deepEqual(await quota(searches[1]), { quota: 30, status: "scheduled" }, "25% of 40 → +10");
  assert.equal((await quota(searches[2])).quota, 20, "a paused audience gets nothing");

  // Only what the balance covers: 100 granted, 40 held above, 60 left.
  const more = await fundAudiences(db as never, wsId, camp!.id, 200, running, (n) => `+${n}`);
  assert.ok(more <= 60, `held ${more}, never more than the balance`);
  console.log("✓ total budget raise: growth split across running audiences by share, held from the balance");
} finally {
  await db.from("workspace_members").delete().eq("user_id", userId);
  await db.auth.admin.deleteUser(userId);
}
