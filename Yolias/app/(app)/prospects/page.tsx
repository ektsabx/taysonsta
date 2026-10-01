import type { Metadata } from "next";
import { Suspense } from "react";
import { ChannelBadges } from "@/components/app/ChannelBadges";
import { ProspectActions } from "@/components/app/ProspectFilters";
import { countryLabel, formatNumber, location } from "@/lib/format";
import { fmt } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { requireSession } from "@/lib/session";
import { listCampaigns } from "@/services/campaigns";
import { listProspects, parseFilters } from "@/services/prospects";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).nav.prospects} — Yolias` };
}

export default async function ProspectsPage({ searchParams }: PageProps<"/prospects">) {
  const session = await requireSession();
  const filters = parseFilters(await searchParams);
  const [prospects, campaigns] = await Promise.all([listProspects(session.workspace.id, filters), listCampaigns(session.workspace.id)]);
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  const pr = t.prospects;
  const countries = [...new Set(campaigns.flatMap((c) => ((c.criteria as { countries?: string[] })?.countries ?? [])))]
    .map((code) => ({ code, name: countryLabel(code, locale) }));
  const filtered = Object.values(filters).some(Boolean);

  return (
    <div className="page-view">
      <header className="view-header" style={{ position: "relative" }}>
        <div className="view-title-group">
          <h2>{pr.title}</h2>
          <p>{pr.subtitle}</p>
        </div>
        <Suspense>
          <ProspectActions campaigns={campaigns.map((c) => ({ id: c.id, name: c.name }))} countries={countries} />
        </Suspense>
      </header>

      <div className="view-content-padding">
        <div className="data-table-card">
          <div className="data-table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{pr.colMaker}</th>
                  <th>{pr.colCompany}</th>
                  <th>{pr.colLocation}</th>
                  <th>{pr.colCampaign}</th>
                  <th>{pr.colDetails}</th>
                  <th>{pr.colMatch}</th>
                </tr>
              </thead>
              <tbody>
                {prospects.length === 0 && (
                  <tr>
                    <td colSpan={6} className="empty-cell">
                      {filtered ? pr.emptyFiltered : pr.empty}
                    </td>
                  </tr>
                )}
                {prospects.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.full_name}</strong>
                      {p.title && <><br /><span className="cell-sub">{p.title}</span></>}
                    </td>
                    <td>
                      {p.company?.name ?? "—"}
                      {p.company?.employee_count != null && <><br /><span className="cell-sub">{fmt(pr.employees, { count: formatNumber(p.company.employee_count, locale) })}</span></>}
                    </td>
                    <td>{location(p.city ?? p.company?.city, p.country ?? p.company?.country, locale) || "—"}</td>
                    <td>{p.campaign?.name ?? "—"}</td>
                    <td><ChannelBadges prospect={p} /></td>
                    <td>{p.match_score != null ? <span className="match-good">{p.match_score}%</span> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
