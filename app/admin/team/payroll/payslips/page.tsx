import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { requirePermission } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { db } from "@/lib/bos/db";
import { listPayslips } from "@/services/bos/hr/payroll";
import { PageHeader, Card, EmptyState, Money, StatusBadge, UserAvatar } from "@/components/bos/ui";
import { FilterBar } from "@/components/bos/FilterBar";
import { statusOptions } from "@/lib/bos/labels";

// Payslips: HR/Finance see all; employees see their published payslips (§26).
export default async function PayslipsPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos, scope } = await requirePermission("payroll.read");
  const sp = await readParams(searchParams);
  const hrAll = scope === "all" || bos.isSuperAdmin;
  const [rows, { data: employees }] = await Promise.all([
    hrAll ? listPayslips({ employee: sp.employee, period: sp.period, status: sp.status }) : listPayslips({ userId: bos.userId, publishedOnly: true, period: sp.period }),
    hrAll ? db().from("employees").select("id, full_name").order("full_name") : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
  ]);
  return (
    <>
      <PageHeader title={hrAll ? "قسائم الرواتب" : "قسائم راتبي"} />
      <FilterBar filters={[
        ...(hrAll ? [{ key: "employee", label: "الموظف", type: "select" as const, options: (employees ?? []).map((e) => ({ value: e.id, label: e.full_name })) }] : []),
        { key: "period", label: "الشهر (YYYY-MM)", type: "text" },
        ...(hrAll ? [{ key: "status", label: "الحالة", type: "select" as const, options: statusOptions("payslip_status") }] : []),
      ]} />
      <Card flush>
        {rows.length ? (
          <BosTable className="bos-table responsive">
            <thead><tr>{hrAll ? <th><Tx>الموظف</Tx></th> : null}<th><Tx>الفترة</Tx></th><th><Tx>الدورة</Tx></th><th><Tx>الإجمالي</Tx></th><th><Tx>الاستقطاعات</Tx></th><th><Tx>الصافي</Tx></th><th><Tx>الحالة</Tx></th><th /></tr></thead>
            <tbody>
              {rows.map((s) => {
                const emp = s.employees as unknown as { id: string; full_name: string; photo_updated_at: string | null } | null;
                const run = s.payroll_runs as unknown as { run_number: string; run_type: string; period_start: string };
                return (
                  <tr key={s.id}>
                    {hrAll ? <td>{emp ? <span className="bos-row" style={{ gap: 8 }}><UserAvatar name={emp.full_name} employeeId={emp.id} version={emp.photo_updated_at} />{emp.full_name}</span> : "—"}</td> : null}
                    <td>{run.period_start.slice(0, 7)}</td>
                    <td>{run.run_number}<span className="cell-sub"><StatusBadge map="payroll_run_type" value={run.run_type} /></span></td>
                    <td><Money value={s.gross_pay} currency={s.currency} /></td>
                    <td><Money value={s.total_deductions} currency={s.currency} /></td>
                    <td><strong><Money value={s.net_pay} currency={s.currency} /></strong></td>
                    <td><StatusBadge map="payslip_status" value={s.status} /></td>
                    <td><Link className="bos-link" href={`/admin/team/payroll/payslips/${s.id}`}><Tx>عرض / تحميل</Tx></Link></td>
                  </tr>
                );
              })}
            </tbody>
          </BosTable>
        ) : <EmptyState title="لا توجد قسائم" description={hrAll ? undefined : "تظهر قسائمك بعد اعتماد ونشر الرواتب."} />}
      </Card>
    </>
  );
}
