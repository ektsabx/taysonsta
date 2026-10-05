import { Tx } from "@/components/bos/I18n";
import { redirect } from "next/navigation";
import { requirePermission, can } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { runReport } from "@/services/bos/reports";
import { Card, KpiCard } from "@/components/bos/ui";
import { BarChart, HBarList } from "@/components/bos/Chart";
import { ReportShell } from "../ReportShell";
import { moneyIn, safeReport } from "../helpers";
import type { RevenueData } from "../revenue/page";

// Revenue vs expenses, gross profit, expenses by category, commissions, cash flow.
export default async function FinanceReport({ searchParams }: { searchParams: SearchParams }) {
  const { bos } = await requirePermission("reports.read");
  if (!can(bos, "revenue.view_sensitive") && !can(bos, "expenses.read")) redirect("/admin/forbidden");
  const sp = await readParams(searchParams);
  const base = moneyIn(sp);
  const r = await safeReport(() => runReport<RevenueData>(bos, "revenue", sp));
  return (
    <ReportShell name="finance" exportName="revenue" canExport={can(bos, "reports.export")} sp={sp} currency>
      {!r.ok ? r.node : (() => {
        const d = r.data.data;
        const gross = Number(d.collected) - Number(d.expenses);
        return (
          <>
            <div className="bos-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 14 }}>
              <KpiCard label="المحصّل" value={base(d.collected)} />
              <KpiCard label="المصروفات المعتمدة" value={base(d.expenses)} />
              <KpiCard label="إجمالي الربح (نقدي)" value={base(gross)} trend={gross >= 0 ? "up" : "down"} />
              <KpiCard label="عمولات مستحقة" value={base(Number(d.commissions.eligible) + Number(d.commissions.approved))} sub={<Tx vars={{ v: base(d.commissions.paid) }}>{"مدفوعة في الفترة {v}"}</Tx>} />
            </div>
            <div className="bos-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
              <Card title="التدفق النقدي الشهري: المحصّل مقابل المصروفات"><BarChart labels={d.trend.map((t) => t.month.slice(2))} series={[{ name: "محصّل", values: d.trend.map((t) => Number(t.collected)) }, { name: "مصروفات", values: d.trend.map((t) => Number(t.expenses)) }]} /></Card>
              <Card title="المصروفات حسب الفئة">{d.expenses_by_category.length ? <HBarList items={d.expenses_by_category.map((e) => ({ label: e.category, value: Number(e.amount) }))} format={base} /> : <span className="bos-faint"><Tx>لا توجد مصروفات</Tx></span>}</Card>
              <Card title="العمولات حسب الحالة"><HBarList items={[{ label: "معلقة", value: Number(d.commissions.pending) }, { label: "مستحقة", value: Number(d.commissions.eligible) }, { label: "معتمدة", value: Number(d.commissions.approved) }, { label: "مدفوعة (الفترة)", value: Number(d.commissions.paid) }]} format={base} /></Card>
            </div>
          </>
        );
      })()}
    </ReportShell>
  );
}
