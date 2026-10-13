import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { LlmNotConfiguredError, runStructured } from "@/lib/ai/llm";
import { tasks } from "@/lib/ai/orchestrator";
import { contextText, loadAiSettings, loadBusinessContext } from "@/lib/ai-workspace/server";
import { decide, guidanceFor, type AiSettings, type Escalation } from "@/lib/ai-workspace/settings";
import { REPLY_KINDS, type ReplyKind } from "@/lib/automations/schema";
import { runAutomations } from "@/lib/automations/engine";
import { changeStage } from "@/lib/crm";
import { stopFollowUps } from "@/lib/crm/follow-ups";
import { historyFor } from "@/lib/outreach/sequence";
import { isStopRequest } from "./stop";
import { messageLanguages, isMessageLanguage } from "@/lib/outreach/channels";
import type { Database, Json, LeadStage, MessageChannel } from "@/types/database";

// Replies Agent (D-197). Yolias has no connected inbox, so a reply exists
// only when the member logs it (pasted from their email or LinkedIn).
// Then: follow-ups stop (Rules → stop on reply), a stop request always marks
// the lead do-not-contact, the agent classifies the reply and suggests the
// next stage and a reply draft, escalation rules create a task for the member,
// and the CRM stage moves only as Rules & Permissions allow.

type Db = SupabaseClient<Database>;
export const ANALYSIS_PROMPT_VERSION = "replies-2026-10-13";

const STAGES = ["interested", "meeting_booked", "meeting_completed", "closed", "lost"] as const;
const AnalysisSchema = z.object({
  kind: z.enum(REPLY_KINDS),
  summary: z.string().min(1).max(400),
  suggested_stage: z.enum(STAGES).nullable(),
  needs_human: z.boolean(),
  escalate_because: z.array(z.enum(["unclear_reply", "objection", "asks_for_human", "stop_request", "unverified_info"])).max(5),
  suggested_reply: z.string().max(2000).nullable(),
});
export type ReplyAnalysis = z.infer<typeof AnalysisSchema> & { by: "ai" | "rules" };


export interface LogReplyInput { leadId: string; body: string; channel: MessageChannel; receivedAt: string | null; from: string | null }

export async function logReply(db: Db, workspaceId: string, userId: string, input: LogReplyInput): Promise<{ ok: true; messageId: string; analysis: ReplyAnalysis | null } | { ok: false; error: "not_found" | "empty" }> {
  const body = input.body.trim().slice(0, 10000);
  if (!body) return { ok: false, error: "empty" };
  const { data: lead } = await db.from("leads").select("id, email, stage").eq("id", input.leadId).eq("workspace_id", workspaceId).maybeSingle();
  if (!lead) return { ok: false, error: "not_found" };
  const admin = createAdminClient();
  const received = input.receivedAt && !Number.isNaN(Date.parse(input.receivedAt)) && Date.parse(input.receivedAt) <= Date.now() + 60_000 ? new Date(input.receivedAt).toISOString() : new Date().toISOString();
  const { data: last } = await admin.from("outreach_messages").select("outreach_campaign_id, enrollment_id, language").eq("lead_id", lead.id).eq("direction", "outbound").eq("status", "sent").order("sent_at", { ascending: false }).limit(1).maybeSingle();
  const { data: msg, error } = await admin.from("outreach_messages").insert({
    workspace_id: workspaceId, lead_id: lead.id, created_by: userId, channel: input.channel, direction: "inbound", status: "received",
    body, from_address: input.from?.trim().slice(0, 320) || lead.email, received_at: received, sent_via: "manual", language: last?.language ?? "en",
    outreach_campaign_id: last?.outreach_campaign_id ?? null, enrollment_id: last?.enrollment_id ?? null,
  }).select("id").single();
  if (error || !msg) throw error ?? new Error("reply not saved");

  const settings = await loadAiSettings(workspaceId);
  if (settings.limits.stop_on_reply) await stopFollowUps(lead.id, "replied", "replied");
  if (isStopRequest(body)) await markDoNotContact(lead.id);

  const analysis = await analyzeReply(workspaceId, userId, msg.id, settings).catch((e) => { console.error("[replies] analysis failed", e); return null; });
  await runAutomations({ workspaceId, trigger: "reply.received", leadId: lead.id, eventKey: `message:${msg.id}`, data: { replyKind: analysis?.kind }, origin: "user" })
    .catch((e) => console.error("[automations] reply.received", e));
  return { ok: true, messageId: msg.id, analysis };
}

async function markDoNotContact(leadId: string) {
  // Opt-outs are honoured whoever recorded them (the DB stops campaigns and cancels drafts).
  await createAdminClient().from("leads").update({ do_not_contact: true }).eq("id", leadId);
}

/** Classifies one logged reply and acts within Rules & Permissions. Null when the Replies Agent is off or not allowed. */
export async function analyzeReply(workspaceId: string, userId: string, messageId: string, settings?: AiSettings): Promise<ReplyAnalysis | null> {
  const s = settings ?? (await loadAiSettings(workspaceId));
  const db = createAdminClient();
  const { data: m } = await db.from("outreach_messages").select("id, lead_id, body, direction").eq("id", messageId).eq("workspace_id", workspaceId).single();
  if (!m || m.direction !== "inbound" || !m.lead_id) return null;
  const leadId = m.lead_id;
  const d = decide(s, "replies", "analyze_replies");
  let analysis: ReplyAnalysis | null = null;
  if (d.allowed) {
    const business = await loadBusinessContext(workspaceId);
    try {
      const r = await runStructured(tasks.extraction, {
        system: [
          "You read one reply from a sales prospect and classify it for the sender's team.",
          "kind: interested | meeting_request | question | objection | not_interested | stop_request | out_of_office | asks_for_human | unclear.",
          "suggested_stage: the CRM stage this reply justifies, or null when it changes nothing (interested → interested; a request for a meeting → interested unless a time was agreed → meeting_booked; a clear no → lost; a stop request → lost).",
          "needs_human: true when a person should answer (complaints, objections, legal or pricing negotiations, unclear meaning, requests to talk to a person).",
          "escalate_because: which of unclear_reply, objection, asks_for_human, stop_request, unverified_info apply. unverified_info = they ask about facts not in the sender's company knowledge.",
          "suggested_reply: a short reply in the reply's language using only the company knowledge given, or null for stop requests and out-of-office. Never invent prices, features, results, dates or claims about competitors.",
          `Sender's company:\n${contextText(business)}`,
          guidanceFor(s, "replies"),
        ].filter(Boolean).join("\n\n"),
        parts: [{ kind: "text", text: JSON.stringify({ thread: await historyFor(leadId), reply: m.body.slice(0, 6000) }) }],
        schema: (() => { const { $schema: _d, ...rest } = z.toJSONSchema(AnalysisSchema) as Record<string, unknown>; void _d; return rest; })(),
        schemaName: "reply_analysis",
        maxTokens: 1500,
      }, (x) => { const v = AnalysisSchema.safeParse(x); return v.success ? v.data : null; }, { workspaceId, campaignId: null, promptVersion: ANALYSIS_PROMPT_VERSION });
      analysis = { ...r.data, by: "ai" };
    } catch (e) {
      if (!(e instanceof LlmNotConfiguredError)) console.error("[replies] llm", e);
    }
  }
  // Without the AI, only the rules: an opt-out is an opt-out.
  if (!analysis && isStopRequest(m.body)) {
    analysis = { kind: "stop_request", summary: "Asked not to be contacted.", suggested_stage: "lost", needs_human: false, escalate_because: ["stop_request"], suggested_reply: null, by: "rules" };
  }
  if (!analysis) return null;
  if (analysis.kind === "stop_request") { analysis.escalate_because = [...new Set([...analysis.escalate_because, "stop_request" as const])]; await markDoNotContact(leadId); }

  await db.from("outreach_messages").update({ analysis: analysis as unknown as Json }).eq("id", m.id);
  await db.from("lead_activities").insert({ workspace_id: workspaceId, lead_id: leadId, kind: "reply_analyzed", actor_kind: "agent", body: analysis.summary, meta: { message_id: m.id, kind: analysis.kind, suggested_stage: analysis.suggested_stage, by: analysis.by } });

  // Escalation: the agent stops and asks the member.
  const reasons = analysis.escalate_because.filter((r) => s.escalation[r as Escalation]);
  if (analysis.needs_human && s.escalation.asks_for_human && !reasons.length) reasons.push("asks_for_human");
  if (reasons.length) {
    await db.from("lead_tasks").insert({
      workspace_id: workspaceId, lead_id: leadId, title: `Reply needs you: ${analysis.summary}`.slice(0, 300), kind: "review", due_at: new Date().toISOString(),
      source: "agent", assignee_id: userId, dedupe_key: `escalate:${m.id}`,
    });
  }
  if (analysis.suggested_stage) await suggestStage(workspaceId, leadId, analysis.suggested_stage, analysis.summary, s, reasons.length > 0);
  return analysis;
}

/** CRM Agent: applies a stage suggestion as Rules & Permissions allow (auto / approval / not at all). */
export async function suggestStage(workspaceId: string, leadId: string, stage: LeadStage, why: string, s: AiSettings, escalated: boolean) {
  const db = createAdminClient();
  const { data: lead } = await db.from("leads").select("stage").eq("id", leadId).single();
  if (!lead || lead.stage === stage || lead.stage === "closed") return;
  // Suggestions only move a deal forward (or to Lost), never back.
  const order: LeadStage[] = ["new", "interested", "meeting_booked", "meeting_completed", "closed"];
  if (stage !== "lost" && order.indexOf(stage) <= order.indexOf(lead.stage)) return;
  const d = decide(s, "crm", "update_crm_stage");
  if (!d.allowed) return;
  // An escalated reply is never acted on automatically.
  if (d.mode === "auto" && !escalated) {
    await changeStage(db, workspaceId, leadId, stage, "agent");
    return;
  }
  const { data: open } = await db.from("agent_pending_actions").select("id").eq("lead_id", leadId).eq("tool", "crm.set_stage").eq("status", "pending").maybeSingle();
  if (open) await db.from("agent_pending_actions").update({ status: "expired" }).eq("id", open.id);
  await db.from("agent_pending_actions").insert({
    workspace_id: workspaceId, lead_id: leadId, agent: "crm", tool: "crm.set_stage", input: { stage } as Json,
    summary: why.slice(0, 300), expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
  });
}

const ReplyDraftSchema = z.object({ subject: z.string().max(200), body: z.string().min(1).max(3000) });

/** Replies Agent: a reply draft for the conversation (the member edits and sends it themselves). */
export async function draftReply(workspaceId: string, userId: string, leadId: string, instruction: string | null): Promise<{ ok: true; messageId: string } | { ok: false; error: "denied" | "not_found" | "do_not_contact" | "not_configured" | "failed" }> {
  const s = await loadAiSettings(workspaceId);
  const d = decide(s, "replies", "prepare_messages");
  if (!d.allowed) return { ok: false, error: "denied" };
  const db = createAdminClient();
  const { data: lead } = await db.from("leads").select("*").eq("id", leadId).eq("workspace_id", workspaceId).maybeSingle();
  if (!lead) return { ok: false, error: "not_found" };
  if (lead.do_not_contact) return { ok: false, error: "do_not_contact" };
  const { data: last } = await db.from("outreach_messages").select("channel, language, subject, outreach_campaign_id, enrollment_id, analysis").eq("lead_id", leadId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const [business, { data: sender }] = await Promise.all([loadBusinessContext(workspaceId, { customerProfileId: lead.customer_profile_id }), db.from("profiles").select("full_name").eq("id", userId).single()]);
  const language = last?.language && isMessageLanguage(last.language) ? messageLanguages[last.language] : "the language of their last message";
  try {
    const r = await runStructured(tasks.writing, {
      system: [
        `You write the next reply in a sales conversation on behalf of ${sender?.full_name ?? "the sender"}, who reviews it and sends it from their own app.`,
        `Answer what they actually said, briefly and naturally, in ${language}. One clear next step. Plain text, no placeholders, no stock AI phrases.`,
        "Use only the company knowledge below. If they ask something it doesn't cover, say you'll check and come back — never guess prices, features, dates or results, and never make claims about competitors.",
        `subject: "Re: " + the previous subject for email, or "" for other channels.`,
        contextText(business),
        guidanceFor(s, "replies"),
      ].filter(Boolean).join("\n\n"),
      parts: [{ kind: "text", text: JSON.stringify({ lead: { name: lead.name, company: lead.company_name }, thread: await historyFor(leadId, 8), member_instruction: instruction }) }],
      schema: (() => { const { $schema: _d, ...rest } = z.toJSONSchema(ReplyDraftSchema) as Record<string, unknown>; void _d; return rest; })(),
      schemaName: "reply_draft",
      maxTokens: 1200,
    }, (x) => { const v = ReplyDraftSchema.safeParse(x); return v.success && !/\[[^\]]{1,40}\]/.test(v.data.body) ? v.data : null; }, { workspaceId, campaignId: null, promptVersion: ANALYSIS_PROMPT_VERSION });
    const channel = last?.channel ?? "email";
    const { data: msg, error } = await db.from("outreach_messages").insert({
      workspace_id: workspaceId, lead_id: leadId, prospect_id: lead.prospect_id, company_id: lead.prospect_id ? null : lead.company_id, created_by: userId,
      channel, to_email: channel === "email" ? lead.email : null, subject: channel === "email" ? r.data.subject.slice(0, 300) : "", body: r.data.body,
      language: last?.language ?? "en", instruction, objective: "follow_up", model: `${r.route.provider}:${r.servedModel}`, cost_usd: r.unpricedCalls ? null : r.costUsd,
      outreach_campaign_id: last?.outreach_campaign_id ?? null,
    }).select("id").single();
    if (error || !msg) return { ok: false, error: "failed" };
    return { ok: true, messageId: msg.id };
  } catch (e) {
    if (e instanceof LlmNotConfiguredError) return { ok: false, error: "not_configured" };
    console.error("[replies] draft", e);
    return { ok: false, error: "failed" };
  }
}

export type { ReplyKind };
