import "server-only";
import { db, type Tables } from "@/lib/bos/db";
import { can, type BosUser } from "@/lib/bos/auth";
import { audit } from "@/lib/bos/audit";
import { emitEvent } from "@/lib/bos/events";
import { nowIso } from "@/lib/bos/clock";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/bos/errors";
import { aiGenerate, parseAiJson, type AiRequest, type AiResult } from "@/services/bos/ai";
import { addMessage, pickAgent, type Conversation } from "@/services/bos/conversations";
import { buildAgentPrompt, detectLanguage, matchesKeyword, toOrQuery, type AgentPromptConfig, type KbSnippet } from "@/lib/bos/ai-agent-prompt";
import type { AiProvider } from "@/lib/bos/integrations/catalog";

// AI support agents (docs/bos/30 §10.6, doc 31 Phase 8). An agent answers
// widget conversations ONLY from knowledge-base articles that are published,
// public and marked "AI allowed"; it hands off to a human when asked, on
// sensitive topics, on low confidence, after its turn limit, when no article
// matches, or when its monthly cost limit / the AI budget is reached.
// Nothing is sent to the model except the KB snippets and this conversation.

export type AiAgent = Tables<"ai_agents">;
export type Generate = (req: AiRequest) => Promise<AiResult>;

export interface AgentInput {
  name: string;
  persona: string | null;
  tone: "friendly" | "formal" | "concise";
  language: "auto" | "ar" | "en";
  instructions: string | null;
  kb_category_ids: string[];
  provider: AiProvider | null;
  max_ai_turns: number;
  min_confidence: number;
  handoff_keywords: string[];
  sensitive_keywords: string[];
  handoff_message: string;
  fallback_message: string;
  monthly_cost_limit_usd: number;
  is_active: boolean;
}

function assertManage(bos: BosUser) {
  if (!can(bos, "conversations.manage") && !bos.isSuperAdmin) throw new ForbiddenError();
}

export async function listAgents() {
  const { data } = await db().from("ai_agents").select("*").order("name");
  return data ?? [];
}

export async function getAgent(id: string) {
  const { data } = await db().from("ai_agents").select("*").eq("id", id).maybeSingle();
  if (!data) throw new NotFoundError();
  return data;
}

export async function saveAgent(bos: BosUser, id: string | null, input: AgentInput) {
  assertManage(bos);
  if (!input.name.trim()) throw new ValidationError("الاسم مطلوب.", { name: "مطلوب" });
  if (!input.handoff_message.trim() || !input.fallback_message.trim()) throw new ValidationError("رسائل التحويل مطلوبة.");
  if ((input.instructions ?? "").length > 8000 || (input.persona ?? "").length > 2000) throw new ValidationError("التعليمات طويلة جداً.");
  const row = { ...input, name: input.name.trim(), handoff_keywords: clean(input.handoff_keywords), sensitive_keywords: clean(input.sensitive_keywords) };
  if (id) {
    const { error } = await db().from("ai_agents").update(row).eq("id", id);
    if (error) throw dup(error);
    await audit({ actorId: bos.userId, action: "ai_agent.updated", entityType: "ai_agent", entityId: id, newValue: { name: row.name, is_active: row.is_active, provider: row.provider } });
    return id;
  }
  const { data, error } = await db().from("ai_agents").insert({ ...row, created_by: bos.userId }).select("id").single();
  if (error) throw dup(error);
  await audit({ actorId: bos.userId, action: "ai_agent.created", entityType: "ai_agent", entityId: data.id, newValue: { name: row.name } });
  return data.id;
}

const clean = (a: string[]) => [...new Set(a.map((k) => k.trim().toLowerCase()).filter(Boolean))].slice(0, 60);
const dup = (e: { code?: string }) => (e.code === "23505" ? new ValidationError("يوجد وكيل بنفس الاسم.", { name: "مكرر" }) : e);

// ---------------------------------------------------------------------------
// Retrieval
// ---------------------------------------------------------------------------

export async function retrieveKb(agent: Pick<AiAgent, "kb_category_ids">, question: string, language: "ar" | "en", limit = 4): Promise<KbSnippet[]> {
  const q = toOrQuery(question);
  if (!q) return [];
  const run = async (lang: "ar" | "en" | null) => {
    let r = db().from("kb_articles").select("id, slug, title, content, language").eq("status", "published").eq("ai_allowed", true).eq("audience", "public").textSearch("search", q, { config: "simple" }).limit(limit);
    if (agent.kb_category_ids.length) r = r.in("category_id", agent.kb_category_ids);
    if (lang) r = r.eq("language", lang);
    const { data } = await r;
    return data ?? [];
  };
  let rows = await run(language);
  if (!rows.length) rows = await run(null); // answer from the other language rather than nothing
  return rows.map((a) => ({ id: a.id, slug: a.slug, title: a.title, content: a.content.slice(0, 6000) }));
}

export async function agentMonthSpendUsd(agentId: string) {
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const { data } = await db().from("ai_usage_log").select("cost_micros").eq("feature", `support.agent.${agentId}`).gte("created_at", start.toISOString());
  return (data ?? []).reduce((s, r) => s + Number(r.cost_micros ?? 0), 0) / 1_000_000;
}

// ---------------------------------------------------------------------------
// Decide an answer (shared by live conversations and the admin test console)
// ---------------------------------------------------------------------------

export type AgentDecision =
  | { kind: "answer"; text: string; sources: { id: string; slug: string; title: string }[]; confidence: number; provider: string }
  | { kind: "handoff"; reason: "requested" | "sensitive" | "no_knowledge" | "low_confidence" | "turn_limit" | "cost_limit" | "ai_unavailable" | "model_requested"; text: string; detail?: string };

export async function decide(agent: AiAgent, question: string, history: { role: "customer" | "agent"; text: string }[], opts: { turns: number; generate?: Generate; userId?: string | null }): Promise<AgentDecision> {
  const language = agent.language === "ar" || agent.language === "en" ? agent.language : detectLanguage(question);
  if (matchesKeyword(question, agent.handoff_keywords)) return { kind: "handoff", reason: "requested", text: agent.handoff_message };
  if (matchesKeyword(question, agent.sensitive_keywords)) return { kind: "handoff", reason: "sensitive", text: agent.handoff_message };
  if (opts.turns >= agent.max_ai_turns) return { kind: "handoff", reason: "turn_limit", text: agent.handoff_message };
  if (Number(agent.monthly_cost_limit_usd) > 0 && (await agentMonthSpendUsd(agent.id)) >= Number(agent.monthly_cost_limit_usd)) return { kind: "handoff", reason: "cost_limit", text: agent.handoff_message };

  const kb = await retrieveKb(agent, [question, ...history.filter((h) => h.role === "customer").slice(-2).map((h) => h.text)].join(" "), language);
  if (!kb.length) return { kind: "handoff", reason: "no_knowledge", text: agent.fallback_message };

  const { system, prompt } = buildAgentPrompt({ ...agent, tone: agent.tone as AgentPromptConfig["tone"] }, kb, history, question, language);
  const res = await (opts.generate ?? aiGenerate)({ feature: `support.agent.${agent.id}`, system, prompt, json: true, maxTokens: 900, temperature: 0.2, userId: opts.userId ?? null, ...(agent.provider ? { providers: [agent.provider as AiProvider] } : {}) });
  if (!res.ok) return { kind: "handoff", reason: "ai_unavailable", text: agent.handoff_message, detail: res.error };
  const out = parseAiJson<{ answer?: string; confidence?: number; needs_human?: boolean; sources?: string[] }>(res.text);
  if (!out?.answer?.trim()) return { kind: "handoff", reason: "low_confidence", text: agent.fallback_message, detail: "unparseable" };
  if (out.needs_human) return { kind: "handoff", reason: "model_requested", text: agent.handoff_message };
  const confidence = Math.max(0, Math.min(1, Number(out.confidence ?? 0)));
  if (confidence < Number(agent.min_confidence)) return { kind: "handoff", reason: "low_confidence", text: agent.fallback_message, detail: String(confidence) };
  // Only cite articles we actually gave the model.
  const cited = kb.filter((a) => (out.sources ?? []).includes(a.slug) || (out.sources ?? []).includes(a.id));
  return { kind: "answer", text: out.answer.trim().slice(0, 4000), sources: (cited.length ? cited : kb.slice(0, 1)).map((a) => ({ id: a.id, slug: a.slug, title: a.title })), confidence, provider: res.provider };
}

// ---------------------------------------------------------------------------
// Live conversation turn
// ---------------------------------------------------------------------------

const reasonText: Record<Extract<AgentDecision, { kind: "handoff" }>["reason"], string> = {
  requested: "العميل طلب التحدث إلى موظف",
  sensitive: "موضوع حساس (استرداد/قانوني/إلغاء)",
  no_knowledge: "لا يوجد مقال مناسب في قاعدة المعرفة",
  low_confidence: "ثقة المساعد منخفضة في الإجابة",
  turn_limit: "تم بلوغ الحد الأقصى لردود المساعد",
  cost_limit: "تم بلوغ حد تكلفة المساعد الشهري",
  ai_unavailable: "مزود الذكاء الاصطناعي غير متاح",
  model_requested: "المساعد طلب تدخل موظف",
};

// Answers the latest customer message of an AI-handled conversation.
// Safe to call more than once: does nothing unless the conversation is still
// AI-handled and its last message is from the customer.
export async function agentRespond(conversationId: string, opts: { generate?: Generate } = {}) {
  const c = db();
  const { data: conv } = await c.from("conversations").select("*").eq("id", conversationId).maybeSingle();
  if (!conv?.ai_active || !conv.ai_agent_id || ["resolved", "closed"].includes(conv.status)) return null;
  const { data: agent } = await c.from("ai_agents").select("*").eq("id", conv.ai_agent_id).maybeSingle();
  const { data: msgs } = await c.from("conversation_messages").select("direction, author_kind, body, created_at").eq("conversation_id", conversationId).in("direction", ["inbound", "outbound"]).order("created_at", { ascending: false }).limit(12);
  const recent = (msgs ?? []).reverse();
  const last = recent[recent.length - 1];
  if (!last || last.direction !== "inbound") return null;
  if (!agent?.is_active) return handOff(conv, "ai_unavailable", agent?.handoff_message ?? "سيرد عليك أحد أعضاء الفريق قريباً.", "agent inactive");

  const history = recent.slice(0, -1).map((m) => ({ role: m.direction === "inbound" ? ("customer" as const) : ("agent" as const), text: m.body }));
  const decision = await decide(agent, last.body, history, { turns: conv.ai_turns, generate: opts.generate });
  if (decision.kind === "handoff") return handOff(conv, decision.reason, decision.text, decision.detail);

  await addMessage(conv, { direction: "outbound", author_kind: "ai", body: decision.text, delivery_status: "sent", ai_sources: { sources: decision.sources, confidence: decision.confidence, provider: decision.provider } });
  await c.from("conversations").update({ ai_turns: conv.ai_turns + 1, last_agent_message_at: nowIso(), last_message_at: nowIso(), ...(conv.first_response_at ? {} : { first_response_at: nowIso() }) }).eq("id", conv.id);
  return decision;
}

async function handOff(conv: Conversation, reason: Extract<AgentDecision, { kind: "handoff" }>["reason"], customerText: string, detail?: string) {
  const c = db();
  const assignee = conv.assignee_id ?? (conv.team_id ? await pickAgent(conv.team_id) : null);
  await addMessage(conv, { direction: "outbound", author_kind: "ai", body: customerText, delivery_status: "sent" });
  const { data: msgs } = await c.from("conversation_messages").select("direction, body").eq("conversation_id", conv.id).eq("direction", "inbound").order("created_at", { ascending: false }).limit(3);
  const summary = `🤖 ${reasonText[reason]}${detail ? ` (${detail.slice(0, 120)})` : ""}\n` + (msgs ?? []).reverse().map((m) => `• ${m.body.slice(0, 200)}`).join("\n");
  await addMessage(conv, { direction: "internal", author_kind: "ai", body: summary });
  await c.from("conversations").update({ ai_active: false, handed_off_at: nowIso(), assignee_id: assignee, status: "open", unread_for_agent: (conv.unread_for_agent ?? 0) + 1, last_message_at: nowIso() }).eq("id", conv.id);
  await emitEvent({ type: "conversation.handed_off", entityType: "conversation", entityId: conv.id, summary: `AI hand-off ${conv.number}: ${reason}`, actorType: "system", payload: { title: conv.subject ?? conv.number, reason: reasonText[reason], assignee_user_id: assignee, team_id: conv.team_id } });
  return { kind: "handoff" as const, reason, text: customerText, assignee };
}

// Admin test console: same decision path, nothing stored except AI usage.
export async function testAgent(bos: BosUser, agentId: string, question: string, opts: { generate?: Generate } = {}) {
  assertManage(bos);
  if (!question.trim()) throw new ValidationError("اكتب سؤالاً للاختبار.");
  const agent = await getAgent(agentId);
  return decide(agent, question.trim().slice(0, 2000), [], { turns: 0, generate: opts.generate, userId: bos.userId });
}

export async function agentStats(days = 30) {
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  const { data } = await db().from("conversations").select("ai_agent_id, ai_active, handed_off_at, status").not("ai_agent_id", "is", null).gte("created_at", since);
  const by = new Map<string, { total: number; handedOff: number; resolvedByAi: number }>();
  for (const r of data ?? []) {
    const s = by.get(r.ai_agent_id!) ?? { total: 0, handedOff: 0, resolvedByAi: 0 };
    s.total++;
    if (r.handed_off_at) s.handedOff++;
    else if (["resolved", "closed"].includes(r.status)) s.resolvedByAi++;
    by.set(r.ai_agent_id!, s);
  }
  return by;
}
