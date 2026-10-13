import type { Metadata } from "next";
import Link from "next/link";
import { Info, Search } from "lucide-react";
import { requireSession } from "@/lib/session";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { INBOX_FILTERS, inboxThread, listInbox, type InboxFilter } from "@/services/inbox";
import { InboxThreadView } from "@/components/app/ws/InboxThread";
import { StageBadge } from "@/components/app/ws/bits";
import { shortDate } from "@/components/app/ws/format";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).ws.inbox.title} — Yolias` };
}

// Unified Inbox (D-194): every conversation with a lead, its messages and
// replies, reminders and planned sends. Filters come from real rows.
export default async function InboxPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requireSession();
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const filter = (INBOX_FILTERS as readonly string[]).includes(one(sp.filter)) ? (one(sp.filter) as InboxFilter) : "all";
  const q = one(sp.q).slice(0, 100);
  const leadId = /^[0-9a-f-]{36}$/i.test(one(sp.lead)) ? one(sp.lead) : null;
  const [t, locale, list, thread] = await Promise.all([
    getDictionary(), getLocale(), listInbox(session.workspace.id, filter, q), leadId ? inboxThread(session.workspace.id, leadId) : Promise.resolve(null),
  ]);
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
      <div className="ws-note" style={{ margin: "14px 34px 0" }}><Info /><span><strong>{t.ws.common.notConnectedTitle}.</strong> {t.ws.common.mailboxNotConnected}</span></div>
      <div className={`inbox${thread ? " has-thread" : ""}`} style={{ marginTop: 14 }}>
        <aside className="inbox-list">
          <div className="inbox-list-head">
            <form method="get" action="/inbox" className="toolbar-search">
              {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
              <Search />
              <input className="form-input" name="q" defaultValue={q} placeholder={w.search} aria-label={w.search} />
            </form>
            <nav className="inbox-filters" aria-label={w.title}>
              {INBOX_FILTERS.map((f) => (
                <Link key={f} href={link({ filter: f === "all" ? null : f, lead: null })} className={`type-chip${f === filter ? " active" : ""}`} aria-current={f === filter ? "page" : undefined}>
                  {w.filters[f]} <span className="type-chip-count">{list.counts[f]}</span>
                </Link>
              ))}
            </nav>
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
                <div className="inbox-item-preview" dir="auto">{l.preview ?? "—"}</div>
                <div className="ws-inline">
                  <StageBadge stage={l.stage} />
                  {l.open_tasks > 0 && <span className="ws-chip">{w.reminders}: {l.open_tasks}</span>}
                  {l.thread_status && l.thread_status !== "open" && <span className="ws-chip">{w.filters[l.thread_status === "done" ? "done" : "others"]}</span>}
                </div>
              </Link>
            ))}
          </div>
        </aside>
        <section className="inbox-thread">
          {thread ? <InboxThreadView thread={thread} backHref={link({ lead: null })} timeZone={tz} /> : <div className="inbox-placeholder">{w.select}</div>}
        </section>
      </div>
    </div>
  );
}
