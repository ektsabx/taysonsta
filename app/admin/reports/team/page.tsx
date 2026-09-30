import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import { requirePermission, can } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { runReport } from "@/services/bos/reports";
import { listDepartments } from "@/services/bos/shared";
import { Card, EmptyState, KpiCard, ProgressBar } from "@/components/bos/ui";
import { formatMinutes } from "@/lib/bos/format";
import { ReportShell } from "../ReportShell";
import { num, safeReport } from "../helpers";

type Row = { user_id: string; name: string; position: string | null; department: string | null; present_days: number; late_days: number; late_minutes: number; absent_days: number; leave_days: number; worked_hours: number; capacity_hours: number; logged_hours: number; overtime_minutes: number; open_tasks: number; overdue_tasks: number; active_projects: number };

// Utilization = logged hours ÷ capacity hours (from schedule). Overloaded:
// utilization > 100% or more than 15 open tasks.
export default async function TeamReport({ searchParams }: { searchParams: SearchParams }) {
  const { bos } = await requirePermission("reports.read");
  const sp = await readParams(searchParams);
  const [r, departments] = await Promise.all([safeReport(() => runReport<Row[]>(bos, "team", sp)), listDepartments()]);
  return (
    <ReportShell name="team" exportName="team" canExport={can(bos, "reports.export")} sp={sp} filters={[{ key: "department_id", label: "القسم", type: "select", options: departments.map((d) => ({ value: d.id, label: d.name })) }]}>
      {!r.ok ? r.node : (() => {
        const rows = r.data.data.map((x) => ({ ...x, util: x.capacity_hours ? (Number(x.logged_hours) / Number(x.capacity_hours)) * 100 : 0 }));
        const overloaded = rows.filter((x) => x.util > 100 || x.open_tasks > 15);
        return (
          <>
            <div className="bos-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 14 }}>
              <KpiCard label="ساعات العمل (حضور)" value={num(rows.reduce((s, x) => s + Number(x.worked_hours), 0))} />
              <KpiCard label="ساعات مسجلة على المشاريع" value={num(rows.reduce((s, x) => s + Number(x.logged_hours), 0))} />
              <KpiCard label="عمل إضافي" value={formatMinutes(rows.reduce((s, x) => s + x.overtime_minutes, 0))} />
              <KpiCard label="مثقلون" value={overloaded.length} />
            </div>
            <Card flush>
              {rows.length ? (
                <BosTable className="bos-table responsive">
                  <thead><tr><th><Tx>الموظف</Tx></th><th><Tx>الاستغلال</Tx></th><th><Tx>مسجل / السعة (س)</Tx></th><th><Tx>حضور</Tx></th><th><Tx>تأخير</Tx></th><th><Tx>غياب</Tx></th><th><Tx>إجازة</Tx></th><th><Tx>إضافي</Tx></th><th><Tx>مهام مفتوحة / متأخرة</Tx></th><th><Tx>مشاريع</Tx></th></tr></thead>
                  <tbody>
                    {rows.map((x) => (
                      <tr key={x.user_id}>
                        <td className="cell-primary">{x.name}<span className="cell-sub">{[x.position, x.department].filter(Boolean).join(" · ")}</span>{x.util > 100 || x.open_tasks > 15 ? <span className="bos-badge tone-danger plain"><Tx>مثقل</Tx></span> : null}</td>
                        <td style={{ minWidth: 110 }}><ProgressBar value={Math.min(100, x.util)} tone={x.util > 100 ? "warning" : undefined} /><span className="cell-sub">{x.util.toFixed(0)}%</span></td>
                        <td>{num(x.logged_hours)} / {num(x.capacity_hours)}</td>
                        <td><Tx>{x.present_days}</Tx></td><td><Tx>{x.late_days}</Tx></td><td><Tx>{x.absent_days}</Tx></td><td><Tx>{x.leave_days}</Tx></td>
                        <td>{formatMinutes(x.overtime_minutes)}</td>
                        <td>{x.open_tasks} / {x.overdue_tasks}</td>
                        <td><Tx>{x.active_projects}</Tx></td>
                      </tr>
                    ))}
                  </tbody>
                </BosTable>
              ) : <EmptyState title="لا توجد بيانات" />}
            </Card>
          </>
        );
      })()}
    </ReportShell>
  );
}
