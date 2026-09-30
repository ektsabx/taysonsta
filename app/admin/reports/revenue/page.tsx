import { Tx } from "@/components/bos/I18n";
import { redirect } from "next/navigation";
import { requirePermission, can } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { runReport } from "@/services/bos/reports";
import { Card, KpiCard, Money } from "@/components/bos/ui";
import { BarChart, HBarList } from "@/components/bos/Chart";
import { ReportShell } from "../ReportShell";
import { base, safeReport } from "../helpers";

export type RevenueData = { from: string; to: string; base_currency: string; revenue: number; collected: number; outstanding: number; overdue: number; expenses: number; by_currency: { currency: string; invoiced: number | null; outstanding: number | null }[]; aging: Record<string, number>; trend: { month: string; invoiced: number; collected: number; expenses: number }[]; by_client: { client: string; collected: number }[]; expenses_by_category: { category: string; amount: number }[]; commissions: Record<string, number> };

export default async function RevenueReport({ searchParams }: { searchParams: SearchParams }) {
  const { bos } = await requirePermission("reports.read");
  if (!can(bos, "revenue.read") && !can(bos, "revenue.view_sensitive")) redirect("/admin/forbidden");
  const sp = await readParams(searchParams);
  const r = await safeReport(() => runReport<RevenueData>(bos, "revenue", sp));
  return (
    <ReportShell name="revenue" exportName="revenue" canExport={can(bos, "reports.export")} sp={sp}>
      {!r.ok ? r.node : (() => {
        const d = r.data.data;
        return (
          <>
            <div className="bos-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 14 }}>
              <KpiCard label="الإيراد (المفوتر)" value={base(d.revenue)} />
              <KpiCard label="المحصّل" value={base(d.collected)} />
              <KpiCard label="المستحق" value={base(d.outstanding)} />
              <KpiCard label="المتأخر" value={base(d.overdue)} />
            </div>
            <div className="bos-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
              <Card title="الاتجاه الشهري (12 شهر)"><BarChart labels={d.trend.map((t) => t.month.slice(2))} series={[{ name: "مفوتر", values: d.trend.map((t) => Number(t.invoiced)) }, { name: "محصّل", values: d.trend.map((t) => Number(t.collected)) }]} /></Card>
              <Card title="أعمار الديون">
                <HBarList items={[{ label: "1–30 يوم", value: Number(d.aging.d0_30) }, { label: "31–60 يوم", value: Number(d.aging.d31_60) }, { label: "61–90 يوم", value: Number(d.aging.d61_90) }, { label: "+90 يوم", value: Number(d.aging.d90_plus) }]} format={base} />
              </Card>
              <Card title="المحصّل حسب العميل">{d.by_client.length ? <HBarList items={d.by_client.map((c) => ({ label: c.client, value: Number(c.collected) }))} format={base} /> : <span className="bos-faint"><Tx>لا يوجد</Tx></span>}</Card>
              <Card title="حسب العملة الأصلية">
                <table className="bos-table"><thead><tr><th><Tx>العملة</Tx></th><th><Tx>المفوتر</Tx></th><th><Tx>المستحق</Tx></th></tr></thead><tbody>{d.by_currency.map((c) => <tr key={c.currency}><td>{c.currency}</td><td><Money value={c.invoiced ?? 0} currency={c.currency} /></td><td><Money value={c.outstanding ?? 0} currency={c.currency} /></td></tr>)}</tbody></table>
              </Card>
            </div>
          </>
        );
      })()}
    </ReportShell>
  );
}
