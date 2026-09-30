import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { requirePermission, can } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { runReport } from "@/services/bos/reports";
import { Card, KpiCard, EmptyState } from "@/components/bos/ui";
import { ReportShell } from "../ReportShell";
import { base, pct, safeReport } from "../helpers";

type Data = { new_clients?: number; active_clients?: number; retention?: number | null; clients: { id: string; name: string; country: string | null; revenue: number; projects: number; active_projects: number; upsells: number; open_upsell_value: number }[] };

export default async function ClientsReport({ searchParams }: { searchParams: SearchParams }) {
  const { bos } = await requirePermission("reports.read");
  const sp = await readParams(searchParams);
  const r = await safeReport(() => runReport<Data>(bos, "clients", sp));
  const money = can(bos, "revenue.view_sensitive");
  return (
    <ReportShell name="clients" exportName="clients" canExport={can(bos, "reports.export")} sp={sp}>
      {!r.ok ? r.node : (() => {
        const d = r.data.data;
        return (
          <>
            <div className="bos-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 14 }}>
              <KpiCard label="عملاء جدد" value={d.new_clients ?? "—"} />
              <KpiCard label="عملاء نشطون" value={d.active_clients ?? d.clients.filter((c) => c.active_projects > 0).length} />
              <KpiCard label="الاحتفاظ" value={pct(d.retention)} sub="صفقة/مشروع جديد خلال 12 شهراً من اكتمال أول مشروع" />
              <KpiCard label="صفقات بيع إضافي" value={d.clients.reduce((s, c) => s + c.upsells, 0)} />
            </div>
            <Card flush>
              {d.clients.length ? (
                <table className="bos-table responsive">
                  <thead><tr><th><Tx>العميل</Tx></th><th><Tx>الدولة</Tx></th><th><Tx>المشاريع</Tx></th><th><Tx>نشطة</Tx></th>{money ? <th><Tx>الإيراد</Tx></th> : null}<th><Tx>بيع إضافي</Tx></th>{money ? <th><Tx>قيمة البيع الإضافي المفتوح</Tx></th> : null}</tr></thead>
                  <tbody>{d.clients.map((c) => <tr key={c.id}><td className="cell-primary"><Link href={`/admin/clients/${c.id}`}>{c.name}</Link></td><td><Tx>{c.country ?? "—"}</Tx></td><td><Tx>{c.projects}</Tx></td><td><Tx>{c.active_projects}</Tx></td>{money ? <td>{base(c.revenue)}</td> : null}<td><Tx>{c.upsells}</Tx></td>{money ? <td>{base(c.open_upsell_value)}</td> : null}</tr>)}</tbody>
                </table>
              ) : <EmptyState title="لا توجد بيانات" />}
            </Card>
          </>
        );
      })()}
    </ReportShell>
  );
}
