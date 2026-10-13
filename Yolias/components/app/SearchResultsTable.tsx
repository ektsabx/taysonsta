import Link from "next/link";
import { criteriaLine, parseIcp } from "@/lib/discovery/icp";
import { campaignFilterOf, campaignFilters, campaignStatus, type CampaignFilter } from "@/lib/discovery/campaign-view";
import { formatDate, formatNumber } from "@/lib/format";
import { fmt } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { listCampaigns, listDrafts } from "@/services/campaigns";
import { StatusFilter } from "./StatusFilter";

// Prospects → Search results (owner, 2026-10-13, D-204; was the Campaigns
// page): every search's campaign in the Prospects table design. Status is a
// dropdown filter; a row opens its prospects (or, for a draft, its setup).
export async function SearchResultsTable({ workspaceId, timeZone, status }: { workspaceId: string; timeZone: string; status: string | undefined }) {
  const filter: CampaignFilter = (campaignFilters as readonly string[]).includes(String(status)) ? (status as CampaignFilter) : "all";
  const [campaigns, drafts, t, locale] = await Promise.all([listCampaigns(workspaceId), listDrafts(workspaceId), getDictionary(), getLocale()]);
  const tz = timeZone;
  const c = t.campaigns;
  const n = (v: number) => formatNumber(v, locale);

  const counts: Record<CampaignFilter, number> = { all: campaigns.length + drafts.length, active: 0, paused: 0, draft: drafts.length, completed: 0, error: 0 };
  for (const row of campaigns) counts[campaignFilterOf(row.status)]++;
  const shown = filter === "all" ? campaigns : filter === "draft" ? [] : campaigns.filter((row) => campaignFilterOf(row.status) === filter);
  const shownDrafts = filter === "all" || filter === "draft" ? drafts : [];
  const empty = !shown.length && !shownDrafts.length;

  return (
    <>
      <div className="filter-bar prospect-toolbar">
        <StatusFilter param="status" base="/prospects?view=searches" value={filter === "all" ? "" : filter} label={c.colStatus}
          options={campaignFilters.map((f) => ({ value: f === "all" ? "" : f, label: `${c.filter[f]} (${n(counts[f])})` }))} />
      </div>
        <div className="data-table-card">
          <div className="data-table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{c.colName}</th>
                  <th>{c.colType}</th>
                  <th>{c.colStatus}</th>
                  <th>{c.colActivity}</th>
                </tr>
              </thead>
              <tbody>
                {empty && <tr><td colSpan={4} className="empty-cell">{filter === "all" ? c.empty : c.emptyFiltered}</td></tr>}
                {shownDrafts.map((d) => {
                  const icp = parseIcp(d.icp);
                  return (
                    <tr key={`draft:${d.id}`}>
                      <td>
                        <Link className="entity-link" href={`/search/${d.id}`}>
                          <strong>{d.title}</strong>
                          <span className="cell-sub">{icp ? criteriaLine(icp, locale, t.icp) : c.draftNote}</span>
                        </Link>
                      </td>
                      <td>{icp ? t.searchTypes[icp.search_type] : "—"}</td>
                      <td><span className="status-muted">{c.draft}</span></td>
                      <td className="cell-sub">{fmt(c.lastActivity, { date: formatDate(d.updated_at, locale, tz) })}</td>
                    </tr>
                  );
                })}
                {shown.map((row) => {
                  const icp = parseIcp(row.criteria);
                  const st = campaignStatus(row.status, t);
                  const pct = row.quota ? Math.min(100, (row.prospects_found / row.quota) * 100) : 0;
                  return (
                    <tr key={row.id}>
                      <td>
                        <Link className="entity-link" href={`/prospects?campaign=${row.id}`}>
                          <strong>{row.name}</strong>
                          <span className="cell-sub">{icp ? criteriaLine(icp, locale, t.icp) : "—"}</span>
                        </Link>
                      </td>
                      <td>{t.searchTypes[row.search_type]}<span className="cell-sub">{row.continuous ? `${c.continuous} · ${c.every[String(row.run_every_hours) as "24" | "168"]}` : c.oneOff}</span></td>
                      <td><span className={st.cls}>{st.label}</span>{row.partial_reason && row.partial_reason in c.reasons ? <span className="cell-sub">{c.reasons[row.partial_reason as keyof typeof c.reasons]}</span> : null}</td>
                      <td>
                        <span className="goal-cell">
                          <span>{fmt(c.goalProgress, { found: n(row.prospects_found), goal: n(row.quota) })}</span>
                          <span className="progress-track"><span className="progress-fill" style={{ width: `${pct.toFixed(1)}%` }} /></span>
                        </span>
                        <span className="cell-sub">{row.status === "scheduled" && row.next_run_at ? `${c.colNextRun}: ${formatDate(row.next_run_at, locale, tz)}` : fmt(c.lastActivity, { date: formatDate(row.updated_at, locale, tz) })}</span>
                        {row.deadline && <span className="cell-sub">{c.colDeadline}: {formatDate(row.deadline, locale, tz)}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
    </>
  );
}
