import "server-only";
import type { BosUser } from "@/lib/bos/auth";
import { audit } from "@/lib/bos/audit";
import { NotFoundError } from "@/lib/bos/errors";
import { ydb } from "@/lib/yolias/db";

// Queue / workers / jobs / failed jobs / retries (docs/09 §B "Operations").

export async function jobsOverview() {
  const db = ydb();
  const [{ data: metrics }, { data: runs }, { data: failures }] = await Promise.all([
    db.rpc("jobs_metrics"),
    db.from("campaign_runs").select("id, campaign_id, workspace_id, job, attempt, status, started_at, finished_at, error, meta").order("started_at", { ascending: false }).limit(40),
    db.from("job_failures").select("*").order("created_at", { ascending: false }).limit(40),
  ]);
  const campaignIds = [...new Set((runs ?? []).map((r) => r.campaign_id))];
  const { data: campaigns } = campaignIds.length ? await db.from("campaigns").select("id, name, status").in("id", campaignIds) : { data: [] };
  const byId = new Map((campaigns ?? []).map((c) => [c.id, c]));
  return {
    metrics: metrics?.[0] ?? null,
    runs: (runs ?? []).map((r) => ({ ...r, campaign: byId.get(r.campaign_id) ?? null })),
    failures: failures ?? [],
  };
}

/** Puts a dead job back on the queue (the job itself is idempotent). */
export async function retryFailedJob(bos: BosUser, id: number): Promise<void> {
  const db = ydb();
  const { data: f } = await db.from("job_failures").select("*").eq("id", id).maybeSingle();
  if (!f || f.retried_at) throw new NotFoundError();
  const campaignId = (f.payload as { campaignId?: string } | null)?.campaignId;
  if (f.kind === "campaign.discover" && campaignId) {
    await db.from("campaigns").update({ status: "queued" }).eq("id", campaignId).eq("status", "failed");
  }
  const { error } = await db.rpc("jobs_enqueue", { p_kind: f.kind, p_payload: f.payload, p_delay: 0 });
  if (error) throw error;
  await db.from("job_failures").update({ retried_at: new Date().toISOString() }).eq("id", id);
  await audit({ actorId: bos.userId, action: "yolias.job.retry", entityType: "yolias_job", entityId: null, metadata: { kind: f.kind, payload: f.payload } });
}
