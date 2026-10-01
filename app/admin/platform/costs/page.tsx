import { requirePermission } from "@/lib/bos/auth";
import { PageHeader, Card, KpiCard, EmptyState, StatusBadge } from "@/components/bos/ui";
import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import { formatDateTime } from "@/lib/bos/format";
import { costOverview } from "@/services/yolias/intel";
import { NotConnected, connected, num } from "@/components/yolias/PlatformUi";

const usd4 = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;

// Platform costs (docs/06 "Cost engine", docs/09 §B "LLM usage & costs",
// "Platform costs", "Cost per prospect"). Since the start of the month.
export default async function CostsPage() {
  await requirePermission("platform.read");
  if (!connected()) return (<><PageHeader title="التكاليف" /><NotConnected /></>);
  const c = await costOverview();
  return (
    <>
      <PageHeader title="التكاليف" subtitle="تكلفة المنصة هذا الشهر: النماذج اللغوية ومزودو البيانات — كل طلب مسجّل بتكلفته" />
      <div className="bos-kpis">
        <KpiCard label="إجمالي التكلفة" value={usd4(c.total)} />
        <KpiCard label="النماذج اللغوية" value={usd4(c.llm)} sub={<Tx vars={{ n: num(c.llmCalls), h: num(c.llmCacheHits) }}>{"{n} طلب · {h} من الذاكرة المؤقتة"}</Tx>} />
        <KpiCard label="مزودو البيانات" value={usd4(c.provider)} />
        <KpiCard label="تكلفة العميل المحتمل" value={c.costPerProspect == null ? "—" : usd4(c.costPerProspect)} sub={<Tx vars={{ n: num(c.prospects) }}>{"{n} عميل محتمل مسلَّم"}</Tx>} />
      </div>

      <Card title="حسب المهمة والمزود">
        {c.rows.length ? (
          <BosTable className="bos-table">
            <thead><tr><th><Tx>النوع</Tx></th><th><Tx>المهمة / المزود</Tx></th><th><Tx>الطلبات</Tx></th><th><Tx>الفشل</Tx></th><th><Tx>من الذاكرة المؤقتة</Tx></th><th><Tx>التكلفة</Tx></th><th><Tx>متوسط الزمن</Tx></th></tr></thead>
            <tbody>
              {c.rows.sort((a, b) => b.cost_usd - a.cost_usd).map((r) => (
                <tr key={`${r.kind}:${r.key}`}>
                  <td>{r.kind === "llm" ? <StatusBadge tone="accent" label="نموذج لغوي" /> : <StatusBadge tone="info" label="مزود بيانات" />}</td>
                  <td dir="ltr">{r.key}</td>
                  <td className="bos-num">{num(r.calls)}</td>
                  <td className="bos-num">{num(r.failures)}</td>
                  <td className="bos-num">{num(r.cache_hits)}</td>
                  <td className="bos-num">{usd4(r.cost_usd)}</td>
                  <td className="bos-num">{r.avg_latency_ms == null ? "—" : `${r.avg_latency_ms} ms`}</td>
                </tr>
              ))}
            </tbody>
          </BosTable>
        ) : <EmptyState title="لا توجد تكاليف هذا الشهر" />}
      </Card>

      <Card title="آخر طلبات النماذج اللغوية">
        {c.recentLlm.length ? (
          <BosTable className="bos-table">
            <thead><tr><th><Tx>الوقت</Tx></th><th><Tx>المهمة</Tx></th><th><Tx>النموذج</Tx></th><th><Tx>الرموز</Tx></th><th><Tx>التكلفة</Tx></th><th><Tx>النتيجة</Tx></th></tr></thead>
            <tbody>
              {c.recentLlm.map((r) => (
                <tr key={r.id}>
                  <td>{formatDateTime(r.created_at)}</td>
                  <td dir="ltr">{r.task}</td>
                  <td dir="ltr">{r.served_model && r.served_model !== r.model ? `${r.model} → ${r.served_model}` : r.model}</td>
                  <td className="bos-num">{r.cache_hit ? "—" : `${num(r.input_tokens)} / ${num(r.output_tokens)}`}</td>
                  <td className="bos-num">{usd4(Number(r.cost_usd))}</td>
                  <td>{!r.ok ? <StatusBadge tone="danger" label={r.error ?? "فشل"} /> : r.cache_hit ? <StatusBadge tone="info" label="من الذاكرة المؤقتة" /> : <StatusBadge tone="success" label="نجح" />}</td>
                </tr>
              ))}
            </tbody>
          </BosTable>
        ) : <EmptyState title="لا توجد طلبات بعد" />}
      </Card>
    </>
  );
}
