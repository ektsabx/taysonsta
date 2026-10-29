import type { Metadata } from "next";
import Link from "next/link";
import { RangePicker } from "@/components/app/RangePicker";
import { formatNumber } from "@/lib/format";
import { fmt } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { requireViewer } from "@/lib/session";
import { discoveryAnalytics, outreachAnalytics, parseRange, ranges } from "@/services/analytics";
import { campaignList, campaignPage } from "@/services/campaigns";
import { CampaignAnalytics } from "@/components/app/campaigns/CampaignDetail";
import { TodayCard } from "@/components/app/TodayCard";
import { todayFor } from "@/services/today";
import { salesOutcomes } from "@/lib/crm/outcomes";

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
  const sp = await searchParams;
  const range = parseRange(sp.range);
  const ws = session.workspace.id;
  // Analytics live in one place (owner, 2026-10-28): all campaigns, or one campaign's numbers and charts.
  const asked = typeof sp.campaign === "string" && /^[0-9a-f-]{36}$/i.test(sp.campaign) ? sp.campaign : null;
  const [campaigns, one, t, locale] = await Promise.all([campaignList(ws), asked ? campaignPage(ws, asked, session.profile.timezone ?? null) : Promise.resolve(null), getDictionary(), getLocale()]);
  const an = t.analytics;
  const picker = campaigns.length > 0 && (
    <RangePicker param="campaign" value={one ? one.summary.id : ""} options={[{ key: "", label: an.allCampaigns }, ...campaigns.map((c) => ({ key: c.id, label: c.name }))]} />
  );
  if (one) {
    return (
      <div className="page-view">
        <header className="view-header">
          <div className="view-title-group"><h2 dir="auto">{one.summary.name}</h2></div>
          <div className="view-actions"><Link className="btn-secondary" href={`/outreach/${one.summary.id}`}>{an.openCampaign}</Link>{picker}</div>
        </header>
        <div className="view-content-padding analytics-page"><CampaignAnalytics page={one} /></div>
      </div>
    );
  }
  const [a, o, today, wl] = await Promise.all([discoveryAnalytics(ws, range), outreachAnalytics(ws, range), todayFor(ws, session.profile.timezone ?? null), salesOutcomes(ws)]);
  const n = (v: number) => formatNumber(v, locale);
  const p = (v: number | null) => (v == null ? "-" : `${v}%`);
  const changeNote = (v: number | null) => (v == null ? an.noPrevious : fmt(an.vsPrevious, { change: `${v > 0 ? "+" : ""}${v}%` }));

  return (
    <div className="page-view">
      <header className="view-header">
        <div className="view-title-group">
          <h2>{an.title}</h2>
        </div>
        <div className="view-actions">
          {picker}
          <RangePicker value={range} options={(Object.keys(ranges) as (keyof typeof ranges)[]).map((k) => ({ key: k, label: an.ranges[k] }))} />
        </div>
      </header>

      <div className="view-content-padding analytics-page">
        {/* Today (owner, 2026-10-29): what needs the member now lives with the numbers, not in Yolias AI. */}
        <TodayCard today={today} timeZone={session.profile.timezone ?? null} />
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

          {/* Won and lost deals (owner, 2026-10-29): the same summary every new search reads. */}
          <Panel title={an.outcomes.title} wide>
            {!wl.won && !wl.lost ? <p className="panel-empty">{an.outcomes.none}</p> : (
              <div className="an-outcomes">
                <div>
                  <h5 className="an-sub">{an.outcomes.won}</h5>
                  <Bars rows={wl.wonIndustries.map((x) => ({ key: x.name, count: x.n, pct: Math.round((x.n / Math.max(1, wl.won)) * 100) }))} label={(k) => k} value={(r) => n(r.count)} empty={an.empty} />
                </div>
                <div>
                  <h5 className="an-sub">{an.outcomes.lost}</h5>
                  <Bars rows={wl.lostReasons.map((x) => ({ key: x.reason, count: x.n, pct: Math.round((x.n / Math.max(1, wl.lost)) * 100) }))} label={(k) => t.ws.crm.lostReasons[k as keyof typeof t.ws.crm.lostReasons] ?? k} value={(r) => n(r.count)} empty={an.empty} />
                </div>
                {wl.wonIndustries.length > 0 && (
                  <p className="an-outcomes-note">{an.outcomes.note} <Link className="ws-link" href={`/?q=${encodeURIComponent(fmt(an.outcomes.prompt, { names: wl.wonIndustries.map((x) => x.name).join(", ") }))}`}>{an.outcomes.findMore}</Link></p>
                )}
              </div>
            )}
          </Panel>

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
