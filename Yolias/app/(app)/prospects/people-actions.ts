"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSession } from "@/lib/session";
import { enqueue } from "@/lib/jobs/queue";
import { getDictionary } from "@/lib/i18n/server";

// Result cards (D-147): reveal decision makers' contacts, bookmark a
// company, and start outreach to the selected people in one go. Every read
// and change goes through the member's own client (RLS) except creating a
// hand-written draft, which only the server may insert (outreach trigger).

const uuid = /^[0-9a-f-]{36}$/i;
const ids = (v: string[]) => [...new Set(v.filter((i) => uuid.test(i)))].slice(0, 100);

/** Shows the email / phone of these people (recorded once per person). The result was already counted. */
export async function revealPeople(personIds: string[]): Promise<{ ok: true; contacts: { id: string; email: string | null; phone: string | null; emailStatus: string }[] } | { ok: false }> {
  const session = await requireSession();
  const list = ids(personIds);
  if (!list.length) return { ok: false };
  const db = await createClient();
  const { data } = await db.from("prospects").select("id, email, phone, email_status").eq("workspace_id", session.workspace.id).in("id", list);
  if (!data?.length) return { ok: false };
  await db.from("prospects").update({ revealed_at: new Date().toISOString(), revealed_by: session.userId })
    .eq("workspace_id", session.workspace.id).in("id", data.map((p) => p.id)).is("revealed_at", null);
  revalidatePath("/prospects", "layout");
  return { ok: true, contacts: data.map((p) => ({ id: p.id, email: p.email_status === "invalid" ? null : p.email, phone: p.phone, emailStatus: p.email_status })) };
}

/** Bookmark: a company in / out of the Prospects list. */
export async function setCompanySaved(companyId: string, saved: boolean): Promise<{ ok: boolean }> {
  const session = await requireSession();
  if (!uuid.test(companyId)) return { ok: false };
  const db = await createClient();
  const { error } = await db.from("companies").update({ saved_at: saved ? new Date().toISOString() : null }).eq("id", companyId).eq("workspace_id", session.workspace.id);
  revalidatePath("/prospects", "layout");
  return { ok: !error };
}

export interface OutreachItem {
  prospectId: string;
  /** A draft Yolias wrote ("Personalize with Yolias"), or null for the shared message. */
  messageId: string | null;
  subject: string;
  body: string;
  language: "en" | "ar";
}

/**
 * "Start outreach": every selected person gets their message (Yolias's
 * draft or the shared one), approved and queued to send from the member's
 * mailbox. Returns the message ids for the progress page.
 */
export async function startOutreach(items: OutreachItem[], mailboxId: string): Promise<{ ok: true; ids: string[]; skipped: number } | { ok: false; error: string }> {
  const session = await requireSession();
  const e = (await getDictionary()).outreach.errors;
  const db = await createClient();
  const { data: box } = uuid.test(mailboxId) ? await db.from("mailboxes").select("id, status").eq("id", mailboxId).eq("user_id", session.userId).maybeSingle() : { data: null };
  if (!box || box.status !== "connected") return { ok: false, error: e.noMailbox };
  const wanted = items.filter((i) => uuid.test(i.prospectId) && i.subject.trim() && i.body.trim()).slice(0, 100);
  if (!wanted.length) return { ok: false, error: e.failed };
  const { data: people } = await db.from("prospects").select("id, campaign_id, email, email_status").eq("workspace_id", session.workspace.id).in("id", wanted.map((i) => i.prospectId));
  const byId = new Map((people ?? []).map((p) => [p.id, p]));
  const admin = createAdminClient();
  const out: string[] = [];
  let skipped = 0;
  for (const item of wanted) {
    const p = byId.get(item.prospectId);
    if (!p?.email || p.email_status === "invalid") { skipped++; continue; }
    const subject = item.subject.trim().slice(0, 300), body = item.body.trim().slice(0, 10_000);
    let id = item.messageId && uuid.test(item.messageId) ? item.messageId : null;
    if (id) {
      const { data: saved } = await db.from("outreach_messages").update({ subject, body }).eq("id", id).eq("prospect_id", p.id).eq("status", "draft").select("id").maybeSingle();
      if (!saved) id = null;
    }
    if (!id) {
      const { data: draft } = await admin.from("outreach_messages").insert({
        workspace_id: session.workspace.id, prospect_id: p.id, campaign_id: p.campaign_id, created_by: session.userId,
        to_email: p.email, subject, body, language: item.language === "ar" ? "ar" : "en", status: "draft",
      }).select("id").single();
      id = draft?.id ?? null;
    }
    if (!id) { skipped++; continue; }
    const { data: approved } = await db.from("outreach_messages").update({ status: "approved", mailbox_id: box.id }).eq("id", id).eq("status", "draft").select("id").maybeSingle();
    if (!approved) { skipped++; continue; }
    await enqueue("outreach.send", { messageId: id });
    out.push(id);
  }
  revalidatePath("/outreach");
  return out.length ? { ok: true, ids: out, skipped } : { ok: false, error: e.failed };
}

/** "Collect decision makers" for delivered companies (saved or not). Free: the company was the result (D-146). */
export async function collectDecisionMakers(companyIds: string[]): Promise<{ ok: boolean; queued: number }> {
  const session = await requireSession();
  const list = ids(companyIds);
  if (!list.length) return { ok: false, queued: 0 };
  const db = await createClient();
  const { data } = await db.from("companies").update({ people_requested_at: new Date().toISOString() })
    .eq("workspace_id", session.workspace.id).in("id", list).not("delivered_at", "is", null)
    .or("people_status.is.null,people_status.in.(no_source,failed)").select("id");
  const queued = (data ?? []).map((r) => r.id);
  for (let i = 0; i < queued.length; i += 20) {
    await enqueue("company.people", { workspaceId: session.workspace.id, companyIds: queued.slice(i, i + 20) });
  }
  revalidatePath("/prospects", "layout");
  revalidatePath("/search", "layout");
  return { ok: true, queued: queued.length };
}
