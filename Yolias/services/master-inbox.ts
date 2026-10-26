import "server-only";
import { createClient } from "@/lib/supabase/server";
import { leadStatuses, type LeadStatus } from "@/services/pipeline";
import type { CrmLeadRow } from "@/types/database";

// The Inbox (D-256, after AgentSDR's Master Inbox): every conversation that
// has a reply, in one list. Tabs read the same statuses as the CRM pipeline:
//   inbox        open conversations with a reply (the badge counts unread ones)
//   replies      open conversations whose latest reply is a person's (not out of office)
//   to_approve   a reply draft or an agent action waits for the member
//   out_of_office  the latest reply is an automatic one
//   sent         something went out to them
//   done         closed conversations
// Read as the member (RLS).

export const INBOX_TABS = ["inbox", "replies", "to_approve", "out_of_office", "sent", "done"] as const;
export type InboxTab = (typeof INBOX_TABS)[number];
const term = (s: string) => s.replace(/[%,()*\\]/g, " ").trim();

export interface InboxListItem {
  leadId: string;
  name: string;
  company: string | null;
  at: string;
  subject: string;
  preview: string;
  unread: boolean;
  hasDraft: boolean;
  status: LeadStatus | null;
}

export async function masterInbox(workspaceId: string, tab: InboxTab, search: string, campaignId: string | null = null): Promise<{ items: InboxListItem[]; counts: Record<InboxTab, number> }> {
  const db = await createClient();
  let q = db.from("crm_leads").select("*").eq("workspace_id", workspaceId).not("thread_last_message_at", "is", null);
  const s = term(search);
  if (s) q = q.or(`name.ilike.%${s}%,company_name.ilike.%${s}%,email.ilike.%${s}%`);
  if (campaignId) {
    const { data: enr } = await db.from("outreach_enrollments").select("lead_id").eq("workspace_id", workspaceId).eq("campaign_id", campaignId).limit(5000);
    q = q.in("id", [...new Set((enr ?? []).map((e) => e.lead_id))].slice(0, 1000).concat("00000000-0000-0000-0000-000000000000"));
  }
  const [{ data: rows }, { data: approvals }] = await Promise.all([
    q.order("thread_last_message_at", { ascending: false }).limit(400),
    db.from("agent_pending_actions").select("lead_id").eq("workspace_id", workspaceId).eq("status", "pending").not("lead_id", "is", null).limit(500),
  ]);
  const leads = (rows ?? []) as CrmLeadRow[];
  const statuses = new Map((await leadStatuses(workspaceId, { leadIds: leads.map((l) => l.id) })).map((x) => [x.leadId, x]));
  const waiting = new Set((approvals ?? []).map((a) => a.lead_id));
  const { data: last } = leads.length
    ? await db.from("outreach_messages").select("lead_id, subject, body, received_at, sent_at, created_at").in("lead_id", leads.map((l) => l.id)).in("status", ["sent", "received"]).order("created_at", { ascending: false }).limit(leads.length * 3)
    : { data: [] as { lead_id: string | null; subject: string; body: string; received_at: string | null; sent_at: string | null; created_at: string }[] };
  const latest = new Map<string, { subject: string; body: string; at: string }>();
  for (const m of last ?? []) if (m.lead_id && !latest.has(m.lead_id)) latest.set(m.lead_id, { subject: m.subject, body: m.body, at: m.received_at ?? m.sent_at ?? m.created_at });

  const items: (InboxListItem & { tabs: Set<InboxTab> })[] = leads.map((l) => {
    const st = statuses.get(l.id) ?? null;
    const open = (l.thread_status ?? "open") === "open";
    const tabs = new Set<InboxTab>();
    if (!open) tabs.add("done");
    if (open && st?.lastInbound) tabs.add("inbox");
    if (open && st?.lastInbound && st.lastInbound.kind !== "out_of_office") tabs.add("replies");
    if (open && st?.lastInbound?.kind === "out_of_office") tabs.add("out_of_office");
    if (st?.draft || waiting.has(l.id)) tabs.add("to_approve");
    if (st?.lastOutbound) tabs.add("sent");
    const m = latest.get(l.id);
    return {
      leadId: l.id, name: l.name, company: l.company_name !== l.name ? l.company_name : null, at: m?.at ?? l.thread_last_message_at!,
      subject: m?.subject ?? "", preview: (m?.body ?? "").replace(/\s+/g, " ").slice(0, 160), unread: l.unread,
      hasDraft: Boolean(st?.draft || st?.lastInbound?.suggestedReply), status: st, tabs,
    };
  });
  const counts = Object.fromEntries(INBOX_TABS.map((t) => [t, t === "inbox" ? items.filter((i) => i.tabs.has("inbox") && i.unread).length : items.filter((i) => i.tabs.has(t)).length])) as Record<InboxTab, number>;
  return { items: items.filter((i) => i.tabs.has(tab)).map(({ tabs: _t, ...i }) => { void _t; return i; }), counts };
}
