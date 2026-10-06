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
const taskLabel: Record<string, string> = { agent: "التفكير والمحادثة", research: "البحث على الويب", extract: "الاستخراج والتصنيف" };
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
        <KpiCard label="المحادثات" value={num(m.conversations)} sub={<Tx vars={{ n: num(m.workspaces), u: num(m.by_scope?.user ?? 0), w: num(m.by_scope?.workspace ?? 0), c: num(m.by_scope?.campaign ?? 0) }}>{"{n} مساحة عمل · {u} خاصة · {w} مشتركة · {c} بحث"}</Tx>} />
        <KpiCard label="الرسائل" value={num(m.user_turns)} sub={<Tx vars={{ n: num(m.assistant_turns) }}>{"{n} رد من المساعد"}</Tx>} />
        <KpiCard label="استدعاءات الأدوات" value={num(m.tool_calls)} sub={<Tx vars={{ n: num(failed), d: num(m.by_outcome.denied ?? 0) }}>{"{n} لم تنجح · {d} مرفوضة"}</Tx>} />
        <KpiCard label="تكلفة النموذج اللغوي" value={usd4(m.llm_cost_usd)} sub={<Tx vars={{ n: num(m.llm_calls) }}>{"{n} طلب"}</Tx>} />
        <KpiCard label="تكلفة الأدوات (المزودون)" value={usd4(m.tool_cost_usd)} sub={m.tool_unpriced ? <Tx vars={{ n: num(m.tool_unpriced) }}>{"+ {n} طلب غير مسعّر"}</Tx> : undefined} />
        <KpiCard label="تقييم الردود" value={`👍 ${num(m.likes ?? 0)} · 👎 ${num(m.dislikes ?? 0)}`} />
      </div>

      <Card title="المنسّق: التكلفة حسب نوع المهمة">
        {m.by_task?.length ? (
          <BosTable className="bos-table">
            <thead><tr><th><Tx>المهمة</Tx></th><th><Tx>الطلبات</Tx></th><th><Tx>التكلفة</Tx></th><th><Tx>غير مسعّرة</Tx></th></tr></thead>
            <tbody>
              {m.by_task.map((k) => (
                <tr key={k.task}>
                  <td><Tx>{taskLabel[k.task] ?? k.task}</Tx> <span className="cell-sub" dir="ltr">{k.task}</span></td>
                  <td className="bos-num">{num(k.calls)}</td>
                  <td className="bos-num">{usd4(Number(k.cost_usd))}</td>
                  <td className="bos-num">{num(k.unpriced)}</td>
                </tr>
              ))}
            </tbody>
          </BosTable>
        ) : <EmptyState title="لا توجد طلبات للنموذج اللغوي" />}
      </Card>

      <Card title="حسب الأداة">
        {m.by_tool.length ? (
          <BosTable className="bos-table">
            <thead><tr><th><Tx>الأداة</Tx></th><th><Tx>الطلبات</Tx></th><th><Tx>لم تنجح</Tx></th><th><Tx>متوسط الزمن</Tx></th><th><Tx>التكلفة</Tx></th></tr></thead>
            <tbody>
              {m.by_tool.map((t) => (
                <tr key={t.tool}>
                  <td dir="ltr">{t.tool}</td>
                  <td className="bos-num">{num(t.calls)}</td>
                  <td className="bos-num">{num(t.failures)}</td>
                  <td className="bos-num">{t.avg_ms == null ? "—" : `${t.avg_ms} ms`}</td>
                  <td className="bos-num">{usd4(Number(t.cost_usd ?? 0))}{t.unpriced ? <span className="cell-sub"><Tx vars={{ n: num(t.unpriced) }}>{"+ {n} غير مسعّر"}</Tx></span> : null}</td>
                </tr>
              ))}
            </tbody>
          </BosTable>
        ) : <EmptyState title="لم يستدعِ المساعد أي أداة بعد" />}
      </Card>

      <Card title="سجل التدقيق (آخر 50)">
        {recent.length ? (
          <BosTable className="bos-table">
            <thead><tr><th><Tx>الوقت</Tx></th><th><Tx>مساحة العمل</Tx></th><th><Tx>الأداة</Tx></th><th><Tx>النتيجة</Tx></th><th><Tx>الزمن</Tx></th><th><Tx>التكلفة</Tx></th></tr></thead>
            <tbody>
              {recent.map((c) => (
                <tr key={c.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(c.created_at)}</td>
                  <td><Link className="bos-link" href={`/admin/platform/workspaces/${c.workspace_id}`}>{c.workspaceName || "—"}</Link></td>
                  <td dir="ltr">{c.tool}</td>
                  <td><Outcome value={c.outcome} />{c.error ? <span className="cell-sub" dir="auto">{c.error.length > 140 ? `${c.error.slice(0, 140)}…` : c.error}</span> : null}</td>
                  <td className="bos-num">{c.latency_ms == null ? "—" : `${c.latency_ms} ms`}</td>
                  <td className="bos-num">{c.cost_usd == null ? (c.unpriced_calls ? <Tx>غير مسعّر</Tx> : "—") : usd4(Number(c.cost_usd))}</td>
                </tr>
              ))}
            </tbody>
          </BosTable>
        ) : <EmptyState title="لا توجد استدعاءات" />}
      </Card>
    </>
  );
}
