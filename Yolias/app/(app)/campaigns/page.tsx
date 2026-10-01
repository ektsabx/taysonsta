import type { Metadata } from "next";
import { CampaignsTable, type CampaignRowView } from "@/components/app/CampaignsTable";
import { NewCampaignButton } from "@/components/app/NewCampaignButton";
import { criteriaLine, parseIcp } from "@/lib/discovery/icp";
import { requireSession } from "@/lib/session";
import { listCampaigns } from "@/services/campaigns";
import type { CampaignStatus } from "@/types/database";

export const metadata: Metadata = { title: "Campaigns — Yolias" };

const statusView: Record<CampaignStatus, { label: string; cls: string }> = {
  queued: { label: "● Active", cls: "status-active" },
  running: { label: "● Active", cls: "status-active" },
  completed: { label: "Completed", cls: "status-muted" },
  awaiting_source: { label: "Awaiting data source", cls: "status-muted" },
  paused: { label: "Paused", cls: "status-muted" },
  failed: { label: "Failed", cls: "status-failed" },
};

export default async function CampaignsPage() {
  const session = await requireSession();
  const campaigns = await listCampaigns(session.workspace.id);
  const rows: CampaignRowView[] = campaigns.map((c) => {
    const icp = parseIcp(c.criteria);
    return {
      id: c.id,
      name: c.name,
      criteria: icp ? criteriaLine(icp) : "—",
      quota: c.quota,
      found: c.prospects_found,
      status: statusView[c.status],
      href: c.strategy_id ? `/strategies/${c.strategy_id}` : null,
    };
  });

  return (
    <div className="page-view">
      <header className="view-header">
        <div className="view-title-group">
          <h2>Discovery Campaigns</h2>
          <p>Customer search missions created and executed by Yolias</p>
        </div>
        <div className="view-actions">
          <NewCampaignButton />
        </div>
      </header>
      <div className="view-content-padding">
        <CampaignsTable rows={rows} />
      </div>
    </div>
  );
}
