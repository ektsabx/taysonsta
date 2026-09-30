import { Tx } from "@/components/bos/I18n";
import { requirePermission, can } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { runReport } from "@/services/bos/reports";
import { Card, EmptyState } from "@/components/bos/ui";
import { ReportShell } from "../ReportShell";
import { base, num, safeReport } from "../helpers";

type Row = { user_id: string; name: string; leads: number; qualified: number; outreach: number; meetings: number; proposals: number; pipeline: number; weighted_pipeline: number; won: number; won_value: number; commission: number };

export default async function BdReport({ searchParams }: { searchParams: SearchParams }) {
  const { bos } = await requirePermission("reports.read");
  const sp = await readParams(searchParams);
  const r = await safeReport(() => runReport<Row[]>(bos, "bd", sp));
  const money = can(bos, "revenue.view_sensitive");
  return (
    <ReportShell name="bd" exportName="bd" canExport={can(bos, "reports.export")} sp={sp}>
      {!r.ok ? r.node : (
        <Card flush>
          {r.data.data.length ? (
            <table className="bos-table responsive">
              <thead><tr><th><Tx>الموظف</Tx></th><th><Tx>عملاء محتملون</Tx></th><th><Tx>مؤهلون</Tx></th><th><Tx>تواصل صادر</Tx></th><th><Tx>اجتماعات</Tx></th><th><Tx>مقترحات</Tx></th>{money ? <><th><Tx>خط المبيعات</Tx></th><th><Tx>الموزون</Tx></th></> : null}<th><Tx>مكسوبة</Tx></th>{money ? <><th><Tx>القيمة المكسوبة</Tx></th><th><Tx>العمولة</Tx></th></> : null}</tr></thead>
              <tbody>
                {r.data.data.map((b) => (
                  <tr key={b.user_id}>
                    <td className="cell-primary">{b.name}</td><td><Tx>{b.leads}</Tx></td><td><Tx>{b.qualified}</Tx></td><td><Tx>{b.outreach}</Tx></td><td><Tx>{b.meetings}</Tx></td><td><Tx>{b.proposals}</Tx></td>
                    {money ? <><td>{base(b.pipeline)}</td><td>{base(b.weighted_pipeline)}</td></> : null}
                    <td>{num(b.won)}</td>
                    {money ? <><td>{base(b.won_value)}</td><td>{base(b.commission)}</td></> : null}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <EmptyState title="لا توجد بيانات" />}
        </Card>
      )}
    </ReportShell>
  );
}
