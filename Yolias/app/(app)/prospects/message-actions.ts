"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSession } from "@/lib/session";
import { draftOutreach } from "@/lib/outreach";
import { capture } from "@/lib/analytics/server";
import { getDictionary } from "@/lib/i18n/server";
import type { MessageChannel, MessageOpenedVia, OutreachMessageRow } from "@/types/database";

// Prospect actions (MVP, D-155): Yolias writes an email or a LinkedIn note for
// a selected person; the member edits it and opens it in their own Gmail /
// Outlook / mail app or on LinkedIn. Yolias sends nothing. What was prepared
// and where it was opened is kept in outreach_messages for a later Outreach
// module.

export type MessageResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const uuid = /^[0-9a-f-]{36}$/i;
const channels: MessageChannel[] = ["email", "linkedin"];
const vias: Record<MessageChannel, MessageOpenedVia[]> = { email: ["gmail", "outlook", "mail_app", "copy"], linkedin: ["linkedin", "copy"] };

export async function prepareMessage(prospectId: string, channel: MessageChannel, instruction: string, language: "en" | "ar"): Promise<MessageResult<{ message: OutreachMessageRow }>> {
  const session = await requireSession();
  const e = (await getDictionary()).outreach.errors;
  if (!uuid.test(prospectId) || !channels.includes(channel)) return { ok: false, error: e.notFound };
  // RLS proves the prospect is in the member's workspace.
  const db = await createClient();
  const { data: p } = await db.from("prospects").select("id").eq("id", prospectId).eq("workspace_id", session.workspace.id).maybeSingle();
  if (!p) return { ok: false, error: e.notFound };
  const r = await draftOutreach({ workspaceId: session.workspace.id, userId: session.userId, prospectId, channel, instruction: instruction.trim().slice(0, 1000) || null, language: language === "ar" ? "ar" : "en" });
  if (!r.ok) return { ok: false, error: e[r.error] };
  await capture(session.userId, "message_drafted", { workspace_id: session.workspace.id, channel, language });
  return { ok: true, message: r.message };
}

export interface OpenInput {
  prospectId: string;
  channel: MessageChannel;
  via: MessageOpenedVia;
  /** Yolias's draft, or null when the member wrote the message themselves. */
  messageId: string | null;
  subject: string;
  body: string;
  language: "en" | "ar";
}

/**
 * The member opens the message in their own app: saves the final text, records
 * where and when, reveals the person's email (they are about to use it) and
 * returns what the browser needs to open the compose window.
 */
export async function openMessage(input: OpenInput): Promise<MessageResult<{ email: string | null; linkedinUrl: string | null }>> {
  const session = await requireSession();
  const e = (await getDictionary()).outreach.errors;
  if (!uuid.test(input.prospectId) || !channels.includes(input.channel) || !vias[input.channel].includes(input.via)) return { ok: false, error: e.failed };
  const db = await createClient();
  const { data: p } = await db.from("prospects").select("id, campaign_id, email, email_status, linkedin_url, revealed_at")
    .eq("id", input.prospectId).eq("workspace_id", session.workspace.id).maybeSingle();
  if (!p) return { ok: false, error: e.notFound };
  const email = p.email && p.email_status !== "invalid" ? p.email : null;
  if (input.channel === "email" && !email) return { ok: false, error: e.no_email };
  if (input.channel === "linkedin" && !p.linkedin_url) return { ok: false, error: e.no_linkedin };

  // Server writes (the outreach trigger keeps members to the old send steps).
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const text = { subject: input.channel === "email" ? input.subject.trim().slice(0, 300) : "", body: input.body.trim().slice(0, 10_000) };
  const updated = input.messageId && uuid.test(input.messageId)
    ? (await admin.from("outreach_messages").update({ ...text, opened_at: now, opened_via: input.via })
      .eq("id", input.messageId).eq("prospect_id", p.id).eq("workspace_id", session.workspace.id).eq("status", "draft").select("id").maybeSingle()).data
    : null;
  if (!updated) {
    await admin.from("outreach_messages").insert({
      workspace_id: session.workspace.id, prospect_id: p.id, campaign_id: p.campaign_id, created_by: session.userId, channel: input.channel,
      to_email: input.channel === "email" ? email : null, ...text, language: input.language === "ar" ? "ar" : "en", opened_at: now, opened_via: input.via,
    });
  }
  if (!p.revealed_at && input.channel === "email") {
    await db.from("prospects").update({ revealed_at: now, revealed_by: session.userId }).eq("id", p.id).is("revealed_at", null);
  }
  await capture(session.userId, input.channel === "email" ? "email_opened" : "linkedin_opened", {
    workspace_id: session.workspace.id, campaign_id: p.campaign_id, via: input.via, drafted_by_ai: Boolean(input.messageId), language: input.language,
  });
  revalidatePath(`/prospects/person/${p.id}`);
  return { ok: true, email: input.channel === "email" ? email : null, linkedinUrl: p.linkedin_url };
}

/** Export selected people (CSV) — counted for analytics; the file itself comes from /prospects/export. */
export async function exportedPeople(count: number, source: "results" | "prospects"): Promise<void> {
  const session = await requireSession();
  await capture(session.userId, "prospects_exported", { workspace_id: session.workspace.id, count: Math.max(0, Math.min(count, 100_000)), format: "csv", source });
}
