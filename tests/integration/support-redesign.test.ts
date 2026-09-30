// Support redesign (docs/bos/37): spam folder on real data (move, auto-spam
// for known spammers without notifications, restore), analytics excluding
// spam with the new breakdowns, knowledge base ↔ AI agent availability.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "@/lib/bos/db";
import { bosUserFor, uniq } from "@/tests/integration/helpers";
import { listConversations, markConversationSpam, receiveInbound, restoreConversationFromSpam, supportAnalytics } from "@/services/bos/conversations";
import { listArticles, setArticleAiAllowed } from "@/services/bos/knowledge";
import { ForbiddenError, ValidationError } from "@/lib/bos/errors";

const cleanup: (() => PromiseLike<unknown>)[] = [];
after(async () => {
  for (const fn of cleanup.reverse()) await Promise.resolve(fn()).catch((e) => console.error("cleanup", e));
});

test("spam: move out of the inbox, known spammer stays in spam silently, restore returns it", async () => {
  const [admin, dev] = await Promise.all([bosUserFor("admin@taysonsta.local"), bosUserFor("youssef.dev@taysonsta.local")]);
  const email = `${uniq("spam")}@example.test`.toLowerCase();
  const first = await receiveInbound({ channel: "email", customer: { name: "Spam Bot", email }, subject: "Cheap offer", body: "Buy now" });
  const convId = first!.conversation.id;
  const customerId = first!.conversation.customer_id;
  cleanup.push(async () => { await db().from("conversations").delete().eq("customer_id", customerId); await db().from("support_customers").delete().eq("id", customerId); });

  if (!dev.permissions.get("conversations.update")) await assert.rejects(markConversationSpam(dev, convId, "x"), ForbiddenError);
  await markConversationSpam(admin, convId, "unsolicited offer");
  const inbox = await listConversations(admin, "all", { status: "all", who: "all", customer: customerId });
  assert.equal(inbox.length, 0, "hidden from every inbox view");
  const spam = await listConversations(admin, "all", { status: "all", who: "all", customer: customerId, spam: true });
  assert.equal(spam.length, 1);
  assert.equal(spam[0].spam_reason, "unsolicited offer");

  // Same customer writes again on a new thread: lands in spam, no agent alert.
  await db().from("conversations").update({ status: "closed" }).eq("id", convId);
  const started = new Date().toISOString();
  const second = await receiveInbound({ channel: "email", customer: { name: "Spam Bot", email }, subject: "Another offer", body: "Buy again" });
  assert.equal((second as { spam?: boolean }).spam, true);
  const { data: again } = await db().from("conversations").select("spam_at").eq("id", second!.conversation.id).single();
  assert.ok(again!.spam_at, "auto-flagged as spam");
  const { count: events, error: evErr } = await db().from("activity_events").select("id", { count: "exact", head: true }).eq("entity_id", second!.conversation.id).gte("occurred_at", started).eq("event_type", "conversation.customer_message");
  assert.equal(evErr, null);
  assert.equal(events, 0, "no customer-message alert for spam");

  await restoreConversationFromSpam(admin, convId);
  const back = await listConversations(admin, "all", { status: "all", who: "all", customer: customerId });
  assert.ok(back.some((c) => c.id === convId), "restored to the inbox with its status");
  const { data: sys } = await db().from("conversation_messages").select("body").eq("conversation_id", convId).eq("direction", "system").order("created_at");
  assert.deepEqual((sys ?? []).map((m) => m.body).filter((b) => b.startsWith("spam:")), ["spam:marked", "spam:restored"]);
});

test("analytics: spam excluded, new breakdowns and a daily series for custom ranges", async () => {
  const today = new Date().toISOString().slice(0, 10);
  const a = await supportAnalytics({ from: today, to: today });
  for (const k of ["byStatus", "byTeam", "byAgent", "ai", "tickets", "daily", "spam", "pending", "snoozed"]) assert.ok(k in a, k);
  assert.equal(a.daily.length, 1);
  const { count: realToday } = await db().from("conversations").select("id", { count: "exact", head: true }).is("spam_at", null).gte("created_at", `${today}T00:00:00Z`);
  assert.equal(a.total, realToday ?? 0);
});

test("knowledge base: only public articles can feed the AI agent; filters by audience", async () => {
  const admin = await bosUserFor("admin@taysonsta.local");
  const { data: art } = await db().from("kb_articles").select("id, audience, ai_allowed").eq("audience", "internal").limit(1).single();
  await assert.rejects(setArticleAiAllowed(admin, art!.id, true), ValidationError, "internal articles never reach the agent");
  await db().from("kb_articles").update({ audience: "public" }).eq("id", art!.id);
  cleanup.push(() => db().from("kb_articles").update({ audience: art!.audience, ai_allowed: art!.ai_allowed }).eq("id", art!.id));
  await setArticleAiAllowed(admin, art!.id, true);
  const pub = await listArticles(admin, { audience: "public", ai: true });
  assert.ok(pub.some((x) => x.id === art!.id));
  const internal = await listArticles(admin, { audience: "internal" });
  assert.ok(!internal.some((x) => x.id === art!.id));
});
