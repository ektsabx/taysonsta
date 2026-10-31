// Campaign-centred Yolias (owner, 2026-10-31, D-270) against the LOCAL Supabase
// only; nothing is sent and nobody is emailed:  npm run test:campaigns
// Covers: two campaigns running side by side; one person never in two active
// campaigns at once; the schedule (scheduled → active on its start date, ended
// on its end date with its leads stopped); pause / resume / end with the
// activity log; the deliverability guard pausing a campaign whose mailbox
// bounces; meetings belonging to their campaign; results by first touch
// (meetings toward the target, qualified, a won deal and its value, cost per
// meeting and return); and one workspace never seeing another's results.
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.ts";

const { enrollLeads } = await import("@/lib/outreach/sequence.ts");
const { setCampaignRun } = await import("@/lib/outreach/execute.ts");
const { campaignScheduleSweep } = await import("@/lib/campaigns/schedule.ts");
const { campaignMetrics, campaignActivity } = await import("@/services/campaign-metrics.ts");
const { campaignOfLead } = await import("@/lib/campaigns/activity.ts");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
if (!/127\.0\.0\.1|localhost/.test(url)) throw new Error("Local database only.");
const db = createClient<Database>(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const stamp = Date.now().toString(36);
const users: string[] = [];
const DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString();

async function member(tag: string) {
  const { data, error } = await db.auth.admin.createUser({ email: `camp-${tag}-${stamp}@yolias.local`, email_confirm: true });
  if (error) throw error;
  users.push(data.user.id);
  const { data: prof } = await db.from("profiles").select("workspace_id").eq("id", data.user.id).single();
  await db.from("workspaces").update({ subscription_status: "active", plan: "growth" }).eq("id", prof!.workspace_id!);
  return { userId: data.user.id, ws: prof!.workspace_id! };
}
const searches = new Map<string, string>();
async function searchOf(ws: string) {
  if (searches.has(ws)) return searches.get(ws)!;
  const { data: prof } = await db.from("profiles").select("id").eq("workspace_id", ws).limit(1).single();
  const { data: strat } = await db.from("strategies").insert({ workspace_id: ws, created_by: prof!.id, title: "s", prompt: "s", status: "ready" }).select("id").single();
  const { data: c } = await db.from("campaigns").insert({ workspace_id: ws, strategy_id: strat!.id, created_by: prof!.id, name: "s", criteria: {}, status: "completed", search_type: "companies", prospects_found: 40 }).select("id").single();
  searches.set(ws, c!.id);
  return c!.id;
}
async function lead(ws: string, tag: string) {
  const { data: co, error } = await db.from("companies").insert({ workspace_id: ws, campaign_id: await searchOf(ws), name: `Co ${tag}`, domain: `${tag}-${stamp}.example`, source: "test", country: "SA" }).select("id").single();
  if (error) throw error;
  const { data } = await db.from("sales_leads").insert({ workspace_id: ws, lead_key: `test:${tag}-${stamp}`, name: `Lead ${tag}`, email: `${tag}-${stamp}@example.com`, source: "manual", company_id: co!.id }).select("id").single();
  return data!.id;
}
async function campaign(ws: string, userId: string, name: string, extra: Partial<Database["public"]["Tables"]["outreach_campaigns"]["Insert"]> = {}) {
  const { data, error } = await db.from("outreach_campaigns").insert({ workspace_id: ws, created_by: userId, name, channel: "email", language: "en", tone: "direct", ...extra }).select("id").single();
  if (error) throw error;
  await db.from("outreach_steps").insert({ workspace_id: ws, campaign_id: data!.id, position: 1, delay_days: 0, objective: "introduction" });
  return data!.id;
}
async function sent(ws: string, campaignId: string, leadId: string, at: number, extra: Partial<Database["public"]["Tables"]["outreach_messages"]["Insert"]> = {}) {
  await db.from("outreach_messages").insert({ workspace_id: ws, lead_id: leadId, outreach_campaign_id: campaignId, channel: "email", direction: "outbound", status: "sent", subject: "Hello", body: "Hi", sent_at: iso(at), ...extra });
}

try {
  const A = await member("a");
  const B = await member("b");

  // Two campaigns side by side, each with a target, dates and a daily limit.
  const now = Date.now();
  const c1 = await campaign(A.ws, A.userId, "Riyadh clinics", { target_meetings: 4, starts_at: iso(now - 10 * DAY), ends_at: iso(now + 20 * DAY), daily_limit: 20, status: "active", approved_at: iso(now - 10 * DAY), approved_by: A.userId });
  const c2 = await campaign(A.ws, A.userId, "Dubai agencies", { target_meetings: 2, status: "active", approved_at: iso(now), approved_by: A.userId });
  const l1 = await lead(A.ws, "one"), l2 = await lead(A.ws, "two"), l3 = await lead(A.ws, "three");

  // One person, one conversation: active in c1 → not enrolled in c2 at the same time.
  assert.equal((await enrollLeads(db as never, A.ws, A.userId, c1, [l1, l2, l3]))!.added, 3);
  const second = await enrollLeads(db as never, A.ws, A.userId, c2, [l1]);
  assert.equal(second!.added, 0);
  assert.equal(second!.skipped.in_other_campaign, 1, "already being contacted by another campaign");
  console.log("✓ two campaigns side by side, no person in two at once");

  // Results: first touch owns the outcome.
  await sent(A.ws, c1, l1, now - 5 * DAY);
  await sent(A.ws, c1, l2, now - 4 * DAY, { delivery_status: "bounced" });
  await sent(A.ws, c1, l3, now - 3 * DAY);
  await db.from("outreach_messages").insert({ workspace_id: A.ws, lead_id: l1, outreach_campaign_id: c1, channel: "email", direction: "inbound", status: "received", subject: "Re: Hello", body: "Yes, let's talk", received_at: iso(now - 4 * DAY), analysis: { kind: "meeting_request" } });
  assert.equal(await campaignOfLead(db as never, l1), c1, "a meeting belongs to the lead's campaign");
  await db.from("sales_meetings").insert({ workspace_id: A.ws, lead_id: l1, title: "Intro", starts_at: iso(now - 2 * DAY), status: "completed", source: "agent", campaign_id: c1, qualified: true });
  await db.from("sales_meetings").insert({ workspace_id: A.ws, lead_id: l3, title: "Intro", starts_at: iso(now + 2 * DAY), status: "scheduled", source: "booking", campaign_id: c1, qualified: false });
  await db.from("sales_leads").update({ stage: "closed", deal_value: 1200 }).eq("id", l1);
  // Prospects used by the campaign's search, at the plan's rate (Growth: $100 / 2,000 = $0.05).
  const search = await searchOf(A.ws);
  await db.from("outreach_campaigns").update({ source_campaign_id: search }).eq("id", c1);
  await db.from("usage_ledger").insert({ workspace_id: A.ws, campaign_id: search, kind: "consume", prospects: 40, period_start: iso(now).slice(0, 10) } as never);

  const [m] = await campaignMetrics(A.ws, { ids: [c1] });
  assert.equal(m.contacted, 3); assert.equal(m.sent, 3); assert.equal(m.bounced, 1);
  assert.equal(m.positive, 1); assert.equal(m.requests, 1);
  assert.equal(m.booked, 2); assert.equal(m.held, 1); assert.equal(m.qualified, 1);
  assert.equal(m.towardTarget, 1, "a meeting marked not qualified doesn't count toward the target");
  assert.equal(m.customers, 1); assert.equal(m.revenueUsd, 1200);
  assert.equal(m.found, 40); assert.equal(m.prospectsUsed, 40);
  assert.ok(Math.abs(m.costs.spendUsd - 2) < 1e-9, `40 × $0.05 = $2, got ${m.costs.spendUsd}`);
  assert.equal(m.costs.perMeeting, 1);
  assert.equal(m.costs.roi, (1200 - 2) / 2);
  assert.equal(m.forecast, null, "3 people contacted: no forecast yet");
  assert.equal(m.plan, null, "no plan without enough data");
  assert.equal(m.pace, "unknown");
  console.log("✓ results by first touch: meetings, qualified, revenue, cost per meeting, return; no forecast without data");

  // Isolation: B sees none of A's campaigns.
  assert.deepEqual(await campaignMetrics(B.ws), []);
  assert.deepEqual(await campaignMetrics(B.ws, { ids: [c1] }), []);
  console.log("✓ one workspace never sees another's results");

  // Pause / resume / end, logged.
  assert.ok(await setCampaignRun(A.ws, c2, "pause"));
  assert.ok(await setCampaignRun(A.ws, c2, "resume"));
  assert.ok(await setCampaignRun(A.ws, c2, "end"));
  const { data: ended } = await db.from("outreach_campaigns").select("status, ended_at").eq("id", c2).single();
  assert.equal(ended!.status, "completed"); assert.ok(ended!.ended_at);
  assert.ok(!(await setCampaignRun(A.ws, c2, "resume")), "an ended campaign doesn't resume");
  const kinds = (await campaignActivity(A.ws, c2)).map((a) => a.kind);
  assert.deepEqual(kinds.slice(0, 3), ["completed", "resumed", "paused"]);
  console.log("✓ pause, resume, end, each in the activity log");

  // Schedule: an approved campaign waiting for its date starts on it; one past its end date ends.
  const later = await campaign(A.ws, A.userId, "Starts today", { status: "scheduled", starts_at: iso(now - 60_000), approved_at: iso(now), approved_by: A.userId });
  const over = await campaign(A.ws, A.userId, "Over", { status: "active", starts_at: iso(now - 30 * DAY), ends_at: iso(now - 60_000), approved_at: iso(now - 30 * DAY), approved_by: A.userId });
  const l4 = await lead(A.ws, "four");
  await db.from("outreach_enrollments").insert({ workspace_id: A.ws, campaign_id: over, lead_id: l4 });
  await campaignScheduleSweep();
  assert.equal((await db.from("outreach_campaigns").select("status").eq("id", later).single()).data!.status, "active");
  assert.equal((await db.from("outreach_campaigns").select("status").eq("id", over).single()).data!.status, "completed");
  const { data: stopped } = await db.from("outreach_enrollments").select("status, stop_reason").eq("campaign_id", over).single();
  assert.deepEqual(stopped, { status: "stopped", stop_reason: "campaign_ended" });
  console.log("✓ scheduled campaign starts on its date; one past its end date ends and its leads stop");

  // Deliverability guard: 25 sent from a mailbox in 7 days, 2 bounced (8%) → its campaign pauses, with the reason.
  const { data: box } = await db.from("mailboxes").insert({ workspace_id: A.ws, user_id: A.userId, provider: "imap", email: `box-${stamp}@example.com`, status: "connected" } as never).select("id").single();
  const guarded = await campaign(A.ws, A.userId, "Guarded", { status: "active", approved_at: iso(now), approved_by: A.userId, mailbox_id: box!.id, send_mode: "mailbox" });
  const lg = await lead(A.ws, "guard");
  for (let i = 0; i < 25; i++) await sent(A.ws, guarded, lg, now - DAY, { mailbox_id: box!.id, delivery_status: i < 2 ? "bounced" : "sent" });
  await campaignScheduleSweep();
  const { data: g } = await db.from("outreach_campaigns").select("status, failure_reason").eq("id", guarded).single();
  assert.equal(g!.status, "paused"); assert.match(g!.failure_reason!, /8% of the last 25/);
  assert.equal((await campaignActivity(A.ws, guarded))[0].kind, "guard");
  console.log("✓ deliverability guard pauses a campaign whose mailbox bounces, and says why");
  console.log("ALL PASS");
} finally {
  for (const u of users) {
    const { data: p } = await db.from("profiles").select("workspace_id").eq("id", u).maybeSingle();
    if (p?.workspace_id) {
      await db.from("notifications").delete().eq("workspace_id", p.workspace_id);
      await db.from("workspaces").delete().eq("id", p.workspace_id);
    }
    await db.auth.admin.deleteUser(u).catch(() => {});
  }
}
