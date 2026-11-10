// Integration test (audit, 2026-11-10): changing plans mid-period deducts the
// unused part of the paid period, from the paid invoice of that period.
//   npm run test:proration
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import type { Database, WorkspaceRow } from "@/types/database.ts";
import { unusedPlanCredit } from "@/lib/billing.ts";

const db = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const { data: created, error } = await db.auth.admin.createUser({ email: `proration-${Date.now()}@yolias.local`, email_confirm: true });
if (error) throw error;
const userId = created.user!.id;
const wsId = (await db.from("profiles").select("workspace_id").eq("id", userId).single()).data!.workspace_id!;
try {
  const day = 86_400_000, now = Date.now();
  const start = new Date(now - 10 * day).toISOString(), end = new Date(now + 20 * day).toISOString();
  await db.from("workspaces").update({ plan: "growth", subscription_status: "active", billing_period: "monthly", current_period_end: end, billing_currency: "USD" }).eq("id", wsId);
  const ws = async () => (await db.from("workspaces").select("*").eq("id", wsId).single()).data as WorkspaceRow;
  assert.equal(await unusedPlanCredit(await ws(), now), 0, "no paid invoice for the period: nothing deducted");
  await db.from("invoices").insert({ workspace_id: wsId, amount: 100, status: "paid", mode: "test", period_start: start, period_end: end, bill_to_email: "x@yolias.local", currency: "USD", kind: "subscription", plan: "growth", billing_period: "monthly" });
  assert.equal(await unusedPlanCredit(await ws(), now), 66.66, "20 of 30 days left of $100");
  await db.from("workspaces").update({ subscription_status: "trialing" }).eq("id", wsId);
  assert.equal(await unusedPlanCredit(await ws(), now), 0, "a trial has nothing paid to deduct");
  await db.from("workspaces").update({ subscription_status: "active", current_period_end: new Date(now - day).toISOString() }).eq("id", wsId);
  assert.equal(await unusedPlanCredit(await ws(), now), 0, "an ended period has nothing left");
  console.log("✓ proration: unused time of the paid period, nothing for trials or ended periods");
} finally {
  await db.from("invoices").delete().eq("workspace_id", wsId);
  await db.auth.admin.deleteUser(userId);
  await db.from("workspaces").delete().eq("id", wsId);
}
