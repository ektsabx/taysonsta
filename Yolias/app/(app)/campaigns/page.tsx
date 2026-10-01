import type { Metadata } from "next";
import { CampaignsTable, type CampaignRowView } from "@/components/app/CampaignsTable";
import { NewCampaignButton } from "@/components/app/NewCampaignButton";
import { criteriaLine, parseIcp } from "@/lib/discovery/icp";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { requireSession } from "@/lib/session";
import { listCampaigns } from "@/services/campaigns";
import type { CampaignStatus } from "@/types/database";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).nav.campaigns} — Yolias` };
}

const statusView: Record<CampaignStatus, { key: "active" | "completed" | "awaiting" | "paused" | "failed"; cls: string }> = {
  queued: { key: "active", cls: "status-active" },
  running: { key: "active", cls: "status-active" },
  completed: { key: "completed", cls: "status-muted" },
  awaiting_source: { key: "awaiting", cls: "status-muted" },
  paused: { key: "paused", cls: "status-muted" },
  failed: { key: "failed", cls: "status-failed" },
};

export default async function CampaignsPage() {
  const session = await requireSession();
  const campaigns = await listCampaigns(session.workspace.id);
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  const rows: CampaignRowView[] = campaigns.map((c) => {
    const icp = parseIcp(c.criteria);
    return {
      id: c.id,
      name: c.name,
      criteria: icp ? criteriaLine(icp, locale, t.icp) : "—",
      quota: c.quota,
      found: c.prospects_found,
      status: { label: t.campaigns.status[statusView[c.status].key], cls: statusView[c.status].cls },
      href: c.strategy_id ? `/strategies/${c.strategy_id}` : null,
    };
  });

  return (
    <div className="page-view">
      <header className="view-header">
        <div className="view-title-group">
          <h2>{t.campaigns.title}</h2>
          <p>{t.campaigns.subtitle}</p>
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
