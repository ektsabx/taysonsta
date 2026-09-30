import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { requirePermission } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { db } from "@/lib/bos/db";
import { getSystemTime } from "@/lib/bos/system-time";
import { managedEmployeeIds } from "@/services/bos/team-scope";
import { listLoans } from "@/services/bos/hr/requests";
import { listCurrencies } from "@/services/bos/shared";
import { PageHeader, Card, EmptyState, Money, ProgressBar, StatusBadge, UserAvatar } from "@/components/bos/ui";
import { FilterBar } from "@/components/bos/FilterBar";
import { SubNav } from "@/components/bos/SubNav";
import { hrSection } from "@/lib/bos/hr-nav";
import { formatDate } from "@/lib/bos/format";
import { statusOptions } from "@/lib/bos/labels";
import { InstallmentActions, LoanButton, LoanSteps } from "../../HrControls";

// Loans and salary advances (docs/bos/28 §17): approval → disbursement →
// installments deducted automatically in payroll.
export default async function LoansPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos, scope } = await requirePermission("payroll.read");
  const sp = await readParams(searchParams);
  const { today } = await getSystemTime();
  const hrAll = scope === "all" || bos.isSuperAdmin;
  const managed = hrAll ? [] : await managedEmployeeIds(bos);
  const [rows, currencies, { data: employees }] = await Promise.all([
    listLoans({ employeeIds: hrAll ? null : [bos.employee.id, ...managed], status: sp.status, employee: sp.employee }),
    listCurrencies(),
    hrAll ? db().from("employees").select("id, full_name").in("lifecycle_status", ["active", "on_leave", "onboarding"]).order("full_name") : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
  ]);
  const finance = bos.permissions.get("payroll.approve") === "all" || bos.permissions.get("payroll.manage") === "all" || bos.isSuperAdmin;
  const canForOthers = bos.permissions.get("payroll.create") === "all" || bos.isSuperAdmin;
  return (
    <>
      <PageHeader title="السلف والقروض" breadcrumbs={[{ label: "الرواتب", href: "/admin/team/payroll" }, { label: "السلف والقروض" }]}
        actions={<LoanButton employees={(employees ?? []).map((e) => ({ value: e.id, label: e.full_name }))} fixedEmployeeId={canForOthers ? undefined : bos.employee.id} currencies={currencies} defaultPeriod={today.slice(0, 7)} label={canForOthers ? "+ سلفة / قرض" : "طلب سلفة / قرض"} />} />
      <SubNav items={hrSection(bos, "payroll")} active="loans" label="الرواتب" />
      <FilterBar filters={[{ key: "status", label: "الحالة", type: "select", options: statusOptions("loan_status") }, ...(hrAll ? [{ key: "employee", label: "الموظف", type: "select" as const, options: (employees ?? []).map((e) => ({ value: e.id, label: e.full_name })) }] : [])]} />
      {rows.length ? rows.map((l) => {
        const emp = l.employees as unknown as { id: string; user_id: string | null; full_name: string; photo_updated_at: string | null } | null;
        return (
          <Card key={l.id}
            title={<span className="bos-row" style={{ gap: 8, flexWrap: "wrap" }}>{emp ? <Link href={`/admin/team/employees/${emp.id}?tab=bonuses`} className="bos-row" style={{ gap: 6 }}><UserAvatar name={emp.full_name} employeeId={emp.id} version={emp.photo_updated_at} />{emp.full_name}</Link> : null}<span><Tx>{l.loan_number}</Tx></span><StatusBadge map="loan_type" value={l.loan_type} /><StatusBadge map="loan_status" value={l.status} /></span>}
            actions={<LoanSteps id={l.id} status={l.status} canFinance={finance} canCancel={emp?.user_id === bos.userId || bos.permissions.get("payroll.update") === "all" || bos.isSuperAdmin} />}>
            <div className="bos-row" style={{ gap: 16, flexWrap: "wrap", fontSize: 13, marginBottom: 8 }}>
              <span><Tx>المبلغ:</Tx> <strong><Money value={l.amount} currency={l.currency} /></strong></span>
              <span><Tx>القسط:</Tx> <Money value={l.installment_amount} currency={l.currency} /> × {l.installments}</span>
              <span><Tx vars={{ v: l.start_period.slice(0, 7) }}>{"البداية: {v}"}</Tx></span>
              <span><Tx vars={{ v: l.paid.toFixed(2), v2: l.remaining.toFixed(2), currency: l.currency }}>{"المسدد: {v} · المتبقي: {v2} {currency}"}</Tx></span>
              {l.disbursed_at ? <span>صُرف {formatDate(l.disbursed_at)}{l.disbursement_reference ? ` (${l.disbursement_reference})` : ""}</span> : null}
            </div>
            <ProgressBar value={Number(l.amount) ? Math.round((l.paid / Number(l.amount)) * 100) : 0} tone="success" />
            <p className="bos-faint" style={{ fontSize: 12.5, margin: "6px 0" }}>{l.reason}{l.decision_comment ? ` · ${l.decision_comment}` : ""}</p>
            <details>
              <summary className="bos-link" style={{ cursor: "pointer", fontSize: 12.5 }}><Tx>جدول الأقساط</Tx></summary>
              <table className="bos-table" style={{ marginTop: 6 }}>
                <tbody>
                  {(l.installmentsList as { id: string; seq: number; due_period: string; amount: number; status: string; note: string | null }[]).map((i) => (
                    <tr key={i.id}>
                      <td><Tx>{i.seq}</Tx></td>
                      <td>{i.due_period.slice(0, 7)}</td>
                      <td><Money value={i.amount} currency={l.currency} /></td>
                      <td><StatusBadge map="installment_status" value={i.status} />{i.note ? <span className="cell-sub"><Tx>{i.note}</Tx></span> : null}</td>
                      <td>{finance && l.status === "active" && i.status === "scheduled" ? <InstallmentActions id={i.id} /> : null}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </Card>
        );
      }) : <Card><EmptyState title="لا توجد سلف أو قروض" /></Card>}
    </>
  );
}
