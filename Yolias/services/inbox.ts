import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { CrmLeadRow } from "@/types/database";

// Inbox (D-194): one conversation per lead. Every filter reads real rows:
// unread = a logged reply after the conversation was last opened; reminders =
// open tasks; scheduled = drafts with a planned send time; sent = a message
// confirmed sent; done / others = the conversation's own status.

export const INBOX_FILTERS = ["all", "unread", "reminders", "scheduled", "sent", "done", "others"] as const;
export type InboxFilter = (typeof INBOX_FILTERS)[number];
const LIMIT = 100;
const term = (s: string) => s.replace(/[%,()*\\]/g, " ").trim();

export interface InboxItem extends CrmLeadRow { preview: string | null; previewAt: string | null }

async function leadIdsWithMessages(workspaceId: string, kind: "scheduled" | "sent"): Promise<string[]> {
  const db = await createClient();
  let q = db.from("outreach_messages").select("lead_id").eq("workspace_id", workspaceId).not("lead_id", "is", null).eq("direction", "outbound");
  q = kind === "scheduled" ? q.not("scheduled_for", "is", null).in("status", ["draft", "approved"]) : q.eq("status", "sent");
  const { data } = await q.order("created_at", { ascending: false }).limit(1000);
  return [...new Set((data ?? []).map((m) => m.lead_id!))];
}

export async function listInbox(workspaceId: string, filter: InboxFilter, search: string): Promise<{ items: InboxItem[]; counts: Record<InboxFilter, number> }> {
  const db = await createClient();
  const base = () => db.from("crm_leads").select("*", { count: "exact" }).eq("workspace_id", workspaceId);
  const [scheduledIds, sentIds] = await Promise.all([leadIdsWithMessages(workspaceId, "scheduled"), leadIdsWithMessages(workspaceId, "sent")]);
  const apply = (q: ReturnType<typeof base>, f: InboxFilter) => {
    switch (f) {
      case "all": return q.not("thread_last_message_at", "is", null).eq("thread_status", "open");
      case "unread": return q.eq("unread", true);
      case "reminders": return q.gt("open_tasks", 0);
      case "scheduled": return q.in("id", scheduledIds.length ? scheduledIds : ["00000000-0000-0000-0000-000000000000"]);
      case "sent": return q.in("id", sentIds.length ? sentIds.slice(0, 500) : ["00000000-0000-0000-0000-000000000000"]);
      case "done": return q.eq("thread_status", "done");
      case "others": return q.eq("thread_status", "other");
    }
  };
  const counts = Object.fromEntries(await Promise.all(INBOX_FILTERS.map(async (f) => {
    const { count } = await apply(db.from("crm_leads").select("*", { count: "exact", head: true }).eq("workspace_id", workspaceId), f);
    return [f, count ?? 0];
  }))) as Record<InboxFilter, number>;

  let q = apply(base(), filter);
  const s = term(search);
  if (s) q = q.or(`name.ilike.%${s}%,company_name.ilike.%${s}%,email.ilike.%${s}%`);
  const { data } = await q.order("thread_last_message_at", { ascending: false, nullsFirst: false }).order("last_activity_at", { ascending: false }).limit(LIMIT);
  const rows = (data ?? []) as CrmLeadRow[];
  const previews = new Map<string, { body: string; at: string }>();
  if (rows.length) {
    const { data: msgs } = await db.from("outreach_messages").select("lead_id, subject, body, created_at, received_at, sent_at")
      .in("lead_id", rows.map((r) => r.id)).neq("status", "canceled").order("created_at", { ascending: false }).limit(rows.length * 4);
    for (const m of msgs ?? []) if (m.lead_id && !previews.has(m.lead_id)) previews.set(m.lead_id, { body: (m.subject || m.body).slice(0, 140), at: m.received_at ?? m.sent_at ?? m.created_at });
  }
  return { items: rows.map((r) => ({ ...r, preview: previews.get(r.id)?.body ?? null, previewAt: previews.get(r.id)?.at ?? null })), counts };
}

export async function inboxThread(workspaceId: string, leadId: string) {
  const db = await createClient();
  const { data: lead } = await db.from("crm_leads").select("*").eq("workspace_id", workspaceId).eq("id", leadId).maybeSingle();
  if (!lead) return null;
  const [messages, tasks, enrollments] = await Promise.all([
    db.from("outreach_messages").select("*").eq("lead_id", leadId).neq("status", "canceled").order("created_at").limit(200),
    db.from("lead_tasks").select("*").eq("lead_id", leadId).is("done_at", null).order("due_at", { nullsFirst: false }).limit(20),
    db.from("outreach_enrollments").select("id, status, campaign:outreach_campaigns(id, name)").eq("lead_id", leadId),
  ]);
  return {
    lead: lead as CrmLeadRow,
    messages: messages.data ?? [],
    tasks: tasks.data ?? [],
    campaigns: (enrollments.data ?? []).map((e) => ({ status: e.status, ...(e.campaign as unknown as { id: string; name: string }) })).filter((c) => c.id),
  };
}
export type InboxThread = NonNullable<Awaited<ReturnType<typeof inboxThread>>>;
