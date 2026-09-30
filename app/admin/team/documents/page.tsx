import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { requirePermission } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { db } from "@/lib/bos/db";
import { getSystemTime } from "@/lib/bos/system-time";
import { managedEmployeeIds } from "@/services/bos/team-scope";
import { listDocuments, listDocumentTypes, daysUntil } from "@/services/bos/hr/documents";
import { PageHeader, Card, EmptyState, KpiCard, StatusBadge, UserAvatar } from "@/components/bos/ui";
import { FilterBar } from "@/components/bos/FilterBar";
import { formatDate } from "@/lib/bos/format";
import { statusLabel, statusOptions } from "@/lib/bos/labels";
import { DocumentRowActions, NewDocumentButton } from "../HrControls";

// Employee documents across the company (docs/bos/28 §8, §41).
export default async function HrDocumentsPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos, scope } = await requirePermission("hr_documents.read");
  const sp = await readParams(searchParams);
  const { today } = await getSystemTime();
  const hrAll = scope === "all" || bos.isSuperAdmin;
  const managed = hrAll ? [] : await managedEmployeeIds(bos);
  const ids = hrAll ? null : [bos.employee.id, ...managed];
  const [docs, types, { data: employees }] = await Promise.all([
    listDocuments(ids, { employee: sp.employee, type: sp.type, category: sp.category, status: sp.status, expiry: sp.expiry as "expiring" | "expired" | "any" | undefined, q: sp.q }, today, { selfEmployeeId: bos.employee.id, managerView: managed.length > 0 }),
    listDocumentTypes(false),
    ids ? db().from("employees").select("id, full_name").in("id", ids).order("full_name") : db().from("employees").select("id, full_name").is("archived_at", null).order("full_name"),
  ]);
  const canCreateAll = bos.permissions.get("hr_documents.create") === "all" || bos.isSuperAdmin;
  const empOptions = (employees ?? []).map((e) => ({ value: e.id, label: e.full_name }));
  return (
    <>
      <PageHeader
        title="مستندات الموظفين"
        subtitle="ملف الموظف: الهوية، العقود، المؤهلات، المستندات المالية والتأمينية"
       
        actions={<NewDocumentButton employees={empOptions} fixedEmployeeId={canCreateAll ? undefined : bos.employee.id} types={(canCreateAll ? types : types.filter((t) => t.employee_can_upload)).filter((t) => t.is_active).map((t) => ({ value: t.id, label: t.name, requires_expiry: t.requires_expiry }))} canConfidential={canCreateAll} />}
      />
      <div className="bos-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 12 }}>
        <KpiCard label="بانتظار التحقق" value={docs.filter((d) => d.status === "pending_verification").length} href="/admin/team/documents?status=pending_verification" />
        <KpiCard label="تنتهي قريباً" value={docs.filter((d) => d.expiry === "expiring").length} href="/admin/team/documents?expiry=expiring" />
        <KpiCard label="منتهية" value={docs.filter((d) => d.expiry === "expired" || d.status === "expired").length} href="/admin/team/documents?expiry=expired" />
        <KpiCard label="الإجمالي" value={docs.length} />
      </div>
      <FilterBar
        searchPlaceholder="بحث بعنوان المستند..."
        filters={[
          { key: "employee", label: "الموظف", type: "select", options: empOptions },
          { key: "type", label: "النوع", type: "select", options: types.map((t) => ({ value: t.id, label: t.name })) },
          { key: "category", label: "الفئة", type: "select", options: statusOptions("document_category") },
          { key: "status", label: "الحالة", type: "select", options: statusOptions("document_status") },
          { key: "expiry", label: "الانتهاء", type: "select", options: [{ value: "expiring", label: "تنتهي قريباً" }, { value: "expired", label: "منتهية" }, { value: "any", label: "لها تاريخ انتهاء" }] },
        ]}
      />
      <Card flush>
        {docs.length ? (
          <BosTable className="bos-table responsive">
            <thead><tr><th><Tx>الموظف</Tx></th><th><Tx>المستند</Tx></th><th><Tx>النوع</Tx></th><th><Tx>الإصدار / الانتهاء</Tx></th><th><Tx>الحالة</Tx></th><th><Tx>الملف</Tx></th><th /></tr></thead>
            <tbody>
              {docs.map((d) => {
                const emp = d.employees as unknown as { id: string; user_id: string | null; full_name: string; photo_updated_at: string | null };
                const t = d.document_types as unknown as { name: string; category: string; employee_can_upload: boolean } | null;
                const own = emp.user_id === bos.userId;
                return (
                  <tr key={d.id}>
                    <td><Link href={`/admin/team/employees/${emp.id}?tab=documents`} className="bos-row" style={{ gap: 8 }}><UserAvatar name={emp.full_name} employeeId={emp.id} version={emp.photo_updated_at} />{emp.full_name}</Link></td>
                    <td className="cell-primary">{d.title}{d.document_number ? <span className="cell-sub" dir="ltr"><Tx>{d.document_number}</Tx></span> : null}{d.confidential ? <span className="bos-badge tone-danger plain"><Tx>سري</Tx></span> : null}</td>
                    <td>{t?.name}<span className="cell-sub">{statusLabel("document_category", t?.category)}</span></td>
                    <td>{formatDate(d.issue_date)} → {formatDate(d.expiry_date)}{d.expiry === "expiring" && d.expiry_date ? <span className="cell-sub" style={{ color: "var(--bos-warning)" }}><Tx vars={{ v: daysUntil(d.expiry_date, today) }}>{"ينتهي خلال {v} يوم"}</Tx></span> : d.expiry === "expired" ? <span className="cell-sub bos-danger"><Tx>منتهي</Tx></span> : null}</td>
                    <td><StatusBadge map="document_status" value={d.status} /></td>
                    <td>{d.file ? <a className="bos-link" href={`/api/bos/files/${d.file.id}`} target="_blank" rel="noreferrer">v{d.file.version}</a> : <span className="bos-faint">—</span>}</td>
                    <td>
                      <DocumentRowActions
                        doc={{ ...d, hasFile: !!d.file }}
                        canManage={bos.permissions.get("hr_documents.update") === "all" || bos.isSuperAdmin}
                        canVerify={bos.permissions.get("hr_documents.approve") === "all" || bos.isSuperAdmin}
                        canUpload={bos.permissions.get("hr_documents.update") === "all" || bos.isSuperAdmin || (own && !!t?.employee_can_upload && ["pending_verification", "rejected"].includes(d.status))}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </BosTable>
        ) : <EmptyState title="لا توجد مستندات" />}
      </Card>
    </>
  );
}
