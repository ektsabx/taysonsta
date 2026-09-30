import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { db } from "@/lib/bos/db";
import { getSystemTime } from "@/lib/bos/system-time";
import { listRuns } from "@/services/bos/hr/payroll";
import { listDepartments } from "@/services/bos/shared";
import { PageHeader, Card, EmptyState, StatusBadge } from "@/components/bos/ui";
import { FilterBar } from "@/components/bos/FilterBar";
import { formatDate } from "@/lib/bos/format";
import { statusOptions } from "@/lib/bos/labels";
import { NewRunButton } from "../HrControls";

// Payroll runs (docs/bos/28 §16). Employees see their payslips instead.
export default async function PayrollRunsPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos, scope } = await requirePermission("payroll.read");
  if (scope !== "all" && !bos.isSuperAdmin) redirect("/admin/team/payroll/payslips");
  const sp = await readParams(searchParams);
  const { today } = await getSystemTime();
  const [runs, departments, { data: employees }] = await Promise.all([
    listRuns({ status: sp.status, year: sp.year, type: sp.type }),
    listDepartments(),
    db().from("employees").select("id, full_name").not("lifecycle_status", "in", "(candidate,hired)").order("full_name"),
  ]);
  const canEdit = bos.permissions.get("payroll.update") === "all" || bos.isSuperAdmin;
  return (
    <>
      <PageHeader title="الرواتب" subtitle="دورات الرواتب الشهرية والتسويات — مرتبطة بالمالية"
        actions={canEdit ? <NewRunButton departments={departments.map((d) => ({ value: d.id, label: d.name }))} employees={(employees ?? []).map((e) => ({ value: e.id, label: e.full_name }))} defaultPeriod={today.slice(0, 7)} /> : null} />
      <FilterBar filters={[
        { key: "status", label: "الحالة", type: "select", options: statusOptions("payroll_run_status") },
        { key: "type", label: "النوع", type: "select", options: statusOptions("payroll_run_type") },
        { key: "year", label: "السنة", type: "select", options: [0, 1, 2].map((i) => String(Number(today.slice(0, 4)) - i)).map((y) => ({ value: y, label: y })) },
      ]} />
      <Card flush>
        {runs.length ? (
          <BosTable className="bos-table responsive">
            <thead><tr><th><Tx>الدورة</Tx></th><th><Tx>الفترة</Tx></th><th><Tx>النوع</Tx></th><th><Tx>النطاق</Tx></th><th><Tx>الموظفون</Tx></th><th><Tx>الصافي</Tx></th><th><Tx>الحالة</Tx></th><th><Tx>تاريخ الصرف</Tx></th></tr></thead>
            <tbody>
              {runs.map((r) => {
                const totals = Object.entries((r.totals ?? {}) as Record<string, { net?: string }>).filter(([k]) => /^[A-Z]{3}$/.test(k));
                return (
                  <tr key={r.id}>
                    <td className="cell-primary"><Link href={`/admin/team/payroll/runs/${r.id}`}>{r.run_number}</Link></td>
                    <td>{r.period_start.slice(0, 7)}</td>
                    <td><StatusBadge map="payroll_run_type" value={r.run_type} /></td>
                    <td>{(r.employees as { full_name: string } | null)?.full_name ?? (r.departments as { name: string } | null)?.name ?? "كل الشركة"}</td>
                    <td><Tx>{r.employee_count}</Tx></td>
                    <td>{totals.length ? totals.map(([c, t]) => <div key={c}>{Number(t.net ?? 0).toLocaleString("en-US")} {c}</div>) : "—"}</td>
                    <td><StatusBadge map="payroll_run_status" value={r.status} /></td>
                    <td>{formatDate(r.pay_date)}</td>
                  </tr>
                );
              })}
            </tbody>
          </BosTable>
        ) : <EmptyState title="لا توجد دورات رواتب" description="أنشئ دورة شهرية لحساب الرواتب من البيانات الفعلية." />}
      </Card>
    </>
  );
}
