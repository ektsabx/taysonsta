// Meeting reminders and deal fields (owner, 2026-10-29), against the local Supabase:
//   npm run test:meetings
// Covers: a meeting in the next hour gets one reminder; a meeting that ended
// gets one "what happened?" plus a task; reruns add nothing; the new stages
// are accepted and closed_at / lost_reason follow the stage.

import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.ts";

const { followUpSweep } = await import("@/lib/outreach/sequence.ts");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
assert.match(url, /127\.0\.0\.1|localhost/, "local database only");
const db = createClient<Database>(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
let userId = "", ws = "";
try {
  const { data: u, error } = await db.auth.admin.createUser({ email: `meet-${Date.now()}@yolias.local`, email_confirm: true });
  if (error) throw error;
  userId = u.user.id;
  ws = (await db.from("profiles").select("workspace_id").eq("id", userId).single()).data!.workspace_id!;
  const { data: lead } = await db.from("sales_leads").insert({ workspace_id: ws, lead_key: `t:${Date.now()}`, name: "Sara Lead", stage: "interested", created_by: userId }).select("id").single();
  const soon = await db.from("sales_meetings").insert({ workspace_id: ws, lead_id: lead!.id, title: "Intro", starts_at: new Date(Date.now() + 30 * 60_000).toISOString(), created_by: userId }).select("id").single();
  const past = await db.from("sales_meetings").insert({ workspace_id: ws, lead_id: lead!.id, title: "Demo", starts_at: new Date(Date.now() - 3 * 3_600_000).toISOString(), created_by: userId }).select("id").single();

  await followUpSweep(200);
  await followUpSweep(200);
  const notes = (await db.from("notifications").select("kind, dedupe_key").eq("user_id", userId).eq("kind", "meeting")).data ?? [];
  assert.equal(notes.filter((n) => n.dedupe_key?.startsWith("meeting-soon:")).length, 1, "one reminder before");
  assert.equal(notes.filter((n) => n.dedupe_key?.startsWith("meeting-outcome:")).length, 1, "one 'what happened?' after");
  const m1 = (await db.from("sales_meetings").select("reminded_at").eq("id", soon.data!.id).single()).data!;
  const m2 = (await db.from("sales_meetings").select("outcome_asked_at").eq("id", past.data!.id).single()).data!;
  assert.ok(m1.reminded_at && m2.outcome_asked_at, "flags set");
  const { count: tasks } = await db.from("lead_tasks").select("id", { count: "exact", head: true }).eq("lead_id", lead!.id).eq("dedupe_key", `meeting-outcome:${past.data!.id}`);
  assert.equal(tasks, 1, "one outcome task");
  console.log("✓ meeting reminders");

  for (const stage of ["proposal", "negotiation"] as const) assert.ok(!(await db.from("sales_leads").update({ stage }).eq("id", lead!.id)).error, `${stage} accepted`);
  await db.from("sales_leads").update({ stage: "lost", lost_reason: "price" }).eq("id", lead!.id);
  let l = (await db.from("sales_leads").select("closed_at, lost_reason").eq("id", lead!.id).single()).data!;
  assert.ok(l.closed_at, "closed_at set when lost");
  await db.from("sales_leads").update({ stage: "negotiation" }).eq("id", lead!.id);
  l = (await db.from("sales_leads").select("closed_at, lost_reason").eq("id", lead!.id).single()).data!;
  assert.equal(l.closed_at, null); assert.equal(l.lost_reason, null);
  console.log("✓ stages, closed_at and lost reason");
  console.log("\nAll meeting and deal checks passed.");
} finally {
  if (ws) await db.from("workspaces").delete().eq("id", ws);
  if (userId) await db.auth.admin.deleteUser(userId).catch(() => {});
}
