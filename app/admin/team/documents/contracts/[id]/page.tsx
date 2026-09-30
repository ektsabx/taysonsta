import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/bos/auth";
import { canAccessEntity } from "@/lib/bos/access";
import { NotFoundError } from "@/lib/bos/errors";
import { getContract } from "@/services/bos/hr/documents";
import { listCurrencies } from "@/services/bos/shared";
import { PageHeader, Card, KeyValues, Money, StatusBadge } from "@/components/bos/ui";
import { FileManager } from "@/components/bos/FileManager";
import { AuditLogPanel } from "@/components/bos/AuditLogPanel";
import { formatDate, formatDateTime } from "@/lib/bos/format";
import { ContractForm, ContractSteps, RenewContractButton } from "../../../HrControls";

// Employee contract with versions, signatures, file and history (§9).
export default async function EmployeeContractPage({ params }: { params: Promise<{ id: string }> }) {
  const { bos } = await requirePermission("hr_documents.read");
  const { id } = await params;
  if (!(await canAccessEntity(bos, "employee_contract", id))) notFound();
  let k;
  try {
    k = await getContract(id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  const canManage = bos.permissions.get("hr_documents.update") === "all" || bos.isSuperAdmin;
  const emp = k.employees as unknown as { id: string; user_id: string | null; full_name: string } | null;
  const isEmployee = emp?.user_id === bos.userId;
  const currencies = await listCurrencies();
  const editable = canManage && ["draft", "pending_signature"].includes(k.status);
  return (
    <>
      <PageHeader
        title={k.title}
        subtitle={<span className="bos-row" style={{ gap: 8 }}><StatusBadge map="employee_contract_status" value={k.status} /><StatusBadge map="signature_status" value={k.signature_status} /><span>{k.contract_number} · v{k.version}</span></span>}
       
        actions={
          <span className="bos-row" style={{ gap: 6, flexWrap: "wrap" }}>
            <ContractSteps id={k.id} status={k.status} signature={k.signature_status} canManage={canManage} isEmployee={isEmployee} />
            {canManage && ["active", "expired"].includes(k.status) ? <><RenewContractButton parentId={k.id} kind="renewal" currencies={currencies} /><RenewContractButton parentId={k.id} kind="amendment" currencies={currencies} /></> : null}
          </span>
        }
      />
      <div className="bos-grid main-side">
        <div>
          <Card title="بيانات العقد">
            <KeyValues
              items={[
                { label: "الموظف", value: emp ? <Link href={`/admin/team/employees/${emp.id}`}>{emp.full_name}</Link> : "—" },
                { label: "النوع", value: <StatusBadge map="employee_contract_type" value={k.contract_type} /> },
                { label: "المسمى", value: k.position_title },
                { label: "البداية", value: formatDate(k.start_date) },
                { label: "النهاية", value: k.end_date ? formatDate(k.end_date) : "غير محدد المدة" },
                { label: "الراتب في العقد", value: k.basic_salary != null ? <Money value={k.basic_salary} currency={k.currency} /> : null },
                { label: "فترة الإخطار", value: k.notice_period_days != null ? `${k.notice_period_days} يوم` : null },
                { label: "توقيع الموظف", value: k.employee_signed_at ? formatDateTime(k.employee_signed_at) : "لم يوقّع" },
                { label: "توقيع الشركة", value: k.company_signed_at ? formatDateTime(k.company_signed_at) : "لم توقّع" },
                { label: "سبب الإنهاء", value: k.termination_reason, hidden: !k.termination_reason },
              ]}
            />
            {k.terms ? <><h4 className="bos-form-section-title"><Tx>البنود</Tx></h4><div className="bos-prose"><Tx>{k.terms}</Tx></div></> : null}
            {k.notes ? <p className="bos-faint" style={{ fontSize: 12.5 }}>{k.notes}</p> : null}
          </Card>
          <Card title="نسخة العقد (الملف)"><FileManager entityType="employee_contract" entityId={k.id} canUpload={canManage} /></Card>
          {editable ? <Card title="تعديل العقد (قبل التفعيل)"><ContractForm employees={[]} currencies={currencies} initial={k as unknown as Record<string, string | number | null>} contractId={k.id} /></Card> : null}
        </div>
        <div>
          <Card title="النسخ والتجديدات">
            {k.versions.map((v) => (
              <div key={v.id} style={{ fontSize: 13, marginBottom: 6 }}>
                {v.id === k.id ? <strong>v{v.version} — {v.contract_number}</strong> : <Link href={`/admin/team/documents/contracts/${v.id}`}>v{v.version} — {v.contract_number}</Link>} <StatusBadge map="employee_contract_type" value={v.contract_type} /> <StatusBadge map="employee_contract_status" value={v.status} />
                <div className="bos-faint" style={{ fontSize: 12 }}>{formatDate(v.start_date)} → {v.end_date ? formatDate(v.end_date) : "مفتوح"}</div>
              </div>
            ))}
          </Card>
          {canManage ? <Card title="السجل"><AuditLogPanel entityType="employee_contract" entityId={k.id} /></Card> : null}
        </div>
      </div>
    </>
  );
}
