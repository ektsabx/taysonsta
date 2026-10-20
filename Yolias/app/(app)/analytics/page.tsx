import type { Metadata } from "next";
import { RangePicker } from "@/components/app/RangePicker";
import { formatNumber } from "@/lib/format";
import { fmt } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { requireViewer } from "@/lib/session";
import { firstName } from "@/lib/format";
import { Greeting } from "@/components/app/Greeting";
import { discoveryAnalytics, outreachAnalytics, parseRange, ranges } from "@/services/analytics";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).nav.analytics} | Yolias` };
}

type BarRow = { key: string; pct: number; count: number };

// One bar style for every list (Yolias design: ink on a quiet track, no palette).
function Bars({ rows, label, value, empty }: { rows: BarRow[]; label: (k: string) => string; value: (r: BarRow) => string; empty: string }) {
  if (!rows.length) return <p className="panel-empty">{empty}</p>;
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

function Panel({ title, children, wide = false }: { title: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <section className={`panel-card${wide ? " panel-wide" : ""}`}>
      <h4 className="panel-title">{title}</h4>
      {children}
    </section>
  );
}

// Discovery analytics (D-162): totals against the previous period, outreach
// and sales, decision makers and user activity, in one visual style (D-166).
// The trend, results pipeline, ICP performance, data quality, top markets and
// distribution panels were removed (owner, 2026-10-20).
export default async function AnalyticsPage({ searchParams }: PageProps<"/analytics">) {
  const session = await requireViewer();
  const range = parseRange((await searchParams).range);
  const [a, o] = await Promise.all([discoveryAnalytics(session.workspace.id, range), outreachAnalytics(session.workspace.id, range)]);
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  const an = t.analytics;
  const n = (v: number) => formatNumber(v, locale);
  const p = (v: number | null) => (v == null ? "-" : `${v}%`);
  const changeNote = (v: number | null) => (v == null ? an.noPrevious : fmt(an.vsPrevious, { change: `${v > 0 ? "+" : ""}${v}%` }));

  return (
    <div className="page-view">
      <header className="view-header">
        <div className="view-title-group">
          <Greeting name={firstName(session.profile.full_name)} className="view-greeting" />
          <h2>{an.title}</h2>
        </div>
        <div className="view-actions">
          <RangePicker value={range} options={(Object.keys(ranges) as (keyof typeof ranges)[]).map((k) => ({ key: k, label: an.ranges[k] }))} />
        </div>
      </header>

      <div className="view-content-padding analytics-page">
        <div className="stat-grid">
          {([
            [an.companiesDiscovered, n(a.totals.companies), changeNote(a.totals.vsPrevious.companies)],
            [an.decisionMakers, n(a.totals.decisionMakers), changeNote(a.totals.vsPrevious.decisionMakers)],
            [an.avgMatch, p(a.icp.avgMatch), fmt(an.scoredLeads, { count: n(a.icp.scored) })],
            [t.prospects.csv.email, n(a.emailFound), fmt(an.ofLeads, { pct: a.totals.leads ? Math.round((a.emailFound / a.totals.leads) * 100) : 0 })],
          ] as const).map(([label, value, note]) => (
            <div key={label} className="stat-card">
              <div className="stat-label">{label}</div>
              <div className="stat-value">{value}</div>
              <div className="stat-note">{note}</div>
            </div>
          ))}
        </div>

        {/* Outreach and sales (D-234): real campaign, message and CRM rows only. */}
        <section className="an-outreach" aria-label={an.outreach.title}>
          <h3 className="an-outreach-title">{an.outreach.title}</h3>
          <div className="stat-grid">
            {([
              [an.outreach.campaigns, n(o.campaignsStarted), fmt(an.outreach.created, { count: n(o.campaignsCreated) })],
              [an.outreach.sent, n(o.sent), fmt(an.outreach.fromMailbox, { count: n(o.sentFromMailbox) })],
              [an.outreach.failed, n(o.failed + o.bounced), fmt(an.outreach.bouncedNote, { count: n(o.bounced) })],
              [an.outreach.replies, n(o.replies), o.contactedLeads ? fmt(an.outreach.replyRate, { pct: Math.round((o.repliedLeads / o.contactedLeads) * 100) }) : an.outreach.noSends],
              [an.outreach.interested, n(o.interested), fmt(an.outreach.optedOut, { count: n(o.optedOut) })],
              [an.outreach.meetings, n(o.meetings), fmt(an.outreach.won, { count: n(o.won) })],
            ] as const).map(([label, value, note]) => (
              <div key={label} className="stat-card">
                <div className="stat-label">{label}</div>
                <div className="stat-value">{value}</div>
                <div className="stat-note">{note}</div>
              </div>
            ))}
          </div>
        </section>

        <div className="analytics-grid">
          {a.decisionMakers.total > 0 && (
            <Panel title={an.sections.decisionMakers} wide>
              <Bars rows={a.decisionMakers.roles.filter((r) => r.count > 0)} label={(k) => an.roles[k as keyof typeof an.roles]} value={(r) => `${n(r.count)} (${r.pct}%)`} empty={an.empty} />
            </Panel>
          )}

          <Panel title={an.sections.activity} wide>
            <dl className="an-activity">
              {(["searches", "qualifications", "emailsPrepared", "exports"] as const).map((k) => (
                <div key={k}><dt>{an.activity[k]}</dt><dd>{n(a.activity[k])}</dd></div>
              ))}
            </dl>
          </Panel>
        </div>
      </div>
    </div>
  );
}
