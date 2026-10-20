import { memberMailboxes } from "@/lib/mailbox";
import { createClient } from "@/lib/supabase/server";
import { PendingApprovals } from "@/components/app/ws/PendingApprovals";
import type { Metadata } from "next";
import Link from "next/link";
import { Info, Search } from "lucide-react";
import { requireViewer } from "@/lib/session";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { INBOX_FILTERS, inboxThread, listInbox, type InboxFilter } from "@/services/inbox";
import { StatusFilter } from "@/components/app/StatusFilter";
import { InboxThreadView } from "@/components/app/ws/InboxThread";
import { StageBadge } from "@/components/app/ws/bits";
import { shortDate } from "@/components/app/ws/format";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).ws.inbox.title} | Yolias` };
}

// Inbox (D-194, D-239): the replies to the campaigns, one conversation per
// lead, labelled Interested / Not interested / Needs follow-up. The member or
// Yolias answers from here; filters come from real rows.
export default async function InboxPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requireViewer();
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const filter = (INBOX_FILTERS as readonly string[]).includes(one(sp.filter)) ? (one(sp.filter) as InboxFilter) : "all";
  const q = one(sp.q).slice(0, 100);
  const leadId = /^[0-9a-f-]{36}$/i.test(one(sp.lead)) ? one(sp.lead) : null;
  const [t, locale, list, thread, boxes, approvals] = await Promise.all([
    getDictionary(), getLocale(), listInbox(session.workspace.id, filter, q), leadId ? inboxThread(session.workspace.id, leadId) : Promise.resolve(null),
    memberMailboxes(session.workspace.id, session.userId),
    // What the agent is waiting for the member to approve (moved here from the AI Agent page, D-233).
    (await createClient()).from("agent_pending_actions").select("id, lead_id, tool, input, summary, created_at, lead:sales_leads(name)")
      .eq("workspace_id", session.workspace.id).eq("status", "pending").not("lead_id", "is", null).order("created_at", { ascending: false }).limit(50),
  ]);
  const hasMailbox = boxes.some((m) => m.status === "connected");
  const w = t.ws.inbox;
  const tz = session.profile.timezone;
  const link = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const cur: Record<string, string | null> = { filter: filter === "all" ? null : filter, q: q || null, lead: leadId, ...patch };
    for (const [k, v] of Object.entries(cur)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/inbox?${s}` : "/inbox";
  };

  return (
    <div className="page-view">
      <header className="view-header">
        <div className="view-title-group">
          <h2>{w.title}</h2>
          <p>{w.subtitle}</p>
        </div>
      </header>
      {!hasMailbox && <div className="ws-note" style={{ margin: "14px 34px 0" }}><Info /><span><strong>{t.ws.common.notConnectedTitle}.</strong> {t.ws.common.mailboxNotConnected}</span></div>}
      <div className="inbox-approvals">
        <PendingApprovals timeZone={tz} approvals={(approvals.data ?? []).map((x) => ({ id: x.id, leadId: x.lead_id!, leadName: (x.lead as unknown as { name: string } | null)?.name ?? "-", tool: x.tool, input: x.input, summary: x.summary, createdAt: x.created_at }))} />
      </div>
      <div className={`inbox${thread ? " has-thread" : ""}`} style={{ marginTop: 14 }}>
        <aside className="inbox-list">
          <div className="inbox-list-head">
            <form method="get" action="/inbox" className="toolbar-search">
              {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
              <Search />
              <input className="form-input" name="q" defaultValue={q} placeholder={w.search} aria-label={w.search} />
            </form>
            {/* What to show: all, unread, or a label (D-239). */}
            <div className="inbox-filters">
              <StatusFilter param="filter" base={link({ filter: null, lead: null })} value={filter === "all" ? "" : filter} label={w.show}
                options={INBOX_FILTERS.map((f) => ({ value: f === "all" ? "" : f, label: `${w.filters[f]} (${list.counts[f]})` }))} />
            </div>
          </div>
          <div className="inbox-items">
            {!list.items.length && <p className="ws-muted" style={{ padding: 16 }}>{filter === "all" && !q ? w.emptyAll : w.empty}</p>}
            {list.items.map((l) => (
              <Link key={l.id} href={link({ lead: l.id })} className={`inbox-item${l.id === leadId ? " active" : ""}${l.unread ? " unread" : ""}`}>
                <div className="inbox-item-top">
                  <strong>{l.name}</strong>
                  <time>{shortDate(l.previewAt ?? l.last_activity_at, locale, tz)}</time>
                </div>
                {l.company_name && l.company_name !== l.name && <div className="cell-sub">{l.company_name}</div>}
                <div className="inbox-item-preview" dir="auto">{l.preview ?? "-"}</div>
                <div className="ws-inline">
                  {l.thread_label && <span className={`ws-chip label-${l.thread_label}`}>{w.labels[l.thread_label]}</span>}
                  <StageBadge stage={l.stage} />
                  {l.thread_status && l.thread_status !== "open" && <span className="ws-chip">{w.filters.done}</span>}
                </div>
              </Link>
            ))}
          </div>
        </aside>
        <section className="inbox-thread">
          {thread ? <InboxThreadView thread={thread} backHref={link({ lead: null })} timeZone={tz} hasMailbox={hasMailbox} /> : <div className="inbox-placeholder">{w.select}</div>}
        </section>
      </div>
    </div>
  );
}
