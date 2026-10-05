import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

// Background jobs (docs/05 "Queue & worker"). The web app only enqueues; the
// worker (/api/worker) runs them. Every job must be idempotent: it can run
// again after a crash or timeout.

export type JobKind = "campaign.discover" | "email.send" | "email.workspace" | "email.announce" | "billing.sweep";

export interface JobPayloads {
  "campaign.discover": { campaignId: string };
  /** One logged email (lib/email/notify.ts). */
  "email.send": { logId: number };
  /** An email to a workspace's owners/admins, queued by Yolias Admin (e.g. prospects added). */
  "email.workspace": { kind: "prospects_added"; workspaceId: string; data: { added: number; reason: string | null }; dedupe?: string };
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
