import { Tx } from "@/components/bos/I18n";
import { requirePermission, can } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { runReport } from "@/services/bos/reports";
import { Card, EmptyState } from "@/components/bos/ui";
import { ReportShell } from "../ReportShell";
import { base, pct, safeReport } from "../helpers";

type Row = { product_id: string; name: string; kind: string; leads: number; deals: number; won: number; revenue: number; conversion: number; avg_deal_value: number; profit: number };

export default async function ProductsReport({ searchParams }: { searchParams: SearchParams }) {
  const { bos } = await requirePermission("reports.read");
  const sp = await readParams(searchParams);
  const r = await safeReport(() => runReport<Row[]>(bos, "products", sp));
  const money = can(bos, "revenue.view_sensitive");
  const margin = can(bos, "projects.view_sensitive");
  return (
    <ReportShell name="products" exportName="products" canExport={can(bos, "reports.export")} sp={sp} note="الربحية = ربح المشاريع التي تتضمن صفقاتها هذا البند (موزعة حسب حصة البند)">
      {!r.ok ? r.node : (
        <Card flush>
          {r.data.data.length ? (
            <table className="bos-table responsive">
              <thead><tr><th><Tx>المنتج / الخدمة</Tx></th><th><Tx>النوع</Tx></th><th><Tx>عملاء محتملون</Tx></th><th><Tx>صفقات</Tx></th><th><Tx>مكسوبة</Tx></th>{money ? <th><Tx>الإيراد</Tx></th> : null}<th><Tx>التحويل</Tx></th>{money ? <th><Tx>متوسط الصفقة</Tx></th> : null}{margin ? <th><Tx>الربحية</Tx></th> : null}</tr></thead>
              <tbody>{r.data.data.map((p) => <tr key={p.product_id}><td className="cell-primary">{p.name}</td><td><Tx>{p.kind === "service" ? "خدمة" : "منتج"}</Tx></td><td><Tx>{p.leads}</Tx></td><td><Tx>{p.deals}</Tx></td><td><Tx>{p.won}</Tx></td>{money ? <td>{base(p.revenue)}</td> : null}<td>{pct(p.conversion)}</td>{money ? <td>{base(p.avg_deal_value)}</td> : null}{margin ? <td>{base(Number(p.profit).toFixed(2))}</td> : null}</tr>)}</tbody>
            </table>
          ) : <EmptyState title="لا توجد بيانات" />}
        </Card>
      )}
    </ReportShell>
  );
}
