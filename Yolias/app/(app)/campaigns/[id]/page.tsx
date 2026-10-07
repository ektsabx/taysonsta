import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { CompanyCard } from "@/components/app/Cards";
import { ResultsToolbar } from "@/components/app/ResultsToolbar";
import { YoliasMark } from "@/components/YoliasMark";
import { hasProviderFor } from "@/lib/intel/registry";
import { cardCompany } from "@/lib/results";
import { parseResultFilters, RESULTS_PAGE, searchResults, type ResultFilters } from "@/services/results";
import { CampaignControls } from "@/components/app/CampaignControls";
import { campaignStatus } from "@/lib/discovery/campaign-view";
import { criteriaLine, parseIcp } from "@/lib/discovery/icp";
import { countryLabel, formatDate, formatNumber } from "@/lib/format";
import { fmt, type Dictionary, type Locale } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { requireSession } from "@/lib/session";
import { getCampaignDashboard } from "@/services/campaigns";
import type { Json } from "@/types/database";

export async function generateMetadata({ params }: PageProps<"/campaigns/[id]">): Promise<Metadata> {
  const { id } = await params;
  const d = /^[0-9a-f-]{36}$/i.test(id) ? await getCampaignDashboard(id) : null;
  return { title: d ? `${d.campaign.name} — Yolias` : "Yolias" };
}

function qs(f: ResultFilters, over: Partial<ResultFilters>) {
  const v = { ...f, ...over };
  const out = new URLSearchParams();
  for (const k of ["q", "industry", "city", "size"] as const) if (v[k]) out.set(k, v[k]);
  if (v.sort !== "relevance") out.set("sort", v.sort);
  if (v.page > 1) out.set("page", String(v.page));
  const s = out.toString();
  return s ? `?${s}` : "";
}

function eventText(message: string, meta: Json | null, t: Dictionary): string {
  const m = meta as { key?: string; vars?: Record<string, string | number> } | null;
  if (!m?.key || !(m.key in t.events) || m.key === "plan") return message;
  return fmt(t.events[m.key as keyof Dictionary["events"]], m.vars ?? {});
}

const dateTime = (iso: string, locale: Locale, timeZone: string) =>
  new Intl.DateTimeFormat(locale === "ar" ? "ar-u-nu-latn" : "en-US", { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(iso));

// One campaign (owner's design, D-166): what it is and where it stands, its
// companies as the same cards as Prospects (each with its decision makers),
// then runs and activity folded away at the bottom. The search's old results
// page now redirects here.
export default async function CampaignPage({ params, searchParams }: PageProps<"/campaigns/[id]">) {
  const session = await requireSession();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const data = await getCampaignDashboard(id);
  if (!data || data.campaign.workspace_id !== session.workspace.id) notFound();
  const { campaign: c, runs, events, usage } = data;
  const f = { ...parseResultFilters(await searchParams), tab: "companies" as const };
  const [t, locale, found, canCollect] = await Promise.all([
    getDictionary(), getLocale(), c.strategy_id ? searchResults(c.strategy_id, session.workspace.id, f) : Promise.resolve(null), hasProviderFor("person.search"),
  ]);
  const cc = t.campaigns;
  const r = t.results;
  const tz = session.profile.timezone;
  const n = (v: number) => formatNumber(v, locale);
  const icp = parseIcp(c.criteria);
  const st = campaignStatus(c.status, t);
  const pct = c.quota ? Math.min(100, (c.prospects_found / c.quota) * 100) : 0;
  const local = c.search_type === "local_businesses";
  const where = icp ? [...icp.cities, ...icp.countries.map((x) => countryLabel(x, locale))].slice(0, 3).join(locale === "ar" ? "، " : ", ") : "";
  const total = found?.companies.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / RESULTS_PAGE));
  const base = `/campaigns/${c.id}`;
  const running = !["completed", "partial", "failed", "paused", "awaiting_source"].includes(c.status);

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
        <div className="view-actions">
          {c.strategy_id && <Link className="btn-secondary" href={`/search/${c.strategy_id}`}><Sparkles /> {cc.openChat}</Link>}
          <CampaignControls id={c.id} status={c.status} />
        </div>
      </header>

      <div className="view-content-padding result-page">
        <section className="result-card results-summary campaign-summary">
          <span className={`results-dot${running ? " running" : ""}`} aria-hidden="true">{running && <YoliasMark size={14} thinking />}</span>
          <div className="results-summary-main">
            <strong>{running ? r.running : r.done}</strong>
            <span>{fmt(r.foundIn, { count: n(total), unit: local ? r.unitPlaces : r.unitCompanies, where: where ? (locale === "ar" ? ` في ${where}` : ` in ${where}`) : "" })}</span>
          </div>
          <div className="campaign-summary-progress">
            <span className="cell-sub">{fmt(cc.goalProgress, { found: n(c.prospects_found), goal: n(c.quota) })} · {cc.kpi.used}: {n(usage.consumed)}</span>
            <span className="progress-track"><span className="progress-fill" style={{ width: `${pct.toFixed(1)}%` }} /></span>
            {c.status === "scheduled" && c.next_run_at && <span className="cell-sub">{cc.kpi.nextRun}: {dateTime(c.next_run_at, locale, tz)}</span>}
            {c.deadline && <span className="cell-sub">{cc.kpi.deadline}: {formatDate(c.deadline, locale, tz)}</span>}
          </div>
        </section>

        {found && (found.options.industries.length > 1 || found.options.cities.length > 1 || total > RESULTS_PAGE) && (
          <ResultsToolbar industries={found.options.industries} cities={found.options.cities} people={false} />
        )}

        {found && found.companies.rows.length ? (
          <ul className="company-grid">
            {found.companies.rows.map((x) => <CompanyCard key={x.id} company={cardCompany(x, x.people, locale, canCollect)} />)}
          </ul>
        ) : <p className="cell-sub results-empty">{running ? r.running : r.empty}</p>}

        {pages > 1 && (
          <div className="results-pager">
            <span className="cell-sub">{fmt(r.showing, { from: n((f.page - 1) * RESULTS_PAGE + 1), to: n(Math.min(f.page * RESULTS_PAGE, total)), total: n(total) })}</span>
            <div className="results-pages">
              {f.page > 1 ? <Link className="icon-btn" href={`${base}${qs(f, { page: f.page - 1 })}`} aria-label="‹"><ChevronLeft className="flip-rtl" /></Link> : <span className="icon-btn disabled"><ChevronLeft className="flip-rtl" /></span>}
              {Array.from({ length: Math.min(pages, 7) }, (_, k) => k + 1).map((p) => (
                <Link key={p} className={`page-num${p === f.page ? " active" : ""}`} href={`${base}${qs(f, { page: p })}`}>{n(p)}</Link>
              ))}
              {f.page < pages ? <Link className="icon-btn" href={`${base}${qs(f, { page: f.page + 1 })}`} aria-label="›"><ChevronRight className="flip-rtl" /></Link> : <span className="icon-btn disabled"><ChevronRight className="flip-rtl" /></span>}
            </div>
          </div>
        )}

        <details className="detail-card campaign-more">
          <summary>{cc.views.runs} <span className="entity-tab-count">{n(runs.length)}</span></summary>
          {runs.length === 0 ? <p className="cell-sub">{cc.noRuns}</p> : (
            <div className="data-table-scroll">
              <table className="data-table compact">
                <thead><tr><th>{cc.runCol.run}</th><th>{cc.runCol.started}</th><th>{cc.runCol.finished}</th><th>{cc.runCol.status}</th><th>{cc.runCol.delivered}</th></tr></thead>
                <tbody>
                  {runs.map((run, i) => (
                    <tr key={run.id}>
                      <td>#{n(runs.length - i)}</td>
                      <td>{dateTime(run.started_at, locale, tz)}</td>
                      <td>{run.finished_at ? dateTime(run.finished_at, locale, tz) : "—"}</td>
                      <td>{cc.runStatus[run.status]}</td>
                      <td><strong>{n(run.delivered)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </details>

        <details className="detail-card campaign-more">
          <summary>{cc.views.activity}</summary>
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
        </details>
      </div>
    </div>
  );
}
