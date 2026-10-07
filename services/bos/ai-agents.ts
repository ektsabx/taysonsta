import "server-only";
import { lookup } from "node:dns/promises";
import { db, type Tables } from "@/lib/bos/db";
import { can, type BosUser } from "@/lib/bos/auth";
import { audit } from "@/lib/bos/audit";
import { emitEvent } from "@/lib/bos/events";
import { nowIso, nowMs } from "@/lib/bos/clock";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/bos/errors";
import { aiGenerate, parseAiJson, type AiRequest, type AiResult } from "@/services/bos/ai";
import { addMessage, pickAgent, type Conversation } from "@/services/bos/conversations";
import {
  aiShouldHandle, buildAgentPrompt, chunkText, detectLanguage, htmlToText, matchRoute, matchesKeyword, toOrQuery,
  type ActivationRules, type AgentPromptConfig, type KbSnippet, type RoutingRule, type WorkingHours,
} from "@/lib/bos/ai-agent-prompt";
import type { AiProvider } from "@/lib/bos/integrations/catalog";

// AI workforce (docs/bos/30 §10.6, docs/bos/39 §5). An agent answers the
// channels it is activated on, ONLY from its allowed knowledge (published
// public AI-enabled KB articles and its own indexed training sources), may use
// read-only customer tools it was granted, and hands off to a person — with
// the conversation context and the reason — when asked, on sensitive topics,
// low confidence, turn/cost limits, or missing knowledge. Staff replies stop
// the agent; the agent never answers after a person has replied.

export type AiAgent = Tables<"ai_agents">;
export type Generate = (req: AiRequest) => Promise<AiResult>;

export const agentChannels = ["web_widget", "messenger", "instagram", "telegram", "email"] as const;
export const agentTools = [
  { key: "crm_lookup", label: "بيانات العميل من CRM", description: "اسم العميل وحسابه وشركته — لهذا العميل فقط." },
  { key: "invoice_status", label: "حالة الفواتير", description: "أرقام فواتير العميل وحالتها ومواعيد استحقاقها (قراءة فقط)." },
  { key: "ticket_status", label: "حالة التذاكر", description: "تذاكر الدعم المفتوحة لهذا العميل وحالتها (قراءة فقط)." },
  { key: "create_ticket", label: "فتح تذكرة عند التحويل", description: "عند التحويل لموظف تُفتح تذكرة دعم مرتبطة بالمحادثة تلقائياً." },
] as const;

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
  description?: string | null;
  avatar_url?: string | null;
  purpose?: "support" | "sales" | "general";
  company_description?: string | null;
  channels?: string[];
  mode?: "ai_first" | "human_first" | "rules";
  activation_rules?: ActivationRules;
  working_hours?: WorkingHours;
  handle_reopened?: boolean;
  use_kb?: boolean;
  tools?: string[];
  routing_rules?: RoutingRule[];
  collect_fields?: string[];
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

const clean = (a: string[] | undefined) => [...new Set((a ?? []).map((k) => k.trim().toLowerCase()).filter(Boolean))].slice(0, 60);
const dup = (e: { code?: string }) => (e.code === "23505" ? new ValidationError("يوجد وكيل بنفس الاسم.", { name: "مكرر" }) : e);
const uuid = /^[0-9a-f-]{36}$/i;

function normalize(input: AgentInput) {
  if (!input.name.trim()) throw new ValidationError("الاسم مطلوب.", { name: "مطلوب" });
  if (!input.handoff_message.trim() || !input.fallback_message.trim()) throw new ValidationError("رسائل التحويل مطلوبة.");
  if ((input.instructions ?? "").length > 8000 || (input.persona ?? "").length > 2000) throw new ValidationError("التعليمات طويلة جداً.");
  if (input.avatar_url && !/^https:\/\//.test(input.avatar_url)) throw new ValidationError("رابط الصورة يجب أن يبدأ بـ https://", { avatar_url: "https" });
  const channels = input.channels ? input.channels.filter((c) => (agentChannels as readonly string[]).includes(c)) : undefined;
  const tools = input.tools ? input.tools.filter((t) => agentTools.some((x) => x.key === t)) : undefined;
  const routing = input.routing_rules?.map((r) => ({ name: (r.name ?? "").trim().slice(0, 80) || "قاعدة", keywords: clean(r.keywords), team_id: r.team_id && uuid.test(r.team_id) ? r.team_id : null })).filter((r) => r.keywords.length).slice(0, 30);
  const hours = input.working_hours ? { enabled: !!input.working_hours.enabled, tz: input.working_hours.tz || "Africa/Cairo", start: input.working_hours.start || "", end: input.working_hours.end || "", days: (input.working_hours.days ?? []).filter((d) => d >= 0 && d <= 6) } : undefined;
  if (hours?.enabled && (!/^\d{2}:\d{2}$/.test(hours.start) || !/^\d{2}:\d{2}$/.test(hours.end))) throw new ValidationError("حدد بداية ونهاية ساعات العمل (HH:MM).");
  const row: Record<string, unknown> = {
    ...input,
    name: input.name.trim(),
    handoff_keywords: clean(input.handoff_keywords),
    sensitive_keywords: clean(input.sensitive_keywords),
  };
  if (channels) row.channels = channels;
  if (tools) row.tools = tools;
  if (routing) row.routing_rules = routing;
  if (hours) row.working_hours = hours;
  if (input.activation_rules) row.activation_rules = { outside_hours_only: !!input.activation_rules.outside_hours_only, unassigned_only: !!input.activation_rules.unassigned_only, keywords: clean(input.activation_rules.keywords) };
  if (input.collect_fields) row.collect_fields = input.collect_fields.map((f) => f.trim()).filter(Boolean).slice(0, 12);
  return row;
}

export async function saveAgent(bos: BosUser, id: string | null, input: AgentInput) {
  assertManage(bos);
  const row = normalize(input);
  if (id) {
    const { error } = await db().from("ai_agents").update(row as never).eq("id", id);
    if (error) throw dup(error);
    await audit({ actorId: bos.userId, action: "ai_agent.updated", entityType: "ai_agent", entityId: id, newValue: { name: row.name, is_active: row.is_active, mode: row.mode, channels: row.channels } });
    return id;
  }
  const { data, error } = await db().from("ai_agents").insert({ ...(row as object), created_by: bos.userId } as never).select("id").single();
  if (error) throw dup(error);
  await audit({ actorId: bos.userId, action: "ai_agent.created", entityType: "ai_agent", entityId: data.id, newValue: { name: row.name } });
  return data.id;
}

// Tab forms save one section: merge into the stored agent and validate the whole.
export async function saveAgentSection(bos: BosUser, id: string, patch: Partial<AgentInput>) {
  const a = await getAgent(id);
  const current: AgentInput = {
    name: a.name, persona: a.persona, tone: a.tone as AgentInput["tone"], language: a.language as AgentInput["language"], instructions: a.instructions, kb_category_ids: a.kb_category_ids,
    provider: a.provider as AiProvider | null, max_ai_turns: a.max_ai_turns, min_confidence: Number(a.min_confidence), handoff_keywords: a.handoff_keywords, sensitive_keywords: a.sensitive_keywords,
    handoff_message: a.handoff_message, fallback_message: a.fallback_message, monthly_cost_limit_usd: Number(a.monthly_cost_limit_usd), is_active: a.is_active,
    description: a.description, avatar_url: a.avatar_url, purpose: a.purpose as AgentInput["purpose"], company_description: a.company_description, channels: a.channels, mode: a.mode as AgentInput["mode"],
    activation_rules: a.activation_rules as ActivationRules, working_hours: a.working_hours as WorkingHours, handle_reopened: a.handle_reopened, use_kb: a.use_kb, tools: a.tools,
    routing_rules: a.routing_rules as unknown as RoutingRule[], collect_fields: a.collect_fields,
  };
  return saveAgent(bos, id, { ...current, ...patch });
}

// ---------------------------------------------------------------------------
// Knowledge: KB articles + the agent's own indexed training sources
// ---------------------------------------------------------------------------

export async function retrieveKb(agent: Pick<AiAgent, "kb_category_ids"> & Partial<Pick<AiAgent, "id" | "use_kb">>, question: string, language: "ar" | "en", limit = 4): Promise<KbSnippet[]> {
  const q = toOrQuery(question);
  if (!q) return [];
  const out: KbSnippet[] = [];
  if (agent.use_kb !== false) {
    const run = async (lang: "ar" | "en" | null) => {
      let r = db().from("kb_articles").select("id, slug, title, content, language").eq("status", "published").eq("ai_allowed", true).eq("audience", "public").textSearch("search", q, { config: "simple" }).limit(limit);
      if (agent.kb_category_ids.length) r = r.in("category_id", agent.kb_category_ids);
      if (lang) r = r.eq("language", lang);
      const { data } = await r;
      return data ?? [];
    };
    let rows = await run(language);
    if (!rows.length) rows = await run(null); // answer from the other language rather than nothing
    out.push(...rows.map((a) => ({ id: a.id, slug: a.slug, title: a.title, content: a.content.slice(0, 6000) })));
  }
  if (agent.id) {
    const { data: chunks } = await db().from("ai_agent_chunks").select("id, source_id, idx, title, content").eq("agent_id", agent.id).textSearch("search", q, { config: "simple" }).limit(limit);
    out.push(...(chunks ?? []).map((c) => ({ id: String(c.id), slug: `src-${c.source_id}-${c.idx}`, title: c.title, content: c.content })));
  }
  return out.slice(0, limit * 2);
}

export async function agentMonthSpendUsd(agentId: string) {
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const { data } = await db().from("ai_usage_log").select("cost_micros").eq("feature", `support.agent.${agentId}`).gte("created_at", start.toISOString());
  return (data ?? []).reduce((s, r) => s + Number(r.cost_micros ?? 0), 0) / 1_000_000;
}

// Read-only facts about THIS customer for the tools the agent was granted.
export async function customerContextFor(tools: string[], conv: Pick<Conversation, "customer_id" | "client_id">): Promise<string | null> {
  if (!tools.some((t) => ["crm_lookup", "invoice_status", "ticket_status"].includes(t))) return null;
  const c = db();
  const { data: cust } = await c.from("support_customers").select("name, company, client_id, contact_id").eq("id", conv.customer_id).maybeSingle();
  const clientId = conv.client_id ?? cust?.client_id ?? null;
  const lines: string[] = [];
  if (tools.includes("crm_lookup") && cust) {
    const { data: client } = clientId ? await c.from("clients").select("name, company_name").eq("id", clientId).maybeSingle() : { data: null };
    lines.push(`Name: ${cust.name}${cust.company ? ` · Company: ${cust.company}` : ""}${client ? ` · Account: ${client.company_name ?? client.name}` : " · No linked account"}`);
  }
  if (tools.includes("invoice_status") && clientId) {
    const { data: inv } = await c.from("bos_invoices").select("invoice_number, status, total, currency, due_date").eq("client_id", clientId).not("status", "in", "(draft,cancelled)").order("due_date", { ascending: false }).limit(5);
    lines.push(inv?.length ? `Invoices: ${inv.map((i) => `${i.invoice_number} ${i.status} ${i.total} ${i.currency} due ${i.due_date ?? "-"}`).join("; ")}` : "Invoices: none");
  }
  if (tools.includes("ticket_status")) {
    let q = c.from("tickets").select("ticket_number, subject, status").not("status", "in", "(closed)").order("created_at", { ascending: false }).limit(5);
    q = clientId ? q.eq("client_id", clientId) : q.eq("support_customer_id", conv.customer_id);
    const { data: t } = await q;
    lines.push(t?.length ? `Open tickets: ${t.map((x) => `${x.ticket_number} "${x.subject}" ${x.status}`).join("; ")}` : "Open tickets: none");
  }
  return lines.length ? lines.join("\n") : null;
}

// ---------------------------------------------------------------------------
// Decide an answer (live conversations and the Playground share this path)
// ---------------------------------------------------------------------------

export type AgentDecision =
  | { kind: "answer"; text: string; sources: { id: string; slug: string; title: string }[]; confidence: number; provider: string }
  | { kind: "handoff"; reason: "requested" | "sensitive" | "no_knowledge" | "low_confidence" | "turn_limit" | "cost_limit" | "ai_unavailable" | "model_requested"; text: string; detail?: string };

export async function decide(agent: AiAgent, question: string, history: { role: "customer" | "agent"; text: string }[], opts: { turns: number; generate?: Generate; userId?: string | null; customerContext?: string | null }): Promise<AgentDecision> {
  const language = agent.language === "ar" || agent.language === "en" ? agent.language : detectLanguage(question);
  if (matchesKeyword(question, agent.handoff_keywords)) return { kind: "handoff", reason: "requested", text: agent.handoff_message };
  if (matchesKeyword(question, agent.sensitive_keywords)) return { kind: "handoff", reason: "sensitive", text: agent.handoff_message };
  if (opts.turns >= agent.max_ai_turns) return { kind: "handoff", reason: "turn_limit", text: agent.handoff_message };
  if (Number(agent.monthly_cost_limit_usd) > 0 && (await agentMonthSpendUsd(agent.id)) >= Number(agent.monthly_cost_limit_usd)) return { kind: "handoff", reason: "cost_limit", text: agent.handoff_message };

  const kb = await retrieveKb(agent, [question, ...history.filter((h) => h.role === "customer").slice(-2).map((h) => h.text)].join(" "), language);
  if (!kb.length && !opts.customerContext) return { kind: "handoff", reason: "no_knowledge", text: agent.fallback_message };

  const cfg: AgentPromptConfig = { name: agent.name, persona: agent.persona, tone: agent.tone as AgentPromptConfig["tone"], instructions: agent.instructions, purpose: agent.purpose as AgentPromptConfig["purpose"], company_description: agent.company_description, collect_fields: agent.collect_fields };
  const { system, prompt } = buildAgentPrompt(cfg, kb, history, question, language, opts.customerContext ?? null);
  const res = await (opts.generate ?? aiGenerate)({ feature: `support.agent.${agent.id}`, system, prompt, json: true, maxTokens: 900, temperature: 0.2, userId: opts.userId ?? null, ...(agent.provider ? { providers: [agent.provider as AiProvider] } : {}) });
  if (!res.ok) return { kind: "handoff", reason: "ai_unavailable", text: agent.handoff_message, detail: res.error };
  const out = parseAiJson<{ answer?: string; confidence?: number; needs_human?: boolean; sources?: string[] }>(res.text);
  if (!out?.answer?.trim()) return { kind: "handoff", reason: "low_confidence", text: agent.fallback_message, detail: "unparseable" };
  if (out.needs_human) return { kind: "handoff", reason: "model_requested", text: agent.handoff_message };
  const confidence = Math.max(0, Math.min(1, Number(out.confidence ?? 0)));
  if (confidence < Number(agent.min_confidence)) return { kind: "handoff", reason: "low_confidence", text: agent.fallback_message, detail: String(confidence) };
  // Only cite sources we actually gave the model.
  const cited = kb.filter((a) => (out.sources ?? []).includes(a.slug) || (out.sources ?? []).includes(a.id));
  return { kind: "answer", text: out.answer.trim().slice(0, 4000), sources: (cited.length ? cited : kb.slice(0, 1)).map((a) => ({ id: a.id, slug: a.slug, title: a.title })), confidence, provider: res.provider };
}

// ---------------------------------------------------------------------------
// Live conversation turn (every channel)
// ---------------------------------------------------------------------------

export const reasonText: Record<Extract<AgentDecision, { kind: "handoff" }>["reason"], string> = {
  requested: "العميل طلب التحدث إلى موظف",
  sensitive: "موضوع حساس (استرداد/قانوني/إلغاء)",
  no_knowledge: "لا توجد معلومة مناسبة في مصادر المعرفة",
  low_confidence: "ثقة المساعد منخفضة في الإجابة",
  turn_limit: "تم بلوغ الحد الأقصى لردود المساعد",
  cost_limit: "تم بلوغ حد تكلفة المساعد الشهري",
  ai_unavailable: "مزود الذكاء الاصطناعي غير متاح",
  model_requested: "المساعد طلب تدخل موظف",
};

async function sendAiMessage(conv: Conversation, text: string, extra: { ai_sources?: unknown } = {}) {
  let delivery: { status: "queued" | "sent" | "delivered" | "read" | "failed" | "skipped" | null; error: string | null; externalId: string | null } = { status: "sent", error: null, externalId: null };
  if (conv.channel !== "web_widget") {
    const { data: customer } = await db().from("support_customers").select("*").eq("id", conv.customer_id).single();
    const { deliverToCustomer } = await import("@/services/bos/channel-delivery");
    delivery = await deliverToCustomer(conv, customer!, text, null);
  }
  const msg = await addMessage(conv, { direction: "outbound", author_kind: "ai", body: text, delivery_status: delivery.status, delivery_error: delivery.error, external_id: delivery.externalId, ...extra });
  return msg;
}

// Answers the latest customer message of an AI-handled conversation.
// Idempotent and race-safe: nothing happens unless the conversation is still
// AI-handled, its last message is from the customer, and no person has
// replied since that message.
export async function agentRespond(conversationId: string, opts: { generate?: Generate } = {}) {
  const c = db();
  const { data: conv } = await c.from("bos_conversations").select("*").eq("id", conversationId).maybeSingle();
  if (!conv?.ai_active || !conv.ai_agent_id || conv.spam_at || ["resolved", "closed"].includes(conv.status)) return null;
  const { data: agent } = await c.from("ai_agents").select("*").eq("id", conv.ai_agent_id).maybeSingle();
  const { data: msgs } = await c.from("conversation_messages").select("direction, author_kind, body, created_at").eq("conversation_id", conversationId).in("direction", ["inbound", "outbound"]).order("created_at", { ascending: false }).limit(12);
  const recent = (msgs ?? []).reverse();
  const last = recent[recent.length - 1];
  if (!last || last.direction !== "inbound") return null;
  if (!agent?.is_active) return handOff(conv, null, "ai_unavailable", agent?.handoff_message ?? "سيرد عليك أحد أعضاء الفريق قريباً.", "agent inactive");

  const history = recent.slice(0, -1).map((m) => ({ role: m.direction === "inbound" ? ("customer" as const) : ("agent" as const), text: m.body }));
  const customerContext = await customerContextFor(agent.tools, conv);
  const decision = await decide(agent, last.body, history, { turns: conv.ai_turns, generate: opts.generate, customerContext });

  // Race guard: a person may have taken over while the model was thinking.
  const { data: fresh } = await c.from("bos_conversations").select("ai_active").eq("id", conversationId).single();
  const { count: humanSince } = await c.from("conversation_messages").select("id", { count: "exact", head: true }).eq("conversation_id", conversationId).eq("direction", "outbound").eq("author_kind", "agent").gt("created_at", last.created_at);
  if (!fresh?.ai_active || humanSince) return null;

  if (decision.kind === "handoff") return handOff(conv, agent, decision.reason, decision.text, decision.detail);
  await sendAiMessage(conv, decision.text, { ai_sources: { sources: decision.sources, confidence: decision.confidence, provider: decision.provider } });
  await c.from("bos_conversations").update({ ai_turns: conv.ai_turns + 1, last_agent_message_at: nowIso(), last_message_at: nowIso(), ...(conv.first_response_at ? {} : { first_response_at: nowIso() }) }).eq("id", conv.id);
  return decision;
}

async function handOff(conv: Conversation, agent: AiAgent | null, reason: Extract<AgentDecision, { kind: "handoff" }>["reason"], customerText: string, detail?: string) {
  const c = db();
  const { data: msgs } = await c.from("conversation_messages").select("direction, body").eq("conversation_id", conv.id).eq("direction", "inbound").order("created_at", { ascending: false }).limit(3);
  const recentText = (msgs ?? []).map((m) => m.body).join(" ");
  // Routing rules pick the team (sales / support / billing …) from what the customer asked.
  const route = agent ? matchRoute(agent.routing_rules as unknown as RoutingRule[], recentText) : null;
  const teamId = route?.team_id ?? conv.team_id;
  const assignee = conv.assignee_id ?? (teamId ? await pickAgent(teamId) : null);
  await sendAiMessage(conv, customerText);
  const summary = `🤖 ${reasonText[reason]}${detail ? ` (${detail.slice(0, 120)})` : ""}${route ? ` · ${route.name}` : ""}\n` + (msgs ?? []).reverse().map((m) => `• ${m.body.slice(0, 200)}`).join("\n");
  await addMessage(conv, { direction: "internal", author_kind: "ai", body: summary });
  await c.from("bos_conversations").update({ ai_active: false, handed_off_at: nowIso(), handoff_reason: reason, team_id: teamId, assignee_id: assignee, status: "open", unread_for_agent: (conv.unread_for_agent ?? 0) + 1, last_message_at: nowIso() }).eq("id", conv.id);
  if (agent?.tools.includes("create_ticket") && !conv.ticket_id && ["requested", "sensitive", "no_knowledge", "model_requested"].includes(reason)) {
    try {
      const { data: cust } = await c.from("support_customers").select("name, client_id, contact_id").eq("id", conv.customer_id).single();
      const { createTicket } = await import("@/services/bos/support");
      const t = await createTicket({}, { client_id: cust?.client_id ?? conv.client_id, contact_id: cust?.contact_id ?? null, category: "support", priority: "medium", subject: (conv.subject ?? `${conv.number} — ${cust?.name ?? ""}`).slice(0, 300), description: summary, assigned_to: assignee, conversation_id: conv.id, support_customer_id: conv.customer_id, team_id: teamId } as never, "internal");
      await c.from("bos_conversations").update({ ticket_id: t.id }).eq("id", conv.id);
      await addMessage(conv, { direction: "system", author_kind: "system", body: `ticket:${t.ticket_number}` });
    } catch (e) {
      await addMessage(conv, { direction: "internal", author_kind: "system", body: `تعذر فتح تذكرة تلقائياً: ${e instanceof Error ? e.message.slice(0, 160) : "خطأ"}` });
    }
  }
  await emitEvent({ type: "conversation.handed_off", entityType: "conversation", entityId: conv.id, summary: `AI hand-off ${conv.number}: ${reason}`, actorType: "system", payload: { title: conv.subject ?? conv.number, reason: reasonText[reason], assignee_user_id: assignee, team_id: teamId } });
  return { kind: "handoff" as const, reason, text: customerText, assignee };
}

// New / reopened conversations on non-widget channels: pick the agent whose
// activation matches (channel, mode, hours, rules) and let it answer. The
// widget keeps its explicit agent (services/bos/widgets.ts).
export async function routeInboundToAi(conversationId: string, ctx: { isNew: boolean; reopened: boolean; text: string }, opts: { generate?: Generate } = {}) {
  const c = db();
  const { data: conv } = await c.from("bos_conversations").select("*").eq("id", conversationId).maybeSingle();
  if (!conv || conv.channel === "web_widget" || conv.spam_at) return null;
  if (conv.ai_active && conv.ai_agent_id) return agentRespond(conversationId, opts);
  const agents = (await listAgents()).filter((a) => a.is_active);
  if (!agents.length) return null;
  const { data: sched } = await c.from("work_schedules").select("start_time, end_time, work_days, timezone").eq("is_default", true).maybeSingle();
  const companyHours: WorkingHours | null = sched ? { tz: sched.timezone, start: String(sched.start_time).slice(0, 5), end: String(sched.end_time).slice(0, 5), days: sched.work_days as number[] } : null;
  const agent = agents.find((a) => aiShouldHandle(a, { channel: conv.channel, isNew: ctx.isNew, reopened: ctx.reopened, assigned: !!conv.assignee_id, text: ctx.text, companyHours }));
  if (!agent) return null;
  await c.from("bos_conversations").update({ ai_active: true, ai_agent_id: agent.id }).eq("id", conv.id);
  await addMessage(conv, { direction: "system", author_kind: "system", body: `ai:start:${agent.name}` });
  return agentRespond(conversationId, opts);
}

// Playground: same decision path, multi-turn, nothing stored except AI usage.
export async function testAgent(bos: BosUser, agentId: string, question: string, opts: { generate?: Generate; history?: { role: "customer" | "agent"; text: string }[] } = {}) {
  assertManage(bos);
  if (!question.trim()) throw new ValidationError("اكتب سؤالاً للاختبار.");
  const agent = await getAgent(agentId);
  const history = (opts.history ?? []).slice(-10).map((h) => ({ role: h.role, text: h.text.slice(0, 2000) }));
  return decide(agent, question.trim().slice(0, 2000), history, { turns: Math.floor(history.length / 2), generate: opts.generate, userId: bos.userId });
}

export async function agentStats(days = 30) {
  const since = new Date(nowMs() - days * 86400_000).toISOString();
  const { data } = await db().from("bos_conversations").select("ai_agent_id, ai_active, handed_off_at, status").not("ai_agent_id", "is", null).gte("created_at", since);
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

// Analytics & usage tab: volume, hand-off reasons, recurring topics, cost.
const topicStop = new Set(["the", "and", "for", "you", "your", "with", "this", "that", "have", "are", "can", "hello", "thanks", "please", "في", "من", "على", "الى", "إلى", "عن", "هل", "كيف", "ما", "انا", "أنا", "ممكن", "عايز", "اريد", "أريد", "مع", "او", "أو", "السلام", "عليكم", "شكرا", "مرحبا", "لو", "بس", "ده", "دي", "هو", "هي"]);
export async function agentAnalytics(agentId: string, days = 30) {
  const since = new Date(nowMs() - days * 86400_000).toISOString();
  const c = db();
  const [{ data: convs }, { data: usage }] = await Promise.all([
    c.from("bos_conversations").select("id, channel, handed_off_at, handoff_reason, status").eq("ai_agent_id", agentId).gte("created_at", since).limit(5000),
    c.from("ai_usage_log").select("input_tokens, output_tokens, cost_micros, ok").eq("feature", `support.agent.${agentId}`).gte("created_at", since).limit(20000),
  ]);
  const rows = convs ?? [];
  const reasons = new Map<string, number>();
  const channels = new Map<string, number>();
  for (const r of rows) {
    if (r.handed_off_at) reasons.set(r.handoff_reason ?? "—", (reasons.get(r.handoff_reason ?? "—") ?? 0) + 1);
    channels.set(r.channel, (channels.get(r.channel) ?? 0) + 1);
  }
  const ids = rows.map((r) => r.id).slice(0, 500);
  const { data: firsts } = ids.length ? await c.from("conversation_messages").select("conversation_id, body").in("conversation_id", ids).eq("direction", "inbound").order("created_at").limit(2000) : { data: [] as { conversation_id: string; body: string }[] };
  const seen = new Set<string>();
  const terms = new Map<string, number>();
  for (const m of firsts ?? []) {
    if (seen.has(m.conversation_id)) continue;
    seen.add(m.conversation_id);
    for (const w of new Set(m.body.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((x) => x.length > 2 && !topicStop.has(x)))) terms.set(w, (terms.get(w) ?? 0) + 1);
  }
  const u = usage ?? [];
  return {
    total: rows.length,
    handedOff: rows.filter((r) => r.handed_off_at).length,
    resolvedByAi: rows.filter((r) => !r.handed_off_at && ["resolved", "closed"].includes(r.status)).length,
    reasons: [...reasons.entries()].map(([reason, n]) => ({ reason, n })).sort((a, b) => b.n - a.n),
    channels: [...channels.entries()].map(([channel, n]) => ({ channel, n })).sort((a, b) => b.n - a.n),
    topics: [...terms.entries()].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([term, n]) => ({ term, n })),
    usage: { calls: u.length, failed: u.filter((x) => !x.ok).length, tokens: u.reduce((s, x) => s + x.input_tokens + x.output_tokens, 0), costUsd: u.reduce((s, x) => s + Number(x.cost_micros ?? 0), 0) / 1_000_000 },
  };
}

// ---------------------------------------------------------------------------
// Training sources (Train tab)
// ---------------------------------------------------------------------------

export async function listSources(agentId: string) {
  const { data } = await db().from("ai_agent_sources").select("*").eq("agent_id", agentId).order("created_at", { ascending: false });
  return data ?? [];
}

export interface SourceInput { kind: "website" | "faq" | "file" | "text"; title?: string | null; url?: string | null; question?: string | null; answer?: string | null; content?: string | null; file_path?: string | null; file_name?: string | null; max_pages?: number }

export async function addSource(bos: BosUser, agentId: string, input: SourceInput) {
  assertManage(bos);
  await getAgent(agentId);
  const row: Record<string, unknown> = { agent_id: agentId, kind: input.kind, created_by: bos.userId, status: "pending" };
  if (input.kind === "website") {
    let u: URL;
    try { u = new URL(input.url ?? ""); } catch { throw new ValidationError("رابط غير صالح.", { url: "https://…" }); }
    if (!/^https?:$/.test(u.protocol)) throw new ValidationError("الرابط يجب أن يبدأ بـ http أو https.");
    row.url = u.toString();
    row.title = (input.title?.trim() || u.hostname).slice(0, 300);
    row.max_pages = Math.max(1, Math.min(25, input.max_pages ?? 5));
  } else if (input.kind === "faq") {
    if (!input.question?.trim() || !input.answer?.trim()) throw new ValidationError("السؤال والإجابة مطلوبان.");
    row.title = input.question.trim().slice(0, 300);
    row.question = input.question.trim().slice(0, 2000);
    row.answer = input.answer.trim().slice(0, 8000);
  } else if (input.kind === "text") {
    if (!input.content?.trim()) throw new ValidationError("النص مطلوب.");
    row.title = (input.title?.trim() || input.content.trim().slice(0, 60)).slice(0, 300);
    row.answer = input.content.trim().slice(0, 100_000);
  } else {
    if (!input.file_path || !input.file_name) throw new ValidationError("الملف مطلوب.");
    if (!/\.(pdf|csv|txt|md)$/i.test(input.file_name)) throw new ValidationError("الملفات المدعومة: PDF وCSV وTXT وMD.");
    row.title = (input.title?.trim() || input.file_name).slice(0, 300);
    row.file_path = input.file_path;
    row.file_name = input.file_name.slice(0, 200);
  }
  const { data, error } = await db().from("ai_agent_sources").insert(row as never).select("id").single();
  if (error) throw error;
  await audit({ actorId: bos.userId, action: "ai_agent.source_added", entityType: "ai_agent", entityId: agentId, newValue: { kind: input.kind, title: row.title } });
  return data.id;
}

export async function removeSource(bos: BosUser, sourceId: string) {
  assertManage(bos);
  const { data: s } = await db().from("ai_agent_sources").select("agent_id, title").eq("id", sourceId).maybeSingle();
  if (!s) throw new NotFoundError();
  await db().from("ai_agent_sources").delete().eq("id", sourceId);
  await audit({ actorId: bos.userId, action: "ai_agent.source_removed", entityType: "ai_agent", entityId: s.agent_id, oldValue: { title: s.title } });
}

// Only public internet hosts (no localhost / private networks) may be fetched.
async function assertPublicHost(url: URL) {
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) throw new Error("private host");
  const addrs = await lookup(host, { all: true });
  for (const { address } of addrs) {
    if (/^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/.test(address) || address === "::1" || /^f[cd]/i.test(address) || /^fe80/i.test(address)) throw new Error("private address");
  }
}

async function fetchPage(url: URL): Promise<{ title: string; text: string; links: string[] }> {
  await assertPublicHost(url);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: "follow", headers: { "User-Agent": "TaysonstaBOS-KnowledgeBot/1.0" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (!(res.headers.get("content-type") ?? "").includes("text/html")) throw new Error("not an HTML page");
    const html = (await res.text()).slice(0, 2_000_000);
    const { title, text } = htmlToText(html);
    const links = [...html.matchAll(/<a[^>]+href="([^"#]+)"/gi)].map((m) => { try { return new URL(m[1], url).toString(); } catch { return ""; } }).filter((h) => h.startsWith(url.origin));
    return { title, text, links };
  } finally {
    clearTimeout(timer);
  }
}

async function extractFile(path: string, name: string): Promise<string> {
  const { data, error } = await db().storage.from("bos-files").download(path);
  if (error || !data) throw new Error("file not found");
  const bytes = new Uint8Array(await data.arrayBuffer());
  if (bytes.length > 15_000_000) throw new Error("file too large (15MB max)");
  if (/\.pdf$/i.test(name)) {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: true });
    return Array.isArray(text) ? text.join("\n\n") : text;
  }
  return new TextDecoder().decode(bytes);
}

// Index (or re-sync) one source into retrievable chunks.
export async function indexSource(sourceId: string) {
  const c = db();
  const { data: s } = await c.from("ai_agent_sources").select("*").eq("id", sourceId).maybeSingle();
  if (!s) throw new NotFoundError();
  await c.from("ai_agent_sources").update({ status: "indexing", error: null }).eq("id", sourceId);
  try {
    const pieces: { title: string; url: string | null; text: string }[] = [];
    if (s.kind === "website") {
      const start = new URL(s.url!);
      const queue = [start.toString()];
      const done = new Set<string>();
      while (queue.length && done.size < s.max_pages) {
        const next = queue.shift()!;
        if (done.has(next)) continue;
        done.add(next);
        const page = await fetchPage(new URL(next)).catch((e) => { if (done.size === 1) throw e; return null; });
        if (!page) continue;
        if (page.text) pieces.push({ title: page.title || s.title, url: next, text: page.text });
        for (const l of page.links) if (!done.has(l) && !queue.includes(l) && queue.length < 100) queue.push(l);
      }
    } else if (s.kind === "faq") {
      pieces.push({ title: s.question ?? s.title, url: null, text: `Q: ${s.question}\nA: ${s.answer}` });
    } else if (s.kind === "text") {
      pieces.push({ title: s.title, url: null, text: s.answer ?? "" });
    } else {
      pieces.push({ title: s.title, url: null, text: await extractFile(s.file_path!, s.file_name!) });
    }
    const rows = pieces.flatMap((p) => chunkText(p.text).map((content) => ({ title: p.title.slice(0, 300), url: p.url, content })));
    if (!rows.length) throw new Error("لم يُعثر على نص قابل للقراءة.");
    await c.from("ai_agent_chunks").delete().eq("source_id", sourceId);
    const { error } = await c.from("ai_agent_chunks").insert(rows.slice(0, 1000).map((r, idx) => ({ source_id: sourceId, agent_id: s.agent_id, idx, ...r })));
    if (error) throw error;
    const chars = rows.reduce((n, r) => n + r.content.length, 0);
    await c.from("ai_agent_sources").update({ status: "indexed", chunks: Math.min(rows.length, 1000), chars, indexed_at: nowIso(), error: null }).eq("id", sourceId);
    return { chunks: rows.length, chars };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "indexing failed";
    await c.from("ai_agent_sources").update({ status: "failed", error: msg.slice(0, 300) }).eq("id", sourceId);
    return { error: msg };
  }
}
