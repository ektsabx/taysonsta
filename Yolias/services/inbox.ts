import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { CrmLeadRow } from "@/types/database";

// Inbox (D-194, D-239): one conversation per lead. Every filter reads real
// rows: unread = a reply after the conversation was last opened; interested /
// not interested / needs follow-up = the conversation's label (from the reply
// analysis or the member); sent = a message sent; done = closed conversations.

export async function inboxThread(workspaceId: string, leadId: string) {
  const db = await createClient();
  const { data: lead } = await db.from("crm_leads").select("*").eq("workspace_id", workspaceId).eq("id", leadId).maybeSingle();
  if (!lead) return null;
  const [messages, tasks, enrollments, activity] = await Promise.all([
    db.from("outreach_messages").select("*").eq("lead_id", leadId).neq("status", "canceled").order("created_at").limit(200),
    db.from("lead_tasks").select("*").eq("lead_id", leadId).is("done_at", null).order("due_at", { nullsFirst: false }).limit(20),
    db.from("outreach_enrollments").select("id, status, campaign:outreach_campaigns(id, name)").eq("lead_id", leadId),
    // What Yolias did in this conversation (D-234): drafts, sends, reply analysis, stage changes, auto-replies.
    db.from("lead_activities").select("id, kind, actor_kind, body, created_at").eq("lead_id", leadId).in("actor_kind", ["agent", "system", "automation"]).order("created_at", { ascending: false }).limit(15),
  ]);
  return {
    lead: lead as CrmLeadRow,
    messages: messages.data ?? [],
    tasks: tasks.data ?? [],
    activity: activity.data ?? [],
    campaigns: (enrollments.data ?? []).map((e) => ({ status: e.status, ...(e.campaign as unknown as { id: string; name: string }) })).filter((c) => c.id),
  };
}
export type InboxThread = NonNullable<Awaited<ReturnType<typeof inboxThread>>>;
