"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/client";

export interface CampaignRowView {
  id: string;
  name: string;
  criteria: string;
  quota: number;
  found: number;
  status: { label: string; cls: string };
  href: string | null;
}

export function CampaignsTable({ rows }: { rows: CampaignRowView[] }) {
  const router = useRouter();
  const { t } = useI18n();
  const c = t.campaigns;
  return (
    <div className="data-table-card">
      <div className="data-table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>{c.colMission}</th>
              <th>{c.colCriteria}</th>
              <th>{c.colQuota}</th>
              <th>{c.colFound}</th>
              <th>{c.colStatus}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="empty-cell">{c.empty}</td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className={r.href ? "row-link" : undefined} onClick={() => r.href && router.push(r.href)}>
                <td><strong>{r.name}</strong></td>
                <td>{r.criteria}</td>
                <td>{r.quota}</td>
                <td><strong>{r.found}</strong></td>
                <td><span className={r.status.cls}>{r.status.label}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
