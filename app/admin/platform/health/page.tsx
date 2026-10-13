import { can, requirePermission } from "@/lib/bos/auth";
import { getSetting } from "@/lib/bos/settings";
import { limits, measureAlerts } from "@/services/yolias/alerts";
import { AlertsForm } from "./AlertsForm";
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
  const { bos } = await requirePermission("platform.read");
  if (!connected()) return (<><PageHeader title="صحة المنصة" /><NotConnected /></>);
  const alertCfg = await getSetting("platform_alerts");
  const [h, alerts] = await Promise.all([platformHealth(), measureAlerts(alertCfg).catch(() => [])]);
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
      <Card title="التنبيهات" flush>
        <BosTable className="bos-table responsive">
          <thead><tr><th><Tx>التنبيه</Tx></th><th><Tx>الخدمة</Tx></th><th><Tx>القيمة الآن</Tx></th><th><Tx>الحد</Tx></th><th><Tx>الحالة</Tx></th></tr></thead>
          <tbody>
            {alerts.map((a) => (
              <tr key={a.key}>
                <td dir="ltr" style={{ fontSize: 12.5 }}>{a.detail}</td>
                <td>{a.service}</td>
                <td className="bos-num" dir="ltr">{a.value} {a.unit}</td>
                <td className="bos-num" dir="ltr">{a.threshold} {a.unit}</td>
                <td>{a.severity === "critical" ? <StatusBadge tone="danger" label="حرج" /> : a.severity === "warning" ? <StatusBadge tone="warning" label="تحذير" /> : <StatusBadge tone="success" label="طبيعي" />}</td>
              </tr>
            ))}
          </tbody>
        </BosTable>
        <div style={{ padding: "12px 16px" }}>
          <p className="bos-faint" style={{ fontSize: 12.5, margin: "0 0 6px" }}><Tx>{alertCfg.enabled ? "يفحصها المجدول تلقائيًا ويرسل إشعارًا داخل النظام وبريدًا للمدير العام والمسؤولين، مرة واحدة لكل تنبيه في اليوم." : "التنبيهات متوقفة."}</Tx></p>
          {limits.map((l) => <p key={l} className="bos-faint" style={{ fontSize: 12.5, margin: "0 0 6px" }}><Tx>{l}</Tx></p>)}
        </div>
      </Card>
      {can(bos, "platform.manage", "all") ? <Card title="حدود التنبيهات"><AlertsForm v={alertCfg} /></Card> : null}
    </>
  );
}
