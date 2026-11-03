import { requirePermission } from "@/lib/bos/auth";
import { Tx } from "@/components/bos/I18n";
import { NotConnected, connected } from "@/components/yolias/PlatformUi";
import { Group, Panel, Stat } from "@/components/yolias/dash/Stat";
import { DashToolbar } from "@/components/yolias/dash/Toolbar";
import { periodOf } from "@/components/yolias/dash/period";
import { fmtValue } from "@/components/yolias/dash/format";
import { ydb } from "@/lib/yolias/db";

// AI operations (audit plan, phase 6, 2026-11-03): every AI task by prompt
// version: calls, failures, latency, cost and the models that served it, so a
// prompt change and its effect sit side by side. From intel.llm_calls.
const TASK: Record<string, string> = { write: "كتابة الرسائل والردود", extract: "قراءة الردود والبيانات", understand: "فهم الطلبات", plan: "التخطيط", agent: "Yolias AI", research: "البحث", classify: "التصنيف" };

export default async function AiOpsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePermission("platform.read");
  if (!connected()) return <NotConnected />;
  const p = periodOf(await searchParams);
  const { data, error } = await ydb().rpc("admin_llm_ops", { p_since: p.since });
  if (error) throw error;
  const rows = (data ?? []).map((r) => ({ ...r, calls: Number(r.calls), failed: Number(r.failed), cache: Number(r.cache_hits), cost: Number(r.cost_usd) }))
    .sort((a, b) => a.task.localeCompare(b.task) || b.last_at.localeCompare(a.last_at));
  const calls = rows.reduce((a, r) => a + r.calls, 0);
  const failed = rows.reduce((a, r) => a + r.failed, 0);
  const cost = rows.reduce((a, r) => a + r.cost, 0);
  const cache = rows.reduce((a, r) => a + r.cache, 0);
  return (
    <div className="yd">
      <div className="yd-head">
        <h1><Tx>عمليات الذكاء الاصطناعي</Tx></h1>
        <DashToolbar preset={p.preset} from={p.from} to={p.to} filters={[]} />
      </div>
      <Group title="الاستدعاءات" tone="platform">
        <Stat tone="platform" label="الاستدعاءات" value={calls} />
        <Stat tone="platform" label="نسبة الفشل" format="pct" value={calls ? failed / calls : null} good="down" />
        <Stat tone="platform" label="من الذاكرة المؤقتة" format="pct" value={calls ? cache / calls : null} />
        <Stat tone="economics" label="التكلفة" format="usd" value={cost} good="down" />
        <Stat tone="economics" label="تكلفة 1,000 استدعاء" format="usd" value={calls ? (cost / calls) * 1000 : null} good="down" />
      </Group>
      <Panel title="كل عملية حسب إصدار الـ prompt">
        <div className="yd-table-wrap">
          <table className="yd-table yd-wrap">
            <thead><tr><th><Tx>العملية</Tx></th><th><Tx>الإصدار</Tx></th><th><Tx>الاستدعاءات</Tx></th><th><Tx>نسبة الفشل</Tx></th><th><Tx>متوسط الزمن</Tx></th><th>p95</th><th><Tx>التكلفة</Tx></th><th><Tx>النماذج</Tx></th><th><Tx>آخر استخدام</Tx></th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.task}:${r.prompt_version}`}>
                  <th scope="row"><Tx>{TASK[r.task] ?? r.task}</Tx></th>
                  <td dir="ltr"><code>{r.prompt_version}</code></td>
                  <td dir="ltr">{r.calls}</td>
                  <td dir="ltr"><span className={r.calls >= 10 && r.failed / r.calls > 0.1 ? "yd-chip bad" : ""}>{fmtValue(r.calls ? r.failed / r.calls : null, "pct")}</span></td>
                  <td dir="ltr">{r.avg_latency_ms == null ? "—" : `${Math.round(Number(r.avg_latency_ms))} ms`}</td>
                  <td dir="ltr">{r.p95_latency_ms == null ? "—" : `${Math.round(Number(r.p95_latency_ms))} ms`}</td>
                  <td dir="ltr">{fmtValue(r.cost, "usd")}</td>
                  <td dir="ltr">{(r.models ?? []).join(", ")}</td>
                  <td dir="ltr">{r.last_at.slice(0, 16).replace("T", " ")}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={9} className="yd-empty"><Tx>لا توجد استدعاءات في هذه الفترة</Tx></td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
