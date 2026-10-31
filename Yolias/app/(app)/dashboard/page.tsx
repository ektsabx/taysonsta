import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { campaignActivity, campaignMetrics, prospectRate } from "@/services/campaign-metrics";
import { CampaignDashboard } from "@/components/app/campaigns/CampaignDashboard";
import { StartHere } from "@/components/app/StartHere";
import { startSteps } from "@/services/start-here";
import { tabCounts } from "@/services/prospects";
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
  return { title: `${(await getDictionary()).camp.dash.title} | Yolias` };
}

/** An ISO time relative to now (outside render, for the lint rule on impure calls). */
function isoFromNow(ms: number) { return new Date(Date.now() + ms).toISOString(); }

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

// The dashboard (owner, 2026-10-31, D-270): the account's home. First the
// campaigns (results, progress to their targets, a comparison, what needs the
// member, Yolias's notes and what it did), then the activity over time from
// the analytics overview (D-269). Actual results, forecasts and targets are
// always labelled apart. One campaign's numbers live on its own page.
export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ range?: string | string[] }> }) {
  const session = await requireViewer();
  const range = parseRange((await searchParams).range);
  const ws = session.workspace.id;
  const tz = session.profile.timezone ?? null;
  const admin = createAdminClient();
  const [o, today, wl, t, locale, metrics, activity, rate, steps, found, approvals, outcomes] = await Promise.all([
    overviewAnalytics(ws, range, tz), todayFor(ws, tz), salesOutcomes(ws), getDictionary(), getLocale(),
    campaignMetrics(ws), campaignActivity(ws), prospectRate(ws), startSteps(ws, session.userId), tabCounts(ws),
    admin.from("agent_pending_actions").select("input").eq("workspace_id", ws).eq("tool", "startOutreachCampaign").eq("status", "pending").gt("expires_at", isoFromNow(0)),
    admin.from("sales_meetings").select("id", { count: "exact", head: true }).eq("workspace_id", ws).eq("status", "scheduled").lt("starts_at", isoFromNow(-3_600_000)),
  ]);
  const waiting = new Set((approvals.data ?? []).map((a) => (a.input as { id?: string } | null)?.id).filter(Boolean) as string[]);
  const an = t.analytics;
  const v = an.ov;
  const n = (x: number) => formatNumber(x, locale);
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
        <div className="view-title-group"><h2>{t.camp.dash.title}</h2></div>
        <div className="view-actions">
          <Link className="sdr-btn primary" href="/outreach/new"><Plus />{t.camp.dash.newCampaign}</Link>
        </div>
      </header>

      <div className="view-content-padding analytics-page">
        <StartHere steps={steps} />
        <TodayCard today={today} timeZone={tz} />

        <CampaignDashboard found={found.companies + found.people} metrics={metrics} activity={activity} rate={rate} waiting={[...waiting]} outcomesWaiting={outcomes.count ?? 0} />

        <div className="ov-section-head">
          <h3>{t.camp.dash.charts}</h3>
          <RangePicker value={range} options={(Object.keys(ranges) as (keyof typeof ranges)[]).map((k) => ({ key: k, label: an.ranges[k] }))} />
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
