import type { Metadata } from "next";
import Link from "next/link";
import { NewCampaignButton } from "@/components/app/NewCampaignButton";
import { criteriaLine, parseIcp } from "@/lib/discovery/icp";
import { campaignStatus } from "@/lib/discovery/campaign-view";
import { formatDate, formatNumber } from "@/lib/format";
import { fmt } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { requireSession } from "@/lib/session";
import { listCampaigns } from "@/services/campaigns";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).nav.campaigns} — Yolias` };
}

// Campaign list (final spec phase 6): type, goal progress, status, schedule
// and deadline; each row opens the campaign dashboard.
export default async function CampaignsPage() {
  const session = await requireSession();
  const campaigns = await listCampaigns(session.workspace.id);
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  const c = t.campaigns;
  const n = (v: number) => formatNumber(v, locale);
  const tz = session.profile.timezone;

  return (
    <div className="page-view">
      <header className="view-header">
        <div className="view-title-group">
          <h2>{c.title}</h2>
          <p>{c.subtitle}</p>
        </div>
        <div className="view-actions">
          <NewCampaignButton />
        </div>
      </header>
      <div className="view-content-padding">
        <div className="data-table-card">
          <div className="data-table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{c.colMission}</th>
                  <th>{c.colType}</th>
                  <th>{c.colGoal}</th>
                  <th>{c.colStatus}</th>
                  <th>{c.colNextRun}</th>
                  <th>{c.colDeadline}</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.length === 0 && <tr><td colSpan={6} className="empty-cell">{c.empty}</td></tr>}
                {campaigns.map((row) => {
                  const icp = parseIcp(row.criteria);
                  const st = campaignStatus(row.status, t);
                  const pct = row.quota ? Math.min(100, (row.prospects_found / row.quota) * 100) : 0;
                  return (
                    <tr key={row.id}>
                      <td>
                        <Link className="entity-link" href={`/campaigns/${row.id}`}>
                          <strong>{row.name}</strong>
                          <span className="cell-sub">{icp ? criteriaLine(icp, locale, t.icp) : "—"}</span>
                        </Link>
                      </td>
                      <td>{t.searchTypes[row.search_type]}<span className="cell-sub">{row.continuous ? `${c.continuous} · ${c.every[String(row.run_every_hours) as "24" | "168"]}` : c.oneOff}</span></td>
                      <td>
                        <span className="goal-cell">
                          <span>{fmt(c.goalProgress, { found: n(row.prospects_found), goal: n(row.quota) })}</span>
                          <span className="progress-track"><span className="progress-fill" style={{ width: `${pct.toFixed(1)}%` }} /></span>
                        </span>
                      </td>
                      <td><span className={st.cls}>{st.label}</span>{row.partial_reason && row.partial_reason in c.reasons ? <span className="cell-sub">{c.reasons[row.partial_reason as keyof typeof c.reasons]}</span> : null}</td>
                      <td>{row.status === "scheduled" && row.next_run_at ? formatDate(row.next_run_at, locale, tz) : "—"}</td>
                      <td>{row.deadline ? formatDate(row.deadline, locale, tz) : <span className="cell-sub">{c.noDeadline}</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
