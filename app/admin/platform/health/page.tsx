import { requirePermission } from "@/lib/bos/auth";
import { PageHeader, Card, KpiCard, EmptyState, StatusBadge } from "@/components/bos/ui";
import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import { formatDateTime } from "@/lib/bos/format";
import { platformHealth } from "@/services/yolias/health";
import { NotConnected, connected, num } from "@/components/yolias/PlatformUi";

const Yes = ({ on, label }: { on: boolean; label?: string }) => <StatusBadge tone={on ? "success" : "neutral"} label={label ?? (on ? "مُعدّ" : "غير مُعدّ")} />;

// Platform health (docs/09 §B): database, worker, queue, providers, LLM and
// email error rates over the last 24 hours. Configuration flags come from the
// worker's heartbeat (yes/no only, never keys).
export default async function HealthPage() {
  await requirePermission("platform.read");
  if (!connected()) return (<><PageHeader title="صحة المنصة" /><NotConnected /></>);
  const h = await platformHealth();
  const workerOk = h.worker != null && h.worker.ageSec < 120;
  const llmRate = h.llm24h.total ? Math.round((h.llm24h.failed / h.llm24h.total) * 100) : null;
  return (
    <>
      <PageHeader title="صحة المنصة" subtitle="الحالة الآن وآخر 24 ساعة" />
      <div className="bos-kpis">
        <KpiCard label="قاعدة البيانات" value={h.db.ok ? `${h.db.latencyMs} ms` : "—"} sub={<StatusBadge tone={h.db.ok ? "success" : "danger"} label={h.db.ok ? "متصلة" : "غير متصلة"} />} />
        <KpiCard label="العامل (Worker)" value={h.worker ? formatDateTime(h.worker.lastRunAt) : "—"} sub={<StatusBadge tone={workerOk ? "success" : "danger"} label={workerOk ? "يعمل" : "متوقف"} />} />
        <KpiCard label="طابور المهام" value={num(h.queue?.queue_length ?? 0)} sub={<Tx vars={{ n: num(h.failedJobs) }}>{"{n} مهمة فاشلة"}</Tx>} />
        <KpiCard label="أخطاء النماذج اللغوية" value={llmRate == null ? "—" : `${llmRate}%`} sub={<Tx vars={{ n: num(h.llm24h.total) }}>{"من {n} طلب"}</Tx>} />
        <KpiCard label="رسائل البريد" value={num(h.email24h.sent)} sub={<Tx vars={{ n: num(h.email24h.failed) }}>{"{n} فشلت"}</Tx>} />
        <KpiCard label="تشغيلات فاشلة" value={num(h.runsFailed24h)} />
      </div>

      <Card title="الخدمات المُعدّة في Yolias">
        {h.configured ? (
          <BosTable className="bos-table">
            <tbody>
              <tr><td>Anthropic (Claude)</td><td><Yes on={h.configured.llm.anthropic} /></td></tr>
              <tr><td>OpenAI</td><td><Yes on={h.configured.llm.openai} /></td></tr>
              <tr><td>Google Gemini</td><td><Yes on={h.configured.llm.gemini} /></td></tr>
              <tr><td>Resend (<Tx>البريد</Tx>)</td><td><Yes on={h.configured.email} /></td></tr>
              <tr><td><Tx>تحويل الصوت إلى نص</Tx></td><td><Yes on={h.configured.stt} /></td></tr>
              <tr><td><Tx>الدفع</Tx></td><td><Yes on={!h.configured.billingTestMode} label={h.configured.billingTestMode ? "وضع الاختبار" : "حقيقي"} /></td></tr>
            </tbody>
          </BosTable>
        ) : <EmptyState title="لم يعمل العامل بعد" />}
      </Card>

      <Card title="مزودو البيانات">
        {h.providers.length ? (
          <BosTable className="bos-table">
            <thead><tr><th><Tx>المزود</Tx></th><th><Tx>مفعّل</Tx></th><th><Tx>قاطع الدائرة</Tx></th><th><Tx>أخطاء متتالية</Tx></th></tr></thead>
            <tbody>
              {h.providers.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td><Yes on={p.enabled} label={p.enabled ? "نعم" : "لا"} /></td>
                  <td><StatusBadge tone={p.circuitOpen ? "danger" : "success"} label={p.circuitOpen ? "مفتوح (متوقف مؤقتاً)" : "مغلق"} /></td>
                  <td className="bos-num">{num(p.failures)}</td>
                </tr>
              ))}
            </tbody>
          </BosTable>
        ) : <EmptyState title="لا يوجد مزودو بيانات متصلون بعد" />}
      </Card>
    </>
  );
}
