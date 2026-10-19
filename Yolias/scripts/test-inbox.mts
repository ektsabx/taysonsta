// Sending from the Outreach page and the Inbox, and Inbox labels (D-239),
// against the local Supabase with the local test mailbox — nothing leaves
// this machine:
//   npm run test:inbox
// Covers: no mailbox → nothing sent; a draft sent from the member's mailbox
// (status, sender, activity); a reply continues the same thread; replies are
// read and labelled (interested / not interested) and the label can be
// changed; do-not-contact and the daily limit are honoured.
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.ts";
process.env.YOLIAS_TEST_MAILBOX = "1";
(await import("@/lib/integrations.ts")).setIntegrationsForTests({});
const { saveMailbox } = await import("@/lib/mailbox/index.ts");
const { testOutbox, pushTestReply } = await import("@/lib/mailbox/test-provider.ts");
const { sendMessageNow, syncReplies } = await import("@/lib/outreach/execute.ts");
const { labelFor } = await import("@/lib/agents/replies.ts");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
assert.match(url, /127\.0\.0\.1|localhost/, "local database only");
const db = createClient<Database>(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const users: string[] = [];

async function member(tag: string) {
  const email = `inbox-${tag}-${Date.now()}@yolias.local`;
  const { data, error } = await db.auth.admin.createUser({ email, email_confirm: true });
  if (error) throw error;
  users.push(data.user.id);
  const { data: p } = await db.from("profiles").select("workspace_id").eq("id", data.user.id).single();
  return { userId: data.user.id, wsId: p!.workspace_id! };
}
async function lead(wsId: string, name: string, email: string) {
  const { data, error } = await db.from("sales_leads").insert({ workspace_id: wsId, lead_key: `test:${email}`, name, email, source: "manual" }).select("id").single();
  if (error) throw error;
  return data.id;
}
async function draft(wsId: string, userId: string, leadId: string, to: string, subject: string, body: string) {
  const { data, error } = await db.from("outreach_messages").insert({ workspace_id: wsId, created_by: userId, lead_id: leadId, channel: "email", direction: "outbound", status: "draft", to_email: to, subject, body, language: "en" }).select("id").single();
  if (error) throw error;
  return data.id;
}
const msg = async (id: string) => (await db.from("outreach_messages").select("*").eq("id", id).single()).data!;

try {
  const A = await member("a");
  const omar = await lead(A.wsId, "Omar Khaled", "omar@client-test.example");
  const first = await draft(A.wsId, A.userId, omar, "omar@client-test.example", "Fleet tracking for Client Co", "Hi Omar, a short idea.");

  // No mailbox: nothing is sent.
  const none = await sendMessageNow(A.wsId, A.userId, first);
  assert.ok(!none.ok && none.error === "no_mailbox");
  assert.equal((await msg(first)).status, "draft");
  assert.equal(testOutbox().length, 0);

  // Connected: sent from the member's mailbox.
  await saveMailbox({ workspaceId: A.wsId, userId: A.userId, provider: "test", email: "sara@acme-test.example", displayName: "Sara", canRead: true, refreshToken: "test" });
  const sent = await sendMessageNow(A.wsId, A.userId, first);
  assert.ok(sent.ok, JSON.stringify(sent));
  const m1 = await msg(first);
  assert.equal(m1.status, "sent"); assert.equal(m1.from_address, "sara@acme-test.example"); assert.equal(m1.sent_via, "mailbox"); assert.equal(m1.approved_by, A.userId);
  assert.ok(m1.provider_thread_id);
  assert.equal(testOutbox().at(-1)!.to, "omar@client-test.example");
  assert.ok((await db.from("lead_activities").select("id").eq("lead_id", omar).eq("kind", "message_sent")).data!.length >= 1, "activity logged");
  const again = await sendMessageNow(A.wsId, A.userId, first);
  assert.ok(!again.ok && again.error === "not_draft", "never sent twice");

  // A reply from the Inbox continues the same thread.
  const reply = await draft(A.wsId, A.userId, omar, "omar@client-test.example", "", "Thanks, here are the details.");
  assert.ok((await sendMessageNow(A.wsId, A.userId, reply)).ok);
  const m2 = await msg(reply);
  assert.equal(m2.provider_thread_id, m1.provider_thread_id, "same thread");
  assert.equal(m2.subject, "Re: Fleet tracking for Client Co");

  // Replies are read and labelled.
  pushTestReply({ threadId: m1.provider_thread_id!, from: "omar@client-test.example", fromName: "Omar", subject: "Re: Fleet tracking", body: "Please remove me from your list." });
  await syncReplies(10, true);
  const { data: inbound } = await db.from("outreach_messages").select("id, analysis").eq("lead_id", omar).eq("direction", "inbound");
  assert.equal(inbound!.length, 1);
  const { data: thread } = await db.from("inbox_threads").select("label").eq("lead_id", omar).single();
  assert.equal(thread!.label, "not_interested", "a stop request is labelled not interested");
  assert.equal((await db.from("sales_leads").select("do_not_contact").eq("id", omar).single()).data!.do_not_contact, true);
  assert.equal(labelFor("interested"), "interested"); assert.equal(labelFor("meeting_request"), "interested");
  assert.equal(labelFor("question"), "follow_up"); assert.equal(labelFor("not_interested"), "not_interested");

  // Do not contact: no more emails.
  const blocked = await draft(A.wsId, A.userId, omar, "omar@client-test.example", "", "One more thing.");
  const r = await sendMessageNow(A.wsId, A.userId, blocked);
  assert.ok(!r.ok && r.error === "do_not_contact");

  // Daily limit.
  const lina = await lead(A.wsId, "Lina Haddad", "lina@client-test.example");
  await db.from("mailboxes").update({ daily_limit: 1, sent_day: new Date().toISOString().slice(0, 10), sent_today: 1 }).eq("workspace_id", A.wsId);
  const limited = await sendMessageNow(A.wsId, A.userId, await draft(A.wsId, A.userId, lina, "lina@client-test.example", "Hello", "Hi Lina."));
  assert.ok(!limited.ok && limited.error === "daily_limit");

  // Another workspace can't send this workspace's messages.
  const B = await member("b");
  await saveMailbox({ workspaceId: B.wsId, userId: B.userId, provider: "test", email: "b@other-test.example", displayName: null, canRead: true, refreshToken: "test" });
  const foreign = await sendMessageNow(B.wsId, B.userId, await draft(A.wsId, A.userId, lina, "lina@client-test.example", "Hi", "x"));
  assert.ok(!foreign.ok && foreign.error === "not_found");

  console.log("✓ inbox: no mailbox refused, send from mailbox, never twice, reply in the same thread, replies labelled, do-not-contact, daily limit, workspace isolation");
} finally {
  for (const id of users) {
    const { data: p } = await db.from("profiles").select("workspace_id").eq("id", id).maybeSingle();
    if (p?.workspace_id) await db.from("workspaces").delete().eq("id", p.workspace_id);
    await db.auth.admin.deleteUser(id).catch(() => {});
  }
}
