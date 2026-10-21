import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadKashier } from "@/lib/payments/kashier";
import { loadIntegrations } from "@/lib/integrations";
import { resendKey } from "@/lib/email/send";
import type { ServiceStatus, StatusComponentRow } from "@/types/database";
import { parseStatusSettings, STATUS_SETTINGS_KEY, type StatusSettings } from "./checks-config";

export { DEFAULT_STATUS_SETTINGS, parseStatusSettings, STATUS_SETTINGS_KEY, type StatusSettings } from "./checks-config";

// Health checks for the status page (D-181). Each one is light (a cheap
// query or a HEAD/GET with a short timeout), never starts paid work, and
// measures the real dependency. A check that can't measure says "no_data"
// instead of claiming the service is fine. Results go through status_record,
// which keeps a failure streak: one failed check alone isn't shown as an
// outage (lib/status/index.ts applies the threshold).

export interface CheckResult { status: ServiceStatus; latency: number | null; detail: string | null }

/** Failures out of a total, against the configured rates (too little traffic = no data). */
export function rateStatus(failed: number, total: number, s: StatusSettings, minSample = 5): ServiceStatus {
  if (total < minSample) return "no_data";
  const r = failed / total;
  return r >= s.failureRateOutage ? "partial_outage" : r >= s.failureRateDegraded ? "degraded" : "operational";
}

async function timed<T>(fn: () => Promise<T>): Promise<{ ms: number; value: T | null; error: string | null }> {
  const t0 = Date.now();
  try {
    const value = await fn();
    return { ms: Date.now() - t0, value, error: null };
  } catch (e) {
    const name = e instanceof Error ? e.name : "";
    return { ms: Date.now() - t0, value: null, error: name === "TimeoutError" || name === "AbortError" ? "timeout" : "error" };
  }
}

const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3200").replace(/\/$/, "");

async function httpCheck(url: string, init: RequestInit, s: StatusSettings): Promise<CheckResult> {
  const r = await timed(() => fetch(url, { ...init, signal: AbortSignal.timeout(8000), cache: "no-store", redirect: "manual" }));
  if (!r.value) return { status: "major_outage", latency: r.ms, detail: r.error };
  if (r.value.status >= 500) return { status: "major_outage", latency: r.ms, detail: `http_${r.value.status}` };
  if (r.value.status >= 400) return { status: "partial_outage", latency: r.ms, detail: `http_${r.value.status}` };
  return { status: r.ms > s.slowMs ? "degraded" : "operational", latency: r.ms, detail: r.ms > s.slowMs ? "slow" : null };
}

/** Reachability only (any HTTP answer below 500 means the provider is up). No paid call is made. */
async function reachCheck(url: string, s: StatusSettings): Promise<CheckResult> {
  const r = await timed(() => fetch(url, { method: "GET", signal: AbortSignal.timeout(8000), cache: "no-store", redirect: "manual" }));
  if (!r.value) return { status: "partial_outage", latency: r.ms, detail: `provider_${r.error}` };
  if (r.value.status >= 500) return { status: "partial_outage", latency: r.ms, detail: `provider_http_${r.value.status}` };
  return { status: r.ms > s.slowMs ? "degraded" : "operational", latency: r.ms, detail: "reachable" };
}

const LLM_HOSTS: Record<string, string> = {
  anthropic: "https://api.anthropic.com/v1/models",
  openai: "https://api.openai.com/v1/models",
  gemini: "https://generativelanguage.googleapis.com/v1beta/models",
};

export async function runCheck(c: Pick<StatusComponentRow, "check_kind">, s: StatusSettings): Promise<CheckResult | null> {
  const db = createAdminClient();
  const since = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
  switch (c.check_kind) {
    case "website":
      return httpCheck(`${siteUrl()}/robots.txt`, { method: "GET" }, s);
    case "database": {
      const r = await timed(async () => {
        const { error } = await db.from("status_components").select("id").limit(1).abortSignal(AbortSignal.timeout(5000));
        if (error) throw new Error(error.message);
        return true;
      });
      if (!r.value) return { status: "major_outage", latency: r.ms, detail: r.error };
      return { status: r.ms > s.slowMs ? "degraded" : "operational", latency: r.ms, detail: null };
    }
    case "auth":
      return httpCheck(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health`, { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "" } }, s);
    case "discovery": {
      // Searches run on the job queue: how long the oldest job has waited.
      const r = await timed(async () => (await db.rpc("jobs_metrics", {}).abortSignal(AbortSignal.timeout(5000))).data?.[0] ?? null);
      if (r.error) return { status: "major_outage", latency: r.ms, detail: r.error };
      const age = Number(r.value?.oldest_age_sec ?? 0) / 60;
      const status: ServiceStatus = age >= s.queueOutageMinutes ? "partial_outage" : age >= s.queueDegradedMinutes ? "degraded" : "operational";
      return { status, latency: r.ms, detail: `queue_age_min:${Math.round(age)}` };
    }
    case "ai": {
      // From real Yolias AI calls in the last 30 minutes (no test calls are made).
      const { data, error } = await db.schema("intel").from("llm_calls").select("ok").gte("created_at", since(30)).limit(2000);
      if (error) return { status: "no_data", latency: null, detail: "unreadable" };
      const rows = data ?? [];
      const rated = rateStatus(rows.filter((x) => !x.ok).length, rows.length, s);
      if (rated !== "no_data") return { status: rated, latency: null, detail: `calls:${rows.length}` };
      // Quiet period: too few real calls to judge, so check the configured provider answers.
      const { routesFor } = await import("@/lib/ai/llm");
      const route = (await routesFor("agent").catch(() => []))[0];
      if (!route || !LLM_HOSTS[route.provider]) return { status: "no_data", latency: null, detail: "not_configured" };
      return reachCheck(LLM_HOSTS[route.provider], s);
    }
    case "payments": {
      const kashier = await loadKashier(db).catch(() => null);
      if (!kashier) return { status: "no_data", latency: null, detail: "not_connected" };
      const reach = await httpCheck(kashier.mode === "live" ? "https://api.kashier.io" : "https://test-api.kashier.io", { method: "HEAD" }, s);
      if (reach.status === "major_outage") return { ...reach, status: "partial_outage", detail: `provider_${reach.detail}` };
      const { data } = await db.from("payments").select("status, failure_reason").gte("created_at", since(120)).limit(2000);
      const rows = data ?? [];
      const failed = rows.filter((p) => p.failure_reason === "checkout_failed").length;
      const rate = rateStatus(failed, rows.length, s, 3);
      return { status: rate === "no_data" ? reach.status : rate, latency: reach.latency, detail: `checkouts:${rows.length}` };
    }
    case "email": {
      await loadIntegrations();
      if (!resendKey()) return { status: "no_data", latency: null, detail: "not_configured" };
      const { data } = await db.from("email_log").select("status").gte("created_at", since(120)).in("status", ["sent", "failed"]).limit(5000);
      const rows = data ?? [];
      const rated = rateStatus(rows.filter((x) => x.status === "failed").length, rows.length, s, 3);
      // Quiet period: check the email provider answers instead of showing "no data".
      return rated === "no_data" ? reachCheck("https://api.resend.com/", s) : { status: rated, latency: null, detail: `emails:${rows.length}` };
    }
    default:
      return null; // manual: only incidents change it
  }
}

export async function statusSettings(): Promise<StatusSettings> {
  const { data } = await createAdminClient().from("site_settings").select("value").eq("key", STATUS_SETTINGS_KEY).maybeSingle();
  return parseStatusSettings(data?.value);
}

/** Runs every enabled check once (in parallel, each with its own timeout) and records the results. */
export async function runStatusChecks(): Promise<number> {
  const db = createAdminClient();
  const [s, { data: comps }] = await Promise.all([statusSettings(), db.from("status_components").select("*").eq("check_enabled", true)]);
  const results = await Promise.all((comps ?? []).map(async (c) => ({ c, r: await runCheck(c, s).catch(() => ({ status: "no_data" as const, latency: null, detail: "check_error" })) })));
  let n = 0;
  for (const { c, r } of results) {
    if (!r) continue;
    await db.rpc("status_record", { p_component: c.id, p_status: r.status, p_latency: r.latency, p_detail: r.detail });
    n++;
  }
  return n;
}
