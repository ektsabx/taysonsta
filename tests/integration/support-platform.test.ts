// Master upgrade Phase 7 (docs/bos/30 §10.1–10.4; doc 31): support platform
// — customer profiles, conversations, threading, idempotency, assignment,
// replies, statuses, tickets from conversations, escalation, merge, inbound
// email webhook, access.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { db } from "@/lib/bos/db";
import { bosUserFor, uniq } from "@/tests/integration/helpers";
import {
  assignConversation, createConversation, createTicketFromConversation, escalateConversation, findOrCreateCustomer, getConversation,
  mergeCustomers, receiveInbound, replyToConversation, setConversationStatus, supportAnalytics,
} from "@/services/bos/conversations";
import { saveConnection } from "@/services/bos/integrations";
import { receiveWebhook } from "@/services/bos/webhooks";
import { ForbiddenError, ValidationError } from "@/lib/bos/errors";

const cleanup: (() => PromiseLike<unknown>)[] = [];
after(async () => {
  for (const fn of cleanup.reverse()) await Promise.resolve(fn()).catch((e) => console.error("cleanup", e));
});

function trackCustomer(id: string) {
  cleanup.push(async () => {
    const c = db();
    const { data: convs } = await c.from("conversations").select("id, ticket_id").eq("customer_id", id);
    for (const v of convs ?? []) {
      if (v.ticket_id) {
        await c.from("conversations").update({ ticket_id: null }).eq("id", v.id);
        await c.from("tickets").delete().eq("id", v.ticket_id);
      }
    }
    await c.from("tickets").delete().eq("support_customer_id", id);
    await c.from("conversations").delete().eq("customer_id", id);
    await c.from("support_customers").update({ merged_into: null }).eq("merged_into", id);
    const d = await c.from("support_customers").delete().eq("id", id);
    if (d.error) throw d.error;
  });
}

test("customers: dedupe by email and phone, link to an existing CRM contact by email", async () => {
  const email = `${uniq("cust").toLowerCase()}@example.com`;
  const a = await findOrCreateCustomer({ name: "Mona", email, channel: "email" });
  trackCustomer(a.id);
  const b = await findOrCreateCustomer({ email: email.toUpperCase(), phone: "+20 100 000 0001" });
  assert.equal(b.id, a.id, "same email → same profile");
  const c = await findOrCreateCustomer({ phone: "201000000001" });
  assert.equal(c.id, a.id, "same phone (normalised) → same profile");

  const { data: ct } = await db().from("contacts").select("id, client_id, email").not("email", "is", null).is("archived_at", null).limit(1).single();
  const { data: pre } = await db().from("support_customers").select("id").eq("normalized_email", ct!.email!.toLowerCase()).is("merged_into", null).maybeSingle();
  const linked = await findOrCreateCustomer({ name: "Contact person", email: ct!.email!.toUpperCase() });
  if (!pre) trackCustomer(linked.id); // only remove what this test created
  if (pre) return; // an existing profile keeps its own links
  assert.equal(linked.contact_id, ct!.id, "linked to the CRM contact");
  assert.equal(linked.client_id, ct!.client_id);
  await assert.rejects(findOrCreateCustomer({ email: "not-an-email" }), ValidationError);
});

test("inbound email threads by [CV-…], is idempotent, reopens resolved conversations; replies and statuses", async () => {
  const support = await bosUserFor("support@taysonsta.local");
  const email = `${uniq("in").toLowerCase()}@example.com`;
  const msgId = uniq("mid");
  const first = await receiveInbound({ channel: "email", customer: { email, name: "Omar Client" }, subject: "Login issue", body: "I can't sign in", external_message_id: msgId });
  assert.ok(first && !first.duplicate);
  trackCustomer(first!.conversation.customer_id);
  const conv = first!.conversation;
  assert.match(conv.number, /^CV-\d{6}$/);
  assert.ok(conv.team_id, "default team");

  const dup = await receiveInbound({ channel: "email", customer: { email }, subject: "Login issue", body: "I can't sign in", external_message_id: msgId });
  assert.equal(dup!.duplicate, true, "same provider message id → ignored");

  // Agent replies (no email provider configured → saved, marked skipped).
  await replyToConversation(support, conv.id, "Please try resetting your password", { internal: false });
  await replyToConversation(support, conv.id, "Customer is on the legacy plan", { internal: true });
  const d1 = await getConversation(support, conv.id);
  assert.ok(d1.conversation.first_response_at, "first response recorded");
  assert.equal(d1.conversation.status, "pending_customer");
  const outbound = d1.messages.find((m) => m.direction === "outbound")!;
  assert.ok(["skipped", "sent"].includes(outbound.delivery_status ?? ""), "delivery status recorded");
  assert.ok(d1.messages.some((m) => m.direction === "internal"));

  await setConversationStatus(support, conv.id, "resolved");
  const reply = await receiveInbound({ channel: "email", customer: { email }, subject: `Re: Login issue [${conv.number}]`, body: "Still failing", external_message_id: uniq("mid2") });
  assert.equal(reply!.conversation.id, conv.id, "threaded into the same conversation");
  const d2 = await getConversation(support, conv.id);
  assert.equal(d2.conversation.status, "open", "customer reply reopens");
  assert.equal(d2.conversation.reopened_count, 1);

  await assert.rejects(setConversationStatus(support, conv.id, "snoozed", { snoozeUntil: new Date(Date.now() - 1000).toISOString() }), ValidationError, "snooze needs a future time");
  await setConversationStatus(support, conv.id, "closed");
  await assert.rejects(replyToConversation(support, conv.id, "hello", { internal: false }), ValidationError, "closed → reopen first");
});

test("manual conversation, assignment, ticket from conversation, escalation, access", async () => {
  const [support, sara, admin] = await Promise.all([bosUserFor("support@taysonsta.local"), bosUserFor("sara@taysonsta.local"), bosUserFor("admin@taysonsta.local")]);
  const conv = await createConversation(support, { customer: { name: "Phone caller", phone: `+2010${Math.floor(Math.random() * 1e8)}` }, channel: "phone", subject: "Invoice question", body: "Caller asks about invoice INV-1", priority: "normal" });
  trackCustomer(conv.customer_id);
  await assert.rejects(getConversation(sara, conv.id), ForbiddenError, "no conversations permission");

  await assignConversation(admin, conv.id, { assignee_id: support.userId });
  const t = await createTicketFromConversation(support, conv.id, {});
  assert.ok(t.ticket_number);
  const { data: tk } = await db().from("tickets").select("conversation_id, support_customer_id, description, client_id").eq("id", t.id).single();
  assert.equal(tk!.conversation_id, conv.id);
  assert.equal(tk!.support_customer_id, conv.customer_id);
  assert.ok(tk!.description.includes("INV-1"), "transcript carried to the ticket");
  await assert.rejects(createTicketFromConversation(support, conv.id, {}), ValidationError, "one ticket per conversation");

  await assert.rejects(escalateConversation(support, conv.id, " "), ValidationError);
  await escalateConversation(support, conv.id, "VIP client");
  const { data: after } = await db().from("conversations").select("priority, ticket_id").eq("id", conv.id).single();
  assert.equal(after!.priority, "high");
  assert.equal(after!.ticket_id, t.id);
});

test("merge moves conversations to the kept profile", async () => {
  const admin = await bosUserFor("admin@taysonsta.local");
  const a = await findOrCreateCustomer({ name: "Dup A", email: `${uniq("a").toLowerCase()}@example.com` });
  const b = await findOrCreateCustomer({ name: "Dup B", email: `${uniq("b").toLowerCase()}@example.com` });
  trackCustomer(b.id);
  trackCustomer(a.id);
  const conv = await receiveInbound({ channel: "email", customer: { email: a.email }, subject: "x", body: "hello" });
  const moved = await mergeCustomers(admin, a.id, b.id);
  assert.equal(moved, 1);
  const { data: v } = await db().from("conversations").select("customer_id").eq("id", conv!.conversation.id).single();
  assert.equal(v!.customer_id, b.id);
  const { data: src } = await db().from("support_customers").select("merged_into").eq("id", a.id).single();
  assert.equal(src!.merged_into, b.id);
  await assert.rejects(mergeCustomers(admin, a.id, b.id), ValidationError, "already merged");
});

test("signed inbound-email webhook opens a conversation; forged one refused", async () => {
  const admin = await bosUserFor("admin@taysonsta.local");
  const secret = uniq("inbound-secret");
  const connId = await saveConnection(admin, null, { provider: "support_email", label: uniq("Support inbox"), config: { inbound_address: "support@example.com" }, secrets: { signing_secret: secret } });
  cleanup.push(() => db().from("integration_connections").delete().eq("id", connId));
  const email = `${uniq("wh").toLowerCase()}@example.com`;
  const body = JSON.stringify({ message_id: uniq("m"), from: { email, name: "Webhook Customer" }, subject: "Need help", text: "Hello from email" });
  cleanup.push(() => db().from("webhook_events").delete().eq("provider", "support_email"));
  const sig = createHmac("sha256", secret).update(body).digest("base64");
  const ok = await receiveWebhook("support_email", new Headers({ "x-signature": sig, "x-request-id": uniq("req") }), body);
  assert.equal(ok.status, 200);
  const { data: cust } = await db().from("support_customers").select("id").eq("normalized_email", email).single();
  trackCustomer(cust!.id);
  const { count } = await db().from("conversations").select("id", { count: "exact", head: true }).eq("customer_id", cust!.id);
  assert.equal(count, 1);
  const bad = await receiveWebhook("support_email", new Headers({ "x-signature": "AAAA", "x-request-id": uniq("req") }), body);
  assert.equal(bad.status, 401);
});

test("analytics returns the overview figures", async () => {
  const a = await supportAnalytics(30);
  for (const k of ["total", "resolved", "open", "unassigned", "waitingOnUs", "byChannel", "byAgent"]) assert.ok(k in a, k);
});
