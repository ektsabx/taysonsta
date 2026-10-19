import type { Metadata } from "next";
import Link from "next/link";
import { Info, Plus } from "lucide-react";
import { requireViewer } from "@/lib/session";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { listOutreachCampaigns } from "@/services/outreach-campaigns";
import { shortDate } from "@/components/app/ws/format";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).ws.outreach.title} — Yolias` };
}

// Outreach (D-193): campaigns that reach the prospects Yolias found.
export default async function OutreachPage() {
  const session = await requireViewer();
  const [t, locale, campaigns] = await Promise.all([getDictionary(), getLocale(), listOutreachCampaigns(session.workspace.id)]);
  const o = t.ws.outreach;
  const tz = session.profile.timezone;
  const statusCls = { draft: "status-muted", active: "status-active", paused: "status-muted", archived: "status-muted" } as const;
  return (
    <div className="page-view">
      <header className="view-header">
        <div className="view-title-group">
          <h2>{o.title}</h2>
          <p>{o.subtitle}</p>
        </div>
        <div className="view-actions">
          <Link className="btn-primary" href="/outreach/new"><Plus /> {o.newCampaign}</Link>
        </div>
      </header>
      <div className="view-content-padding">
        <div className="ws-note"><Info /><span><strong>{t.ws.common.notConnectedTitle}.</strong> {t.ws.common.mailboxNotConnected}</span></div>
        <div className="data-table-card">
          <div className="data-table-scroll">
            <table className="data-table">
              <thead>
                <tr><th>{o.colName}</th><th>{o.colStatus}</th><th>{o.colLeads}</th><th>{o.colDrafts}</th><th>{o.colSent}</th><th>{o.colReplies}</th><th>{o.colMeetings}</th><th>{o.colUpdated}</th></tr>
              </thead>
              <tbody>
                {!campaigns.length && <tr><td colSpan={8} className="empty-cell">{o.empty}</td></tr>}
                {campaigns.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link className="entity-link" href={`/outreach/${c.id}`}>
                        <strong>{c.name}</strong>
                        <span className="cell-sub">{[o.channels[c.channel], c.goal].filter(Boolean).join(" · ")}</span>
                      </Link>
                    </td>
                    <td><span className={statusCls[c.status]}>{o.status[c.status]}</span></td>
                    <td>{c.stats.leads}</td><td>{c.stats.drafts}</td><td>{c.stats.sent}</td><td>{c.stats.replies}</td><td>{c.stats.meetings}</td>
                    <td className="cell-sub">{shortDate(c.updated_at, locale, tz)}</td>
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
