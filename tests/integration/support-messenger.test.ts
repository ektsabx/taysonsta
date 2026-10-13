// Support messenger (D-180): a visitor's conversations (several, created on
// first message only), signed identity of a site's signed-in user (forged or
// expired signatures refused; conversations follow the account across
// sessions; a signed-out or different visitor never sees them), staff
// identity and photo consent, "talk to a person" hand-off, ratings once per
// resolution, and ratings report.
import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { db } from "@/lib/bos/db";
import { bosUserFor, uniq } from "@/tests/integration/helpers";
import {
  agentPhoto, postVisitorMessage, rateConversation, requestHuman, resolveSession, saveWidget, sessionFor, startSession, verifyIdentity,
  visitorConversations, visitorMessages, type Widget,
} from "@/services/bos/widgets";
import { replyToConversation, setConversationStatus } from "@/services/bos/conversations";
import { saveAgent } from "@/services/bos/ai-agents";
import { encryptSecrets } from "@/lib/bos/secrets";
import { ratingsReport, saveAgentProfile } from "@/services/bos/support-ratings";
import { ValidationError } from "@/lib/bos/errors";

const cleanup: (() => PromiseLike<unknown>)[] = [];
after(async () => {
  for (const fn of cleanup.reverse()) await Promise.resolve(fn()).catch((e) => console.error("cleanup", e));
});

const SECRET = "test-identity-secret-" + "a".repeat(20);
let widget: Widget;
const origin = { origin: "https://shop.example.com" };

function sign(payload: object, secret = SECRET) {
  const p = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${p}.${createHmac("sha256", secret).update(p).digest("base64url")}`;
}
const fresh = async (token: string) => (await sessionFor(widget, token))!;

before(async () => {
  const admin = await bosUserFor("admin@taysonsta.local");
  const agentId = await saveAgent(admin, null, { name: uniq("Agent"), persona: null, tone: "concise", language: "auto", instructions: null, kb_category_ids: [], provider: null, max_ai_turns: 3, min_confidence: 0.6, handoff_keywords: [], sensitive_keywords: [], handoff_message: "A teammate will take it from here.", fallback_message: "x", monthly_cost_limit_usd: 0, is_active: true });
  cleanup.push(() => db().from("ai_agents").delete().eq("id", agentId));
  const wid = await saveWidget(admin, null, { name: uniq("Messenger"), is_active: true, on_yolias: false, allowed_domains: ["shop.example.com"], title: "Help", welcome_message: "Hi", offline_message: "Off", primary_color: "#112233", position: "right", bottom_offset: 20, language: "en", require_email: false, working_hours: {}, ai_agent_id: agentId, team_id: null, ratings_enabled: true, show_agent_photos: true, help_enabled: true });
  await db().from("support_widgets").update({ identity_secret_enc: await encryptSecrets({ identity: SECRET }) }).eq("id", wid);
  cleanup.push(async () => {
    const c = db();
    const { data: convs } = await c.from("bos_conversations").select("id, customer_id").eq("widget_id", wid);
    await c.from("widget_sessions").delete().eq("widget_id", wid);
    if (convs?.length) await c.from("bos_conversations").delete().in("id", convs.map((x) => x.id));
    await c.from("support_widgets").delete().eq("id", wid);
  });
  widget = (await db().from("support_widgets").select("*").eq("id", wid).single()).data!;
});

test("identity: only a valid, recent signature from the site's server counts", async () => {
  const uid = randomUUID();
  const now = Math.floor(Date.now() / 1000);
  assert.deepEqual(await verifyIdentity(widget, sign({ u: uid, e: "a@b.co", n: "Ann", t: now })), { userId: uid, email: "a@b.co", name: "Ann" });
  assert.equal(await verifyIdentity(widget, sign({ u: uid, t: now }, "wrong-secret")), null, "forged");
  assert.equal(await verifyIdentity(widget, sign({ u: uid, t: now - 3600 })), null, "expired");
  assert.equal(await verifyIdentity(widget, sign({ u: "not-a-uuid", t: now })), null);
  const [p] = sign({ u: uid, t: now }).split(".");
  const other = sign({ u: randomUUID(), t: now }).split(".")[1];
  assert.equal(await verifyIdentity(widget, `${p}.${other}`), null, "signature of another payload");
  assert.equal(await verifyIdentity(widget, null), null);
});

test("conversations: created on first message, several per visitor, never visible to others", async () => {
  const a = await fresh(await startSession(widget, origin));
  assert.deepEqual((await visitorConversations(widget, a)).conversations, [], "opening the messenger creates nothing");
  const c1 = await postVisitorMessage(widget, a, { body: "First question" });
  const second = await postVisitorMessage(widget, (await db().from("widget_sessions").select("*").eq("id", a.id).single()).data!, { body: "A new topic" });
  assert.notEqual(second.conversationId, c1.conversationId, "a new conversation without an id");
  const same = await postVisitorMessage(widget, (await db().from("widget_sessions").select("*").eq("id", a.id).single()).data!, { body: "More on the first", conversationId: c1.conversationId });
  assert.equal(same.conversationId, c1.conversationId, "continues the chosen one");
  const list = await visitorConversations(widget, a);
  assert.equal(list.conversations.length, 2);
  const b = await fresh(await startSession(widget, origin));
  assert.equal((await visitorConversations(widget, b)).conversations.length, 0, "another visitor sees none");
  assert.equal((await visitorMessages(widget, b, c1.conversationId)).messages.length, 0);
  await assert.rejects(postVisitorMessage(widget, b, { body: "hi", conversationId: c1.conversationId }), ValidationError);
});

test("account identity: conversations follow the user; signed out or someone else can't see them", async () => {
  const uid = randomUUID();
  const id = { userId: uid, email: `${uniq("msgr")}@example.com`.toLowerCase(), name: "Sam User" };
  // Started anonymously, then signed in: the session joins the account.
  const anon = await fresh(await startSession(widget, origin));
  const r = await postVisitorMessage(widget, anon, { body: "Before signing in" });
  const joined = (await resolveSession(anon, id))!;
  assert.equal(joined.visitor_key, `yolias:${uid}`);
  // Another device of the same user sees it.
  const other = (await resolveSession(await fresh(await startSession(widget, origin, id)), id))!;
  assert.deepEqual((await visitorConversations(widget, other)).conversations.map((c) => c.id), [r.conversationId]);
  // Signed out on that browser, or a different account: the session is refused.
  assert.equal(await resolveSession(joined, null), null);
  assert.equal(await resolveSession(joined, { userId: randomUUID(), email: null, name: null }), null);
});

test("who answers, hand-off on request, photo consent, ratings once per resolution", async () => {
  const admin = await bosUserFor("admin@taysonsta.local");
  const s = await fresh(await startSession(widget, origin));
  const r = await postVisitorMessage(widget, s, { body: "Can a person help?" });
  assert.equal(r.aiShouldRespond, true);
  const before = await visitorMessages(widget, s, r.conversationId);
  assert.equal(before.ai, true); assert.equal(before.canRate, false);
  // "Talk to a person".
  await requestHuman(widget, s, r.conversationId);
  const waiting = await visitorMessages(widget, s, r.conversationId);
  assert.equal(waiting.ai, false); assert.equal(waiting.waitingHuman, true);
  assert.equal(waiting.messages.at(-1)!.author.kind, "ai", "the agent's hand-off message, labelled as AI");
  // A person replies: their name, no photo until they allow it.
  await saveAgentProfile(admin, { displayName: "Sara from Support", showPhoto: false });
  await replyToConversation(admin, r.conversationId, "Hi, I'm here.", { internal: false });
  await replyToConversation(admin, r.conversationId, "Internal: check billing", { internal: true });
  const seen = await visitorMessages(widget, s, r.conversationId);
  const human = seen.messages.at(-1)!;
  assert.equal(human.author.kind, "agent"); assert.equal(human.author.name, "Sara from Support"); assert.equal(human.author.photo, null);
  assert.ok(!seen.messages.some((m) => m.body.startsWith("Internal")), "internal notes never reach the visitor");
  assert.equal(seen.waitingHuman, false);
  assert.equal(await agentPhoto(widget, s, human.id), null, "no consent → no photo");
  // Not before it's resolved; once after; again only if reopened and resolved again.
  await assert.rejects(rateConversation(widget, s, r.conversationId, 5, null), ValidationError);
  await setConversationStatus(admin, r.conversationId, "resolved");
  const done = await visitorMessages(widget, s, r.conversationId);
  assert.equal(done.status, "resolved"); assert.equal(done.canRate, true);
  await assert.rejects(rateConversation(widget, s, r.conversationId, 6, null), ValidationError);
  assert.deepEqual(await rateConversation(widget, s, r.conversationId, 4, "Quick and clear"), { ok: true, duplicate: false });
  assert.deepEqual(await rateConversation(widget, s, r.conversationId, 1, null), { ok: true, duplicate: true }, "a second rating is ignored");
  const { data: rating } = await db().from("support_ratings").select("rating, responder_kind, agent_user_id").eq("conversation_id", r.conversationId);
  assert.deepEqual(rating, [{ rating: 4, responder_kind: "human", agent_user_id: admin.userId }]);
  assert.equal((await visitorMessages(widget, s, r.conversationId)).canRate, false);
  const rep = await ratingsReport({ days: 1, responder: "human" });
  assert.ok(rep.total >= 1 && rep.human.count >= 1 && rep.average !== null);
  // Another visitor can't rate or hand off this conversation.
  const intruder = await fresh(await startSession(widget, origin));
  await assert.rejects(rateConversation(widget, intruder, r.conversationId, 5, null), ValidationError);
  await assert.rejects(requestHuman(widget, intruder, r.conversationId), ValidationError);
  await saveAgentProfile(admin, { displayName: "", showPhoto: false });
});
