// Integration test (owner, 2026-11-10): when a plan ends with no credit,
// running campaigns pause, nothing resumes, nothing is deleted; renewing
// lets the member resume them.
//   npm run test:plan-lapse
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import type { Database, WorkspaceRow } from "@/types/database.ts";
import { settleSubscription, startPlan } from "@/lib/billing.ts";
import { setCampaignRun } from "@/lib/outreach/execute.ts";

const db = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const email = `plan-lapse-${Date.now()}@yolias.local`;
const { data: created, error } = await db.auth.admin.createUser({ email, email_confirm: true });
if (error) throw error;
const userId = created.user!.id;
const wsId = (await db.from("profiles").select("workspace_id").eq("id", userId).single()).data!.workspace_id!;
const ws = async () => (await db.from("workspaces").select("*").eq("id", wsId).single()).data as WorkspaceRow;
try {
  const ended = new Date(Date.now() - 3_600_000).toISOString();
  await db.from("workspaces").update({ plan: "growth", subscription_status: "active", billing_period: "monthly", current_period_end: ended, cancel_at_period_end: true, billing_currency: "USD" }).eq("id", wsId);
  const { data: camp } = await db.from("outreach_campaigns").insert({ workspace_id: wsId, name: "Lapse test", status: "active", approved_at: new Date().toISOString() }).select("id").single();
  const { data: lead } = await db.from("sales_leads").insert({ workspace_id: wsId, lead_key: "email:lapse@client.test", name: "Omar", email: "lapse@client.test", source: "manual" }).select("id").single();

  const after = await settleSubscription(await ws());
  assert.equal(after.subscription_status, "canceled", "the plan ended");
  const c1 = (await db.from("outreach_campaigns").select("status, failure_reason").eq("id", camp!.id).single()).data!;
  assert.deepEqual([c1.status, c1.failure_reason], ["paused", "plan_ended"], "running campaigns pause, with the reason");
  assert.equal(await setCampaignRun(wsId, camp!.id, "resume"), false, "nothing resumes while the plan is over");
  assert.ok((await db.from("sales_leads").select("id").eq("id", lead!.id).maybeSingle()).data, "records are kept");

  const renewed = await startPlan(await ws(), "growth", "monthly", { userId, email, name: null }, { mode: "test", amount: 100, currency: "USD" });
  assert.notEqual(renewed, false, "renewed");
  assert.equal(await setCampaignRun(wsId, camp!.id, "resume"), true, "after renewing, the campaign resumes");
  const c2 = (await db.from("outreach_campaigns").select("status, failure_reason").eq("id", camp!.id).single()).data!;
  assert.deepEqual([c2.status, c2.failure_reason], ["active", null]);

  // With Pay As You Go credit bought before, the plan ending isn't a lapse: campaigns keep running on the credit.
  await db.from("workspaces").update({ subscription_status: "active", current_period_end: ended, cancel_at_period_end: true, credit_started_at: new Date().toISOString() }).eq("id", wsId);
  await settleSubscription(await ws());
  assert.equal((await db.from("outreach_campaigns").select("status").eq("id", camp!.id).single()).data!.status, "active", "credit keeps the campaign running");
  console.log("✓ plan lapse: campaigns pause with the reason, nothing resumes or is deleted, renewal restores; credit keeps running");
} finally {
  await db.auth.admin.deleteUser(userId);
  await db.from("workspaces").delete().eq("id", wsId);
}
