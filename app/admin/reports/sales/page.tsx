import { Tx } from "@/components/bos/I18n";
import { requirePermission, can } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { runReport } from "@/services/bos/reports";
import { listLeadSources, listActiveStaff } from "@/services/bos/shared";
import { Card, KpiCard } from "@/components/bos/ui";
import { BarChart, HBarList, LineChart } from "@/components/bos/Chart";
import { ReportShell } from "../ReportShell";
import { moneyIn, pct, safeReport } from "../helpers";

type Sales = { from: string; to: string; leads: number; qualified?: number; meetings?: number; proposals?: number; won: number; lost: number; revenue?: number; conversion?: number; trend: { month: string; leads: number; won: number; revenue: number }[]; by_source?: { source: string; leads: number; won?: number }[]; by_bd?: { name: string; won: number; revenue: number }[] };

export default async function SalesReport({ searchParams }: { searchParams: SearchParams }) {
  const { bos } = await requirePermission("reports.read");
  const sp = await readParams(searchParams);
  const base = moneyIn(sp);
  const [r, sources, staff] = await Promise.all([safeReport(() => runReport<Sales>(bos, "sales", sp)), listLeadSources(), listActiveStaff()]);
  const money = can(bos, "revenue.view_sensitive");
  return (
    <ReportShell name="sales" exportName="sales" canExport={can(bos, "reports.export")} sp={sp} currency filters={[{ key: "source_id", label: "المصدر", type: "select", options: sources.map((s) => ({ value: s.id, label: s.name })) }, { key: "country", label: "الدولة", type: "text" }, ...(bos.permissions.get("reports.read") !== "own" ? [{ key: "user_id", label: "الموظف", type: "select" as const, options: staff.map((s) => ({ value: s.userId, label: s.name })) }] : [])]}>
      {!r.ok ? r.node : (() => {
        const d = r.data.data;
        const funnel = [
          { label: "عملاء محتملون", value: d.leads },
          { label: "مؤهلون", value: d.qualified ?? 0 },
          { label: "اجتماعات", value: d.meetings ?? 0 },
          { label: "مقترحات", value: d.proposals ?? 0 },
          { label: "مكسوبة", value: d.won },
        ];
        return (
          <>
            <div className="bos-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 14 }}>
              <KpiCard label="عملاء محتملون" value={d.leads} />
              <KpiCard label="مؤهلون" value={d.qualified ?? "—"} />
              <KpiCard label="اجتماعات" value={d.meetings ?? "—"} />
              <KpiCard label="مقترحات" value={d.proposals ?? "—"} />
              <KpiCard label="مكسوبة" value={d.won} />
              <KpiCard label="خاسرة" value={d.lost} />
              {money ? <KpiCard label="الإيراد المكسوب" value={base(d.revenue ?? 0)} /> : null}
              <KpiCard label="التحويل" value={pct(d.conversion)} sub="مكسوبة ÷ مؤهلة" />
            </div>
            <div className="bos-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
              <Card title="قمع المبيعات"><HBarList items={funnel} format={(v) => String(v)} /></Card>
              <Card title="الاتجاه الشهري"><BarChart labels={d.trend.map((t) => t.month.slice(2))} series={[{ name: "عملاء محتملون", values: d.trend.map((t) => t.leads) }, { name: "مكسوبة", values: d.trend.map((t) => t.won) }]} /></Card>
              {money ? <Card title="الإيراد المكسوب شهرياً"><LineChart labels={d.trend.map((t) => t.month.slice(2))} series={[{ name: "الإيراد", values: d.trend.map((t) => Number(t.revenue)) }]} /></Card> : null}
              {d.by_source?.length ? <Card title="حسب المصدر"><HBarList items={d.by_source.map((s) => ({ label: s.source, value: s.leads, sub: s.won != null ? `${s.won} مكسوبة` : undefined }))} format={(v) => String(v)} /></Card> : null}
              {d.by_bd?.length ? <Card title="حسب موظف تطوير الأعمال"><HBarList items={d.by_bd.map((b) => ({ label: b.name, value: money ? Number(b.revenue) : b.won, sub: `${b.won} ✓` }))} format={money ? base : (v) => String(v)} /></Card> : null}
            </div>
            <p className="bos-faint" style={{ fontSize: 12 }}><Tx vars={{ from: d.from, to: d.to }}>{"الفترة {from} → {to}. التعريفات: العملاء المحتملون = المنشأون في الفترة؛ المؤهلون = من دخلوا مرحلة مؤهلة أو بعدها؛ الإيراد = قيمة الصفقات المكسوبة."}</Tx></p>
          </>
        );
      })()}
    </ReportShell>
  );
}
