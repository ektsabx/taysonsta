"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSession } from "@/lib/session";
import { getDictionary } from "@/lib/i18n/server";
import { confirmSent } from "@/lib/outreach/sequence";
import { draftReply, logReply } from "@/lib/agents/replies";
import { EMAIL_LIMIT } from "@/lib/outreach/channels";
import type { ThreadStatus } from "@/types/database";

// Messages and conversations (Inbox, CRM lead page, Outreach). Three
// separate states: the message (draft → sent / received), the conversation
// (open / done / other, read) and the deal stage (CRM). Yolias has no
// connected mailbox: "sent" is the member's confirmation, replies are logged.

export type MsgResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const uuid = z.string().uuid();
// The lead id stays in the calls for readability; every page that shows it is revalidated.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const refresh = (_leadId?: string | null) => {
  revalidatePath("/inbox");
  revalidatePath("/outreach", "layout");
};

export async function updateDraft(messageId: string, subject: string, body: string): Promise<MsgResult> {
  const session = await requireSession();
  const e = (await getDictionary()).ws.messages.errors;
  if (!uuid.safeParse(messageId).success) return { ok: false, error: e.not_found };
  const db = await createClient();
  const { data: m } = await db.from("outreach_messages").select("id, channel, status, lead_id").eq("id", messageId).eq("workspace_id", session.workspace.id).maybeSingle();
  if (!m) return { ok: false, error: e.not_found };
  if (m.status !== "draft") return { ok: false, error: e.edit };
  const text = String(body ?? "").trim().slice(0, EMAIL_LIMIT);
  if (!text) return { ok: false, error: e.failed };
  const { error } = await db.from("outreach_messages").update({ subject: m.channel === "email" ? String(subject ?? "").trim().slice(0, 300) : "", body: text }).eq("id", m.id);
  if (error) return { ok: false, error: e.failed };
  refresh(m.lead_id);
  return { ok: true };
}

export async function discardMessage(messageId: string): Promise<MsgResult> {
  const session = await requireSession();
  const e = (await getDictionary()).ws.messages.errors;
  const db = await createClient();
  const { data, error } = await db.from("outreach_messages").update({ status: "canceled" }).eq("id", messageId).eq("workspace_id", session.workspace.id).in("status", ["draft", "approved", "failed"]).select("lead_id").maybeSingle();
  if (error || !data) return { ok: false, error: e.edit };
  refresh(data.lead_id);
  return { ok: true };
}

export async function markMessageSent(messageId: string): Promise<MsgResult> {
  const session = await requireSession();
  const e = (await getDictionary()).ws.messages.errors;
  if (!uuid.safeParse(messageId).success) return { ok: false, error: e.not_found };
  const r = await confirmSent(await createClient(), session.workspace.id, session.userId, messageId);
  if (!r.ok) return { ok: false, error: e[r.error] };
  const { data } = await createAdminClient().from("outreach_messages").select("lead_id").eq("id", messageId).single();
  refresh(data?.lead_id);
  return { ok: true };
}

/** Plans when the member will send a draft (no mailbox: a reminder fires at that time). Null clears it. */
export async function scheduleMessage(messageId: string, at: string | null): Promise<MsgResult> {
  const session = await requireSession();
  const e = (await getDictionary()).ws.messages.errors;
  if (!uuid.safeParse(messageId).success) return { ok: false, error: e.not_found };
  const when = at && !Number.isNaN(Date.parse(at)) ? new Date(at).toISOString() : null;
  const { data: own } = await (await createClient()).from("outreach_messages").select("id, lead_id").eq("id", messageId).eq("workspace_id", session.workspace.id).maybeSingle();
  if (!own) return { ok: false, error: e.not_found };
  const { data, error } = await createAdminClient().from("outreach_messages").update({ scheduled_for: when }).eq("id", messageId).in("status", ["draft", "approved"]).eq("direction", "outbound").select("id").maybeSingle();
  if (error || !data) return { ok: false, error: e.edit };
  // A new time gets a new reminder.
  await createAdminClient().from("lead_tasks").delete().eq("dedupe_key", `scheduled:${messageId}`).is("done_at", null);
  refresh(own.lead_id);
  return { ok: true };
}

const replyInput = z.object({
  leadId: z.string().uuid(),
  body: z.string().trim().min(1).max(10000),
  channel: z.enum(["email", "linkedin", "facebook", "instagram"]),
  receivedAt: z.string().nullable(),
  from: z.string().trim().max(320).nullable(),
});

export async function logReplyAction(input: z.input<typeof replyInput>): Promise<MsgResult<{ analysis: unknown }>> {
  const session = await requireSession();
  const t = await getDictionary();
  const p = replyInput.safeParse(input);
  if (!p.success) return { ok: false, error: t.ws.common.error };
  const r = await logReply(await createClient(), session.workspace.id, session.userId, p.data);
  if (!r.ok) return { ok: false, error: r.error === "empty" ? t.ws.common.error : t.ws.crm.errors.notFound };
  refresh(p.data.leadId);
  return { ok: true, analysis: r.analysis };
}

export async function draftReplyAction(leadId: string, instruction: string): Promise<MsgResult<{ messageId: string }>> {
  const session = await requireSession();
  const t = await getDictionary();
  if (!uuid.safeParse(leadId).success) return { ok: false, error: t.ws.crm.errors.notFound };
  const { data: own } = await (await createClient()).from("sales_leads").select("id").eq("id", leadId).eq("workspace_id", session.workspace.id).maybeSingle();
  if (!own) return { ok: false, error: t.ws.crm.errors.notFound };
  const r = await draftReply(session.workspace.id, session.userId, leadId, instruction.trim().slice(0, 1000) || null);
  if (!r.ok) {
    const msg = r.error === "denied" ? t.ws.messages.prepareErrors.denied : r.error === "do_not_contact" ? t.ws.messages.errors.do_not_contact
      : r.error === "not_configured" ? t.outreach.errors.not_configured : r.error === "not_found" ? t.ws.crm.errors.notFound : t.ws.common.error;
    return { ok: false, error: msg };
  }
  refresh(leadId);
  return { ok: true, messageId: r.messageId };
}

export async function setThreadStatus(leadId: string, status: ThreadStatus): Promise<MsgResult> {
  const session = await requireSession();
  const t = await getDictionary();
  if (!uuid.safeParse(leadId).success || !["open", "done", "other"].includes(status)) return { ok: false, error: t.ws.common.error };
  const { data, error } = await (await createClient()).from("inbox_threads").update({ status }).eq("lead_id", leadId).eq("workspace_id", session.workspace.id).select("id").maybeSingle();
  if (error || !data) return { ok: false, error: t.ws.common.error };
  refresh(leadId);
  return { ok: true };
}

export async function markThreadRead(leadId: string): Promise<MsgResult> {
  const session = await requireSession();
  if (!uuid.safeParse(leadId).success) return { ok: false, error: "" };
  await (await createClient()).from("inbox_threads").update({ last_read_at: new Date().toISOString() }).eq("lead_id", leadId).eq("workspace_id", session.workspace.id);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** A reply the member writes (or the AI's suggested reply, used as is): saved as a draft in the conversation. */
export async function saveManualDraft(leadId: string, body: string): Promise<MsgResult<{ messageId: string }>> {
  const session = await requireSession();
  const t = await getDictionary();
  if (!uuid.safeParse(leadId).success) return { ok: false, error: t.ws.crm.errors.notFound };
  const text = String(body ?? "").trim();
  if (!text) return { ok: false, error: t.ws.messages.errors.failed };
  const { data: lead } = await (await createClient()).from("sales_leads").select("id, prospect_id, company_id, email, do_not_contact").eq("id", leadId).eq("workspace_id", session.workspace.id).maybeSingle();
  if (!lead) return { ok: false, error: t.ws.crm.errors.notFound };
  if (lead.do_not_contact) return { ok: false, error: t.ws.messages.errors.do_not_contact };
  const admin = createAdminClient();
  const { data: last } = await admin.from("outreach_messages").select("channel, subject, language, outreach_campaign_id").eq("lead_id", leadId).neq("status", "canceled").order("created_at", { ascending: false }).limit(1).maybeSingle();
  // Replies are email (D-269), whatever an old message's channel was.
  const channel = "email" as const;
  const subject = last?.subject ? (/^re:/i.test(last.subject) ? last.subject : `Re: ${last.subject}`).slice(0, 300) : "";
  const { data: msg, error } = await admin.from("outreach_messages").insert({
    workspace_id: session.workspace.id, lead_id: leadId, prospect_id: lead.prospect_id, company_id: lead.prospect_id ? null : lead.company_id, created_by: session.userId,
    channel, to_email: lead.email, subject, body: text.slice(0, EMAIL_LIMIT), language: last?.language ?? "en",
    outreach_campaign_id: last?.outreach_campaign_id ?? null,
  }).select("id").single();
  if (error || !msg) return { ok: false, error: t.ws.messages.errors.failed };
  refresh(leadId);
  return { ok: true, messageId: msg.id };
}

/** Sends a prepared email now from the member's own mailbox (D-239): the click is the approval. */
export async function sendNow(messageId: string): Promise<MsgResult> {
  const session = await requireSession();
  const t = await getDictionary();
  if (!uuid.safeParse(messageId).success) return { ok: false, error: t.ws.messages.errors.not_found };
  const { sendMessageNow } = await import("@/lib/outreach/execute");
  const r = await sendMessageNow(session.workspace.id, session.userId, messageId);
  const { data } = await createAdminClient().from("outreach_messages").select("lead_id").eq("id", messageId).maybeSingle();
  refresh(data?.lead_id);
  if (!r.ok) return { ok: false, error: t.ws.send.errors[r.error] + (r.detail ? ` ${r.detail}` : "") };
  return { ok: true };
}

/** Writes and sends a reply in the conversation, from the member's mailbox. */
export async function sendReply(leadId: string, body: string): Promise<MsgResult> {
  const saved = await saveManualDraft(leadId, body);
  if (!saved.ok) return saved;
  const sent = await sendNow(saved.messageId);
  // Not sent (no mailbox, limit…): the reply stays as a draft in the conversation.
  return sent;
}

/** Interested / Not interested / Needs follow-up (D-239). */
export async function setThreadLabel(leadId: string, label: "interested" | "not_interested" | "follow_up" | null): Promise<MsgResult> {
  const session = await requireSession();
  const t = await getDictionary();
  if (!uuid.safeParse(leadId).success || (label !== null && !["interested", "not_interested", "follow_up"].includes(label))) return { ok: false, error: t.ws.common.error };
  const { data, error } = await (await createClient()).from("inbox_threads").update({ label }).eq("lead_id", leadId).eq("workspace_id", session.workspace.id).select("id").maybeSingle();
  if (error || !data) return { ok: false, error: t.ws.common.error };
  refresh(leadId);
  return { ok: true };
}

/**
 * The member corrects how Yolias read the latest reply (D-256, the Inbox's
 * classification dropdown). The thread's label follows, as with Yolias's own reading.
 */
export async function setReplyKind(leadId: string, kind: string): Promise<MsgResult> {
  const session = await requireSession();
  const t = await getDictionary();
  const { REPLY_KINDS } = await import("@/lib/automations/schema");
  const { labelFor } = await import("@/lib/agents/replies");
  if (!uuid.safeParse(leadId).success || !(REPLY_KINDS as readonly string[]).includes(kind)) return { ok: false, error: t.ws.common.error };
  const db = await createClient();
  const { data: m } = await db.from("outreach_messages").select("id, analysis").eq("workspace_id", session.workspace.id).eq("lead_id", leadId).eq("direction", "inbound")
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!m) return { ok: false, error: t.ws.common.notFound };
  const prev = m.analysis && typeof m.analysis === "object" && !Array.isArray(m.analysis) ? (m.analysis as Record<string, unknown>) : {};
  const { error } = await db.from("outreach_messages").update({ analysis: { ...prev, kind, summary: typeof prev.summary === "string" ? prev.summary : "", by: "user" } }).eq("id", m.id);
  if (error) return { ok: false, error: t.ws.common.error };
  await db.from("inbox_threads").update({ label: labelFor(kind) }).eq("lead_id", leadId).eq("workspace_id", session.workspace.id);
  refresh(leadId);
  return { ok: true };
}

/** A task on the conversation done or open again (tasks live with the conversation, D-268). */
export async function setTaskDone(taskId: string, done: boolean): Promise<MsgResult> {
  const session = await requireSession();
  const t = await getDictionary();
  if (!uuid.safeParse(taskId).success) return { ok: false, error: t.ws.common.notFound };
  const { data, error } = await (await createClient()).from("lead_tasks").update({ done_at: done ? new Date().toISOString() : null }).eq("id", taskId).eq("workspace_id", session.workspace.id).select("lead_id").maybeSingle();
  if (error || !data) return { ok: false, error: t.ws.common.error };
  refresh(data.lead_id);
  return { ok: true };
}
