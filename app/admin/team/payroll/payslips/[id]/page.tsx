import { Tx } from "@/components/bos/I18n";
import { notFound } from "next/navigation";
import { requireBosUser } from "@/lib/bos/auth";
import { canAccessEntity } from "@/lib/bos/access";
import { NotFoundError } from "@/lib/bos/errors";
import { getSetting } from "@/lib/bos/settings";
import { getPayslip } from "@/services/bos/hr/payroll";
import { PageHeader, Card, StatusBadge } from "@/components/bos/ui";
import { formatMoney } from "@/lib/bos/money";
import { formatDate, formatMinutes } from "@/lib/bos/format";
import { PrintButton } from "@/components/bos/PrintButton";
import { ManualLineButton, RemoveManualLineButton } from "../../../HrControls";

// Payslip — line-by-line, printable / downloadable as PDF (§16, §26).
export default async function PayslipPage({ params }: { params: Promise<{ id: string }> }) {
  const bos = await requireBosUser();
  const { id } = await params;
  if (!(await canAccessEntity(bos, "payslip", id))) notFound();
  let s;
  try {
    s = await getPayslip(id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  const company = await getSetting("company");
  const run = s.payroll_runs as unknown as { id: string; run_number: string; run_type: string; period_start: string; period_end: string; pay_date: string | null; status: string };
  const emp = s.employees as unknown as { id: string; full_name: string; employee_code: string | null; position: string | null; departments: { name: string } | null };
  const earnings = s.lines.filter((l) => l.kind === "earning");
  const deductions = s.lines.filter((l) => l.kind === "deduction");
  const m = (v: unknown) => formatMoney(v, s.currency);
  const editable = (bos.permissions.get("payroll.update") === "all" || bos.isSuperAdmin) && ["draft", "calculated"].includes(run.status);
  return (
    <>
      <div className="bos-no-print">
        <PageHeader title={<Tx vars={{ v: run.period_start.slice(0, 7) }}>{"قسيمة راتب {v}"}</Tx>} subtitle={emp.full_name} breadcrumbs={[{ label: "الرواتب", href: "/admin/team/payroll" }, { label: "القسائم", href: "/admin/team/payroll/payslips" }, { label: emp.full_name }]}
          actions={<span className="bos-row" style={{ gap: 6 }}>{editable ? <ManualLineButton payslipId={s.id} /> : null}<PrintButton label="طباعة / تحميل PDF" /></span>} />
      </div>
      <Card>
        <div className="bos-payslip">
          <div className="bos-row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{company.name}</div>
              <div className="bos-faint" style={{ fontSize: 12 }}>{company.address}</div>
            </div>
            <div style={{ textAlign: "end" }}>
              <div style={{ fontWeight: 800 }}><Tx vars={{ v: run.period_start.slice(0, 7) }}>{"قسيمة راتب — {v}"}</Tx></div>
              <div className="bos-faint" style={{ fontSize: 12 }}>{run.run_number} · <StatusBadge map="payslip_status" value={s.status} /></div>
            </div>
          </div>
          <table>
            <tbody>
              <tr><td><Tx>الموظف</Tx></td><td><strong>{emp.full_name}</strong></td><td><Tx>الكود</Tx></td><td><Tx>{emp.employee_code ?? "—"}</Tx></td></tr>
              <tr><td><Tx>المسمى</Tx></td><td>{emp.position ?? "—"}</td><td><Tx>القسم</Tx></td><td>{emp.departments?.name ?? "—"}</td></tr>
              <tr><td><Tx>الفترة</Tx></td><td>{formatDate(run.period_start)} → {formatDate(run.period_end)}</td><td><Tx>تاريخ الصرف</Tx></td><td>{formatDate(run.pay_date)}</td></tr>
              <tr><td><Tx>أيام العمل</Tx></td><td>{s.paid_days} / {s.working_days}</td><td><Tx>غياب / بدون أجر</Tx></td><td>{s.absent_days} / {s.unpaid_leave_days}</td></tr>
              <tr><td><Tx>التأخير</Tx></td><td>{formatMinutes(s.late_minutes)}</td><td><Tx>الإضافي</Tx></td><td>{formatMinutes(s.overtime_minutes)}</td></tr>
            </tbody>
          </table>
          <div className="bos-grid cols-2" style={{ gap: 16, marginTop: 16 }}>
            <div>
              <h4 className="bos-form-section-title"><Tx>الاستحقاقات</Tx></h4>
              <table>
                <tbody>
                  {earnings.map((l) => <tr key={l.id}><td>{l.label}{l.quantity != null && l.category === "overtime" ? <span className="cell-sub"><Tx vars={{ quantity: l.quantity }}>{"{quantity} ساعة"}</Tx></span> : null}</td><td className="num">{m(l.amount)}</td><td className="bos-no-print">{editable && l.source_type === "manual" ? <RemoveManualLineButton id={l.id} /> : null}</td></tr>)}
                  <tr className="total"><td><Tx>إجمالي الاستحقاقات</Tx></td><td className="num">{m(s.total_earnings)}</td><td /></tr>
                </tbody>
              </table>
            </div>
            <div>
              <h4 className="bos-form-section-title"><Tx>الاستقطاعات</Tx></h4>
              <table>
                <tbody>
                  {deductions.length ? deductions.map((l) => <tr key={l.id}><td><Tx>{l.label}</Tx></td><td className="num">{m(l.amount)}</td><td className="bos-no-print">{editable && l.source_type === "manual" ? <RemoveManualLineButton id={l.id} /> : null}</td></tr>) : <tr><td className="bos-faint"><Tx>لا يوجد</Tx></td><td /><td /></tr>}
                  <tr className="total"><td><Tx>إجمالي الاستقطاعات</Tx></td><td className="num">{m(s.total_deductions)}</td><td /></tr>
                </tbody>
              </table>
            </div>
          </div>
          <table style={{ marginTop: 16 }}>
            <tbody>
              <tr className="total"><td style={{ fontSize: 15 }}><Tx>صافي الراتب</Tx></td><td className="num" style={{ fontSize: 17 }}>{m(s.net_pay)}</td></tr>
            </tbody>
          </table>
          {s.warnings?.length ? <p className="bos-no-print" style={{ color: "var(--bos-warning)", fontSize: 12.5 }}>{s.warnings.join(" · ")}</p> : null}
        </div>
      </Card>
    </>
  );
}
