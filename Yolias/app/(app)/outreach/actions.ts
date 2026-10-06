"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSession } from "@/lib/session";
import { enqueue } from "@/lib/jobs/queue";
import { draftOutreach } from "@/lib/outreach";
import { getDictionary } from "@/lib/i18n/server";
import { parseFilters, selectEntities } from "@/services/prospects";
import type { OutreachMessageRow } from "@/types/database";

// Outreach actions (final spec phase 8). Drafts are written by the server
// (Yolias AI); members edit, approve or cancel them with their own client —
// the database only allows those human steps (trigger). Sending is a job.

export type OutreachResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const uuid = /^[0-9a-f-]{36}$/i;

async function errors() {
  return (await getDictionary()).outreach.errors;
}

export async function prepareMessage(prospectId: string, instruction: string, language: "en" | "ar"): Promise<OutreachResult<{ message: OutreachMessageRow }>> {
  const session = await requireSession();
  const e = await errors();
  if (!uuid.test(prospectId)) return { ok: false, error: e.notFound };
  // RLS proves the prospect is in the member's workspace.
  const db = await createClient();
  const { data: p } = await db.from("prospects").select("id").eq("id", prospectId).eq("workspace_id", session.workspace.id).maybeSingle();
  if (!p) return { ok: false, error: e.notFound };
  const r = await draftOutreach({ workspaceId: session.workspace.id, userId: session.userId, prospectId, instruction: instruction.trim().slice(0, 1000) || null, language: language === "ar" ? "ar" : "en" });
  if (!r.ok) return { ok: false, error: e[r.error] };
  revalidatePath("/outreach");
  return { ok: true, message: r.message };
}

/** Bulk: drafts for the selected people (or all matching), prepared in the background. */
export async function prepareMany(target: { ids: string[] } | { all: string }, instruction: string, language: "en" | "ar"): Promise<OutreachResult<{ queued: number }>> {
  const session = await requireSession();
  const filters = parseFilters(Object.fromEntries(new URLSearchParams("all" in target ? target.all : "")));
  filters.tab = "people";
  const page = await selectEntities(session.workspace.id, filters, "ids" in target ? target.ids.slice(0, 500) : "all", 500);
  const ids = (page.rows as { id: string; email: string | null; email_status: string }[]).filter((r) => r.email && r.email_status !== "invalid").map((r) => r.id);
  for (let i = 0; i < ids.length; i += 10) {
    await enqueue("outreach.prepare", { workspaceId: session.workspace.id, userId: session.userId, prospectIds: ids.slice(i, i + 10), instruction: instruction.trim().slice(0, 1000) || null, language });
  }
  return { ok: true, queued: ids.length };
}

export async function saveDraft(id: string, input: { subject: string; body: string }): Promise<OutreachResult> {
  await requireSession();
  const e = await errors();
  const subject = input.subject.trim().slice(0, 300), body = input.body.trim().slice(0, 10_000);
  if (!subject || !body) return { ok: false, error: e.empty };
  const db = await createClient();
  const { error } = await db.from("outreach_messages").update({ subject, body }).eq("id", id).eq("status", "draft");
  if (error) return { ok: false, error: e.failed };
  revalidatePath("/outreach");
  return { ok: true };
}

/** Approve and queue the send from one of the member's own connected mailboxes. */
export async function approveAndSend(id: string, mailboxId: string): Promise<OutreachResult> {
  const session = await requireSession();
  const e = await errors();
  const db = await createClient();
  const { data: box } = await db.from("mailboxes").select("id, status").eq("id", mailboxId).eq("user_id", session.userId).maybeSingle();
  if (!box || box.status !== "connected") return { ok: false, error: e.noMailbox };
  const { data, error } = await db.from("outreach_messages").update({ status: "approved", mailbox_id: box.id }).eq("id", id).eq("status", "draft").select("id").maybeSingle();
  if (error || !data) return { ok: false, error: e.failed };
  await enqueue("outreach.send", { messageId: id });
  revalidatePath("/outreach");
  return { ok: true };
}

export async function cancelMessage(id: string): Promise<OutreachResult> {
  await requireSession();
  const db = await createClient();
  const { data } = await db.from("outreach_messages").update({ status: "canceled" }).eq("id", id).in("status", ["draft", "approved", "failed"]).select("id").maybeSingle();
  revalidatePath("/outreach");
  return data ? { ok: true } : { ok: false, error: (await errors()).failed };
}

export async function backToDraft(id: string): Promise<OutreachResult> {
  await requireSession();
  const db = await createClient();
  const { data } = await db.from("outreach_messages").update({ status: "draft" }).eq("id", id).in("status", ["approved", "failed"]).select("id").maybeSingle();
  revalidatePath("/outreach");
  return data ? { ok: true } : { ok: false, error: (await errors()).failed };
}

export async function setMailboxLimit(id: string, limit: number): Promise<OutreachResult> {
  await requireSession();
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) return { ok: false, error: (await errors()).limit };
  const db = await createClient();
  const { error } = await db.from("mailboxes").update({ daily_limit: limit }).eq("id", id);
  revalidatePath("/outreach");
  return error ? { ok: false, error: (await errors()).failed } : { ok: true };
}

export async function disconnectMailbox(id: string): Promise<OutreachResult> {
  const session = await requireSession();
  // RLS proves it's the member's own mailbox; the token is cleared by the server.
  const db = await createClient();
  const { data: box } = await db.from("mailboxes").select("id").eq("id", id).eq("user_id", session.userId).maybeSingle();
  if (!box) return { ok: false, error: (await errors()).noMailbox };
  await createAdminClient().rpc("clear_mailbox_token", { p_mailbox: box.id });
  revalidatePath("/outreach");
  return { ok: true };
}
