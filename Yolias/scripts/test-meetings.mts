// Meeting reminders and deal fields (owner, 2026-10-29), against the local Supabase:
//   npm run test:meetings
// Covers: a meeting in the next hour gets one reminder; a meeting that ended
// gets one "what happened?" (asked in Meetings, no task); reruns add nothing; the new stages
// are accepted and closed_at / lost_reason follow the stage. Reminders and the
// morning summary are queued as email once (owner, 2026-10-29), never with
// "Morning summary and meetings" off; won / lost deals become search context.
// Queued test emails are canceled at once: nothing is sent.

import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.ts";

const { followUpSweep } = await import("@/lib/outreach/sequence.ts");
const { dailyDigestSweep } = await import("@/lib/email/digest.ts");
const { salesOutcomes, outcomesLines } = await import("@/lib/crm/outcomes.ts");
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
  assert.equal(tasks, 0, "no outcome task: Meetings asks (D-268)");
  console.log("✓ meeting reminders");

  const mails = async (kind: string) => (await db.from("email_log").select("id").eq("user_id", userId).eq("kind", kind)).data ?? [];
  const cancelAll = () => db.from("email_log").update({ status: "canceled" }).eq("user_id", userId).neq("status", "sent");
  assert.equal((await mails("meeting_soon")).length, 1, "one reminder email");
  assert.equal((await mails("meeting_outcome")).length, 1, "one 'how did it go?' email");
  await cancelAll();
  console.log("✓ meeting emails");

  // Morning summary: an active workspace with a quiet deal and a meeting today.
  await db.from("workspaces").update({ credit_started_at: new Date().toISOString() }).eq("id", ws);
  await db.from("profiles").update({ onboarded_at: new Date().toISOString() }).eq("id", userId);
  await db.from("sales_leads").update({ last_activity_at: new Date(Date.now() - 10 * 86_400_000).toISOString() }).eq("id", lead!.id);
  const day = new Date(Date.UTC(2030, 0, 2, 8, 0));
  await dailyDigestSweep({ force: true, now: day });
  await dailyDigestSweep({ force: true, now: day });
  assert.equal((await mails("daily_digest")).length, 1, "one morning summary a day");
  await cancelAll();
  await db.from("profiles").update({ notify_sales: false }).eq("id", userId);
  await dailyDigestSweep({ force: true, now: new Date(Date.UTC(2030, 0, 3, 8, 0)) });
  assert.equal((await mails("daily_digest")).length, 1, "no summary when turned off");
  console.log("✓ morning summary");

  for (const stage of ["proposal", "negotiation"] as const) assert.ok(!(await db.from("sales_leads").update({ stage }).eq("id", lead!.id)).error, `${stage} accepted`);
  await db.from("sales_leads").update({ stage: "lost", lost_reason: "price" }).eq("id", lead!.id);
  let l = (await db.from("sales_leads").select("closed_at, lost_reason").eq("id", lead!.id).single()).data!;
  assert.ok(l.closed_at, "closed_at set when lost");
  await db.from("sales_leads").update({ stage: "negotiation" }).eq("id", lead!.id);
  l = (await db.from("sales_leads").select("closed_at, lost_reason").eq("id", lead!.id).single()).data!;
  assert.equal(l.closed_at, null); assert.equal(l.lost_reason, null);
  console.log("✓ stages, closed_at and lost reason");

  const camp = (await db.from("campaigns").insert({ workspace_id: ws, name: "s", criteria: {}, status: "completed", search_type: "companies" }).select("id").single()).data!.id;
  const { data: co } = await db.from("companies").insert({ workspace_id: ws, campaign_id: camp, name: "Won Co", kind: "company", industry: "Logistics", city: "Cairo", employee_count: 40, source: "test" }).select("id").single();
  await db.from("sales_leads").insert({ workspace_id: ws, lead_key: `w:${Date.now()}`, name: "Won Co", company_id: co!.id, stage: "closed", created_by: userId });
  await db.from("sales_leads").update({ stage: "lost", lost_reason: "price" }).eq("id", lead!.id);
  const o = await salesOutcomes(ws);
  assert.equal(o.won, 1); assert.equal(o.lost, 1);
  assert.equal(o.wonIndustries[0]?.name, "Logistics");
  assert.equal(o.lostReasons[0]?.reason, "price");
  assert.match(outcomesLines(o), /Industries of won deals: Logistics/);
  console.log("✓ won and lost deals as search context");
  console.log("\nAll meeting and deal checks passed.");
} finally {
  if (ws) await db.from("workspaces").delete().eq("id", ws);
  if (userId) await db.auth.admin.deleteUser(userId).catch(() => {});
}
