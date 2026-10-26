// Email sending rules (D-256), against the local Supabase with the local test
// mailbox — nothing leaves this machine:
//   npm run test:sending-rules
// Covers: a new mailbox starts with the workspace's rules; nothing is sent
// outside the mailbox's days and hours (in its time zone); inside them one
// email leaves per random gap, and the next waits for the gap; a reply the
// member sends from the Inbox does not wait.
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.ts";
process.env.YOLIAS_TEST_MAILBOX = "1";
(await import("@/lib/integrations.ts")).setIntegrationsForTests({});
const { saveMailbox } = await import("@/lib/mailbox/index.ts");
const { testOutbox } = await import("@/lib/mailbox/test-provider.ts");
const { dispatchCampaigns, sendMessageNow } = await import("@/lib/outreach/execute.ts");
const { localClock } = await import("@/lib/outreach/sending-rules.ts");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
assert.match(url, /127\.0\.0\.1|localhost/, "local database only");
const db = createClient<Database>(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const users: string[] = [];
let wsId = "";

try {
  const email = `rules-${Date.now()}@yolias.local`;
  const { data: u, error } = await db.auth.admin.createUser({ email, email_confirm: true });
  if (error) throw error;
  users.push(u.user.id);
  const userId = u.user.id;
  wsId = (await db.from("profiles").select("workspace_id").eq("id", userId).single()).data!.workspace_id!;

  // ── 1. A new mailbox starts with the workspace's rules ──
  await db.from("workspaces").update({ sending_rules: { daily_per_mailbox: 12, gap_min: 18, gap_max: 24, days: [0, 1, 2, 3, 4, 5, 6], start: "00:00", end: "00:00", timezone: "Africa/Cairo" } }).eq("id", wsId);
  const box = await saveMailbox({ workspaceId: wsId, userId, provider: "test", email: "rules@acme-test.example", displayName: "Rules", canRead: true, refreshToken: "test" });
  assert.deepEqual([box.daily_limit, box.send_days, box.send_start, box.send_end, box.time_zone], [12, [0, 1, 2, 3, 4, 5, 6], "00:00", "00:00", "Africa/Cairo"], "the new mailbox took the rules");
  console.log("✓ new mailbox defaults");

  // A running campaign with three prepared first emails.
  const now = new Date().toISOString();
  const { data: camp } = await db.from("outreach_campaigns").insert({ workspace_id: wsId, name: "Rules test", channel: "email", created_by: userId, status: "active", send_mode: "mailbox", mailbox_id: box.id, approved_by: userId, approved_at: now, started_at: now }).select("id").single();
  await db.from("outreach_steps").insert({ workspace_id: wsId, campaign_id: camp!.id, position: 1 });
  for (const n of [1, 2, 3]) {
    const to = `lead${n}@client-test.example`;
    const { data: l } = await db.from("sales_leads").insert({ workspace_id: wsId, lead_key: `test:${to}`, name: `Lead ${n}`, email: to, source: "manual" }).select("id").single();
    const { data: e } = await db.from("outreach_enrollments").insert({ workspace_id: wsId, campaign_id: camp!.id, lead_id: l!.id, status: "active", current_step: 0 }).select("id").single();
    await db.from("outreach_messages").insert({ workspace_id: wsId, created_by: userId, lead_id: l!.id, outreach_campaign_id: camp!.id, enrollment_id: e!.id, step_position: 1, channel: "email", direction: "outbound", status: "draft", to_email: to, subject: `Hello ${n}`, body: "Hi.", language: "en" });
  }
  const sentCount = async () => (await db.from("outreach_messages").select("id", { count: "exact", head: true }).eq("outreach_campaign_id", camp!.id).eq("status", "sent")).count ?? 0;

  // ── 2. Outside the days and hours: nothing goes out ──
  const today = localClock(new Date(), "Africa/Cairo").day;
  await db.from("mailboxes").update({ send_days: [(today + 3) % 7] }).eq("id", box.id);
  await dispatchCampaigns();
  assert.equal(await sentCount(), 0, "not on a sending day");
  const { minutes } = localClock(new Date(), "Africa/Cairo");
  const hh = (m: number) => `${String(Math.floor(((m + 1440) % 1440) / 60)).padStart(2, "0")}:${String(((m + 1440) % 1440) % 60).padStart(2, "0")}`;
  await db.from("mailboxes").update({ send_days: [0, 1, 2, 3, 4, 5, 6], send_start: hh(minutes + 60), send_end: hh(minutes + 120) }).eq("id", box.id);
  await dispatchCampaigns();
  assert.equal(await sentCount(), 0, "not before the start hour");
  console.log("✓ outside the sending hours: nothing sent");

  // ── 3. Inside: one email, then the gap ──
  await db.from("mailboxes").update({ send_start: hh(minutes - 60), send_end: hh(minutes + 60) }).eq("id", box.id);
  const before = Date.now();
  await dispatchCampaigns();
  assert.equal(await sentCount(), 1, "one email per gap");
  const next = (await db.from("mailboxes").select("next_send_at").eq("id", box.id).single()).data!.next_send_at!;
  const wait = (Date.parse(next) - before) / 60_000;
  assert.ok(wait >= 17.9 && wait <= 24.5, `the next waits 18 to 24 minutes: ${wait.toFixed(1)}`);
  await dispatchCampaigns();
  assert.equal(await sentCount(), 1, "nothing during the gap");
  await db.from("mailboxes").update({ next_send_at: new Date(Date.now() - 1000).toISOString() }).eq("id", box.id);
  await dispatchCampaigns();
  assert.equal(await sentCount(), 2, "the next one after the gap");
  console.log("✓ one email per random gap");

  // ── 4. The member's own reply doesn't wait for the gap ──
  const { data: l } = await db.from("sales_leads").insert({ workspace_id: wsId, lead_key: "test:direct@client-test.example", name: "Direct", email: "direct@client-test.example", source: "manual" }).select("id").single();
  const { data: d } = await db.from("outreach_messages").insert({ workspace_id: wsId, created_by: userId, lead_id: l!.id, channel: "email", direction: "outbound", status: "draft", to_email: "direct@client-test.example", subject: "Re: hi", body: "Sure.", language: "en" }).select("id").single();
  const n0 = testOutbox().length;
  assert.ok((await sendMessageNow(wsId, userId, d!.id)).ok, "sent now");
  assert.equal(testOutbox().length, n0 + 1);
  console.log("✓ the member's reply goes at once");

  console.log("\nAll sending-rules checks passed.");
} finally {
  // The workspace and its campaigns go too, so later runs don't share the worker with them.
  if (wsId) await db.from("workspaces").delete().eq("id", wsId);
  for (const id of users) await db.auth.admin.deleteUser(id).catch(() => {});
}
