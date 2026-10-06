import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AgentThread } from "@/components/app/AgentThread";
import { CampaignControls } from "@/components/app/CampaignControls";
import { campaignStatus } from "@/lib/discovery/campaign-view";
import { criteriaLine, parseIcp } from "@/lib/discovery/icp";
import { formatDate, formatNumber } from "@/lib/format";
import { fmt, type Dictionary, type Locale } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { requireSession } from "@/lib/session";
import { getCampaignDashboard } from "@/services/campaigns";
import { conversationFor } from "@/services/conversations";
import type { Json } from "@/types/database";

export async function generateMetadata({ params }: PageProps<"/campaigns/[id]">): Promise<Metadata> {
  const { id } = await params;
  const d = /^[0-9a-f-]{36}$/i.test(id) ? await getCampaignDashboard(id) : null;
  return { title: d ? `${d.campaign.name} — Yolias` : "Yolias" };
}

const views = ["overview", "results", "runs", "activity", "chat"] as const;
type View = (typeof views)[number];

function eventText(message: string, meta: Json | null, t: Dictionary): string {
  const m = meta as { key?: string; vars?: Record<string, string | number> } | null;
  if (!m?.key || !(m.key in t.events) || m.key === "plan") return message;
  return fmt(t.events[m.key as keyof Dictionary["events"]], m.vars ?? {});
}

const dateTime = (iso: string, locale: Locale, timeZone: string) =>
  new Intl.DateTimeFormat(locale === "ar" ? "ar-u-nu-latn" : "en-US", { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(iso));

// Campaign dashboard (final spec phase 6): status and controls, goal
// progress, prospects used, schedule and deadline, results per entity,
// runs (lineage), activity, and the campaign's chat — one page with
// internal navigation (?view=).
export default async function CampaignPage({ params, searchParams }: PageProps<"/campaigns/[id]">) {
  const session = await requireSession();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const data = await getCampaignDashboard(id);
  if (!data || data.campaign.workspace_id !== session.workspace.id) notFound();
  const { campaign: c, runs, events, usage, results, daily, daysLeft: days } = data;
  const sp = await searchParams;
  const view: View = (views as readonly string[]).includes(String(sp.view)) ? (sp.view as View) : "overview";
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  const cc = t.campaigns;
  const tz = session.profile.timezone;
  const n = (v: number) => formatNumber(v, locale);
  const icp = parseIcp(c.criteria);
  const st = campaignStatus(c.status, t);
  const pct = c.quota ? Math.min(100, (c.prospects_found / c.quota) * 100) : 0;
  const maxDay = Math.max(1, ...daily.map((d) => d.delivered));
  const prospectsTab = c.search_type === "people" ? "" : c.search_type === "local_businesses" ? "tab=local&" : "tab=companies&";

  return (
    <div className="page-view">
      <header className="view-header">
        <div className="view-title-group">
          <Link href="/campaigns" className="detail-back"><ArrowLeft className="flip-rtl" /> {cc.back}</Link>
          <h2>{c.name}</h2>
          <p>
            <span className={st.cls}>{st.label}</span> · {t.searchTypes[c.search_type]} · {c.continuous ? `${cc.continuous} (${cc.every[String(c.run_every_hours) as "24" | "168"]})` : cc.oneOff}
            {icp ? ` · ${criteriaLine(icp, locale, t.icp)}` : ""}
          </p>
        </div>
        <CampaignControls id={c.id} status={c.status} goal={c.quota} deadline={c.deadline} continuous={c.continuous} everyHours={c.run_every_hours} />
      </header>

      <nav className="entity-tabs" aria-label={c.name}>
        {views.map((v) => (
          <Link key={v} href={`/campaigns/${c.id}${v === "overview" ? "" : `?view=${v}`}`} className={v === view ? "active" : ""} aria-current={v === view ? "page" : undefined}>
            {cc.views[v]}{v === "runs" && <span className="entity-tab-count">{n(runs.length)}</span>}
          </Link>
        ))}
      </nav>

      <div className="view-content-padding">
        {view === "overview" && (
          <>
            <div className="kpi-row">
              <div className="kpi-card">
                <span className="kpi-label">{cc.kpi.progress}</span>
                <strong className="kpi-value">{fmt(cc.goalProgress, { found: n(c.prospects_found), goal: n(c.quota) })}</strong>
                <span className="progress-track"><span className="progress-fill" style={{ width: `${pct.toFixed(1)}%` }} /></span>
                {c.partial_reason && c.partial_reason in cc.reasons ? <span className="cell-sub">{cc.reasons[c.partial_reason as keyof typeof cc.reasons]}</span> : null}
              </div>
              <div className="kpi-card"><span className="kpi-label">{cc.kpi.used}</span><strong className="kpi-value">{n(usage.consumed)}</strong>{usage.reserved > 0 && <span className="cell-sub">+{n(usage.reserved)}</span>}</div>
              <div className="kpi-card"><span className="kpi-label">{cc.kpi.saved}</span><strong className="kpi-value">{n(results.saved)}</strong></div>
              <div className="kpi-card"><span className="kpi-label">{cc.kpi.runs}</span><strong className="kpi-value">{n(Math.max(c.runs_count, runs.length))}</strong></div>
              <div className="kpi-card">
                <span className="kpi-label">{cc.kpi.deadline}</span>
                <strong className="kpi-value">{c.deadline ? formatDate(c.deadline, locale, tz) : cc.noDeadline}</strong>
                {days != null && <span className="cell-sub">{days > 0 ? fmt(cc.daysLeft, { count: n(days) }) : cc.deadlinePassed}</span>}
              </div>
              <div className="kpi-card"><span className="kpi-label">{cc.kpi.nextRun}</span><strong className="kpi-value">{c.status === "scheduled" && c.next_run_at ? dateTime(c.next_run_at, locale, tz) : "—"}</strong></div>
            </div>
            <section className="detail-card">
              <h3>{cc.deliveredChart}</h3>
              {daily.length === 0 ? <p className="cell-sub">{cc.noDeliveries}</p> : (
                <div className="bar-chart" role="img" aria-label={cc.deliveredChart}>
                  {daily.map((d) => (
                    <div key={d.day} className="bar-col" title={`${formatDate(d.day, locale)}: ${n(d.delivered)}`}>
                      <span className="bar-value">{n(d.delivered)}</span>
                      <span className="bar" style={{ height: `${(d.delivered / maxDay) * 100}%` }} />
                      <span className="bar-label">{new Intl.DateTimeFormat(locale === "ar" ? "ar-u-nu-latn" : "en-US", { month: "short", day: "numeric" }).format(new Date(d.day))}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {view === "results" && (
          <div className="kpi-row">
            {([["people", results.people, ""], ["companies", results.companies, "tab=companies&"], ["local", results.local, "tab=local&"], ["jobs", results.jobs, "tab=jobs&"]] as const).map(([k, count, tab]) => (
              <Link key={k} className="kpi-card kpi-link" href={`/prospects?${tab}campaign=${c.id}`}>
                <span className="kpi-label">{t.prospects.tabs[k]}</span>
                <strong className="kpi-value">{n(count)}</strong>
                <span className="cell-sub">{cc.openInProspects} →</span>
              </Link>
            ))}
            <p className="cell-sub" style={{ gridColumn: "1 / -1" }}><Link className="entity-link" href={`/prospects?${prospectsTab}campaign=${c.id}`}>{cc.openInProspects}</Link></p>
          </div>
        )}

        {view === "runs" && (
          <div className="data-table-card">
            <div className="data-table-scroll">
              <table className="data-table">
                <thead><tr><th>{cc.runCol.run}</th><th>{cc.runCol.started}</th><th>{cc.runCol.finished}</th><th>{cc.runCol.status}</th><th>{cc.runCol.candidates}</th><th>{cc.runCol.delivered}</th></tr></thead>
                <tbody>
                  {runs.length === 0 && <tr><td colSpan={6} className="empty-cell">{cc.noRuns}</td></tr>}
                  {runs.map((r, i) => {
                    const meta = (r.meta ?? {}) as { candidates?: number; reason?: string };
                    return (
                      <tr key={r.id}>
                        <td>#{n(runs.length - i)}{r.attempt > 1 && <span className="cell-sub">↻ {r.attempt}</span>}</td>
                        <td>{dateTime(r.started_at, locale, tz)}</td>
                        <td>{r.finished_at ? dateTime(r.finished_at, locale, tz) : "—"}</td>
                        <td>{cc.runStatus[r.status]}{r.error && <span className="cell-sub">{r.error}</span>}</td>
                        <td>{meta.candidates != null ? n(meta.candidates) : "—"}</td>
                        <td><strong>{n(r.delivered)}</strong></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {view === "activity" && (
          <section className="detail-card">
            {events.length === 0 ? <p className="cell-sub">{cc.noActivity}</p> : (
              <ul className="activity-list">
                {events.map((e) => (
                  <li key={e.id} className={`activity-${e.level}`}>
                    <span className="activity-time">{dateTime(e.created_at, locale, tz)}</span>
                    <span>{eventText(e.message, e.meta, t)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {view === "chat" && (c.strategy_id
          ? <div className="campaign-chat"><AgentThread strategyId={c.strategy_id} initial={await conversationFor(c.strategy_id)} /></div>
          : <p className="cell-sub">{cc.chatEmpty}</p>)}
      </div>
    </div>
  );
}
