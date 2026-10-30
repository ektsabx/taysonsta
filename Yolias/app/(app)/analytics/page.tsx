import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, MessagesSquare, Search, Send, Trophy } from "lucide-react";
import { RangePicker } from "@/components/app/RangePicker";
import { formatNumber } from "@/lib/format";
import { fmt } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { requireViewer } from "@/lib/session";
import { overviewAnalytics, parseRange, ranges } from "@/services/analytics";
import { TodayCard } from "@/components/app/TodayCard";
import { DailyChart, Donut } from "@/components/app/analytics/Charts";
import { todayFor } from "@/services/today";
import { salesOutcomes } from "@/lib/crm/outcomes";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).nav.analytics} | Yolias` };
}

type BarRow = { key: string; pct: number; count: number };

// One bar style for every list (Yolias design: ink on a quiet track, no palette).
function Bars({ rows, label, value }: { rows: BarRow[]; label: (k: string) => string; value: (r: BarRow) => string }) {
  return (
    <div className="an-bars">
      {rows.map((m) => (
        <div key={m.key} className="an-bar-row">
          <div className="an-bar-head"><span dir="auto">{label(m.key)}</span><span className="an-bar-value">{value(m)}</span></div>
          <div className="an-track"><div className="an-fill" style={{ width: `${Math.max(m.pct, 2)}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

// The member's overview of Yolias (owner, 2026-10-30, D-269): what needs them
// today, then each part of the product with the numbers that matter for it
// (search, campaigns, conversations, meetings, customers), a day-by-day chart,
// the path from search to customer, and what wins and loses. A campaign's own
// analytics are on the campaign's page, not here.
export default async function AnalyticsPage({ searchParams }: PageProps<"/analytics">) {
  const session = await requireViewer();
  const range = parseRange((await searchParams).range);
  const ws = session.workspace.id;
  const tz = session.profile.timezone ?? null;
  const [o, today, wl, t, locale] = await Promise.all([overviewAnalytics(ws, range, tz), todayFor(ws, tz), salesOutcomes(ws), getDictionary(), getLocale()]);
  const an = t.analytics;
  const v = an.ov;
  const n = (x: number) => formatNumber(x, locale);
  const pct = (x: number | null) => (x == null ? "–" : `${x}%`);
  const sections: { key: string; icon: React.ReactNode; title: string; href: string; main: [string, string]; rows: [string, string][] }[] = [
    { key: "search", icon: <Search />, title: v.search, href: "/prospects", main: [n(o.search.companies + o.search.people), v.found],
      rows: [[v.searches, n(o.search.searches)], [v.companies, n(o.search.companies)], [v.people, n(o.search.people)], [v.withEmail, pct(o.search.emailPct)]] },
    { key: "campaigns", icon: <Send />, title: v.campaigns, href: "/outreach", main: [n(o.campaigns.sent), v.sent],
      rows: [[v.active, n(o.campaigns.active)], [v.contacted, n(o.campaigns.contacted)], [v.bounced, n(o.campaigns.bounced)]] },
    { key: "conversations", icon: <MessagesSquare />, title: v.conversations, href: "/inbox", main: [pct(o.conversations.replyPct), v.replyRate],
      rows: [[v.replies, n(o.conversations.replies)], [v.interested, n(o.conversations.interested)], [v.waiting, n(o.conversations.waiting)]] },
    { key: "meetings", icon: <CalendarDays />, title: v.meetings, href: "/meetings", main: [n(o.meetings.booked), v.booked],
      rows: [[v.upcoming, n(o.meetings.upcoming)], [v.held, n(o.meetings.held)], [v.noShow, n(o.meetings.noShow)]] },
    { key: "customers", icon: <Trophy />, title: v.customers, href: "/meetings", main: [n(o.customers.won), v.won],
      rows: [[v.winRate, pct(o.customers.winPct)], [v.lost, n(o.customers.lost)]] },
  ];
  const totals = o.series.reduce((x, d) => ({ sent: x.sent + d.sent, replies: x.replies + d.replies, meetings: x.meetings + d.meetings }), { sent: 0, replies: 0, meetings: 0 });
  const chartSeries = [
    { key: "sent", name: v.sent, color: "var(--ink)" },
    { key: "replies", name: v.replies, color: "var(--blue)" },
    { key: "meetings", name: v.booked, color: "var(--green)" },
  ];
  const sources = [
    { name: t.meetings.source.booking, value: o.meetings.bySource.booking, color: "var(--ink)" },
    { name: t.meetings.source.agent, value: o.meetings.bySource.agent, color: "var(--blue)" },
    { name: t.meetings.source.manual, value: o.meetings.bySource.manual, color: "var(--line-strong)" },
  ];
  const first = o.funnel[0].n;

  return (
    <div className="page-view">
      <header className="view-header">
        <div className="view-title-group"><h2>{an.title}</h2></div>
        <div className="view-actions">
          <RangePicker value={range} options={(Object.keys(ranges) as (keyof typeof ranges)[]).map((k) => ({ key: k, label: an.ranges[k] }))} />
        </div>
      </header>

      <div className="view-content-padding analytics-page">
        <TodayCard today={today} timeZone={tz} />

        <div className="ov-grid">
          {sections.map((s) => (
            <Link key={s.key} href={s.href} className="ov-card">
              <span className="ov-head"><span className="ov-icon">{s.icon}</span>{s.title}</span>
              <span className="ov-main"><strong>{s.main[0]}</strong><span>{s.main[1]}</span></span>
              <dl className="ov-rows">{s.rows.map(([k, val]) => <div key={k}><dt>{k}</dt><dd>{val}</dd></div>)}</dl>
            </Link>
          ))}
        </div>

        <section className="ov-panel">
          <div className="ov-panel-head">
            <h3>{v.activity}</h3>
            <div className="ov-keys">{chartSeries.map((s) => <span key={s.key}><i style={{ background: s.color }} />{s.name} <strong>{n(totals[s.key as keyof typeof totals])}</strong></span>)}</div>
          </div>
          <DailyChart days={o.series} series={chartSeries} label={v.activity} locale={locale} />
        </section>

        <div className="ov-two">
          <section className="ov-panel">
            <div className="ov-panel-head"><h3>{an.funnel.title}</h3></div>
            <Bars
              rows={o.funnel.map((f) => ({ key: f.key, count: f.n, pct: first ? Math.round((f.n / first) * 100) : 0 }))}
              label={(k) => an.funnel.steps[k as keyof typeof an.funnel.steps]}
              value={(r) => `${n(r.count)}${first && r.key !== "found" ? ` (${r.pct}%)` : ""}`}
            />
          </section>
          <section className="ov-panel">
            <div className="ov-panel-head"><h3>{v.meetingSources}</h3></div>
            <div className="ov-donut">
              <Donut parts={sources} center={n(o.meetings.booked)} label={v.meetingSources} />
              <ul>{sources.map((p) => <li key={p.name}><i style={{ background: p.color }} />{p.name}<strong>{n(p.value)}</strong></li>)}</ul>
            </div>
          </section>
        </div>

        {/* Won and lost customers (D-263): the same summary every new search reads. */}
        <section className="ov-panel">
          <div className="ov-panel-head"><h3>{an.outcomes.title}</h3></div>
          {!wl.won && !wl.lost ? <p className="panel-empty">{an.outcomes.none}</p> : (
            <div className="an-outcomes">
              <div>
                <h5 className="an-sub">{an.outcomes.won}</h5>
                <Bars rows={wl.wonIndustries.map((x) => ({ key: x.name, count: x.n, pct: Math.round((x.n / Math.max(1, wl.won)) * 100) }))} label={(k) => k} value={(r) => n(r.count)} />
              </div>
              <div>
                <h5 className="an-sub">{an.outcomes.lost}</h5>
                <Bars rows={wl.lostReasons.map((x) => ({ key: x.reason, count: x.n, pct: Math.round((x.n / Math.max(1, wl.lost)) * 100) }))} label={(k) => t.ws.crm.lostReasons[k as keyof typeof t.ws.crm.lostReasons] ?? k} value={(r) => n(r.count)} />
              </div>
              {wl.wonIndustries.length > 0 && (
                <p className="an-outcomes-note">{an.outcomes.note} <Link className="ws-link" href={`/?q=${encodeURIComponent(fmt(an.outcomes.prompt, { names: wl.wonIndustries.map((x) => x.name).join(", ") }))}`}>{an.outcomes.findMore}</Link></p>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
