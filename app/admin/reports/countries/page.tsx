import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import { requirePermission, can } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { runReport } from "@/services/bos/reports";
import { Card, EmptyState } from "@/components/bos/ui";
import { HBarList } from "@/components/bos/Chart";
import { ReportShell } from "../ReportShell";
import { moneyIn, pct, safeReport } from "../helpers";

type Row = { country: string; leads: number; qualified: number; deals: number; won: number; won_revenue: number; conversion: number; avg_deal_value: number };

export default async function CountriesReport({ searchParams }: { searchParams: SearchParams }) {
  const { bos } = await requirePermission("reports.read");
  const sp = await readParams(searchParams);
  const base = moneyIn(sp);
  const r = await safeReport(() => runReport<Row[]>(bos, "countries", sp));
  const money = can(bos, "revenue.view_sensitive");
  return (
    <ReportShell name="countries" exportName="countries" canExport={can(bos, "reports.export")} sp={sp} currency>
      {!r.ok ? r.node : (
        <div className="bos-grid main-side">
          <Card flush>
            {r.data.data.length ? (
              <BosTable className="bos-table responsive">
                <thead><tr><th><Tx>الدولة</Tx></th><th><Tx>عملاء محتملون</Tx></th><th><Tx>مؤهلون</Tx></th><th><Tx>صفقات</Tx></th><th><Tx>مكسوبة</Tx></th>{money ? <th><Tx>الإيراد المكسوب</Tx></th> : null}<th><Tx>التحويل</Tx></th>{money ? <th><Tx>متوسط الصفقة</Tx></th> : null}</tr></thead>
                <tbody>{r.data.data.map((c) => <tr key={c.country}><td className="cell-primary"><Tx>{c.country}</Tx></td><td><Tx>{c.leads}</Tx></td><td><Tx>{c.qualified}</Tx></td><td><Tx>{c.deals}</Tx></td><td><Tx>{c.won}</Tx></td>{money ? <td>{base(c.won_revenue)}</td> : null}<td>{pct(c.conversion)}</td>{money ? <td>{base(c.avg_deal_value)}</td> : null}</tr>)}</tbody>
              </BosTable>
            ) : <EmptyState title="لا توجد بيانات" />}
          </Card>
          <Card title={money ? "الإيراد المكسوب حسب الدولة" : "العملاء المحتملون حسب الدولة"}><HBarList items={r.data.data.map((c) => ({ label: c.country, value: money ? Number(c.won_revenue) : c.leads }))} format={money ? base : (v) => String(v)} /></Card>
        </div>
      )}
    </ReportShell>
  );
}
