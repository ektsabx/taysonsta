import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { runDiscovery } from "@/lib/discovery/pipeline";
import { deliverEmail, notify, workspaceRecipients } from "@/lib/email/notify";
import { sendAnnouncement } from "@/lib/email/announce";
import { securityAlert } from "@/lib/email/events";
import { billingSweep } from "@/lib/billing";
import type { JobKind, JobPayloads } from "@/lib/jobs/queue";
import type { Json } from "@/types/database";

// Drains the job queue (docs/05). Retries with exponential backoff; after
// MAX_ATTEMPTS a job goes to the dead-letter table (job_failures) and its
// campaign is marked failed. Runs inside a time budget so it fits a
// Cloudflare Worker invocation.

export const MAX_ATTEMPTS = 5;
const VISIBILITY_SECONDS = 300;

type Handler<K extends JobKind> = (payload: JobPayloads[K], attempt: number) => Promise<void>;

const handlers: { [K in JobKind]: Handler<K> } = {
  "campaign.discover": (p, attempt) => runDiscovery(p.campaignId, { attempt }),
  "email.send": (p) => deliverEmail(p.logId),
  "email.workspace": async (p) => {
    const { data: u } = await createAdminClient().rpc("usage_summary", { p_ws: p.workspaceId });
    await notify("prospects_added", await workspaceRecipients(p.workspaceId), { ...p.data, allowance: u?.[0]?.allowance ?? 0 }, { workspaceId: p.workspaceId, dedupe: p.dedupe });
  },
  "email.user": (p) => securityAlert(p.userId, p.event),
  "email.announce": (p) => sendAnnouncement(p.announcementId),
  "billing.sweep": async () => {
    await billingSweep();
  },
};

const SWEEP_EVERY_MS = 60 * 60_000;

/**
 * For Yolias Admin → Platform health: when the worker last ran and which
 * services are configured in this deployment (yes/no only — never a key).
 */
async function heartbeat() {
  const configured = {
    llm: { anthropic: Boolean(process.env.ANTHROPIC_API_KEY), openai: Boolean(process.env.OPENAI_API_KEY), gemini: Boolean(process.env.GEMINI_API_KEY) },
    email: Boolean(process.env.RESEND_API_KEY),
    billingTestMode: process.env.BILLING_TEST_MODE === "true",
  };
  await createAdminClient().from("worker_state").upsert({ key: "heartbeat", value: { at: new Date().toISOString(), configured }, updated_at: new Date().toISOString() });
}

/** Queues the billing sweep at most once an hour (the worker is called every few seconds). */
async function scheduleSweep() {
  const db = createAdminClient();
  const since = new Date(Date.now() - SWEEP_EVERY_MS).toISOString();
  const { data } = await db.from("worker_state").upsert({ key: "billing.sweep", value: {}, updated_at: new Date().toISOString() }, { onConflict: "key", ignoreDuplicates: true }).select("key");
  if (data?.length) {
    await db.rpc("jobs_enqueue", { p_kind: "billing.sweep", p_payload: {}, p_delay: 0 });
    return;
  }
  // Conditional bump: only one caller wins per hour.
  const { data: won } = await db.from("worker_state").update({ updated_at: new Date().toISOString() }).eq("key", "billing.sweep").lt("updated_at", since).select("key");
  if (won?.length) await db.rpc("jobs_enqueue", { p_kind: "billing.sweep", p_payload: {}, p_delay: 0 });
}

/** 30s, 60s, 120s, 240s… capped at 30 minutes. */
export function backoffSeconds(attempt: number): number {
  return Math.min(30 * 2 ** Math.max(attempt - 1, 0), 1800);
}

export interface TickResult {
  taken: number;
  succeeded: number;
  retried: number;
  dead: number;
}

export async function tick({ max = 5, budgetMs = 25_000 } = {}): Promise<TickResult> {
  const db = createAdminClient();
  const started = Date.now();
  const result: TickResult = { taken: 0, succeeded: 0, retried: 0, dead: 0 };
  await scheduleSweep().catch((e) => console.error("[jobs] sweep scheduling failed", e));
  await heartbeat().catch(() => {});
  while (Date.now() - started < budgetMs && result.taken < max) {
    const { data: jobs, error } = await db.rpc("jobs_read", { p_n: 1, p_vt: VISIBILITY_SECONDS });
    if (error) throw new Error(`queue read failed: ${error.message}`);
    const job = jobs?.[0];
    if (!job) break;
    result.taken++;
    const handler = handlers[job.kind as JobKind] as Handler<JobKind> | undefined;
    try {
      if (!handler) throw new Error(`unknown job kind: ${job.kind}`);
      await handler(job.payload as unknown as JobPayloads[JobKind], job.read_ct);
      await db.rpc("jobs_ack", { p_msg_id: job.msg_id });
      result.succeeded++;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(`[jobs] ${job.kind} #${job.msg_id} attempt ${job.read_ct} failed: ${message}`);
      if (!handler || job.read_ct >= MAX_ATTEMPTS) {
        await db.rpc("jobs_dead", { p_msg_id: job.msg_id, p_kind: job.kind, p_payload: job.payload as Json, p_attempts: job.read_ct, p_error: message });
        await onDead(job.kind, job.payload, message);
        result.dead++;
      } else {
        await db.rpc("jobs_retry_later", { p_msg_id: job.msg_id, p_delay: backoffSeconds(job.read_ct) });
        result.retried++;
      }
    }
  }
  return result;
}

async function onDead(kind: string, payload: unknown, error: string) {
  if (kind !== "campaign.discover") return;
  const campaignId = (payload as { campaignId?: string })?.campaignId;
  if (!campaignId) return;
  const db = createAdminClient();
  const { data: c } = await db.from("campaigns").select("workspace_id, status").eq("id", campaignId).maybeSingle();
  if (!c || c.status === "completed" || c.status === "partial") return;
  await db.from("campaigns").update({ status: "failed" }).eq("id", campaignId);
  await db.rpc("release_usage", { p_ws: c.workspace_id, p_campaign: campaignId, p_reason: "job failed" });
  await db.from("campaign_events").insert({ workspace_id: c.workspace_id, campaign_id: campaignId, stage: "deliver", level: "error", message: `Discovery stopped: ${error}`, meta: { key: "stopped", vars: { reason: error.slice(0, 200) } } });
}
