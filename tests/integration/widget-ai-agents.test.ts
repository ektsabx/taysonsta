// Master upgrade Phase 8 (docs/bos/30 §10.5–10.6; doc 31): website widget
// sessions + messages, origin allow-list, AI agent answers from the KB with
// sources, hand-off rules, visitor isolation, human takeover, access.
// The AI provider is stubbed (no keys in tests; nothing leaves the machine).
import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { db } from "@/lib/bos/db";
import { bosUserFor, uniq } from "@/tests/integration/helpers";
import { originOk, postVisitorMessage, saveWidget, sessionFor, startSession, visitorMessages, widgetByKey, type Widget } from "@/services/bos/widgets";
import { agentRespond, saveAgent, testAgent, type Generate } from "@/services/bos/ai-agents";
import { createArticle } from "@/services/bos/knowledge";
import { replyToConversation } from "@/services/bos/conversations";
import type { AiRequest } from "@/services/bos/ai";
import { ForbiddenError, ValidationError } from "@/lib/bos/errors";

const cleanup: (() => PromiseLike<unknown>)[] = [];
after(async () => {
  for (const fn of cleanup.reverse()) await Promise.resolve(fn()).catch((e) => console.error("cleanup", e));
});

const word = uniq("zorblax").replace(/[^a-z0-9]/g, "");
let widget: Widget;
let agentId: string;
let articleSlug: string;
const prompts: AiRequest[] = [];

const answer = (o: object): Generate => async (req) => {
  prompts.push(req);
  return { ok: true, text: JSON.stringify(o), provider: "anthropic", model: "stub", inputTokens: 10, outputTokens: 10, costUsd: 0, fallbackFrom: [] };
};

async function trackSessionCleanup(widgetId: string) {
  cleanup.push(async () => {
    const c = db();
    const { data: ss } = await c.from("widget_sessions").select("customer_id, conversation_id").eq("widget_id", widgetId);
    await c.from("widget_sessions").delete().eq("widget_id", widgetId);
    const convIds = (ss ?? []).map((s) => s.conversation_id).filter(Boolean) as string[];
    const custIds = [...new Set((ss ?? []).map((s) => s.customer_id).filter(Boolean) as string[])];
    if (convIds.length) await c.from("conversations").delete().in("id", convIds);
    if (custIds.length) {
      await c.from("conversations").delete().in("customer_id", custIds);
      await c.from("support_customers").delete().in("id", custIds);
    }
  });
}

before(async () => {
  const admin = await bosUserFor("admin@taysonsta.local");
  const { data: cat } = await db().from("kb_categories").select("id").limit(1).single();
  await assert.rejects(
    createArticle(admin, { kind: "article", title: "x", slug: null, content: "x", category_id: cat!.id, tags: [], owner_id: null, allowed_role_ids: null, playbook_section: null, required_documents: null, status: "draft", ai_allowed: true, audience: "internal" }),
    ValidationError,
    "AI-allowed articles must be public",
  );
  const a = await createArticle(admin, { kind: "article", title: `How to configure ${word}`, slug: null, content: `To configure ${word}, open Settings and press Save.`, category_id: cat!.id, tags: [], owner_id: null, allowed_role_ids: null, playbook_section: null, required_documents: null, status: "published", language: "en", audience: "public", ai_allowed: true });
  articleSlug = a.slug;
  cleanup.push(async () => {
    await db().from("kb_article_versions").delete().eq("article_id", a.id);
    await db().from("kb_articles").delete().eq("id", a.id);
  });
  agentId = await saveAgent(admin, null, { name: uniq("Agent"), persona: null, tone: "concise", language: "auto", instructions: null, kb_category_ids: [], provider: null, max_ai_turns: 3, min_confidence: 0.6, handoff_keywords: ["human"], sensitive_keywords: ["refund"], handoff_message: "Transferring you.", fallback_message: "Not sure — a colleague will help.", monthly_cost_limit_usd: 0, is_active: true });
  cleanup.push(() => db().from("ai_agents").delete().eq("id", agentId));
  const wid = await saveWidget(admin, null, { name: uniq("Widget"), is_active: true, allowed_domains: ["shop.example.com"], title: "Help", welcome_message: "Hi", offline_message: "Offline", primary_color: "#112233", position: "right", bottom_offset: 20, language: "en", require_email: true, working_hours: {}, ai_agent_id: agentId, team_id: null, branch_id: null });
  cleanup.push(() => db().from("support_widgets").delete().eq("id", wid));
  await trackSessionCleanup(wid);
  const { data: w } = await db().from("support_widgets").select("*").eq("id", wid).single();
  widget = w!;
});

test("widget key + origin allow-list + hashed session token", async () => {
  assert.ok(await widgetByKey(widget.public_key));
  assert.equal(await widgetByKey("not-a-key"), null);
  assert.equal(originOk(widget, "https://shop.example.com"), true);
  assert.equal(originOk(widget, "https://evil.com"), false);
  const token = await startSession(widget, { origin: "https://shop.example.com", pageUrl: "https://shop.example.com/p" });
  const s = await sessionFor(widget, token);
  assert.ok(s);
  assert.notEqual(s!.token_hash, token, "only the hash is stored");
  assert.equal(await sessionFor(widget, "f".repeat(64)), null);
  await assert.rejects(postVisitorMessage(widget, s!, { body: "hello" }), ValidationError, "email required");
});

test("AI answers from the KB with sources; visitor never sees internal notes; hand-off on request", async () => {
  const email = `${uniq("v").toLowerCase()}@example.com`;
  const s = (await sessionFor(widget, await startSession(widget, { origin: "https://shop.example.com" })))!;
  const r = await postVisitorMessage(widget, s, { body: `How do I configure ${word}?`, email, name: "Visitor" });
  assert.equal(r.aiShouldRespond, true);
  const { data: conv } = await db().from("conversations").select("assignee_id, ai_active, widget_id, channel").eq("id", r.conversationId).single();
  assert.equal(conv!.assignee_id, null, "not assigned while the AI answers");
  assert.equal(conv!.channel, "web_widget");

  const d = await agentRespond(r.conversationId, { generate: answer({ answer: "Open Settings and press Save.", confidence: 0.9, needs_human: false, sources: [articleSlug] }) });
  assert.equal(d?.kind, "answer");
  const req = prompts.at(-1)!;
  assert.ok(req.prompt.includes(word) && req.prompt.includes("<kb>"), "KB article sent as context");
  assert.equal(req.feature, `support.agent.${agentId}`);
  const { data: aiMsg } = await db().from("conversation_messages").select("ai_sources, author_kind").eq("conversation_id", r.conversationId).eq("author_kind", "ai").single();
  assert.equal((aiMsg!.ai_sources as { sources: { slug: string }[] }).sources[0].slug, articleSlug);
  assert.equal(await agentRespond(r.conversationId, { generate: answer({}) }), null, "no double answer");

  const s2 = (await db().from("widget_sessions").select("*").eq("id", s.id).single()).data!;
  await postVisitorMessage(widget, s2, { body: "I want a human please" });
  const h = await agentRespond(r.conversationId, { generate: answer({ answer: "x", confidence: 1 }) });
  assert.equal(h?.kind, "handoff");
  assert.equal((h as { reason: string }).reason, "requested");
  const { data: after1 } = await db().from("conversations").select("ai_active, handed_off_at").eq("id", r.conversationId).single();
  assert.equal(after1!.ai_active, false);
  assert.ok(after1!.handed_off_at);
  const { count: internal } = await db().from("conversation_messages").select("id", { count: "exact", head: true }).eq("conversation_id", r.conversationId).eq("direction", "internal");
  assert.equal(internal, 1, "summary for the agent");
  const seen = await visitorMessages(s2);
  assert.deepEqual(seen.messages.map((m) => m.from), ["me", "ai", "me", "ai"]);
  assert.ok(!seen.messages.some((m) => m.body.startsWith("🤖")), "internal summary hidden");

  // Another visitor typing the same email gets a fresh thread, not this history.
  const intruder = (await sessionFor(widget, await startSession(widget, { origin: "https://shop.example.com" })))!;
  const r2 = await postVisitorMessage(widget, intruder, { body: "hello", email });
  assert.notEqual(r2.conversationId, r.conversationId);
  const iSeen = await visitorMessages((await db().from("widget_sessions").select("*").eq("id", intruder.id).single()).data!);
  assert.equal(iSeen.messages.length, 1);
});

test("hand-off rules: sensitive topic, no knowledge, low confidence; human reply takes over", async () => {
  const mk = async (body: string) => {
    const s = (await sessionFor(widget, await startSession(widget, { origin: "https://shop.example.com" })))!;
    return postVisitorMessage(widget, s, { body, email: `${uniq("h").toLowerCase()}@example.com` });
  };
  const calls = prompts.length;
  const a = await mk(`I need a refund for ${word}`);
  assert.equal((await agentRespond(a.conversationId, { generate: answer({}) }) as { reason: string }).reason, "sensitive");
  const b = await mk("qwertyuiop asdfghjkl");
  assert.equal((await agentRespond(b.conversationId, { generate: answer({}) }) as { reason: string }).reason, "no_knowledge");
  assert.equal(prompts.length, calls, "model not called for rule-based hand-offs");
  const c = await mk(`configure ${word} on mobile?`);
  assert.equal((await agentRespond(c.conversationId, { generate: answer({ answer: "maybe", confidence: 0.2, needs_human: false, sources: [] }) }) as { reason: string }).reason, "low_confidence");

  const d = await mk(`configure ${word}`);
  const support = await bosUserFor("support@taysonsta.local");
  await replyToConversation(support, d.conversationId, "Hi, I'm here to help.", { internal: false });
  const { data: dc } = await db().from("conversations").select("ai_active").eq("id", d.conversationId).single();
  assert.equal(dc!.ai_active, false, "human reply stops the AI");
  assert.equal(await agentRespond(d.conversationId, { generate: answer({}) }), null);
});

test("test console needs conversations.manage; returns the same decision", async () => {
  const [admin, sara] = await Promise.all([bosUserFor("admin@taysonsta.local"), bosUserFor("sara@taysonsta.local")]);
  await assert.rejects(testAgent(sara, agentId, "hi"), ForbiddenError);
  const d = await testAgent(admin, agentId, `configure ${word}`, { generate: answer({ answer: "Press Save.", confidence: 0.8, needs_human: false, sources: [articleSlug] }) });
  assert.equal(d.kind, "answer");
  const n = await db().from("conversation_messages").select("id", { count: "exact", head: true }).eq("body", "Press Save.");
  assert.equal(n.count, 0, "nothing stored");
});
