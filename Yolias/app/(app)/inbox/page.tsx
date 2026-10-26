import type { Metadata } from "next";
import { requireViewer } from "@/lib/session";
import { getDictionary } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { memberMailboxes } from "@/lib/mailbox";
import { inboxThread } from "@/services/inbox";
import { INBOX_TABS, masterInbox, type InboxTab } from "@/services/master-inbox";
import { leadStatuses } from "@/services/pipeline";
import { MasterInbox } from "@/components/app/inbox/MasterInbox";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).sdr.inbox.title} | Yolias` };
}

// Conversations (D-256): the Inbox after AgentSDR's Master Inbox, one list
// of every conversation with a reply, the thread and the lead's details.
// ?tab, ?q, ?campaign (filter) and ?lead (the open conversation) live in the URL.
export default async function InboxPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requireViewer();
  const ws = session.workspace.id;
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const tab = (INBOX_TABS as readonly string[]).includes(one(sp.tab)) ? (one(sp.tab) as InboxTab) : "inbox";
  const q = one(sp.q).slice(0, 100);
  const campaignId = /^[0-9a-f-]{36}$/i.test(one(sp.campaign)) ? one(sp.campaign) : null;
  const leadId = /^[0-9a-f-]{36}$/i.test(one(sp.lead)) ? one(sp.lead) : null;
  const db = await createClient();
  const [list, thread, status, boxes, approvals, tasks, campaigns] = await Promise.all([
    masterInbox(ws, tab, q, campaignId),
    leadId ? inboxThread(ws, leadId) : Promise.resolve(null),
    leadId ? leadStatuses(ws, { leadIds: [leadId] }).then((r) => r[0] ?? null) : Promise.resolve(null),
    memberMailboxes(ws, session.userId),
    db.from("agent_pending_actions").select("id, lead_id, tool, input, summary, created_at, lead:sales_leads(name)").eq("workspace_id", ws).eq("status", "pending").not("lead_id", "is", null).order("created_at", { ascending: false }).limit(50),
    db.from("lead_tasks").select("id, title, lead_id, due_at, lead:sales_leads(name)").eq("workspace_id", ws).is("done_at", null).order("due_at", { nullsFirst: false }).limit(50),
    db.from("outreach_campaigns").select("id, name").eq("workspace_id", ws).neq("status", "archived").order("created_at", { ascending: false }).limit(100),
  ]);
  const connected = boxes.find((m) => m.status === "connected") ?? null;
  return (
    <MasterInbox
      tab={tab} counts={list.counts} items={list.items} q={q} campaignId={campaignId} campaigns={campaigns.data ?? []}
      thread={thread} status={status} hasMailbox={Boolean(connected)} mailboxEmail={connected?.email ?? null} timeZone={session.profile.timezone ?? null}
      approvals={(approvals.data ?? []).map((x) => ({ id: x.id, leadId: x.lead_id!, leadName: (x.lead as unknown as { name: string } | null)?.name ?? "-", tool: x.tool, input: x.input, summary: x.summary, createdAt: x.created_at }))}
      tasks={(tasks.data ?? []).map((k) => ({ id: k.id, title: k.title, leadId: k.lead_id, leadName: (k.lead as unknown as { name: string } | null)?.name ?? "-", dueAt: k.due_at }))}
    />
  );
}
