import type { Metadata } from "next";
import { Suspense } from "react";
import { ChannelBadges } from "@/components/app/ChannelBadges";
import { ProspectActions } from "@/components/app/ProspectFilters";
import { countryName } from "@/lib/discovery/icp";
import { location } from "@/lib/format";
import { requireSession } from "@/lib/session";
import { listCampaigns } from "@/services/campaigns";
import { listProspects, parseFilters } from "@/services/prospects";

export const metadata: Metadata = { title: "Prospects — Yolias" };

export default async function ProspectsPage({ searchParams }: PageProps<"/prospects">) {
  const session = await requireSession();
  const filters = parseFilters(await searchParams);
  const [prospects, campaigns] = await Promise.all([listProspects(session.workspace.id, filters), listCampaigns(session.workspace.id)]);
  const countries = [...new Set(campaigns.flatMap((c) => ((c.criteria as { countries?: string[] })?.countries ?? [])))]
    .map((code) => ({ code, name: countryName(code) }));
  const filtered = Object.values(filters).some(Boolean);

  return (
    <div className="page-view">
      <header className="view-header" style={{ position: "relative" }}>
        <div className="view-title-group">
          <h2>Discovered Prospects</h2>
          <p>Verified target companies and decision makers acquired by Yolias</p>
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
                  <th>Decision Maker</th>
                  <th>Company &amp; Headcount</th>
                  <th>Location</th>
                  <th>Campaign Origin</th>
                  <th>Verified Details</th>
                  <th>ICP Match</th>
                </tr>
              </thead>
              <tbody>
                {prospects.length === 0 && (
                  <tr>
                    <td colSpan={6} className="empty-cell">
                      {filtered ? "No prospects match these filters." : "No prospects yet. Save discovered decision makers from Yolias AI to see them here."}
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
                      {p.company?.employee_count != null && <><br /><span className="cell-sub">{p.company.employee_count} employees</span></>}
                    </td>
                    <td>{location(p.city ?? p.company?.city, p.country ?? p.company?.country) || "—"}</td>
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
