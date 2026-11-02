// Yolias as an AI sales agent (owner, 2026-10-31, D-273), end to end against
// the LOCAL Supabase only, with a local stand-in for the AI provider and the
// local test mailbox (nothing leaves this machine, no real person is emailed):
//   npm run test:sales-agent
// Covers: launching is the go-ahead (no approval per email, a campaign may
// start before anyone is found); intake moves people found for an audience
// into its conversations once; the worker sends each step once from the
// mailbox with the campaign's signature, notes and each person's language;
// replies: interest gets times and the booking page, a question and one
// objection are answered, a second objection, a request for a person and an
// unknown fact go to the member, a no or a stop ends it; a named time is booked
// and confirmed; pause stops sending and spending, resume restarts; the daily
// budget holds searches; the daily emails go only when there is news;
// learning; Yolias AI's new tools (draft only, never launch); workspace guards.
import assert from "node:assert/strict";
import http from "node:http";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.ts";

process.env.YOLIAS_TEST_MAILBOX = "1";
const PORT = 4953;
process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${PORT}`;

// ── AI stand-in ──────────────────────────────────────────────────────────────
const prompts: string[] = [];
const reply = (body: unknown) => JSON.stringify({ id: "msg", type: "message", role: "assistant", model: "claude-test", stop_reason: "end_turn", stop_sequence: null, content: [{ type: "text", text: JSON.stringify(body) }], usage: { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } });
const server = http.createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const body = JSON.parse(raw || "{}");
    const system = typeof body.system === "string" ? body.system : JSON.stringify(body.system ?? "");
    const user = JSON.stringify(body.messages ?? []);
    prompts.push(system + user);
    res.setHeader("content-type", "application/json");
    if (system.includes("You write one B2B email on their behalf")) {
      const ar = system.includes("Write in Arabic");
      return res.end(reply(ar
        ? { subject: "تتبع أسطولك", body: "مرحبًا،\n\nنساعد فرق التوصيل على تقليل التأخير بالتتبع المباشر.\n\nهل يناسبك اتصال قصير؟\n\nمنى", personalization_used: [], cta: "اتصال قصير", tone: "direct" }
        : { subject: "Fleet tracking for your drivers", body: "Hi,\n\nWe help delivery teams cut late deliveries with live fleet tracking.\n\nWould a short call next week work?\n\nMona", personalization_used: [], cta: "a short call", tone: "direct" }));
    }
    if (system.includes("classify it for the sender's team")) {
      const t = user.toLowerCase();
      const r = (kind: string, extra: Record<string, unknown> = {}) => res.end(reply({ kind, summary: `Reply: ${kind}.`, suggested_stage: kind === "interested" || kind === "meeting_request" ? "interested" : kind === "not_interested" || kind === "stop_request" ? "lost" : null, needs_human: false, escalate_because: [], suggested_reply: null, proposed_start: null, ...extra }));
      if (t.includes("remove me")) return r("stop_request", { escalate_because: ["stop_request"] });
      if (t.includes("not for us")) return r("not_interested");
      if (t.includes("talk to a person")) return r("asks_for_human", { needs_human: true, escalate_because: ["asks_for_human"] });
      if (t.includes("iso certified")) return r("question", { escalate_because: ["unverified_info"], suggested_reply: "Let me check." });
      if (t.includes("free trial")) return r("question", { suggested_reply: "Yes, every plan starts with a 7-day free trial." });
      if (t.includes("too expensive")) return r("objection", { suggested_reply: "Most teams cover the cost with fewer late deliveries. A short call?" });
      if (t.includes("tuesday at 11")) return r("meeting_request", { proposed_start: proposedIso, suggested_reply: "Great." });
      return r("interested", { suggested_reply: "Thanks! Happy to show you." });
    }
    res.end(reply({}));
  });
}).listen(PORT);
(await import("@/lib/integrations.ts")).setIntegrationsForTests({ anthropic: { api_key: "test-anthropic" } });

const { saveMailbox } = await import("@/lib/mailbox/index.ts");
const { testOutbox, pushTestReply } = await import("@/lib/mailbox/test-provider.ts");
const { dispatchCampaigns, syncReplies, approveCampaign, setCampaignRun } = await import("@/lib/outreach/execute.ts");
const { intakeSweep } = await import("@/lib/agent-core/intake.ts");
const { computeInsights } = await import("@/lib/agent-core/learning.ts");
const { dailyRoom } = await import("@/lib/campaigns/budget.ts");
const { runDiscovery } = await import("@/lib/discovery/pipeline.ts");
const { ensureBookingPage } = await import("@/lib/meetings/index.ts");
const { campaignTable } = await import("@/services/campaign-table.ts");
const { dashboardData } = await import("@/services/dashboard.ts");
const { campaignDigestSweep } = await import("@/lib/email/campaign-digest.ts");
const { executeTool } = await import("@/lib/agent/tools.ts");
const { DEFAULT_POLICY } = await import("@/lib/agent/policy-schema.ts");
const { metric } = await import("@/lib/campaigns/metrics.ts");
const { recordOpen } = await import("@/lib/outreach/opens.ts");
const { recordVisit, recordProgress, visitBooked, meetingPrepSweep, book, slotsFor } = await import("@/lib/meetings/index.ts");
const { optimizeCampaign } = await import("@/lib/agent-core/optimizer.ts");
const { masterInbox } = await import("@/services/master-inbox.ts");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, svc = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!/127\.0\.0\.1|localhost/.test(url)) throw new Error("Local database only.");
const admin = createClient<Database>(url, svc, { auth: { persistSession: false } });
const PASSWORD = "Agent-Test-2026!";
const users: string[] = [];
const DAY = 86_400_000;

// A free weekday slot three days ahead at 11:00 in the host's zone (UTC here).
const target = new Date(Date.now() + 3 * DAY);
while ([0, 6].includes(target.getUTCDay())) target.setTime(target.getTime() + DAY);
target.setUTCHours(11, 0, 0, 0);
const proposedIso = target.toISOString();

async function member(tag: string) {
  const email = `${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@yolias.local`;
  const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true, password: PASSWORD });
  if (error) throw error;
  users.push(data.user.id);
  const { data: prof } = await admin.from("profiles").select("*").eq("id", data.user.id).single();
  const wsId = prof!.workspace_id!;
  await admin.from("workspaces").update({ subscription_status: "active", plan: "growth", name: "Nile Logistics Tech", offering: "Fleet tracking software" }).eq("id", wsId);
  await admin.from("profiles").update({ onboarded_at: new Date().toISOString(), full_name: "Mona Adel", timezone: "UTC" }).eq("id", data.user.id);
  const client = createClient<Database>(url, anon, { auth: { persistSession: false } });
  const s = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (s.error) throw s.error;
  const [{ data: profile }, { data: workspace }] = await Promise.all([admin.from("profiles").select("*").eq("id", data.user.id).single(), admin.from("workspaces").select("*").eq("id", wsId).single()]);
  const session = { userId: data.user.id, email, emailConfirmed: true, profile: profile!, workspace: workspace!, role: "owner" as const, signupMeta: {} };
  return { userId: data.user.id, wsId, email, client, session };
}
const ctxFor = (m: Awaited<ReturnType<typeof member>>) => ({ session: m.session as never, db: m.client as SupabaseClient<Database>, conversationId: null, strategyId: null, launched: [], pending: [], policy: DEFAULT_POLICY, approved: false });

try {
  const A = await member("agent-a");
  const B = await member("agent-b");
  await admin.from("workspace_knowledge").upsert({ workspace_id: A.wsId, about: "Founded in Cairo. We build fleet tracking for delivery companies.", products: "FleetLive" });
  await admin.from("workspaces").update({ sending_rules: { gap_min: 0, gap_max: 0, days: [0, 1, 2, 3, 4, 5, 6], start: "00:00", end: "00:00" } }).eq("id", A.wsId);
  const box = await saveMailbox({ workspaceId: A.wsId, userId: A.userId, provider: "test", email: "mona@nile-test.example", displayName: "Mona", canRead: true, refreshToken: "test" });
  await ensureBookingPage(A.userId, A.wsId, "Mona Adel", A.email, "UTC");
  await admin.from("booking_pages").update({ enabled: true, timezone: "UTC", min_notice_hours: 0, window_days: 30, hours: { sun: [], mon: [["09:00", "17:00"]], tue: [["09:00", "17:00"]], wed: [["09:00", "17:00"]], thu: [["09:00", "17:00"]], fri: [["09:00", "17:00"]], sat: [] } } as never).eq("user_id", A.userId);

  // ── 1. A campaign launched before anyone is found (launching is the go-ahead) ──
  const { data: camp } = await admin.from("outreach_campaigns").insert({
    workspace_id: A.wsId, created_by: A.userId, name: "Riyadh fleets", channel: "email", objective: "meetings", aim: "meeting", language: "mul", tone: "direct",
    sender_name: "Mona from Nile", instructions: "Mention FleetLive by name.", daily_limit: 30, goal: "Late deliveries cost money.",
  }).select("id").single();
  const campId = camp!.id;
  await admin.from("outreach_steps").insert([0, 3, 7].map((d, i) => ({ workspace_id: A.wsId, campaign_id: campId, position: i + 1, delay_days: d, objective: (i === 0 ? "introduction" : "follow_up") as never })));
  const { data: strat } = await admin.from("strategies").insert({ workspace_id: A.wsId, created_by: A.userId, title: "Riyadh fleets", prompt: "logistics in Riyadh", status: "ready" }).select("id").single();
  const { data: search } = await admin.from("campaigns").insert({ workspace_id: A.wsId, strategy_id: strat!.id, name: "Riyadh fleets", criteria: {}, status: "scheduled", search_type: "companies", continuous: true }).select("id").single();
  const { data: group } = await admin.from("audience_groups").insert({ workspace_id: A.wsId, campaign_id: campId, name: "Riyadh logistics", source: "find_new", strategy_id: strat!.id, search_campaign_id: search!.id, angle_a: "Late deliveries cost money.", created_by: A.userId }).select("id").single();
  const noBox = await approveCampaign({ workspaceId: A.wsId, userId: A.userId, role: "owner", campaignId: campId, mailboxId: null, autoReply: true });
  assert.equal(!noBox.ok && noBox.error, "no_leads", "without the launch flag, an empty campaign isn't started");
  const go = await approveCampaign({ workspaceId: A.wsId, userId: A.userId, role: "owner", campaignId: campId, mailboxId: box.id, autoReply: true, launch: true });
  assert.ok(go.ok, "launched with nobody found yet");
  const c0 = (await admin.from("outreach_campaigns").select("status, auto_reply, approved_at").eq("id", campId).single()).data!;
  assert.deepEqual([c0.status, c0.auto_reply, Boolean(c0.approved_at)], ["active", true, true], "active, answering by itself");
  assert.equal((await admin.from("agent_pending_actions").select("id", { count: "exact", head: true }).eq("workspace_id", A.wsId)).count, 0, "no approval card anywhere");
  console.log("✓ launching is the go-ahead");

  // ── 2. Intake: people found for the audience join once ──
  const people: { name: string; email: string; country: string }[] = [
    { name: "Sara Ali", email: "sara", country: "SA" }, { name: "Omar Khaled", email: "omar", country: "SA" }, { name: "Lina Haddad", email: "lina", country: "GB" },
    { name: "Fahad Saud", email: "fahad", country: "SA" }, { name: "Hana Zaki", email: "hana", country: "GB" }, { name: "Nour Adel", email: "nour", country: "GB" },
    { name: "Yara Sami", email: "yara", country: "GB" }, { name: "Tarek Fawzi", email: "tarek", country: "GB" },
  ];
  const stamp = Date.now();
  for (const [i, p] of people.entries()) {
    const { data: co } = await admin.from("companies").insert({ workspace_id: A.wsId, campaign_id: search!.id, name: `Fleet Co ${i}`, domain: `fleet${i}-${stamp}.example`, source: "test", country: p.country, industry: i % 2 ? "Logistics" : "Delivery", delivered_at: new Date().toISOString(), saved_at: new Date().toISOString() }).select("id").single();
    await admin.from("prospects").insert({ workspace_id: A.wsId, campaign_id: search!.id, company_id: co!.id, full_name: p.name, title: "Head of Operations", country: p.country, email: `${p.email}-${stamp}@fleet${i}.example`, email_status: "verified", source: "test", saved_at: new Date().toISOString() });
  }
  await admin.from("campaigns").update({ prospects_found: people.length, runs_count: 1 }).eq("id", search!.id);
  const in1 = await intakeSweep();
  assert.ok(in1.joined >= people.length, `the audience's people joined: ${in1.joined}`);
  const in2 = await intakeSweep();
  assert.equal(in2.joined, 0, "the same run is never taken twice");
  const { count: enrolled } = await admin.from("outreach_enrollments").select("id", { count: "exact", head: true }).eq("campaign_id", campId).eq("audience_group_id", group!.id);
  assert.equal(enrolled, people.length, "each person once, in the right audience");
  assert.ok((await admin.from("campaign_activity").select("body").eq("campaign_id", campId).eq("kind", "found")).data!.length === 1, "the find is in the campaign's log");
  console.log("✓ intake");

  // ── 3. Sending: once per step, signature, notes, each person's language ──
  const r1 = await dispatchCampaigns();
  const firstSent = testOutbox().length;
  assert.equal(firstSent, people.length, `every first email went out once: ${firstSent} (${JSON.stringify(r1)})`);
  await dispatchCampaigns();
  assert.equal(testOutbox().length, firstSent, "nothing twice");
  const writes = prompts.filter((p) => p.includes("You write one B2B email on their behalf"));
  assert.ok(writes.every((p) => p.includes("Mona from Nile")), "signed with the campaign's name");
  assert.ok(writes.every((p) => p.includes("Mention FleetLive by name.")), "the campaign's notes reach the writer");
  assert.ok(writes.some((p) => p.includes("Write in Arabic")) && writes.some((p) => p.includes("Write in English")), "each person's language from their country");
  const { data: sentRows } = await admin.from("outreach_messages").select("lead_id, provider_thread_id, to_email, language").eq("outreach_campaign_id", campId).eq("status", "sent").eq("step_position", 1);
  const thread = (i: number) => sentRows![i];
  console.log("✓ sending");

  // ── 4. Replies: the agent answers, books, stops or hands over ──
  const answers = () => testOutbox().length;
  const handoffs = async (leadId: string) => (await admin.from("lead_tasks").select("id", { count: "exact", head: true }).eq("lead_id", leadId).like("dedupe_key", "handoff:%")).count ?? 0;
  const ask = async (i: number, body: string) => { pushTestReply({ threadId: thread(i).provider_thread_id!, from: thread(i).to_email!, fromName: null, subject: "Re: Fleet tracking", body }); await syncReplies(10, true); };

  let n = answers();
  await ask(0, "Sounds interesting, tell me more");
  assert.equal(answers(), n + 1, "interest is answered at once");
  assert.ok(testOutbox().at(-1)!.body.includes("/meet/"), "with the booking page");
  assert.equal(await handoffs(thread(0).lead_id!), 0, "no hand-off for interest");

  n = answers();
  await ask(1, "Is there a free trial?");
  assert.equal(answers(), n + 1, "a question is answered");
  assert.ok(testOutbox().at(-1)!.body.includes("7-day free trial"));

  n = answers();
  await ask(2, "It's too expensive for us");
  assert.equal(answers(), n + 1, "one objection is answered");
  await ask(2, "Still too expensive");
  assert.equal(answers(), n + 1, "a second objection goes to the member");
  assert.equal(await handoffs(thread(2).lead_id!), 1, "with a task");

  n = answers();
  await ask(3, "Can I talk to a person?");
  assert.equal(answers(), n, "a request for a person isn't answered by Yolias");
  assert.equal(await handoffs(thread(3).lead_id!), 1);
  assert.ok((await admin.from("notifications").select("title").eq("user_id", A.userId)).data!.some((x) => / needs you$/.test(x.title)), "and the member is told");

  n = answers();
  await ask(4, "Are you ISO certified?");
  assert.equal(answers(), n, "never answers what Company Knowledge doesn't say");
  assert.equal(await handoffs(thread(4).lead_id!), 1);

  n = answers();
  await ask(5, "Please remove me from your list");
  assert.equal(answers(), n, "a stop request gets nothing");
  assert.equal((await admin.from("sales_leads").select("do_not_contact").eq("id", thread(5).lead_id!).single()).data!.do_not_contact, true, "and is never contacted again");

  n = answers();
  await ask(6, "Not for us, thanks");
  assert.equal(answers(), n, "a clear no ends the conversation");
  assert.notEqual((await admin.from("outreach_enrollments").select("status").eq("campaign_id", campId).eq("lead_id", thread(6).lead_id!).single()).data!.status, "active");

  n = answers();
  await ask(7, "Tuesday at 11 works for me");
  assert.equal(answers(), n + 1, "a named time is booked and confirmed in the thread");
  const { data: mtg } = await admin.from("sales_meetings").select("starts_at, confirmed_at, campaign_id, source").eq("lead_id", thread(7).lead_id!).single();
  assert.equal(Date.parse(mtg!.starts_at), Date.parse(proposedIso), "at the time they named");
  assert.ok(mtg!.confirmed_at, "confirmed: the guest chose it");
  assert.equal(mtg!.campaign_id, campId, "credited to the campaign");
  console.log("✓ replies: answer, book, stop, hand over");

  // ── 4b. D-274: opens, the booking link, guest reminders, the brief, "Needs you" ──
  const firstOut = testOutbox().find((x) => x.to === thread(0).to_email)!;
  assert.ok(firstOut.pixelUrl && /\/api\/o\/[0-9a-f-]{36}$/.test(firstOut.pixelUrl), "campaign emails carry the open image");
  const { data: m0 } = await admin.from("outreach_messages").select("id").eq("lead_id", thread(0).lead_id!).eq("step_position", 1).eq("status", "sent").single();
  await admin.from("outreach_messages").update({ sent_at: new Date(Date.now() - 10 * 60_000).toISOString() }).eq("id", m0!.id);
  assert.equal(await recordOpen(m0!.id), true, "an open after the first minute counts");
  await recordOpen(m0!.id);
  const o = (await admin.from("outreach_messages").select("recipient_opened_at, open_count").eq("id", m0!.id).single()).data!;
  assert.ok(o.recipient_opened_at && o.open_count === 2, "first open kept, each load counted");
  assert.equal(await recordOpen("not-an-id"), false);
  const { data: m1 } = await admin.from("outreach_messages").select("id").eq("lead_id", thread(1).lead_id!).eq("step_position", 1).eq("status", "sent").single();
  await admin.from("outreach_messages").update({ sent_at: new Date().toISOString() }).eq("id", m1!.id);
  assert.equal(await recordOpen(m1!.id), false, "a scanner right after sending isn't a person");

  const interestReply = testOutbox().filter((x) => x.to === thread(0).to_email).at(-1)!;
  assert.ok(interestReply.body.includes(`?r=${thread(0).lead_id}`), "the booking link in the reply carries the lead");
  const slug = (await admin.from("booking_pages").select("slug").eq("user_id", A.userId).single()).data!.slug;
  const v1 = await recordVisit(slug, "visitor-one-123", thread(0).lead_id!);
  assert.ok(v1, "a visit is recorded");
  assert.equal(await recordVisit(slug, "visitor-one-123", thread(0).lead_id!), v1, "one visit per visitor per day");
  const v1row = (await admin.from("booking_visits").select("campaign_id, lead_id").eq("id", v1!).single()).data!;
  assert.deepEqual([v1row.campaign_id, v1row.lead_id], [campId, thread(0).lead_id], "credited to the lead's campaign");
  const v2 = await recordVisit(slug, "visitor-two-456", thread(1).lead_id!);
  assert.equal(await recordProgress(v2!, "visitor-two-456", { name: "Omar", email: "omar@fleet.example" }), true, "what they typed is kept");
  assert.equal(await recordProgress(v2!, "someone-else-999", { name: "X", email: "x@x.example" }), false, "only by the same visitor");
  await admin.from("booking_visits").update({ updated_at: new Date(Date.now() - 2 * 3_600_000).toISOString() }).eq("id", v2!);
  const pageRow = (await admin.from("booking_pages").select("*").eq("user_id", A.userId).single()).data!;
  const free = (await slotsFor(pageRow as never)).flatMap((d) => d.slots);
  const bookingDay = new Date(free.find((x) => x !== proposedIso)!);
  const booked = await book({ slug, start: bookingDay.toISOString(), name: "Sara Ali", email: thread(0).to_email!, note: null });
  assert.ok(booked.ok, `booked from the page: ${JSON.stringify(booked)} ${bookingDay.toISOString()}`);
  if (booked.ok) await visitBooked(v1, "visitor-one-123", booked.meetingId);
  await recordVisit(slug, "visitor-three-789", null);
  const [vl] = await campaignTable(A.wsId, { from: null, to: null }, { ids: [campId] });
  assert.deepEqual([vl.counts.visits, vl.counts.linkBooked, vl.counts.abandoned], [2, 1, 1], "visits, bookings and forms left, for the campaign (the direct visit isn't)");
  assert.equal(vl.counts.opened, 1, "people who opened");
  assert.ok(vl.counts.foundPeople === people.length && vl.counts.foundCompanies === people.length, "people and companies found");

  // Guest reminders: a day before, then an hour before; the brief.
  const { data: soon } = await admin.from("sales_meetings").insert({ workspace_id: A.wsId, lead_id: thread(0).lead_id!, title: "Intro: Sara", starts_at: new Date(Date.now() + 20 * 3_600_000).toISOString(), status: "scheduled", source: "agent", host_id: A.userId, created_by: A.userId, guest_email: thread(0).to_email, created_at: new Date(Date.now() - 3 * DAY).toISOString() } as never).select("id").single();
  await meetingPrepSweep();
  const r1m = (await admin.from("sales_meetings").select("guest_reminded_day_at, guest_reminded_hour_at").eq("id", soon!.id).single()).data!;
  assert.ok(r1m.guest_reminded_day_at && !r1m.guest_reminded_hour_at, "the day-before reminder");
  await meetingPrepSweep();
  assert.equal((await admin.from("email_log").select("id", { count: "exact", head: true }).eq("kind", "meeting_guest_reminder").like("dedupe_key", `%${soon!.id}%`)).count, 1, "once per meeting");
  await admin.from("sales_meetings").update({ starts_at: new Date(Date.now() + 40 * 60_000).toISOString() }).eq("id", soon!.id);
  await meetingPrepSweep();
  const r2m = (await admin.from("sales_meetings").select("guest_reminded_hour_at, brief_at").eq("id", soon!.id).single()).data!;
  assert.ok(r2m.guest_reminded_hour_at, "the hour-before reminder");
  assert.ok(r2m.brief_at, "the brief was prepared once");
  await admin.from("sales_meetings").delete().eq("id", soon!.id);

  // Needs you: only what Yolias handed over.
  const needs = await masterInbox(A.wsId, "needs_you", "", null, null, A.client as never);
  const needIds = new Set(needs.items.map((i) => i.leadId));
  for (const i of [2, 3, 4]) assert.ok(needIds.has(thread(i).lead_id!), `handed over: ${i}`);
  for (const i of [0, 1, 5, 6]) assert.ok(!needIds.has(thread(i).lead_id!), `Yolias handled it: ${i}`);
  console.log("✓ opens, booking link visits, guest reminders, brief, Needs you");

  // ── 5. Numbers: meetings, confirmed, cost per meeting ──
  await admin.from("usage_ledger").insert({ workspace_id: A.wsId, kind: "consume", prospects: 20, period_start: new Date().toISOString().slice(0, 7) + "-01", campaign_id: search!.id, created_by: "test" } as never);
  const [line] = await campaignTable(A.wsId, { from: null, to: null }, { ids: [campId] });
  assert.equal(line.counts.meetings, 2, "the named time and the page booking");
  assert.equal(line.counts.confirmed, 2);
  assert.ok(line.counts.spendUsd > 0, "spend from the people found");
  assert.equal(metric("cost_per_meeting")!.compute(line.counts), line.counts.spendUsd / line.counts.meetings, "cost per meeting = spend ÷ meetings");
  assert.equal(line.groups[0].counts.contacted, people.length, "per audience");
  const dash = await dashboardData(A.wsId, "7d", null);
  assert.equal(dash.counts.meetings, 2, "the dashboard agrees");
  assert.ok(dash.account.totalUsd != null && dash.account.leftUsd != null, "the account balance");
  assert.equal(dash.series.days.length, 7);
  assert.ok(dash.live?.campaignId === campId, "it says what Yolias is working on");
  console.log("✓ numbers");

  // ── 6. Pause stops sending and spending; resume ──
  assert.ok(await setCampaignRun(A.wsId, campId, "pause"));
  assert.equal((await admin.from("campaigns").select("status").eq("id", search!.id).single()).data!.status, "paused", "the audience's search pauses too");
  await admin.from("outreach_enrollments").update({ next_step_at: new Date(Date.now() - 60_000).toISOString() }).eq("campaign_id", campId).eq("status", "active");
  await admin.from("outreach_messages").update({ sent_at: new Date(Date.now() - 4 * DAY).toISOString() }).eq("outreach_campaign_id", campId).eq("status", "sent");
  const before = testOutbox().length;
  await dispatchCampaigns();
  assert.equal(testOutbox().length, before, "paused: nothing sent");
  assert.ok(await setCampaignRun(A.wsId, campId, "resume"));
  assert.equal((await admin.from("campaigns").select("status").eq("id", search!.id).single()).data!.status, "scheduled", "the search goes on");
  console.log("✓ pause and resume");

  // ── 7. Daily budget holds the searches ──
  assert.equal(await dailyRoom(A.wsId), null, "no daily budget: no limit");
  await admin.from("workspaces").update({ daily_budget_usd: 0.5 }).eq("id", A.wsId);
  assert.equal(await dailyRoom(A.wsId), 0, "already spent more than $0.50 today");
  await admin.from("campaigns").update({ status: "scheduled", next_run_at: new Date().toISOString(), quota: 100 }).eq("id", search!.id);
  await runDiscovery(search!.id);
  const held = (await admin.from("campaigns").select("status, next_run_at").eq("id", search!.id).single()).data!;
  assert.equal(held.status, "scheduled");
  assert.ok(Date.parse(held.next_run_at!) > Date.now() + 60_000, "it waits for tomorrow");
  await admin.from("workspaces").update({ daily_budget_usd: null }).eq("id", A.wsId);
  console.log("✓ daily budget");

  // ── 8. Daily emails only when there is news ──
  const d1 = await campaignDigestSweep({ force: true });
  const kinds = (await admin.from("email_log").select("kind, user_id").in("user_id", [A.userId, B.userId])).data ?? [];
  assert.ok(kinds.some((k) => k.user_id === A.userId && k.kind === "leads_review"), `people found → review email (${JSON.stringify(d1)})`);
  assert.ok(kinds.some((k) => k.user_id === A.userId && k.kind === "campaign_changes"), "changes → recap email");
  assert.ok(!kinds.some((k) => k.user_id === B.userId), "a workspace with nothing happening gets nothing");
  await campaignDigestSweep({ force: true });
  const again = (await admin.from("email_log").select("id", { count: "exact", head: true }).eq("user_id", A.userId).eq("kind", "leads_review")).count;
  assert.equal(again, 1, "never twice the same day");
  await admin.from("profiles").update({ notify_review: false }).eq("id", B.userId);
  console.log("✓ daily emails");

  // ── 9. Learning ──
  const ins = await computeInsights(admin as never, A.wsId);
  assert.equal(ins.contacted, people.length);
  assert.ok(ins.objections.length >= 1, "objections are remembered as short phrases");
  console.log("✓ learning");

  // ── 10. Yolias AI: a draft only, and the new tools ──
  const draft = await executeTool(ctxFor(A) as never, "createCampaignDraft", { name: "Dubai fleets", offer: "FleetLive", meetings: 5, budgetUsd: 20, audiences: [{ name: "Dubai logistics", countries: ["AE"], industries: ["Logistics"], titles: ["COO"] }] });
  assert.ok(draft.ok, draft.ok ? "" : draft.message);
  const draftUrl = (draft as { data: { draftUrl: string } }).data.draftUrl;
  const draftId = draftUrl.split("draft=")[1];
  const d = (await admin.from("outreach_campaigns").select("status, approved_at, wizard").eq("id", draftId).single()).data!;
  assert.deepEqual([d.status, d.approved_at], ["draft", null], "Yolias AI never launches");
  assert.ok(JSON.stringify(d.wizard).includes("Dubai logistics"), "the builder opens with it");
  const list = await executeTool(ctxFor(A) as never, "listCampaigns", {});
  assert.ok(list.ok && JSON.stringify((list as { data: unknown }).data).includes("Riyadh fleets"));
  const meet = await executeTool(ctxFor(A) as never, "listMeetings", { when: "upcoming" });
  assert.ok(meet.ok && (meet as { data: { meetings: unknown[] } }).data.meetings.length === 2);
  const gone = await executeTool(ctxFor(A) as never, "startOutreachCampaign", { id: campId });
  assert.ok(!gone.ok, "the old approval tool is gone");
  console.log("✓ Yolias AI tools");

  // ── 11. Guards ──
  const other = await executeTool(ctxFor(B) as never, "controlOutreachCampaign", { id: campId, action: "pause" });
  assert.ok(!other.ok, "another workspace can't touch it");
  const { data: seen } = await B.client.from("audience_groups").select("id").eq("campaign_id", campId);
  assert.equal(seen?.length ?? 0, 0, "nor see its audiences");
  const forged = await A.client.from("outreach_campaigns").update({ approved_at: new Date().toISOString(), send_mode: "mailbox" } as never).eq("id", draftId);
  assert.ok(forged.error, "launching is the server's to record");
  console.log("✓ guards");

  // ── 12. D-274: the optimizer moves the budget toward results ──
  const { data: s2 } = await admin.from("campaigns").insert({ workspace_id: A.wsId, strategy_id: strat!.id, name: "Weak audience", criteria: {}, status: "scheduled", search_type: "companies", continuous: true, quota: 10 }).select("id").single();
  const { data: g2 } = await admin.from("audience_groups").insert({ workspace_id: A.wsId, campaign_id: campId, name: "Weak audience", source: "find_new", strategy_id: strat!.id, search_campaign_id: s2!.id, created_by: A.userId }).select("id").single();
  const day = new Date().toISOString().slice(0, 10);
  await optimizeCampaign(admin as never, { id: campId, workspace_id: A.wsId, name: "Riyadh fleets", cost_cap_usd: null, approved_by: A.userId, created_by: A.userId }, day);
  const shares = (await admin.from("audience_groups").select("id, budget_share, learning, opt_state").eq("campaign_id", campId)).data!;
  assert.ok(shares.every((g) => g.budget_share != null && g.learning), "too few results and people: learning, a share each");
  assert.ok(Math.abs(shares.reduce((a, g) => a + Number(g.budget_share), 0) - 1) < 0.01, "the shares add up to the budget");
  // An audience the optimizer stops: its search waits for tomorrow.
  await admin.from("audience_groups").update({ budget_share: 0 }).eq("id", g2!.id);
  await admin.from("campaigns").update({ status: "scheduled", next_run_at: new Date().toISOString() }).eq("id", s2!.id);
  await runDiscovery(s2!.id);
  const waited = (await admin.from("campaigns").select("status, next_run_at").eq("id", s2!.id).single()).data!;
  assert.ok(waited.status === "scheduled" && Date.parse(waited.next_run_at!) > Date.now() + 60_000, "no budget today: it waits");
  console.log("✓ optimizer");

  console.log("\nAll sales-agent checks passed.");
} finally {
  for (const id of users) {
    const { data: prof } = await admin.from("profiles").select("workspace_id").eq("id", id).maybeSingle();
    if (prof?.workspace_id) await admin.from("workspaces").delete().eq("id", prof.workspace_id);
    await admin.auth.admin.deleteUser(id).catch(() => {});
  }
  server.close();
}
