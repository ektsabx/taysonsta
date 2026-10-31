import type { Metadata } from "next";
import Link from "next/link";
import { Info, Mail, MailCheck, Plus, Reply, Users } from "lucide-react";
import { requireViewer } from "@/lib/session";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/config";
import { formatNumber } from "@/lib/format";
import { memberMailboxes } from "@/lib/mailbox";
import { campaignList } from "@/services/campaigns";
import { CampaignList } from "@/components/app/campaigns/CampaignList";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).sdr.campaigns.title} | Yolias` };
}

// Campaigns (D-256, after AgentSDR Send campaigns): the totals across every
// campaign, then the list with its filters. A campaign opens its own page.
export default async function CampaignsPage() {
  const session = await requireViewer();
  const [t, locale, list, boxes] = await Promise.all([getDictionary(), getLocale(), campaignList(session.workspace.id), memberMailboxes(session.workspace.id, session.userId)]);
  const c = t.sdr.campaigns;
  const n = (v: number) => formatNumber(v, locale);
  const live = list.filter((x) => x.view !== "archived");
  const count = (v: string) => live.filter((x) => x.view === v).length;
  const leads = live.reduce((s, x) => s + x.leads, 0);
  const sent = list.reduce((s, x) => s + x.sent, 0);
  const replied = live.reduce((s, x) => s + x.replied, 0);
  const last = list.map((x) => x.lastSendAt).filter((x): x is string => Boolean(x)).sort().at(-1);
  const ago = (iso: string) => relative(iso, locale);
  const hasMailbox = boxes.some((m) => m.status === "connected");

  return (
    <div className="sdr-page">
      <header className="sdr-head">
        <div><h2>{c.title}</h2><p>{c.subtitle}</p></div>
        {/* D-270: the campaign wizard; campaigns can still start from Yolias AI or from people picked in Prospects. */}
        <div className="sdr-head-actions"><Link className="sdr-btn primary" href="/outreach/new"><Plus />{c.create}</Link></div>
      </header>
      {!hasMailbox && <div className="ws-note"><Info /><span><strong>{t.ws.common.notConnectedTitle}.</strong> {t.ws.common.mailboxNotConnected}</span></div>}
      <div className="sdr-stats">
        <div className="sdr-stat"><div className="sdr-stat-icon"><Mail /></div><div className="sdr-stat-label">{c.statActive}</div><div className="sdr-stat-value">{n(count("active"))}</div><div className="sdr-stat-note">{fmt(c.statActiveNote, { paused: n(count("paused")), draft: n(count("draft")), completed: n(count("completed")) })}</div></div>
        <div className="sdr-stat"><div className="sdr-stat-icon"><Users /></div><div className="sdr-stat-label">{c.statLeads}</div><div className="sdr-stat-value">{n(leads)}</div><div className="sdr-stat-note">{fmt(c.statLeadsNote, { n: n(live.length) })}</div></div>
        <div className="sdr-stat"><div className="sdr-stat-icon"><MailCheck /></div><div className="sdr-stat-label">{c.statSent}</div><div className="sdr-stat-value">{n(sent)}</div><div className="sdr-stat-note">{last ? fmt(c.statSentNote, { ago: ago(last) }) : c.statSentNever}</div></div>
        <div className="sdr-stat"><div className="sdr-stat-icon"><Reply /></div><div className="sdr-stat-label" title={c.statRepliesHint}>{c.statReplies}</div><div className="sdr-stat-value">{n(replied)}</div><div className="sdr-stat-note">{fmt(c.statRepliesNote, { pct: leads ? ((replied / leads) * 100).toFixed(2) : "0" })}</div></div>
      </div>
      <CampaignList campaigns={list} />
    </div>
  );
}

/** "2 hr. ago", "3 days ago": a page rendered on the server, once per request. */
function relative(iso: string, locale: string): string {
  const rtf = new Intl.RelativeTimeFormat(locale === "ar" ? "ar" : "en", { numeric: "auto", style: "narrow" });
  const h = (Date.parse(iso) - Date.now()) / 3_600_000;
  return Math.abs(h) < 24 ? rtf.format(Math.round(h), "hour") : rtf.format(Math.round(h / 24), "day");
}
