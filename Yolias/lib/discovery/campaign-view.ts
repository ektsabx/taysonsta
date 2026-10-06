import { isActive, isRunning } from "@/lib/discovery/states";
import type { Dictionary } from "@/lib/i18n/config";
import type { CampaignStatus } from "@/types/database";

/** Status label + pill class for a campaign, shared by the list and the dashboard. */
export function campaignStatus(status: CampaignStatus, t: Dictionary): { label: string; cls: string } {
  const c = t.campaigns;
  if (isRunning(status)) return { label: c.statusExtra.running, cls: "status-active" };
  if (status === "scheduled") return { label: c.statusExtra.scheduled, cls: "status-active" };
  if (isActive(status)) return { label: c.status.active, cls: "status-active" };
  if (status === "completed") return { label: c.status.completed, cls: "status-muted" };
  if (status === "partial") return { label: c.status.partial, cls: "status-muted" };
  if (status === "awaiting_source") return { label: c.status.awaiting, cls: "status-muted" };
  if (status === "paused") return { label: c.status.paused, cls: "status-muted" };
  return { label: c.status.failed, cls: "status-failed" };
}
