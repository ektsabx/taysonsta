import Link from "next/link";
import { Sparkles } from "lucide-react";
import { CampaignControls } from "@/components/app/CampaignControls";
import { campaignStatus } from "@/lib/discovery/campaign-view";
import { parseIcp, sizeLabel } from "@/lib/discovery/icp";
import { countryLabel, formatDate, formatNumber } from "@/lib/format";
import { fmt, type Dictionary, type Locale } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { getCampaignDashboard } from "@/services/campaigns";
import type { Json } from "@/types/database";

function eventText(message: string, meta: Json | null, t: Dictionary): string {
  const m = meta as { key?: string; vars?: Record<string, string | number> } | null;
  if (!m?.key || !(m.key in t.events) || m.key === "plan") return message;
  return fmt(t.events[m.key as keyof Dictionary["events"]], m.vars ?? {});
}

const dateTime = (iso: string, locale: Locale, timeZone: string) =>
  new Intl.DateTimeFormat(locale === "ar" ? "ar-u-nu-latn" : "en-US", { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(iso));


// One search's campaign (D-166, D-204): shown above the Prospects table when
// the table is filtered to it — status, progress, criteria and controls, with
// runs and activity folded. The results are the table right below.
export async function CampaignSummary({ id, workspaceId, timeZone }: { id: string; workspaceId: string; timeZone: string }) {
  const data = await getCampaignDashboard(id);
  if (!data || data.campaign.workspace_id !== workspaceId) return null;
  const { campaign: c, runs, events, usage } = data;
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  const cc = t.campaigns;
  const tz = timeZone;
  const n = (v: number) => formatNumber(v, locale);
  const icp = parseIcp(c.criteria);
  const st = campaignStatus(c.status, t);
  const pct = c.quota ? Math.min(100, (c.prospects_found / c.quota) * 100) : 0;

  return (
    <section className="campaign-summary result-page">
      <div className="campaign-summary-head">
        <h3>{c.name}</h3>
        <div className="view-actions">
          {c.strategy_id && <Link className="btn-secondary" href={`/search/${c.strategy_id}`}><Sparkles /> {cc.openChat}</Link>}
          <CampaignControls id={c.id} status={c.status} />
        </div>
      </div>
        <dl className="campaign-facts">
          <div><dt>{cc.runCol.status}</dt><dd><span className={st.cls}>{st.label}</span></dd></div>
          <div><dt>{cc.kpi.progress}</dt><dd>{fmt(cc.goalProgress, { found: n(c.prospects_found), goal: n(c.quota) })}<span className="progress-track"><span className="progress-fill" style={{ width: `${pct.toFixed(1)}%` }} /></span></dd></div>
          <div><dt>{cc.kpi.used}</dt><dd>{n(usage.consumed)}</dd></div>
          <div><dt>{t.setup.target}</dt><dd>{t.searchTypes[c.search_type]} · {c.continuous ? cc.every[String(c.run_every_hours) as "24" | "168"] : cc.oneOff}</dd></div>
          {icp && (icp.industries.length > 0 || icp.keywords.length > 0) && <div><dt>{t.setup.industries}</dt><dd dir="auto">{(icp.industries.length ? icp.industries : icp.keywords).join("، ")}</dd></div>}
          {icp && <div><dt>{t.setup.size}</dt><dd>{sizeLabel(icp, t.icp)}</dd></div>}
          {icp && icp.countries.length > 0 && <div className="wide"><dt>{t.setup.countries}</dt><dd>{icp.countries.map((x) => countryLabel(x, locale)).join("، ")}</dd></div>}
          {c.status === "scheduled" && c.next_run_at && <div><dt>{cc.kpi.nextRun}</dt><dd>{dateTime(c.next_run_at, locale, tz)}</dd></div>}
          {c.deadline && <div><dt>{cc.kpi.deadline}</dt><dd>{formatDate(c.deadline, locale, tz)}</dd></div>}
        </dl>

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
    </section>
  );
}
