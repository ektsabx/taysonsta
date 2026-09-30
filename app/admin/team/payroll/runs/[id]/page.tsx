import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/bos/auth";
import { NotFoundError } from "@/lib/bos/errors";
import { getSystemTime } from "@/lib/bos/system-time";
import { getRun } from "@/services/bos/hr/payroll";
import { listApprovalsForEntity, describeApprovers } from "@/services/bos/approvals";
import { PageHeader, Card, EmptyState, KeyValues, KpiCard, Money, StatusBadge, UserAvatar } from "@/components/bos/ui";
import { ApprovalPanel } from "@/components/bos/ApprovalPanel";
import { AuditLogPanel } from "@/components/bos/AuditLogPanel";
import { formatDate, formatDateTime, formatMinutes } from "@/lib/bos/format";
import { RunSteps } from "../../../HrControls";

// Payroll run: payslips, totals per currency, approval and payment (§16, §32).
export default async function PayrollRunPage({ params }: { params: Promise<{ id: string }> }) {
  const { bos } = await requirePermission("payroll.read", "all");
  const { id } = await params;
  let data;
  try {
    data = await getRun(id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  const { run, payslips } = data;
  const { today } = await getSystemTime();
  const approvals = await describeApprovers(await listApprovalsForEntity("payroll_run", id));
  const totals = Object.entries((run.totals ?? {}) as Record<string, { gross?: string; deductions?: string; net?: string; count?: number }>).filter(([k]) => /^[A-Z]{3}$/.test(k));
  const missing = ((run.totals as { missing_compensation?: string[] } | null)?.missing_compensation ?? []) as string[];
  const canPay = bos.permissions.get("payroll.approve") === "all" || bos.permissions.get("payroll.manage") === "all" || bos.isSuperAdmin;
  const canEdit = bos.permissions.get("payroll.update") === "all" || bos.isSuperAdmin;
  return (
    <>
      <PageHeader
        title={<Tx vars={{ v: run.period_start.slice(0, 7) }}>{"دورة رواتب {v}"}</Tx>}
        subtitle={<span className="bos-row" style={{ gap: 8 }}><StatusBadge map="payroll_run_status" value={run.status} /><StatusBadge map="payroll_run_type" value={run.run_type} /><span>{run.run_number}</span></span>}
        breadcrumbs={[{ label: "الرواتب", href: "/admin/team/payroll" }, { label: run.run_number ?? "" }]}
        actions={canEdit || canPay ? <RunSteps runId={run.id} status={run.status} canPay={canPay} today={today} /> : null}
      />
      <div className="bos-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10, marginBottom: 14 }}>
        <KpiCard label="الموظفون" value={run.employee_count} />
        {totals.map(([c, t]) => <KpiCard key={c} label={`الصافي (${c})`} value={Number(t.net ?? 0).toLocaleString("en-US")} sub={`إجمالي ${Number(t.gross ?? 0).toLocaleString("en-US")} · استقطاعات ${Number(t.deductions ?? 0).toLocaleString("en-US")}`} />)}
      </div>
      {missing.length ? <div className="bos-alert warning">موظفون بدون راتب معتمد لم تُحسب لهم قسائم: {missing.join("، ")}. حدد رواتبهم من تبويب الرواتب في ملف الموظف ثم أعد الحساب.</div> : null}
      <Card title="قسائم الرواتب" flush>
        {payslips.length ? (
          <table className="bos-table responsive">
            <thead><tr><th><Tx>الموظف</Tx></th><th><Tx>الأساسي</Tx></th><th><Tx>أيام</Tx></th><th><Tx>غياب / بدون أجر</Tx></th><th><Tx>إضافي</Tx></th><th><Tx>الإجمالي</Tx></th><th><Tx>الاستقطاعات</Tx></th><th><Tx>الصافي</Tx></th><th><Tx>الحالة</Tx></th></tr></thead>
            <tbody>
              {payslips.map((s) => {
                const emp = s.employees as unknown as { id: string; full_name: string; employee_code: string | null; position: string | null; photo_updated_at: string | null };
                return (
                  <tr key={s.id}>
                    <td className="cell-primary"><Link href={`/admin/team/payroll/payslips/${s.id}`} className="bos-row" style={{ gap: 8 }}><UserAvatar name={emp.full_name} employeeId={emp.id} version={emp.photo_updated_at} /><span>{emp.full_name}<span className="cell-sub">{[emp.employee_code, emp.position].filter(Boolean).join(" · ")}</span></span></Link>{s.warnings?.length ? <span className="cell-sub" style={{ color: "var(--bos-warning)" }}>{s.warnings.join(" · ")}</span> : null}</td>
                    <td><Money value={s.basic_salary} currency={s.currency} /></td>
                    <td>{s.paid_days} / {s.working_days}</td>
                    <td>{s.absent_days || s.unpaid_leave_days ? `${s.absent_days} / ${s.unpaid_leave_days}` : "—"}</td>
                    <td>{s.overtime_minutes ? formatMinutes(s.overtime_minutes) : "—"}</td>
                    <td><Money value={s.gross_pay} currency={s.currency} /></td>
                    <td><Money value={s.total_deductions} currency={s.currency} /></td>
                    <td><strong><Money value={s.net_pay} currency={s.currency} /></strong></td>
                    <td><StatusBadge map="payslip_status" value={s.status} />{s.published_at ? <span className="cell-sub"><Tx>منشورة</Tx></span> : null}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : <EmptyState title="لا توجد قسائم" description="احسب الدورة لإنشاء القسائم." />}
      </Card>
      <div className="bos-grid cols-2" style={{ gap: 12 }}>
        <Card title="تفاصيل الدورة">
          <KeyValues items={[
            { label: "الفترة", value: `${formatDate(run.period_start)} → ${formatDate(run.period_end)}` },
            { label: "تاريخ الصرف", value: formatDate(run.pay_date) },
            { label: "آخر حساب", value: run.calculated_at ? formatDateTime(run.calculated_at) : "—" },
            { label: "أُرسلت للاعتماد", value: run.submitted_at ? formatDateTime(run.submitted_at) : "—" },
            { label: "اعتُمدت", value: run.approved_at ? formatDateTime(run.approved_at) : "—" },
            { label: "صُرفت", value: run.paid_at ? formatDateTime(run.paid_at) : "—" },
            { label: "ملاحظات", value: run.notes },
            { label: "سبب الإلغاء", value: run.cancelled_reason, hidden: !run.cancelled_reason },
          ]} />
          {run.status === "paid" ? <p className="bos-faint" style={{ fontSize: 12 }}><Tx>تم ترحيل تكلفة الرواتب إلى</Tx> <Link className="bos-link" href="/admin/finance/expenses"><Tx>المصروفات في المالية</Tx></Link>.</p> : null}
        </Card>
        <Card title="الاعتماد">{approvals.length ? <ApprovalPanel entityType="payroll_run" entityId={run.id} bos={bos} /> : <EmptyState title="لم تُرسل للاعتماد بعد" />}</Card>
      </div>
      <Card title="السجل"><AuditLogPanel entityType="payroll_run" entityId={run.id} /></Card>
    </>
  );
}
