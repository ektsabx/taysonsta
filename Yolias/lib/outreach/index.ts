import "server-only";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { LlmNotConfiguredError, runStructured } from "@/lib/ai/llm";
import { tasks } from "@/lib/ai/orchestrator";
import { isSuppressed } from "@/lib/intel/shared";
import type { MessageChannel, OutreachMessageRow } from "@/types/database";

// Prospect messages (MVP, D-155): Yolias writes a personal email or LinkedIn
// message for a prospect from what Yolias knows (never invented facts); the
// member edits it and opens it in their own Gmail / Outlook / mail app or on
// LinkedIn. Yolias sends nothing. Every message is kept in outreach_messages
// (channel, text, opened where and when) for a later Outreach module.

export const OUTREACH_PROMPT_VERSION = "outreach-2026-10-07";

const EmailSchema = z.object({
  subject: z.string().min(1).max(120),
  body: z.string().min(1).max(3000),
});
const LinkedInSchema = z.object({
  body: z.string().min(1).max(300),
});

const RULES = `- Use only the facts given about the prospect, their company and the sender's business. Never invent numbers, clients, results, news or mutual contacts.
- No buzzwords, no exclamation marks, no fake urgency. Plain text, no markdown, no placeholders like [Name].
- Write in {LANGUAGE}{ARABIC_NOTE}.`;

const SYSTEM: Record<MessageChannel, string> = {
  email: `You write a first B2B outreach email on behalf of the sender.
Rules:
- Personal and specific: why this person and company, in one or two sentences, then what the sender offers, then one low-friction question.
- Short: at most 110 words in the body. No "I hope this email finds you well".
- Sign with the sender's name and company.
${RULES}`,
  linkedin: `You write a LinkedIn connection note on behalf of the sender.
Rules:
- At most 280 characters in total, so it fits a connection request.
- Greet the person by first name, say in one sentence why you'd like to connect (their role or company and the sender's business), and end with a light reason to connect — no hard pitch, no meeting request.
- No subject line and no signature block; the sender's first name at the end is enough.
${RULES}`,
};

export interface DraftInput {
  workspaceId: string;
  userId: string;
  prospectId: string;
  channel: MessageChannel;
  instruction: string | null;
  language: "en" | "ar";
}

export type DraftResult = { ok: true; message: OutreachMessageRow } | { ok: false; error: "not_found" | "no_email" | "no_linkedin" | "suppressed" | "not_configured" | "failed" };

/**
 * Writes a message for one prospect and saves it (status "draft"). The caller
 * has already checked the prospect belongs to the member's workspace (RLS).
 */
export async function draftOutreach(input: DraftInput): Promise<DraftResult> {
  const db = createAdminClient();
  const { data: p } = await db.from("prospects").select("*, company:companies(name, domain, website, industry, description, city, country, category, employee_count)")
    .eq("id", input.prospectId).eq("workspace_id", input.workspaceId).maybeSingle();
  if (!p) return { ok: false, error: "not_found" };
  if (input.channel === "email" && (!p.email || p.email_status === "invalid")) return { ok: false, error: "no_email" };
  if (input.channel === "linkedin" && !p.linkedin_url) return { ok: false, error: "no_linkedin" };
  if (await isSuppressed({ email: p.email, linkedinUrl: p.linkedin_url, personId: p.person_id })) return { ok: false, error: "suppressed" };
  const [{ data: ws }, { data: sender }] = await Promise.all([
    db.from("workspaces").select("name, website, industry, offering, target_markets").eq("id", input.workspaceId).single(),
    db.from("profiles").select("full_name").eq("id", input.userId).single(),
  ]);
  const company = p.company as unknown as Record<string, unknown> | null;
  const facts = {
    prospect: { name: p.full_name, title: p.title, city: p.city, country: p.country },
    company,
    sender: { name: sender?.full_name, company: ws?.name, website: ws?.website, industry: ws?.industry, products_and_services: ws?.offering, markets: ws?.target_markets },
    instruction: input.instruction,
  };
  const Schema = input.channel === "email" ? EmailSchema : LinkedInSchema;
  const { $schema: _drop, ...schema } = z.toJSONSchema(Schema) as Record<string, unknown>;
  void _drop;
  try {
    const r = await runStructured(tasks.writing, {
      system: SYSTEM[input.channel].replace("{LANGUAGE}", input.language === "ar" ? "Arabic" : "English").replace("{ARABIC_NOTE}", input.language === "ar" ? " (clear Modern Standard Arabic)" : ""),
      parts: [{ kind: "text", text: JSON.stringify(facts) }],
      schema,
      schemaName: input.channel === "email" ? "outreach_email" : "linkedin_note",
      maxTokens: 900,
    }, (d) => {
      const v = Schema.safeParse(d);
      return v.success ? (v.data as { subject?: string; body: string }) : null;
    }, { workspaceId: input.workspaceId, campaignId: p.campaign_id, promptVersion: OUTREACH_PROMPT_VERSION });
    const { data: message, error } = await db.from("outreach_messages").insert({
      workspace_id: input.workspaceId, prospect_id: p.id, campaign_id: p.campaign_id, created_by: input.userId, channel: input.channel,
      to_email: input.channel === "email" ? p.email : null, subject: r.data.subject ?? "", body: r.data.body, language: input.language, instruction: input.instruction,
      model: `${r.route.provider}:${r.servedModel}`, cost_usd: r.unpricedCalls ? null : r.costUsd,
    }).select("*").single();
    if (error || !message) {
      console.error("[outreach] saving the draft failed", error?.message);
      return { ok: false, error: "failed" };
    }
    return { ok: true, message };
  } catch (e) {
    if (e instanceof LlmNotConfiguredError) return { ok: false, error: "not_configured" };
    console.error("[outreach] draft failed", e);
    return { ok: false, error: "failed" };
  }
}
