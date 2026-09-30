import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { requirePermission } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { db } from "@/lib/bos/db";
import { getSystemTime } from "@/lib/bos/system-time";
import { listContracts, daysUntil } from "@/services/bos/hr/documents";
import { listCurrencies } from "@/services/bos/shared";
import { PageHeader, Card, EmptyState, KpiCard, StatusBadge, UserAvatar } from "@/components/bos/ui";
import { FilterBar } from "@/components/bos/FilterBar";
import { SubNav } from "@/components/bos/SubNav";
import { hrSection } from "@/lib/bos/hr-nav";
import { formatDate } from "@/lib/bos/format";
import { statusOptions } from "@/lib/bos/labels";
import { NewContractButton } from "../../HrControls";

// Central Employee Contracts view (docs/bos/28 §10).
export default async function EmployeeContractsPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos, scope } = await requirePermission("hr_documents.read");
  const sp = await readParams(searchParams);
  const { today } = await getSystemTime();
  const hrAll = scope === "all" || bos.isSuperAdmin;
  const [rows, { data: employees }, currencies] = await Promise.all([
    listContracts(hrAll ? null : [bos.employee.id], { employee: sp.employee, type: sp.type, status: sp.status, expiring: sp.expiring, from: sp.from, to: sp.to, q: sp.q }, today),
    hrAll ? db().from("employees").select("id, full_name").is("archived_at", null).order("full_name") : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    listCurrencies(),
  ]);
  const visible = hrAll ? rows : rows.filter((r) => r.status !== "draft");
  const empOptions = (employees ?? []).map((e) => ({ value: e.id, label: e.full_name }));
  return (
    <>
      <PageHeader
        title="عقود الموظفين"
        subtitle="كل العقود والنسخ والتجديدات والملاحق"
        breadcrumbs={[{ label: "الفريق" }, { label: "المستندات", href: "/admin/team/documents" }, { label: "العقود" }]}
        actions={bos.permissions.get("hr_documents.update") === "all" || bos.isSuperAdmin ? <NewContractButton employees={empOptions} currencies={currencies} /> : null}
      />
      <SubNav items={hrSection(bos, "documents")} active="contracts" label="المستندات" />
      <div className="bos-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 12 }}>
        <KpiCard label="سارية" value={visible.filter((r) => r.status === "active").length} href="/admin/team/documents/contracts?status=active" />
        <KpiCard label="تنتهي خلال 30 يوماً" value={visible.filter((r) => r.expiry === "expiring").length} href="/admin/team/documents/contracts?expiring=1" />
        <KpiCard label="بانتظار التوقيع" value={visible.filter((r) => r.status === "pending_signature").length} href="/admin/team/documents/contracts?status=pending_signature" />
        <KpiCard label="منتهية" value={visible.filter((r) => r.status === "expired").length} href="/admin/team/documents/contracts?status=expired" />
      </div>
      <FilterBar
        searchPlaceholder="بحث بالعنوان أو رقم العقد..."
        filters={[
          ...(hrAll ? [{ key: "employee", label: "الموظف", type: "select" as const, options: empOptions }] : []),
          { key: "type", label: "نوع العقد", type: "select", options: statusOptions("employee_contract_type") },
          { key: "status", label: "الحالة", type: "select", options: statusOptions("employee_contract_status") },
          { key: "expiring", label: "الانتهاء", type: "select", options: [{ value: "1", label: "تنتهي خلال 30 يوماً" }] },
          { key: "from", label: "بداية من", type: "date" },
          { key: "to", label: "بداية حتى", type: "date" },
        ]}
      />
      <Card flush>
        {visible.length ? (
          <table className="bos-table responsive">
            <thead><tr><th><Tx>الموظف</Tx></th><th><Tx>العقد</Tx></th><th><Tx>النوع</Tx></th><th><Tx>البداية</Tx></th><th><Tx>النهاية</Tx></th><th><Tx>التوقيع</Tx></th><th><Tx>الحالة</Tx></th></tr></thead>
            <tbody>
              {visible.map((k) => {
                const emp = k.employees as unknown as { id: string; full_name: string; photo_updated_at: string | null; position: string | null };
                return (
                  <tr key={k.id}>
                    <td><Link href={`/admin/team/employees/${emp.id}?tab=contracts`} className="bos-row" style={{ gap: 8 }}><UserAvatar name={emp.full_name} employeeId={emp.id} version={emp.photo_updated_at} /><span>{emp.full_name}<span className="cell-sub">{emp.position ?? ""}</span></span></Link></td>
                    <td className="cell-primary"><Link href={`/admin/team/documents/contracts/${k.id}`}><Tx>{k.title}</Tx></Link><span className="cell-sub">{k.contract_number} · v{k.version}</span></td>
                    <td><StatusBadge map="employee_contract_type" value={k.contract_type} /></td>
                    <td>{formatDate(k.start_date)}</td>
                    <td>{formatDate(k.end_date)}{k.expiry === "expiring" && k.end_date ? <span className="cell-sub" style={{ color: "var(--bos-warning)" }}><Tx vars={{ v: daysUntil(k.end_date, today) }}>{"خلال {v} يوم"}</Tx></span> : null}</td>
                    <td><StatusBadge map="signature_status" value={k.signature_status} /></td>
                    <td><StatusBadge map="employee_contract_status" value={k.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : <EmptyState title="لا توجد عقود" />}
      </Card>
    </>
  );
}
