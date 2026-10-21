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
import { LaunchPanel } from "@/components/app/ws/LaunchPanel";
import { loadAiSettings } from "@/lib/ai-workspace/server";
import { shortDate } from "@/components/app/ws/format";
import { campaignWorkspace, getOutreachCampaign, launchSummary, listOutreachCampaigns, outreachOptions } from "@/services/outreach-campaigns";
import { CampaignWorkspaceView } from "@/components/app/ws/CampaignWorkspace";

const LABEL_FILTERS = new Set<InboxFilter>(["interested", "not_interested", "follow_up"]);
import { Plus } from "lucide-react";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).ws.conversations.title} | Yolias` };
}

// Conversations (owner, 2026-10-20, D-249): Outreach and the Inbox in one
// page. "Campaigns" (first, owner 2026-10-21): the campaigns that start the
// conversations (D-193); one opens its conversations with its approval / run
// panel. "Conversations": one thread per lead with what was sent and every reply.
export default async function ConversationsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requireViewer();
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const filter = (INBOX_FILTERS as readonly string[]).includes(one(sp.filter)) ? (one(sp.filter) as InboxFilter) : "all";
  const q = one(sp.q).slice(0, 100);
  const leadId = /^[0-9a-f-]{36}$/i.test(one(sp.lead)) ? one(sp.lead) : null;
  // Campaigns come first (owner 2026-10-21); a conversation, a campaign filter or a search opens the threads.
  const tab = one(sp.tab) === "threads" || leadId || /^[0-9a-f-]{36}$/i.test(one(sp.campaign)) || one(sp.filter) || q ? "threads" : "campaigns";
  // A campaign opens these same conversations, filtered to its leads (D-252).
  const campaignId = /^[0-9a-f-]{36}$/i.test(one(sp.campaign)) ? one(sp.campaign) : null;
  // A campaign has one place (owner 2026-10-21): its conversations, its emails and its sequence, as sub-tabs here.
  const view = campaignId && (one(sp.view) === "emails" || one(sp.view) === "sequence") ? (one(sp.view) as "emails" | "sequence") : "threads";
  const [t, locale, list, thread, boxes, approvals, campaigns, launch, settings] = await Promise.all([
    getDictionary(), getLocale(), listInbox(session.workspace.id, filter, q, null, campaignId), leadId ? inboxThread(session.workspace.id, leadId) : Promise.resolve(null),
    memberMailboxes(session.workspace.id, session.userId),
    // What the agent is waiting for the member to approve (moved here from the AI Agent page, D-233).
    (await createClient()).from("agent_pending_actions").select("id, lead_id, tool, input, summary, created_at, lead:sales_leads(name)")
      .eq("workspace_id", session.workspace.id).eq("status", "pending").not("lead_id", "is", null).order("created_at", { ascending: false }).limit(50),
    listOutreachCampaigns(session.workspace.id),
    // A campaign opened here shows its approval / run panel above its conversations (D-253).
    campaignId ? launchSummary(session.workspace.id, campaignId) : Promise.resolve(null),
    loadAiSettings(session.workspace.id),
  ]);
  const work = campaignId && view !== "threads"
    ? await Promise.all([getOutreachCampaign(session.workspace.id, campaignId), outreachOptions(session.workspace.id), campaignWorkspace(session.workspace.id, campaignId),
        (await createClient()).from("sales_leads").select("id, name, company_name, stage, do_not_contact").eq("workspace_id", session.workspace.id).order("last_activity_at", { ascending: false }).limit(500)])
    : null;
  const hasMailbox = boxes.some((m) => m.status === "connected");
  const mailboxEmail = boxes.find((m) => m.status === "connected")?.email ?? null;
  const w = t.ws.inbox;
  const c = t.ws.conversations;
  const o = t.ws.outreach;
  const tz = session.profile.timezone;
  const link = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const cur: Record<string, string | null> = { campaign: campaignId, filter: filter === "all" ? null : filter, q: q || null, lead: leadId, ...patch };
    for (const [k, v] of Object.entries(cur)) if (v) p.set(k, v);
    return `/conversations?${p.toString() || "tab=threads"}`;
  };
  const statusCls = { draft: "status-muted", active: "status-active", paused: "status-muted", archived: "status-muted" } as const;
  const unread = list.counts.unread ?? 0;
  const filtered = campaignId ? campaigns.find((x) => x.id === campaignId) ?? null : null;

  return (
    <div className="page-view">
      <header className="view-header">
        <div className="view-title-group">
          <h2>{c.title}</h2>
          <p>{c.subtitle}</p>
        </div>
        <div className="view-actions">
          <Link className={tab === "campaigns" ? "btn-primary" : "btn-secondary"} href="/outreach/new"><Plus /> {o.newCampaign}</Link>
        </div>
      </header>
      <nav className="conv-tabs" aria-label={c.title}>
        <Link href="/conversations" className={tab === "campaigns" ? "active" : ""} aria-current={tab === "campaigns" ? "page" : undefined}>{c.tabs.campaigns}<span className="conv-count muted">{campaigns.length}</span></Link>
        <Link href="/conversations?tab=threads" className={tab === "threads" ? "active" : ""} aria-current={tab === "threads" ? "page" : undefined}>{c.tabs.threads}{unread ? <span className="conv-count">{unread}</span> : null}</Link>
      </nav>
      {!hasMailbox && <div className="ws-note" style={{ margin: "14px 34px 0" }}><Info /><span><strong>{t.ws.common.notConnectedTitle}.</strong> {t.ws.common.mailboxNotConnected}</span></div>}
      {tab === "campaigns" ? (
        <div className="view-content-padding">
          <div className="data-table-card">
            <div className="data-table-scroll">
              <table className="data-table">
                <thead>
                  <tr><th>{o.colName}</th><th>{o.colStatus}</th><th>{o.colLeads}</th><th>{o.colDrafts}</th><th>{o.colSent}</th><th>{o.colReplies}</th><th>{o.colMeetings}</th><th>{o.colUpdated}</th></tr>
                </thead>
                <tbody>
                  {!campaigns.length && <tr><td colSpan={8} className="empty-cell">{o.empty}</td></tr>}
                  {campaigns.map((x) => (
                    <tr key={x.id}>
                      <td>
                        <Link className="entity-link" href={`/conversations?campaign=${x.id}`}>
                          <strong>{x.name}</strong>
                          <span className="cell-sub">{[o.channels[x.channel], x.goal].filter(Boolean).join(" · ")}</span>
                        </Link>
                      </td>
                      <td><span className={statusCls[x.status]}>{o.status[x.status]}</span></td>
                      <td>{x.stats.leads}</td><td>{x.stats.drafts}</td><td>{x.stats.sent}</td>
                      <td>{x.stats.replies ? <Link className="entity-link" href={`/conversations?campaign=${x.id}`}>{x.stats.replies}</Link> : 0}</td>
                      <td>{x.stats.meetings}</td>
                      <td className="cell-sub">{shortDate(x.updated_at, locale, tz)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (<>
      {campaignId && (
        <div className="conv-filter" role="status">
          <span>{c.filteredBy} <strong>{filtered?.name ?? "-"}</strong></span>
          <Link className="btn-secondary ws-btn-sm" href={link({ campaign: null, lead: null })}>{c.clearFilter}</Link>
        </div>
      )}
      {campaignId && (
        <nav className="conv-subtabs" aria-label={filtered?.name ?? c.title}>
          {(["threads", "emails", "sequence"] as const).map((v) => (
            <Link key={v} href={`/conversations?campaign=${campaignId}${v === "threads" ? "" : `&view=${v}`}`} className={view === v ? "active" : ""} aria-current={view === v ? "page" : undefined}>
              {v === "threads" ? c.tabs.threads : o.workspace.tabs[v]}
            </Link>
          ))}
        </nav>
      )}
      {work && work[0] && launch ? (
        <div className="view-content-padding">
          <CampaignWorkspaceView
            embedded={{ view: view as "emails" | "sequence" }}
            detail={work[0]} options={work[1]} work={work[2]} maxSteps={settings.limits.max_messages_per_lead}
            candidates={(work[3].data ?? []).filter((l) => !work[0]!.enrollments.some((e) => e.lead_id === l.id))}
            timeZone={tz} launch={launch}
            mailboxes={boxes.filter((m) => m.status === "connected").map((m) => ({ id: m.id, email: m.email, provider: m.provider }))}
            mailboxName={boxes.find((m) => m.id === launch.campaign.mailbox_id)?.email ?? null}
            dailyLimit={settings.limits.daily_send_limit}
          />
        </div>
      ) : (<>
      {launch && launch.campaign.status !== "archived" && (
        <div className="conv-launch">
          {hasMailbox || launch.campaign.approved_at
            ? <LaunchPanel summary={launch} mailboxes={boxes.filter((m) => m.status === "connected").map((m) => ({ id: m.id, email: m.email, provider: m.provider }))} mailboxName={boxes.find((m) => m.id === launch.campaign.mailbox_id)?.email ?? null} dailyLimit={settings.limits.daily_send_limit} />
            : null}
        </div>
      )}
      <div className="inbox-approvals">
        <PendingApprovals timeZone={tz} approvals={(approvals.data ?? []).map((x) => ({ id: x.id, leadId: x.lead_id!, leadName: (x.lead as unknown as { name: string } | null)?.name ?? "-", tool: x.tool, input: x.input, summary: x.summary, createdAt: x.created_at }))} />
      </div>
      <div className={`inbox${thread ? " has-thread" : ""}`} style={{ marginTop: 14 }}>
        <aside className="inbox-list">
          <div className="inbox-list-head">
            <form method="get" action="/conversations" className="toolbar-search">
              {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
              {campaignId && <input type="hidden" name="campaign" value={campaignId} />}
              <Search />
              <input className="form-input" name="q" defaultValue={q} placeholder={w.search} aria-label={w.search} />
            </form>
            {/* What to show: all, unread, or a label (D-239). */}
            <div className="inbox-filters">
              <StatusFilter param="filter" base={link({ filter: null, lead: null })} value={filter === "all" ? "" : filter} label={w.show}
                options={INBOX_FILTERS.filter((f) => !LABEL_FILTERS.has(f)).map((f) => ({ value: f === "all" ? "" : f, label: `${w.filters[f]} (${list.counts[f]})` }))} />
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
                {/* Labels and stages removed from the list (owner 2026-10-21): Yolias AI sorts replies, "Move to CRM" makes a deal. */}
                {l.thread_status && l.thread_status !== "open" && <div className="ws-inline"><span className="ws-chip">{w.filters.done}</span></div>}
              </Link>
            ))}
          </div>
        </aside>
        <section className="inbox-thread">
          {thread ? <InboxThreadView thread={thread} backHref={link({ lead: null })} timeZone={tz} hasMailbox={hasMailbox} mailboxEmail={mailboxEmail} /> : <div className="inbox-placeholder">{w.select}</div>}
        </section>
      </div>
      </>)}
      </>)}
    </div>
  );
}
