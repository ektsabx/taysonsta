import "server-only";
import { ydb, yintel } from "@/lib/yolias/db";
import { monthStartUtc } from "@/lib/yolias/plans";

// Platform health and profitability for Yolias Admin (docs/09 §B "Platform
// health", "Revenue · Platform costs · Cost per prospect"). Real data only
// (rule 39): every figure comes from a table or SQL aggregate.

export interface Heartbeat {
  at: string;
  configured: { llm: { anthropic: boolean; openai: boolean; gemini: boolean }; email: boolean; stt: boolean; billingTestMode: boolean };
}

export async function platformHealth() {
  const day = new Date(Date.now() - 86_400_000).toISOString();
  const started = Date.now();
  const { data: hb, error: dbError } = await ydb().from("worker_state").select("value").eq("key", "heartbeat").maybeSingle();
  const dbLatencyMs = Date.now() - started;
  const [queue, failedJobs, llmTotal, llmFailed, emailFailed, emailSent, providers, runsFailed] = await Promise.all([
    ydb().rpc("jobs_metrics"),
    ydb().from("job_failures").select("id", { count: "exact", head: true }).is("retried_at", null),
    yintel().from("llm_calls").select("id", { count: "exact", head: true }).gte("created_at", day),
    yintel().from("llm_calls").select("id", { count: "exact", head: true }).gte("created_at", day).eq("ok", false),
    ydb().from("email_log").select("id", { count: "exact", head: true }).gte("created_at", day).eq("status", "failed"),
    ydb().from("email_log").select("id", { count: "exact", head: true }).gte("created_at", day).eq("status", "sent"),
    yintel().from("providers").select("id, name, enabled, health"),
    ydb().from("campaign_runs").select("id", { count: "exact", head: true }).gte("started_at", day).eq("status", "failed"),
  ]);
  const q = (queue.data as unknown as { queue_length: number; oldest_age_sec: number | null; dead: number }[] | null)?.[0] ?? null;
  const heartbeat = (hb?.value ?? null) as Heartbeat | null;
  return {
    db: { ok: !dbError, latencyMs: dbLatencyMs },
    worker: heartbeat ? { lastRunAt: heartbeat.at, ageSec: Math.round((Date.now() - new Date(heartbeat.at).getTime()) / 1000) } : null,
    configured: heartbeat?.configured ?? null,
    queue: q,
    failedJobs: failedJobs.count ?? 0,
    runsFailed24h: runsFailed.count ?? 0,
    llm24h: { total: llmTotal.count ?? 0, failed: llmFailed.count ?? 0 },
    email24h: { sent: emailSent.count ?? 0, failed: emailFailed.count ?? 0 },
    providers: (providers.data ?? []).map((p) => {
      const h = (p.health ?? {}) as { circuit_open_until?: string | null; consecutive_failures?: number };
      return { id: p.id, name: p.name, enabled: p.enabled, circuitOpen: Boolean(h.circuit_open_until && new Date(h.circuit_open_until) > new Date()), failures: h.consecutive_failures ?? 0 };
    }),
  };
}

export async function profitability(since = monthStartUtc()) {
  const { data, error } = await ydb().rpc("admin_profitability", { p_since: since.toISOString() });
  if (error) throw error;
  const rows = (data ?? []).map((r) => {
    const cost = Number(r.llm_cost) + Number(r.provider_cost);
    const live = Number(r.revenue_live);
    return { ...r, revenue_live: live, revenue_test: Number(r.revenue_test), cost, margin: live - cost, prospects: Number(r.prospects), unpriced_calls: Number(r.unpriced_calls), costPerProspect: Number(r.prospects) ? cost / Number(r.prospects) : null };
  });
  const byPlan = new Map<string, { plan: string; workspaces: number; revenue_live: number; revenue_test: number; cost: number; prospects: number }>();
  for (const r of rows) {
    const p = byPlan.get(r.plan) ?? { plan: r.plan, workspaces: 0, revenue_live: 0, revenue_test: 0, cost: 0, prospects: 0 };
    p.workspaces++;
    p.revenue_live += r.revenue_live;
    p.revenue_test += r.revenue_test;
    p.cost += r.cost;
    p.prospects += r.prospects;
    byPlan.set(r.plan, p);
  }
  return { since: since.toISOString(), rows: rows.sort((a, b) => b.cost - a.cost), byPlan: [...byPlan.values()] };
}
