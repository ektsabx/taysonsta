import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

// Background jobs (docs/05 "Queue & worker"). The web app only enqueues; the
// worker (/api/worker) runs them. Every job must be idempotent: it can run
// again after a crash or timeout.

export type JobKind = "campaign.discover";

export interface JobPayloads {
  "campaign.discover": { campaignId: string };
}

export async function enqueue<K extends JobKind>(kind: K, payload: JobPayloads[K], delaySeconds = 0): Promise<number | null> {
  const { data, error } = await createAdminClient().rpc("jobs_enqueue", { p_kind: kind, p_payload: payload as unknown as Json, p_delay: delaySeconds });
  if (error) {
    console.error("[jobs] enqueue failed", error.message);
    return null;
  }
  return (data as unknown as number | null) ?? null;
}
