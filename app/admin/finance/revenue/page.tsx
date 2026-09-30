import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { requirePermission } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { db } from "@/lib/bos/db";
import { PageHeader, Card, KpiCard, Money } from "@/components/bos/ui";
import { FilterBar } from "@/components/bos/FilterBar";
import { BarChart, HBarList } from "@/components/bos/Chart";
import { formatMoney } from "@/lib/bos/money";
import { todayIn, startOfMonth } from "@/lib/bos/format";

// Revenue overview (§55 Revenue report): invoiced, collected, outstanding,
// overdue, monthly trend, aging, by client and by currency — all from SQL.
export default async function RevenuePage({ searchParams }: { searchParams: SearchParams }) {
  const { bos } = await requirePermission("revenue.read");
  const params = await readParams(searchParams);
  const today = todayIn(bos.employee.timezone);
  const from = params.from ?? `${today.slice(0, 4)}-01-01`;
  const to = params.to ?? today;
  const { data, error } = await db().rpc("bos_report_revenue", { f: { from, to } });
  if (error) throw error;
  const r = data as {
    base_currency: string; revenue: number; collected: number; outstanding: number; overdue: number; expenses: number;
    by_currency: { currency: string; invoiced: number; outstanding: number }[];
    aging: Record<string, number>;
    trend: { month: string; invoiced: number; collected: number; expenses: number }[];
    by_client: { client_id: string; client: string; collected: number }[];
  };
  const base = r.base_currency;
  const sensitive = bos.permissions.has("revenue.view_sensitive");
  return (
    <>
      <PageHeader title="الإيرادات" subtitle={<Tx vars={{ from, to, base }}>{"{from} → {to} · بعملة الأساس {base}"}</Tx>} breadcrumbs={[{ label: "المالية" }, { label: "الإيرادات" }]} actions={<Link href="/admin/reports/revenue" className="admin-btn small secondary"><Tx>التقرير الكامل</Tx></Link>} />
      <FilterBar filters={[{ key: "from", label: "من", type: "date" }, { key: "to", label: "إلى", type: "date" }]} />
      <div className="bos-kpis">
        <KpiCard label="الإيراد (فواتير صادرة)" value={formatMoney(r.revenue, base)} />
        <KpiCard label="المحصّل" value={formatMoney(r.collected, base)} />
        <KpiCard label="المستحق" value={formatMoney(r.outstanding, base)} href="/admin/finance/invoices?status=open" />
        <KpiCard label="المتأخر" value={formatMoney(r.overdue, base)} href="/admin/finance/invoices?status=overdue" />
        {sensitive ? <KpiCard label="المصروفات" value={formatMoney(r.expenses, base)} /> : null}
        {sensitive ? <KpiCard label="المحصّل − المصروفات" value={formatMoney(Number(r.collected) - Number(r.expenses), base)} /> : null}
      </div>
      <div className="bos-grid cols-2">
        <Card title="الاتجاه الشهري (12 شهر)">
          <BarChart labels={r.trend.map((t) => t.month.slice(2))} series={[{ name: "مفوتر", values: r.trend.map((t) => Number(t.invoiced)) }, { name: "محصّل", values: r.trend.map((t) => Number(t.collected)) }, ...(sensitive ? [{ name: "مصروفات", values: r.trend.map((t) => Number(t.expenses)) }] : [])]} />
        </Card>
        <Card title="أعمار الديون (المستحق)">
          <HBarList format={(v) => formatMoney(v, base)} items={[
            { label: "1–30 يوم", value: Number(r.aging.d0_30) },
            { label: "31–60 يوم", value: Number(r.aging.d31_60) },
            { label: "61–90 يوم", value: Number(r.aging.d61_90) },
            { label: "أكثر من 90 يوم", value: Number(r.aging.d90_plus) },
          ]} />
        </Card>
        <Card title="التحصيل حسب العميل">
          {r.by_client.length ? <HBarList format={(v) => formatMoney(v, base)} items={r.by_client.map((c) => ({ label: c.client, value: Number(c.collected) }))} /> : <div className="bos-faint"><Tx>لا توجد مدفوعات في الفترة</Tx></div>}
        </Card>
        <Card title="حسب العملة الأصلية">
          <table className="bos-table">
            <thead><tr><th><Tx>العملة</Tx></th><th><Tx>مفوتر</Tx></th><th><Tx>مستحق</Tx></th></tr></thead>
            <tbody>
              {r.by_currency.map((c) => (
                <tr key={c.currency}><td>{c.currency}</td><td><Money value={c.invoiced ?? 0} currency={c.currency} /></td><td><Money value={c.outstanding ?? 0} currency={c.currency} /></td></tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
}
