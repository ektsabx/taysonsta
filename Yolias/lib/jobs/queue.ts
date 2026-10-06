import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

// Background jobs (docs/05 "Queue & worker"). The web app only enqueues; the
// worker (/api/worker) runs them. Every job must be idempotent: it can run
// again after a crash or timeout.

export type JobKind = "campaign.discover" | "company.people" | "outreach.prepare" | "outreach.send" | "email.send" | "email.workspace" | "email.user" | "email.announce" | "billing.sweep";

export interface JobPayloads {
  "campaign.discover": { campaignId: string };
  /** Decision-maker matching for saved companies / local businesses (Prospects). */
  "company.people": { workspaceId: string; companyIds: string[] };
  /** Outreach drafts for many prospects (Prospects bulk action). */
  "outreach.prepare": { workspaceId: string; userId: string; prospectIds: string[]; instruction: string | null; language: "en" | "ar" };
  /** Send one approved outreach message from the approver's mailbox. */
  "outreach.send": { messageId: string };
  /** One logged email (lib/email/notify.ts). */
  "email.send": { logId: number };
  /** An email to a workspace's owners/admins, queued by Yolias Admin (e.g. prospects added). */
  "email.workspace": { kind: "prospects_added"; workspaceId: string; data: { added: number; reason: string | null }; dedupe?: string };
  /** A security email to one user, queued by Yolias Admin (suspend / restore). */
  "email.user": { userId: string; event: "account_suspended" | "account_restored" };
  /** Fan-out of a product update announcement written in Yolias Admin. */
  "email.announce": { announcementId: string };
  /** Renewal reminders, ending reminders and test-mode renewals. */
  "billing.sweep": Record<string, never>;
}

export async function enqueue<K extends JobKind>(kind: K, payload: JobPayloads[K], delaySeconds = 0): Promise<number | null> {
  const { data, error } = await createAdminClient().rpc("jobs_enqueue", { p_kind: kind, p_payload: payload as unknown as Json, p_delay: delaySeconds });
  if (error) {
    console.error("[jobs] enqueue failed", error.message);
    return null;
  }
  return (data as unknown as number | null) ?? null;
}
