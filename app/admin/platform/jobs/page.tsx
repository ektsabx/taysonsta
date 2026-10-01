import { requirePermission, can } from "@/lib/bos/auth";
import { PageHeader, Card, KpiCard, EmptyState, StatusBadge } from "@/components/bos/ui";
import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import { formatDateTime } from "@/lib/bos/format";
import type { Tone } from "@/lib/bos/labels";
import { jobsOverview } from "@/services/yolias/jobs";
import { NotConnected, connected, num } from "@/components/yolias/PlatformUi";
import { RetryButton } from "./RetryButton";

const runTone: Record<string, { label: string; tone: Tone }> = {
  running: { label: "قيد التشغيل", tone: "info" },
  succeeded: { label: "نجح", tone: "success" },
  failed: { label: "فشل", tone: "danger" },
  skipped: { label: "تُخطّي", tone: "neutral" },
};

const duration = (a: string, b: string | null) => (b ? `${Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / 1000))}s` : "—");

// Queue, workers, job runs, failed jobs and retries (docs/05, docs/09 §B "Operations").
export default async function JobsPage() {
  const { bos } = await requirePermission("platform.read");
  if (!connected()) return (<><PageHeader title="المهام والطابور" /><NotConnected /></>);
  const { metrics, runs, failures } = await jobsOverview();
  const manage = can(bos, "platform.manage", "all");
  return (
    <>
      <PageHeader title="المهام والطابور" subtitle="مهام الاكتشاف في الخلفية: الطابور، كل تشغيل، والمهام التي فشلت بعد كل المحاولات" />
      <div className="bos-kpis">
        <KpiCard label="في الطابور" value={num(Number(metrics?.queue_length ?? 0))} />
        <KpiCard label="أقدم مهمة منتظرة" value={metrics?.oldest_age_sec == null ? "—" : `${metrics.oldest_age_sec}s`} />
        <KpiCard label="مهام فاشلة" value={num(Number(metrics?.dead ?? 0))} />
        <KpiCard label="إجمالي المهام" value={num(Number(metrics?.total_messages ?? 0))} />
      </div>

      <Card title="المهام الفاشلة">
        {failures.length ? (
          <BosTable className="bos-table">
            <thead><tr><th><Tx>الوقت</Tx></th><th><Tx>المهمة</Tx></th><th><Tx>المحاولات</Tx></th><th><Tx>الخطأ</Tx></th><th></th></tr></thead>
            <tbody>
              {failures.map((f) => (
                <tr key={f.id}>
                  <td>{formatDateTime(f.created_at)}</td>
                  <td dir="ltr">{f.kind}</td>
                  <td className="bos-num">{f.attempts}</td>
                  <td style={{ maxWidth: 420 }}>{f.error ?? "—"}</td>
                  <td>{f.retried_at ? <StatusBadge tone="info" label="أُعيدت" /> : manage ? <RetryButton id={f.id} /> : null}</td>
                </tr>
              ))}
            </tbody>
          </BosTable>
        ) : <EmptyState title="لا توجد مهام فاشلة" />}
      </Card>

      <Card title="آخر التشغيلات">
        {runs.length ? (
          <BosTable className="bos-table">
            <thead><tr><th><Tx>البداية</Tx></th><th><Tx>الحملة</Tx></th><th><Tx>المحاولة</Tx></th><th><Tx>النتيجة</Tx></th><th><Tx>المدة</Tx></th><th><Tx>التفاصيل</Tx></th></tr></thead>
            <tbody>
              {runs.map((r) => {
                const t = runTone[r.status] ?? { label: r.status, tone: "neutral" as Tone };
                const m = (r.meta ?? {}) as { companies?: number; prospects?: number; reason?: string };
                return (
                  <tr key={r.id}>
                    <td>{formatDateTime(r.started_at)}</td>
                    <td>{r.campaign?.name ?? "—"}</td>
                    <td className="bos-num">{r.attempt}</td>
                    <td><StatusBadge tone={t.tone} label={t.label} /></td>
                    <td className="bos-num">{duration(r.started_at, r.finished_at)}</td>
                    <td style={{ fontSize: 12 }}>{r.error ?? (m.prospects != null ? <Tx vars={{ c: m.companies ?? 0, p: m.prospects }}>{"{c} شركة · {p} عميل محتمل"}</Tx> : m.reason ?? "—")}</td>
                  </tr>
                );
              })}
            </tbody>
          </BosTable>
        ) : <EmptyState title="لا توجد تشغيلات بعد" />}
      </Card>
    </>
  );
}
