import "server-only";
import { emitEvent } from "@/lib/bos/events";
import { getSetting, type SettingValue } from "@/lib/bos/settings";
import { ydb, yintel, yoliasConfigured } from "@/lib/yolias/db";

// Platform alerts (2026-10-12). Real measurements only, from the Yolias
// database: Gemini spend (intel.llm_calls), failed AI and data-provider calls
// (intel.llm_calls / provider_calls), payment failures (payments), product
// emails sent today (email_log) and the database size Postgres reports.
// When a threshold is crossed, one "platform.alert" event per alert per day
// (dedupe key) → in-app + email to Super Admins and Admins. Thresholds:
// bos_settings "platform_alerts". What can't be measured here is reported as
// such (see `limits`), never estimated.

export type AlertKey = "gemini_cost" | "ai_errors" | "payment_failures" | "email_volume" | "db_size";
export type Severity = "ok" | "warning" | "critical";

export interface AlertState {
  key: AlertKey;
  service: string;
  value: number;
  threshold: number;
  unit: string;
  severity: Severity;
  detail: string;
}

/** What these alerts can't see (shown in Admin next to them). */
export const limits = [
  "أخطاء التطبيق في المتصفح والخادم تُتابع في Sentry؛ قراءتها من هنا تحتاج Auth Token من Sentry، لذا يقيس هذا التنبيه فشل طلبات الذكاء الاصطناعي ومزودي البيانات المسجلة في Yolias.",
  "عدّاد البريد يحسب رسائل منتج Yolias المرسلة اليوم (email_log). رسائل تسجيل الدخول التي يرسلها Supabase عبر Resend لا تظهر هنا، فحصة Resend الفعلية قد تكون أعلى استهلاكًا.",
];

// Fixed ids so each alert type is one "entity" in the notification system.
const entityIds: Record<AlertKey, string> = {
  gemini_cost: "a1e70000-0000-4000-8000-000000000001",
  ai_errors: "a1e70000-0000-4000-8000-000000000002",
  payment_failures: "a1e70000-0000-4000-8000-000000000003",
  email_volume: "a1e70000-0000-4000-8000-000000000004",
  db_size: "a1e70000-0000-4000-8000-000000000005",
};

const startOfUtcDay = () => `${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

export async function measureAlerts(cfg?: SettingValue<"platform_alerts">): Promise<AlertState[]> {
  const c = cfg ?? (await getSetting("platform_alerts"));
  const day = startOfUtcDay();
  const [llmToday, llmFailHour, provFailHour, pays, emails, dbSize] = await Promise.all([
    yintel().from("llm_calls").select("model, served_model, cost_usd").gte("created_at", day).limit(100_000),
    yintel().from("llm_calls").select("id", { count: "exact", head: true }).eq("ok", false).gte("created_at", ago(3_600_000)),
    yintel().from("provider_calls").select("id", { count: "exact", head: true }).eq("ok", false).gte("created_at", ago(3_600_000)),
    ydb().from("payments").select("status").gte("created_at", ago(86_400_000)).in("status", ["succeeded", "failed"]).limit(10_000),
    ydb().from("email_log").select("id", { count: "exact", head: true }).eq("status", "sent").gte("created_at", day),
    ydb().rpc("admin_db_size"),
  ]);

  const gemini = (llmToday.data ?? []).filter((r) => /gemini/i.test(r.served_model ?? r.model)).reduce((s, r) => s + Number(r.cost_usd ?? 0), 0);
  const failures = (llmFailHour.count ?? 0) + (provFailHour.count ?? 0);
  const attempts = (pays.data ?? []).length;
  const failed = (pays.data ?? []).filter((p) => p.status === "failed").length;
  const payPct = attempts ? (failed / attempts) * 100 : 0;
  const sent = emails.count ?? 0;
  const mb = typeof dbSize.data === "number" ? dbSize.data / 1_048_576 : Number(dbSize.data ?? 0) / 1_048_576;

  const level = (v: number, warn: number, crit: number): Severity => (v >= crit ? "critical" : v >= warn ? "warning" : "ok");
  return [
    { key: "gemini_cost", service: "Gemini", value: round(gemini, 4), threshold: c.gemini_daily_usd, unit: "USD", severity: c.gemini_daily_usd > 0 ? level(gemini, c.gemini_daily_usd, c.gemini_daily_usd * 2) : "ok", detail: `Gemini spend today (UTC): $${gemini.toFixed(4)}` },
    { key: "ai_errors", service: "Yolias AI / data providers", value: failures, threshold: c.ai_failures_per_hour, unit: "/h", severity: level(failures, c.ai_failures_per_hour, c.ai_failures_per_hour * 3), detail: `Failed calls in the last hour: ${llmFailHour.count ?? 0} AI, ${provFailHour.count ?? 0} data providers` },
    { key: "payment_failures", service: "Paymob", value: round(payPct, 1), threshold: c.payment_failure_pct, unit: "%", severity: attempts >= c.payment_min_attempts ? level(payPct, c.payment_failure_pct, Math.min(100, c.payment_failure_pct * 2)) : "ok", detail: `${failed} of ${attempts} payments failed in the last 24 hours` },
    { key: "email_volume", service: "Resend", value: sent, threshold: c.email_daily_quota, unit: "emails", severity: level(sent, (c.email_daily_quota * c.email_warn_pct) / 100, c.email_daily_quota), detail: `${sent} product emails sent today of a ${c.email_daily_quota} daily quota` },
    { key: "db_size", service: "Supabase", value: round(mb, 1), threshold: c.db_limit_mb, unit: "MB", severity: dbSize.error ? "ok" : level(mb, (c.db_limit_mb * c.db_warn_pct) / 100, c.db_limit_mb), detail: dbSize.error ? "Database size unavailable" : `Database size ${mb.toFixed(1)} MB of ${c.db_limit_mb} MB` },
  ];
}

const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;

const titles: Record<AlertKey, [string, string]> = {
  gemini_cost: ["تكلفة Gemini تجاوزت الحد اليومي", "Gemini spend passed the daily limit"],
  ai_errors: ["ارتفاع فشل طلبات الذكاء الاصطناعي أو مزودي البيانات", "AI or data-provider failures are high"],
  payment_failures: ["ارتفاع نسبة فشل المدفوعات", "Payment failure rate is high"],
  email_volume: ["البريد يقترب من الحصة اليومية", "Email is close to the daily quota"],
  db_size: ["قاعدة البيانات تقترب من السعة المتاحة", "The database is close to its size limit"],
};

/** Run by the scheduled sweep. Returns how many alerts were raised (deduped per day). */
export async function checkPlatformAlerts(): Promise<number> {
  if (!yoliasConfigured()) return 0;
  const cfg = await getSetting("platform_alerts");
  if (!cfg.enabled) return 0;
  const day = new Date().toISOString().slice(0, 10);
  let raised = 0;
  for (const a of await measureAlerts(cfg)) {
    if (a.severity === "ok") continue;
    const [ar, en] = titles[a.key];
    const sev = a.severity === "critical" ? "حرج" : "تحذير";
    // Same alert, same day, same severity = the same incident: sent once.
    const id = await emitEvent({
      type: "platform.alert",
      entityType: "platform",
      entityId: entityIds[a.key],
      summary: `${en}: ${a.detail}`,
      actorType: "system",
      payload: {
        alert: a.key, severity: a.severity, service: a.service, value: a.value, threshold: a.threshold, unit: a.unit, at: new Date().toISOString(),
        title: en, title_en: `[${a.severity}] ${en}`, title_ar: `[${sev}] ${ar}`,
        detail_en: `${a.service}: ${a.detail}. Threshold: ${a.threshold} ${a.unit}.`,
        detail_ar: `${a.service}: ${a.detail}. الحد: ${a.threshold} ${a.unit}.`,
      },
      dedupeKey: `platform.alert:${a.key}:${a.severity}:${day}`,
    });
    if (id) raised++;
  }
  return raised;
}
