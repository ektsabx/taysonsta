import type { Metadata } from "next";
import { requireViewer } from "@/lib/session";
import { getDictionary } from "@/lib/i18n/server";
import { memberMailboxes } from "@/lib/mailbox";
import { inboxThread } from "@/services/inbox";
import { INBOX_TABS, campaignLive, masterInbox, type InboxTab } from "@/services/master-inbox";
import { leadStatuses } from "@/services/pipeline";
import { MasterInbox } from "@/components/app/inbox/MasterInbox";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).sdr.inbox.title} | Yolias` };
}

// Conversations (D-256): the Inbox after AgentSDR's Master Inbox, one list
// of every conversation with a reply, the thread and the lead's details.
// ?tab, ?q and ?lead live in the URL. ?campaign (after approving a campaign,
// D-269) shows that campaign's conversations with a live strip on top while
// Yolias writes and sends them.
export default async function InboxPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requireViewer();
  const ws = session.workspace.id;
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const tab = (INBOX_TABS as readonly string[]).includes(one(sp.tab)) ? (one(sp.tab) as InboxTab) : "inbox";
  const q = one(sp.q).slice(0, 100);
  const leadId = /^[0-9a-f-]{36}$/i.test(one(sp.lead)) ? one(sp.lead) : null;
  const campaignId = /^[0-9a-f-]{36}$/i.test(one(sp.campaign)) ? one(sp.campaign) : null;
  const [list, thread, status, boxes, live] = await Promise.all([
    masterInbox(ws, tab, q, campaignId),
    leadId ? inboxThread(ws, leadId) : Promise.resolve(null),
    leadId ? leadStatuses(ws, { leadIds: [leadId] }).then((r) => r[0] ?? null) : Promise.resolve(null),
    memberMailboxes(ws, session.userId),
    campaignId ? campaignLive(ws, campaignId) : Promise.resolve(null),
  ]);
  const connected = boxes.find((m) => m.status === "connected") ?? null;
  return (
    <MasterInbox
      tab={tab} counts={list.counts} items={list.items} q={q}
      thread={thread} status={status} hasMailbox={Boolean(connected)} mailboxEmail={connected?.email ?? null} timeZone={session.profile.timezone ?? null}
      campaign={live}
    />
  );
}
