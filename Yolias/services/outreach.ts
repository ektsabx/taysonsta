import "server-only";
import { createClient } from "@/lib/supabase/server";
import { mailers } from "@/lib/outreach/mailers";
import type { MailboxRow, MailProvider, OutreachMessageRow, OutreachStatus } from "@/types/database";

// Outreach data for the member (RLS): their mailboxes, the workspace's
// messages by status, and the messages of one prospect.

export type MailboxView = Pick<MailboxRow, "id" | "provider" | "email" | "status" | "daily_limit" | "sent_today" | "sent_day">;

export async function myMailboxes(userId: string): Promise<MailboxView[]> {
  const db = await createClient();
  const { data } = await db.from("mailboxes").select("id, provider, email, status, daily_limit, sent_today, sent_day").eq("user_id", userId).order("provider");
  const today = new Date().toISOString().slice(0, 10);
  return (data ?? []).map((m) => ({ ...m, sent_today: m.sent_day === today ? m.sent_today : 0 }));
}

/** Which mail providers this deployment can connect (OAuth client configured). */
export function providersAvailable(): Record<MailProvider, boolean> {
  return { gmail: Boolean(mailers.gmail.app()), outlook: Boolean(mailers.outlook.app()) };
}

export const outreachTabs = ["draft", "approved", "sent", "failed", "canceled"] as const;
export type OutreachTab = (typeof outreachTabs)[number];

export type OutreachListItem = OutreachMessageRow & { prospect: { id: string; full_name: string; title: string | null } | null };

export async function listOutreach(workspaceId: string, tab: OutreachTab, limit = 100): Promise<OutreachListItem[]> {
  const db = await createClient();
  const statuses: OutreachStatus[] = tab === "approved" ? ["approved", "sending"] : [tab];
  const { data } = await db.from("outreach_messages").select("*, prospect:prospects(id, full_name, title)")
    .eq("workspace_id", workspaceId).in("status", statuses).order("updated_at", { ascending: false }).limit(limit);
  return (data ?? []) as unknown as OutreachListItem[];
}

export async function outreachCounts(workspaceId: string): Promise<Record<OutreachTab, number>> {
  const db = await createClient();
  const head = { count: "exact" as const, head: true };
  const counts = await Promise.all(outreachTabs.map((t) =>
    db.from("outreach_messages").select("id", head).eq("workspace_id", workspaceId).in("status", t === "approved" ? ["approved", "sending"] : [t])));
  return Object.fromEntries(outreachTabs.map((t, i) => [t, counts[i].count ?? 0])) as Record<OutreachTab, number>;
}

export async function messagesFor(prospectId: string): Promise<OutreachMessageRow[]> {
  const db = await createClient();
  const { data } = await db.from("outreach_messages").select("*").eq("prospect_id", prospectId).order("created_at", { ascending: false }).limit(10);
  return data ?? [];
}
