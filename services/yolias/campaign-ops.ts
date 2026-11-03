import "server-only";
import { ydb } from "@/lib/yolias/db";
import { audit } from "@/lib/bos/audit";
import { NotFoundError, ValidationError } from "@/lib/bos/errors";
import type { BosUser } from "@/lib/bos/auth";
import { flagsOf, type CampaignFlag } from "@/lib/yolias/campaign-flags";

export { BOUNCE_LIMIT, type CampaignFlag } from "@/lib/yolias/campaign-flags";

// Campaign operations and deliverability (audit, 2026-11-03): every campaign
// and mailbox across all Yolias accounts, with what needs attention. Counted
// by admin_campaign_ops / admin_deliverability in the Yolias database.


export interface OpsCampaign {
  id: string; workspaceId: string; workspace: string; name: string; status: string; objective: string;
  createdAt: string; approvedAt: string | null; mailbox: string | null; dailyLimit: number | null;
  sent: number; bounced: number; failed: number; replies: number; interested: number; meetings: number; lastSentAt: string | null;
  flags: CampaignFlag[];
}

export async function campaignOps(sinceIso: string): Promise<OpsCampaign[]> {
  const { data, error } = await ydb().rpc("admin_campaign_ops", { p_since: sinceIso });
  if (error) throw error;
  return (data ?? []).map((r) => {
    const c = {
      id: r.campaign_id, workspaceId: r.workspace_id, workspace: r.workspace_name ?? "", name: r.name, status: r.status, objective: r.objective,
      createdAt: r.created_at, approvedAt: r.approved_at, mailbox: r.mailbox_email, dailyLimit: r.daily_limit,
      sent: Number(r.sent), bounced: Number(r.bounced), failed: Number(r.failed), replies: Number(r.replies), interested: Number(r.interested), meetings: Number(r.meetings), lastSentAt: r.last_sent_at,
    };
    return { ...c, flags: flagsOf(c) };
  });
}

export interface OpsMailbox {
  id: string; email: string; provider: string; status: string; workspace: string; dailyLimit: number;
  sent: number; bounced: number; replies: number; unsubscribed: number; lastError: string | null; lastSyncedAt: string | null;
}

export async function deliverability(sinceIso: string): Promise<OpsMailbox[]> {
  const { data, error } = await ydb().rpc("admin_deliverability", { p_since: sinceIso });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.mailbox_id, email: r.email, provider: r.provider, status: r.status, workspace: r.workspace_name ?? "", dailyLimit: r.daily_limit,
    sent: Number(r.sent), bounced: Number(r.bounced), replies: Number(r.replies), unsubscribed: Number(r.unsubscribed), lastError: r.last_error, lastSyncedAt: r.last_synced_at,
  }));
}

/** Pauses a running campaign (a risk the admin saw). platform.manage only; audited. */
export async function pauseCampaign(bos: BosUser, id: string, reason: string) {
  const why = reason.trim();
  if (why.length < 3) throw new ValidationError("اكتب سبب الإيقاف.", { reason: "مطلوب" });
  const { data: c } = await ydb().from("outreach_campaigns").select("id, name, status, workspace_id").eq("id", id).maybeSingle();
  if (!c) throw new NotFoundError();
  if (c.status !== "active" && c.status !== "scheduled") throw new ValidationError("الحملة ليست تعمل.");
  const { error } = await ydb().from("outreach_campaigns").update({ status: "paused" }).eq("id", id).in("status", ["active", "scheduled"]);
  if (error) throw error;
  await audit({ actorId: bos.userId, action: "yolias.campaign.pause", entityType: "yolias_campaign", entityId: null, oldValue: { status: c.status }, newValue: { status: "paused", reason: why }, metadata: { campaign: id, name: c.name } });
}
