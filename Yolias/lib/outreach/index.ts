import "server-only";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { LlmNotConfiguredError, runStructured } from "@/lib/ai/llm";
import { tasks } from "@/lib/ai/orchestrator";
import { isSuppressed } from "@/lib/intel/shared";
import { mailers, MailerError } from "./mailers";
import type { OutreachMessageRow } from "@/types/database";

// Outreach (final spec phase 8): Yolias writes a personalised email for a
// prospect from what Yolias knows (never invented facts); a member edits and
// approves it; the "outreach.send" job sends it from the approver's own
// connected mailbox. Email only, one approved message at a time, suppression
// list honoured (rule 34), per-mailbox daily limit for deliverability.

export const OUTREACH_PROMPT_VERSION = "outreach-2026-10-06";

const DraftSchema = z.object({
  subject: z.string().min(1).max(120),
  body: z.string().min(1).max(3000),
});

const SYSTEM = `You write a first B2B outreach email on behalf of the sender.
Rules:
- Use only the facts given about the prospect, their company and the sender's business. Never invent numbers, clients, results, news or mutual contacts.
- Personal and specific: why this person and company, in one or two sentences, then what the sender offers, then one low-friction question.
- Short: at most 110 words in the body. No buzzwords, no exclamation marks, no fake urgency, no "I hope this email finds you well".
- Sign with the sender's name and company. Plain text, no markdown, no placeholders like [Name].
- Write in {LANGUAGE}{ARABIC_NOTE}.`;

export interface DraftInput {
  workspaceId: string;
  userId: string;
  prospectId: string;
  instruction: string | null;
  language: "en" | "ar";
}

export type DraftResult = { ok: true; message: OutreachMessageRow } | { ok: false; error: "not_found" | "no_email" | "suppressed" | "not_configured" | "failed" };

/**
 * Writes a draft for one prospect and saves it (status "draft"). The caller
 * has already checked the prospect belongs to the member's workspace (RLS).
 */
export async function draftOutreach(input: DraftInput): Promise<DraftResult> {
  const db = createAdminClient();
  const { data: p } = await db.from("prospects").select("*, company:companies(name, domain, website, industry, description, city, country, category, employee_count)")
    .eq("id", input.prospectId).eq("workspace_id", input.workspaceId).maybeSingle();
  if (!p) return { ok: false, error: "not_found" };
  if (!p.email || p.email_status === "invalid") return { ok: false, error: "no_email" };
  if (await isSuppressed({ email: p.email, linkedinUrl: p.linkedin_url, personId: p.person_id })) return { ok: false, error: "suppressed" };
  const [{ data: ws }, { data: sender }] = await Promise.all([
    db.from("workspaces").select("name, website, offering").eq("id", input.workspaceId).single(),
    db.from("profiles").select("full_name").eq("id", input.userId).single(),
  ]);
  const company = p.company as unknown as Record<string, unknown> | null;
  const facts = {
    prospect: { name: p.full_name, title: p.title, city: p.city, country: p.country },
    company,
    sender: { name: sender?.full_name, company: ws?.name, website: ws?.website, offering: ws?.offering },
    instruction: input.instruction,
  };
  const { $schema: _drop, ...schema } = z.toJSONSchema(DraftSchema) as Record<string, unknown>;
  void _drop;
  try {
    const r = await runStructured(tasks.writing, {
      system: SYSTEM.replace("{LANGUAGE}", input.language === "ar" ? "Arabic" : "English").replace("{ARABIC_NOTE}", input.language === "ar" ? " (clear Modern Standard Arabic)" : ""),
      parts: [{ kind: "text", text: JSON.stringify(facts) }],
      schema,
      schemaName: "outreach_email",
      maxTokens: 900,
    }, (d) => {
      const v = DraftSchema.safeParse(d);
      return v.success ? v.data : null;
    }, { workspaceId: input.workspaceId, campaignId: p.campaign_id, promptVersion: OUTREACH_PROMPT_VERSION });
    const { data: message, error } = await db.from("outreach_messages").insert({
      workspace_id: input.workspaceId, prospect_id: p.id, campaign_id: p.campaign_id, created_by: input.userId, to_email: p.email,
      subject: r.data.subject, body: r.data.body, language: input.language, instruction: input.instruction,
      model: `${r.route.provider}:${r.servedModel}`, cost_usd: r.unpricedCalls ? null : r.costUsd,
    }).select("*").single();
    if (error || !message) return { ok: false, error: "failed" };
    return { ok: true, message };
  } catch (e) {
    if (e instanceof LlmNotConfiguredError) return { ok: false, error: "not_configured" };
    console.error("[outreach] draft failed", e);
    return { ok: false, error: "failed" };
  }
}

/**
 * Sends one approved message (job "outreach.send"). Idempotent: only an
 * "approved" message is claimed (→ "sending"), so a retried job can't send
 * twice. Returns the final status.
 */
export async function sendOutreach(messageId: string): Promise<OutreachMessageRow["status"] | null> {
  const db = createAdminClient();
  const { data: m } = await db.from("outreach_messages").update({ status: "sending", error: null }).eq("id", messageId).eq("status", "approved").select("*").maybeSingle();
  if (!m) return null;
  const failWith = async (error: string) => {
    await db.from("outreach_messages").update({ status: "failed", error }).eq("id", m.id);
    return "failed" as const;
  };

  const { data: p } = await db.from("prospects").select("email, email_status, linkedin_url, person_id").eq("id", m.prospect_id).maybeSingle();
  const to = (m.to_email ?? p?.email ?? "").trim().toLowerCase();
  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return failWith("no_email");
  if (p?.email_status === "invalid" && to === p.email?.toLowerCase()) return failWith("invalid_email");
  // Suppression is checked again at send time (it may have changed since the draft).
  if (await isSuppressed({ email: to, linkedinUrl: p?.linkedin_url ?? null, personId: p?.person_id ?? null })) return failWith("suppressed");

  const { data: box } = m.mailbox_id ? await db.from("mailboxes").select("*").eq("id", m.mailbox_id).maybeSingle() : { data: null };
  if (!box || box.status !== "connected" || box.workspace_id !== m.workspace_id || box.user_id !== m.approved_by) return failWith("mailbox_not_connected");
  const mailer = mailers[box.provider];
  const app = await mailer.app();
  if (!app) return failWith("provider_not_configured");

  // Daily limit per mailbox, counted atomically (a conditional update).
  const today = new Date().toISOString().slice(0, 10);
  const used = box.sent_day === today ? box.sent_today : 0;
  if (used >= box.daily_limit) return failWith("daily_limit");
  const { data: counted } = await db.from("mailboxes").update({ sent_day: today, sent_today: used + 1 }).eq("id", box.id).eq("sent_today", box.sent_today).select("id").maybeSingle();
  if (!counted) {
    // Raced with another send: put it back to approved for a retry.
    await db.from("outreach_messages").update({ status: "approved" }).eq("id", m.id);
    throw new Error("mailbox counter moved; retry");
  }

  const { data: refreshToken } = await db.rpc("mailbox_token", { p_mailbox: box.id });
  if (!refreshToken) return failWith("mailbox_not_connected");
  const { data: sender } = await db.from("profiles").select("full_name").eq("id", box.user_id).single();
  try {
    const tokens = await mailer.refresh(app, refreshToken);
    if (tokens.refreshToken && tokens.refreshToken !== refreshToken) await db.rpc("set_mailbox_token", { p_mailbox: box.id, p_token: tokens.refreshToken });
    const sent = await mailer.send(tokens.accessToken, { from: box.email, fromName: sender?.full_name ?? null, to, subject: m.subject, body: m.body });
    await db.from("outreach_messages").update({ status: "sent", sent_at: new Date().toISOString(), provider_message_id: sent.providerId, to_email: to }).eq("id", m.id);
    return "sent";
  } catch (e) {
    // The send didn't happen: give the day's slot back.
    await db.from("mailboxes").update({ sent_today: Math.max(0, used) }).eq("id", box.id).eq("sent_day", today);
    if (e instanceof MailerError && e.kind === "auth") {
      await db.from("mailboxes").update({ status: "error", last_error: e.message.slice(0, 300) }).eq("id", box.id);
      return failWith("mailbox_auth");
    }
    if (e instanceof MailerError && e.kind === "rejected") return failWith(`rejected: ${e.message}`.slice(0, 300));
    // Unavailable / network: back to approved and let the job retry with backoff.
    await db.from("outreach_messages").update({ status: "approved" }).eq("id", m.id);
    throw e;
  }
}
