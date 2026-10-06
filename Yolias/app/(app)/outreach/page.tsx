import type { Metadata } from "next";
import Link from "next/link";
import { MailboxControls } from "@/components/app/MailboxControls";
import { GmailIcon, OutlookIcon } from "@/components/app/ConnectorIcons";
import { formatDate } from "@/lib/format";
import { fmt } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { requireSession } from "@/lib/session";
import { listOutreach, myMailboxes, outreachCounts, outreachTabs, providersAvailable, type OutreachTab } from "@/services/outreach";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).outreach.title} — Yolias` };
}

const providerName = { gmail: "Gmail", outlook: "Outlook" } as const;

// Outreach (final spec phase 8): the member's connected mailboxes and every
// prepared message by status. Messages are written and approved on each
// person's page (Prospects); sending happens from the approver's mailbox.
export default async function OutreachPage({ searchParams }: PageProps<"/outreach">) {
  const session = await requireSession();
  const sp = await searchParams;
  const tab: OutreachTab = (outreachTabs as readonly string[]).includes(String(sp.tab)) ? (sp.tab as OutreachTab) : "draft";
  const [boxes, counts, list, t, locale] = await Promise.all([
    myMailboxes(session.userId), outreachCounts(session.workspace.id), listOutreach(session.workspace.id, tab), getDictionary(), getLocale(),
  ]);
  const o = t.outreach;
  const available = providersAvailable();
  const result = typeof sp.mailbox === "string" && sp.mailbox in o.mailboxResult ? o.mailboxResult[sp.mailbox as keyof typeof o.mailboxResult] : null;

  return (
    <div className="page-view">
      <header className="view-header">
        <div className="view-title-group">
          <h2>{o.title}</h2>
          <p>{o.subtitle}</p>
        </div>
      </header>
      <div className="view-content-padding">
        {result && <p className={sp.mailbox === "connected" ? "notice-ok" : "form-error"} role="status">{result}</p>}
        <section className="detail-card mailboxes-card">
          <h3>{o.mailboxes}</h3>
          <p className="cell-sub">{o.mailboxesLead}</p>
          <ul className="mailbox-list">
            {(["gmail", "outlook"] as const).map((provider) => {
              const box = boxes.find((b) => b.provider === provider);
              const Icon = provider === "gmail" ? GmailIcon : OutlookIcon;
              return (
                <li key={provider}>
                  <Icon />
                  <span className="mailbox-main">
                    <strong>{providerName[provider]}</strong>
                    {box ? (
                      <span className="cell-sub">
                        <span dir="ltr">{box.email}</span> · {o.status[box.status]} · {fmt(o.sentToday, { count: box.sent_today, limit: box.daily_limit })}
                      </span>
                    ) : !available[provider] ? <span className="cell-sub">{fmt(o.notConfigured, { provider: providerName[provider] })}</span> : null}
                  </span>
                  {box && box.status !== "disconnected" && <MailboxControls id={box.id} limit={box.daily_limit} />}
                  {available[provider] && (!box || box.status !== "connected") && (
                    <a className="btn-primary" href={`/api/integrations/${provider}/connect`}>{box ? o.reconnect : fmt(o.connect, { provider: providerName[provider] })}</a>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <nav className="entity-tabs inline" aria-label={o.title}>
          {outreachTabs.map((k) => (
            <Link key={k} href={`/outreach${k === "draft" ? "" : `?tab=${k}`}`} className={k === tab ? "active" : ""} aria-current={k === tab ? "page" : undefined}>
              {o.tabs[k]} <span className="entity-tab-count">{counts[k]}</span>
            </Link>
          ))}
        </nav>
        <div className="data-table-card">
          <div className="data-table-scroll">
            <table className="data-table">
              <thead><tr><th>{o.colProspect}</th><th>{o.colSubject}</th><th>{o.colStatus}</th><th>{o.colUpdated}</th></tr></thead>
              <tbody>
                {list.length === 0 && <tr><td colSpan={4} className="empty-cell">{o.empty}</td></tr>}
                {list.map((m) => (
                  <tr key={m.id}>
                    <td>{m.prospect ? <Link className="entity-link" href={`/prospects/person/${m.prospect.id}`}><strong>{m.prospect.full_name}</strong>{m.prospect.title && <span className="cell-sub">{m.prospect.title}</span>}</Link> : "—"}</td>
                    <td dir="auto">{m.subject}{m.to_email && <span className="cell-sub" dir="ltr">{m.to_email}</span>}</td>
                    <td><span className={`status-pill outreach-${m.status}`}>{o.statusLabel[m.status]}</span>{m.status === "failed" && m.error ? <span className="cell-sub">{o.failedReason[m.error as keyof typeof o.failedReason] ?? m.error}</span> : null}</td>
                    <td>{formatDate(m.sent_at ?? m.updated_at, locale, session.profile.timezone)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
