import Link from "next/link";
import { requirePermission } from "@/lib/bos/auth";
import { PageHeader, Card, KpiCard, EmptyState, StatusBadge } from "@/components/bos/ui";
import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import { formatDateTime } from "@/lib/bos/format";
import { agentOverview } from "@/services/yolias/agent";
import { NotConnected, connected, num } from "@/components/yolias/PlatformUi";

const usd4 = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;

const outcomes: Record<string, { label: string; tone: "success" | "danger" | "warning" | "info" | "neutral" }> = {
  ok: { label: "نجح", tone: "success" },
  denied: { label: "مرفوض (صلاحيات)", tone: "danger" },
  invalid: { label: "مدخلات غير صالحة", tone: "warning" },
  not_found: { label: "غير موجود", tone: "neutral" },
  not_connected: { label: "غير متصل", tone: "info" },
  error: { label: "خطأ", tone: "danger" },
};
const Outcome = ({ value }: { value: string }) => <StatusBadge tone={outcomes[value]?.tone ?? "neutral"} label={outcomes[value]?.label ?? value} />;

// Yolias AI agent: usage, cost and the audit log of every tool call
// (docs/07, docs/09 §B, rule 35). Last 30 days; no conversation text.
export default async function AgentPage() {
  await requirePermission("platform.read");
  if (!connected()) return (<><PageHeader title="Yolias AI" /><NotConnected /></>);
  const { metrics: m, recent } = await agentOverview(30);
  const failed = m.tool_calls - (m.by_outcome.ok ?? 0);
  return (
    <>
      <PageHeader title="Yolias AI" subtitle="استخدام المساعد وسجل تدقيق كل أداة استدعاها — آخر 30 يوماً" />
      <div className="bos-kpis">
        <KpiCard label="المحادثات" value={num(m.conversations)} sub={<Tx vars={{ n: num(m.workspaces) }}>{"{n} مساحة عمل"}</Tx>} />
        <KpiCard label="الرسائل" value={num(m.user_turns)} sub={<Tx vars={{ n: num(m.assistant_turns) }}>{"{n} رد من المساعد"}</Tx>} />
        <KpiCard label="استدعاءات الأدوات" value={num(m.tool_calls)} sub={<Tx vars={{ n: num(failed), d: num(m.by_outcome.denied ?? 0) }}>{"{n} لم تنجح · {d} مرفوضة"}</Tx>} />
        <KpiCard label="تكلفة النموذج اللغوي" value={usd4(m.llm_cost_usd)} sub={<Tx vars={{ n: num(m.llm_calls) }}>{"{n} طلب"}</Tx>} />
      </div>

      <Card title="حسب الأداة">
        {m.by_tool.length ? (
          <BosTable className="bos-table">
            <thead><tr><th><Tx>الأداة</Tx></th><th><Tx>الطلبات</Tx></th><th><Tx>لم تنجح</Tx></th><th><Tx>متوسط الزمن</Tx></th></tr></thead>
            <tbody>
              {m.by_tool.map((t) => (
                <tr key={t.tool}>
                  <td dir="ltr">{t.tool}</td>
                  <td className="bos-num">{num(t.calls)}</td>
                  <td className="bos-num">{num(t.failures)}</td>
                  <td className="bos-num">{t.avg_ms == null ? "—" : `${t.avg_ms} ms`}</td>
                </tr>
              ))}
            </tbody>
          </BosTable>
        ) : <EmptyState title="لم يستدعِ المساعد أي أداة بعد" />}
      </Card>

      <Card title="سجل التدقيق (آخر 50)">
        {recent.length ? (
          <BosTable className="bos-table">
            <thead><tr><th><Tx>الوقت</Tx></th><th><Tx>مساحة العمل</Tx></th><th><Tx>الأداة</Tx></th><th><Tx>النتيجة</Tx></th><th><Tx>الزمن</Tx></th></tr></thead>
            <tbody>
              {recent.map((c) => (
                <tr key={c.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(c.created_at)}</td>
                  <td><Link className="bos-link" href={`/admin/platform/workspaces/${c.workspace_id}`}>{c.workspaceName || "—"}</Link></td>
                  <td dir="ltr">{c.tool}</td>
                  <td><Outcome value={c.outcome} />{c.error ? <span className="cell-sub" dir="auto">{c.error.length > 140 ? `${c.error.slice(0, 140)}…` : c.error}</span> : null}</td>
                  <td className="bos-num">{c.latency_ms == null ? "—" : `${c.latency_ms} ms`}</td>
                </tr>
              ))}
            </tbody>
          </BosTable>
        ) : <EmptyState title="لا توجد استدعاءات" />}
      </Card>
    </>
  );
}
