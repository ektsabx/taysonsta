import Link from "next/link";
import { requirePermission } from "@/lib/bos/auth";
import { Tx } from "@/components/bos/I18n";
import { NotConnected, connected } from "@/components/yolias/PlatformUi";
import { Group, Panel, Stat } from "@/components/yolias/dash/Stat";
import { LineChart } from "@/components/yolias/dash/Charts";
import { SortTable } from "@/components/yolias/dash/SortTable";
import { DashToolbar } from "@/components/yolias/dash/Toolbar";
import { periodOf } from "@/components/yolias/dash/period";
import { fmtValue } from "@/components/yolias/dash/format";
import { paymentsDashboard } from "@/services/yolias/recent-payments";

// Latest payments (owner, 2026-11-05): what came in, from whom, what failed and
// who pays again, for a period against the one before. Live payments only.
const KIND: Record<string, string> = { subscription: "اشتراك", prospect_pack: "شحن رصيد" };
const STATUS: Record<string, { label: string; tone: string }> = { succeeded: { label: "ناجح", tone: " good" }, failed: { label: "فشل", tone: " bad" }, pending: { label: "لم يكتمل", tone: "" }, refunded: { label: "مسترد", tone: " bad" } };
const cols = [{ key: "revenue", label: "الإيرادات", format: "usd" as const, bar: true }, { key: "paid", label: "المدفوعات" }];

export default async function RecentPaymentsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePermission("platform.read");
  if (!connected()) return <NotConnected />;
  const p = periodOf(await searchParams);
  const d = await paymentsDashboard(p.since, p.until);
  const s = d.stats, b = d.before;
  const rows = (list: { key: string; revenue: number; paid: number }[], label: (k: string) => React.ReactNode = (k) => k) => list.map((r) => ({ id: r.key, label: label(r.key), sortLabel: r.key, values: { revenue: r.revenue, paid: r.paid } }));
  return (
    <div className="yd">
      <div className="yd-head">
        <h1><Tx>آخر المدفوعات</Tx></h1>
        <DashToolbar preset={p.preset} from={p.from} to={p.to} filters={[]} />
      </div>
      <Group title="الإيرادات" tone="revenue">
        <Stat tone="revenue" label="الإيرادات" format="usd" value={s.revenue} prev={b.revenue} change={d.change("revenue")} spark={d.daily} />
        <Stat tone="revenue" label="مدفوعات ناجحة" value={s.paid} prev={b.paid} change={d.change("paid")} />
        <Stat tone="revenue" label="عملاء دفعوا" value={s.customers} prev={b.customers} change={d.change("customers")} />
        <Stat tone="revenue" label="متوسط الدفعة" format="usd" value={s.average} prev={b.average} />
        <Stat tone="revenue" label="الاشتراكات من الإيرادات" format="pct" value={s.revenue ? (d.byKind.find((k) => k.key === "subscription")?.revenue ?? 0) / s.revenue : null} />
        <Stat tone="revenue" label="الشحن (حسب الاستخدام) من الإيرادات" format="pct" value={s.revenue ? (d.byKind.find((k) => k.key === "prospect_pack")?.revenue ?? 0) / s.revenue : null} />
      </Group>
      <Group title="العملاء" tone="customers">
        <Stat tone="customers" label="Repeat Rate %" format="pct" value={d.repeat} />
        <Stat tone="customers" label="يدفعون لأول مرة" value={s.firstTime} prev={b.firstTime} />
        <Stat tone="customers" label="عملاء عادوا للدفع" value={s.returning} prev={b.returning} />
      </Group>
      <Group title="جودة الدفع" tone="economics">
        <Stat tone="economics" label="نسبة نجاح الدفع" format="pct" value={s.successRate} prev={b.successRate} />
        <Stat tone="economics" label="مدفوعات فشلت" value={s.failed} prev={b.failed} change={d.change("failed")} good="down" />
        <Stat tone="economics" label="لم تكتمل" value={s.pending} prev={b.pending} good="down" />
        <Stat tone="economics" label="المبالغ المستردة" format="usd" value={s.refundedAmount} prev={b.refundedAmount} good="down" />
      </Group>
      <Panel title="الإيرادات يوميًا"><LineChart labels={d.days} lines={[{ name: "الإيرادات", values: d.daily, tone: "green" }]} /></Panel>
      <div className="yd-grid3">
        <Panel title="حسب النوع"><SortTable firstLabel="النوع" initial="revenue" cols={cols} rows={rows(d.byKind, (k) => <Tx>{KIND[k] ?? k}</Tx>)} /></Panel>
        <Panel title="حسب الخطة"><SortTable firstLabel="الخطة" initial="revenue" cols={cols} rows={rows(d.byPlan)} /></Panel>
        <Panel title="حسب مزود الدفع"><SortTable firstLabel="المزود" initial="revenue" cols={cols} rows={rows(d.byProvider)} /></Panel>
      </div>
      {d.failures.length > 0 && (
        <Panel title="أسباب الفشل">
          <SortTable firstLabel="السبب" initial="n" cols={[{ key: "n", label: "المرات", bar: true }]} rows={d.failures.map((f) => ({ id: f.key, label: <span dir="auto">{f.key}</span>, sortLabel: f.key, values: { n: f.n } }))} />
        </Panel>
      )}
      <Panel title="آخر 100 دفعة">
        <div className="yd-table-wrap">
          <table className="yd-table">
            <thead><tr><th><Tx>التاريخ</Tx></th><th><Tx>العميل</Tx></th><th><Tx>النوع</Tx></th><th><Tx>المبلغ</Tx></th><th><Tx>الحالة</Tx></th><th><Tx>الدولة</Tx></th><th><Tx>السبب</Tx></th></tr></thead>
            <tbody>
              {d.latest.map((r) => (
                <tr key={r.id}>
                  <td dir="ltr">{r.created_at.slice(0, 16).replace("T", " ")}</td>
                  <th scope="row"><Link href={`/admin/platform/workspaces/${r.workspace_id}`} dir="auto">{r.customer || r.email || r.workspace_id.slice(0, 8)}</Link><br /><span className="yd-prev" dir="ltr">{r.email ?? ""}</span></th>
                  <td><Tx>{KIND[r.kind] ?? r.kind}</Tx>{r.plan ? <> · <span dir="ltr">{r.plan}</span></> : null}</td>
                  <td dir="ltr">{fmtValue(Number(r.amount), "usd")}</td>
                  <td><span className={`yd-chip${STATUS[r.status]?.tone ?? ""}`}><Tx>{STATUS[r.status]?.label ?? r.status}</Tx></span></td>
                  <td dir="ltr">{r.country ?? ""}</td>
                  <td dir="auto">{r.failure_reason ?? ""}</td>
                </tr>
              ))}
              {!d.latest.length && <tr><td colSpan={7} className="yd-empty"><Tx>لا توجد مدفوعات في هذه الفترة</Tx></td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
