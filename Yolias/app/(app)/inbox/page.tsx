import type { Metadata } from "next";
import { requireViewer } from "@/lib/session";
import { getDictionary } from "@/lib/i18n/server";
import { memberMailboxes } from "@/lib/mailbox";
import { inboxThread } from "@/services/inbox";
import { INBOX_SHOWS, INBOX_TABS, campaignLive, masterInbox, type InboxShow, type InboxTab } from "@/services/master-inbox";
import { createClient } from "@/lib/supabase/server";
import { BUYING_INTENTS } from "@/lib/buying-intent";
import { createAdminClient } from "@/lib/supabase/admin";
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
  const tab = (INBOX_TABS as readonly string[]).includes(one(sp.tab)) ? (one(sp.tab) as InboxTab) : "all";
  const q = one(sp.q).slice(0, 100);
  const leadId = /^[0-9a-f-]{36}$/i.test(one(sp.lead)) ? one(sp.lead) : null;
  const campaignId = /^[0-9a-f-]{36}$/i.test(one(sp.campaign)) ? one(sp.campaign) : null;
  const show = (INBOX_SHOWS as readonly string[]).includes(one(sp.show)) ? (one(sp.show) as InboxShow) : null;
  const [list, thread, status, boxes, live, { data: campaignOptions }] = await Promise.all([
    masterInbox(ws, tab, q, campaignId, show),
    leadId ? inboxThread(ws, leadId) : Promise.resolve(null),
    leadId ? leadStatuses(ws, { leadIds: [leadId] }).then((r) => r[0] ?? null) : Promise.resolve(null),
    memberMailboxes(ws, session.userId),
    campaignId ? campaignLive(ws, campaignId) : Promise.resolve(null),
    (await createClient()).from("outreach_campaigns").select("id, name").eq("workspace_id", ws).neq("status", "archived").order("created_at", { ascending: false }).limit(100),
  ]);
  const connected = boxes.find((m) => m.status === "connected") ?? null;
  const { data: tagRows } = await createAdminClient().from("lead_tags").select("lead_id, tag").eq("workspace_id", ws).limit(20000);
  const tagsOf = new Map<string, string[]>();
  for (const r of tagRows ?? []) tagsOf.set(r.lead_id, [...(tagsOf.get(r.lead_id) ?? []), r.tag]);
  const tag = one(sp.tag).slice(0, 40) || null;
  const intent = (BUYING_INTENTS as string[]).includes(one(sp.intent)) ? one(sp.intent) : null;
  const items = list.all.filter((i) => (!tag || tagsOf.get(i.leadId)?.includes(tag)) && (!intent || i.status?.lastInbound?.intent === intent));
  return (
    <MasterInbox
      tab={tab} counts={list.counts} items={items} q={q} tag={tag} intent={intent} allTags={[...new Set((tagRows ?? []).map((r) => r.tag))].sort()} leadTags={leadId ? tagsOf.get(leadId) ?? [] : []}
      thread={thread} status={status} hasMailbox={Boolean(connected)} mailboxEmail={connected?.email ?? null} timeZone={session.profile.timezone ?? null}
      campaign={live} campaigns={campaignOptions ?? []} show={show}
    />
  );
}
