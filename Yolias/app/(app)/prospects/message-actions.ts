"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSession } from "@/lib/session";
import { draftOutreach, loadTarget, type MessageTarget } from "@/lib/outreach";
import { channelLimit, channels, channelVias, conversationUrl, isMessageLanguage, objectives, tones, whatsappDigits, DEFAULT_LANGUAGE, DEFAULT_OBJECTIVE, DEFAULT_TONE } from "@/lib/outreach/channels";
import { capture, type ServerEvent } from "@/lib/analytics/server";
import { getDictionary } from "@/lib/i18n/server";
import type { MessageChannel, MessageObjective, MessageOpenedVia, MessageTone, OutreachMessageRow } from "@/types/database";

// Prospect actions (MVP, D-155 / D-160): Yolias writes an email, a LinkedIn
// note or a WhatsApp / Facebook / Instagram message for a selected person,
// company or local business; the member edits it and opens it in their own
// Gmail / Outlook / mail app, WhatsApp, Messenger, Instagram or LinkedIn.
// Yolias sends nothing. What was prepared and where it was opened is kept in
// outreach_messages for a later Outreach module.

export type MessageResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const uuid = /^[0-9a-f-]{36}$/i;

export interface PrepareInput {
  target: MessageTarget;
  channel: MessageChannel;
  instruction: string;
  language: string;
  objective: MessageObjective;
  tone: MessageTone;
}

const validTarget = (t: MessageTarget) => (t?.kind === "person" || t?.kind === "company") && uuid.test(t.id);

export async function prepareMessage(input: PrepareInput): Promise<MessageResult<{ message: OutreachMessageRow }>> {
  const session = await requireSession();
  const e = (await getDictionary()).outreach.errors;
  if (!validTarget(input.target) || !channels.includes(input.channel)) return { ok: false, error: e.not_found };
  // RLS proves the person / company is in the member's workspace.
  const db = await createClient();
  const { data: row } = await db.from(input.target.kind === "person" ? "prospects" : "companies").select("id").eq("id", input.target.id).eq("workspace_id", session.workspace.id).maybeSingle();
  if (!row) return { ok: false, error: e.not_found };
  const language = isMessageLanguage(input.language) ? input.language : DEFAULT_LANGUAGE;
  const objective = objectives.includes(input.objective) ? input.objective : DEFAULT_OBJECTIVE;
  const tone = tones.includes(input.tone) ? input.tone : DEFAULT_TONE;
  const r = await draftOutreach({
    workspaceId: session.workspace.id, userId: session.userId, target: input.target, channel: input.channel,
    instruction: input.instruction.trim().slice(0, 1000) || null, language, objective, tone,
  });
  if (!r.ok) return { ok: false, error: e[r.error] };
  await capture(session.userId, "message_drafted", { workspace_id: session.workspace.id, channel: input.channel, language, objective, tone, target: input.target.kind, personalized: r.message.personalization.length > 0 });
  return { ok: true, message: r.message };
}

export interface OpenInput {
  target: MessageTarget;
  channel: MessageChannel;
  via: MessageOpenedVia;
  /** Yolias's draft, or null when the member wrote the message themselves. */
  messageId: string | null;
  subject: string;
  body: string;
  language: string;
}

const openedEvent: Record<MessageChannel, ServerEvent> = {
  email: "email_opened", linkedin: "linkedin_opened", whatsapp: "whatsapp_opened", facebook: "facebook_opened", instagram: "instagram_opened",
};

/**
 * The member opens the message in their own app: saves the final text, records
 * where and when, reveals the person's contact (they are about to use it) and
 * returns the address / link the browser opens.
 */
export async function openMessage(input: OpenInput): Promise<MessageResult<{ email: string | null; url: string | null }>> {
  const session = await requireSession();
  const e = (await getDictionary()).outreach.errors;
  if (!validTarget(input.target) || !channels.includes(input.channel) || !channelVias[input.channel].includes(input.via)) return { ok: false, error: e.failed };
  // Membership through the member's own client (RLS), then the full record.
  const db = await createClient();
  const { data: own } = await db.from(input.target.kind === "person" ? "prospects" : "companies").select("id").eq("id", input.target.id).eq("workspace_id", session.workspace.id).maybeSingle();
  if (!own) return { ok: false, error: e.not_found };
  const loaded = await loadTarget(session.workspace.id, input.target, input.channel);
  if (!loaded.ok) return { ok: false, error: e[loaded.error] };
  const t = loaded.data;

  const admin = createAdminClient();
  const { data: rec } = input.target.kind === "person"
    ? await admin.from("prospects").select("linkedin_url, whatsapp, phone, facebook_url, instagram_url, revealed_at").eq("id", input.target.id).single()
    : await admin.from("companies").select("whatsapp, phone, facebook_url, instagram_url").eq("id", input.target.id).single();
  const r = (rec ?? {}) as { linkedin_url?: string | null; whatsapp?: string | null; phone?: string | null; facebook_url?: string | null; instagram_url?: string | null; revealed_at?: string | null };

  // Server writes (the outreach trigger keeps members to the old send steps).
  const now = new Date().toISOString();
  const text = { subject: input.channel === "email" ? input.subject.trim().slice(0, 300) : "", body: input.body.trim().slice(0, channelLimit[input.channel]) };
  const language = isMessageLanguage(input.language) ? input.language : DEFAULT_LANGUAGE;
  const updated = input.messageId && uuid.test(input.messageId)
    ? (await admin.from("outreach_messages").update({ ...text, opened_at: now, opened_via: input.via })
      .eq("id", input.messageId).eq(input.target.kind === "person" ? "prospect_id" : "company_id", input.target.id)
      .eq("workspace_id", session.workspace.id).eq("status", "draft").select("id").maybeSingle()).data
    : null;
  if (!updated) {
    await admin.from("outreach_messages").insert({
      workspace_id: session.workspace.id, prospect_id: t.prospectId, company_id: t.prospectId ? null : t.companyId, campaign_id: t.campaignId,
      created_by: session.userId, channel: input.channel, to_email: t.toEmail, ...text, language, opened_at: now, opened_via: input.via,
    });
  }
  // Using a person's email or phone reveals it (recorded like Reveal).
  const usesContact = input.channel === "email" || (input.channel === "whatsapp" && !r.whatsapp);
  if (input.target.kind === "person" && usesContact && !r.revealed_at) {
    await db.from("prospects").update({ revealed_at: now, revealed_by: session.userId }).eq("id", input.target.id).is("revealed_at", null);
  }
  await capture(session.userId, openedEvent[input.channel], {
    workspace_id: session.workspace.id, campaign_id: t.campaignId, via: input.via, drafted_by_ai: Boolean(input.messageId), language, target: input.target.kind,
  });
  revalidatePath(input.target.kind === "person" ? `/prospects/person/${input.target.id}` : `/prospects/company/${input.target.id}`);

  const target = { whatsapp: whatsappDigits(r.whatsapp ?? r.phone), facebookUrl: r.facebook_url, instagramUrl: r.instagram_url };
  const url = input.channel === "linkedin" ? r.linkedin_url ?? null
    : input.channel === "email" ? null
    : conversationUrl(input.channel, target, text.body);
  return { ok: true, email: t.toEmail, url };
}

/** Export selected people (CSV) — counted for analytics; the file itself comes from /prospects/export. */
export async function exportedPeople(count: number, source: "results" | "prospects"): Promise<void> {
  const session = await requireSession();
  await capture(session.userId, "prospects_exported", { workspace_id: session.workspace.id, count: Math.max(0, Math.min(count, 100_000)), format: "csv", source });
}
