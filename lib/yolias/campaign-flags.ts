// Pure flags for Yolias Admin's campaign operations (audit, 2026-11-03).
export type CampaignFlag = "stuck" | "bounces" | "failures";

const DAY = 86_400_000;
export const BOUNCE_LIMIT = 0.05;

/** What needs attention on a campaign: live but quiet for 2 days, bounces over 5% (20+ sent), 5+ failed emails. */
export function flagsOf(c: { status: string; approvedAt: string | null; sent: number; bounced: number; failed: number; lastSentAt: string | null }, now = Date.now()): CampaignFlag[] {
  const out: CampaignFlag[] = [];
  const live = c.status === "active" && Boolean(c.approvedAt);
  const quietSince = c.lastSentAt ? Date.parse(c.lastSentAt) : c.approvedAt ? Date.parse(c.approvedAt) : now;
  if (live && now - quietSince > 2 * DAY) out.push("stuck");
  if (c.sent >= 20 && c.bounced / c.sent > BOUNCE_LIMIT) out.push("bounces");
  if (c.failed >= 5) out.push("failures");
  return out;
}
