import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { requirePermission } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { db } from "@/lib/bos/db";
import { managedEmployeeIds } from "@/services/bos/team-scope";
import { listHrRequests, listRequestTypes } from "@/services/bos/hr/requests";
import { PageHeader, Card, EmptyState, StatusBadge, UserAvatar } from "@/components/bos/ui";
import { FilterBar } from "@/components/bos/FilterBar";
import { SubNav } from "@/components/bos/SubNav";
import { hrSection } from "@/lib/bos/hr-nav";
import { formatDate } from "@/lib/bos/format";
import { statusOptions } from "@/lib/bos/labels";
import { HrRequestButton, HrRequestSteps } from "../../HrControls";

// Other employee requests: certificates, letters, equipment, schedule
// changes, remote work, training (docs/bos/28 §26).
export default async function OtherRequestsPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos, scope } = await requirePermission("hr_requests.read");
  const sp = await readParams(searchParams);
  const all = scope === "all" || bos.isSuperAdmin;
  const managed = all ? [] : await managedEmployeeIds(bos);
  const [rows, types, { data: employees }] = await Promise.all([
    listHrRequests({ employeeIds: all ? null : [bos.employee.id, ...managed], status: sp.status, type: sp.type }),
    listRequestTypes(),
    all ? db().from("employees").select("id, full_name").is("archived_at", null).order("full_name") : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
  ]);
  const canManage = bos.isSuperAdmin || bos.permissions.get("hr_requests.update") === "all";
  const canForOthers = bos.isSuperAdmin || bos.permissions.get("hr_requests.create") === "all";
  return (
    <>
      <PageHeader title="طلبات أخرى" breadcrumbs={[{ label: "الفريق" }, { label: "الطلبات", href: "/admin/team/requests" }, { label: "طلبات أخرى" }]}
        actions={<HrRequestButton employees={(employees ?? []).map((e) => ({ value: e.id, label: e.full_name }))} fixedEmployeeId={canForOthers ? undefined : bos.employee.id} types={types.map((t) => ({ value: t.id, label: t.name }))} />} />
      <SubNav items={hrSection(bos, "requests")} active="other" label="الطلبات" />
      <FilterBar filters={[{ key: "status", label: "الحالة", type: "select", options: statusOptions("hr_request_status") }, { key: "type", label: "النوع", type: "select", options: types.map((t) => ({ value: t.id, label: t.name })) }]} />
      <Card flush>
        {rows.length ? (
          <table className="bos-table responsive">
            <thead><tr><th><Tx>الرقم</Tx></th><th><Tx>الموظف</Tx></th><th><Tx>النوع</Tx></th><th><Tx>الموضوع</Tx></th><th><Tx>التاريخ</Tx></th><th><Tx>الحالة</Tx></th><th><Tx>الرد</Tx></th><th /></tr></thead>
            <tbody>
              {rows.map((r) => {
                const emp = r.employees as unknown as { id: string; user_id: string | null; full_name: string; photo_updated_at: string | null } | null;
                return (
                  <tr key={r.id}>
                    <td><Tx>{r.request_number}</Tx></td>
                    <td>{emp ? <Link href={`/admin/team/employees/${emp.id}?tab=requests`} className="bos-row" style={{ gap: 8 }}><UserAvatar name={emp.full_name} employeeId={emp.id} version={emp.photo_updated_at} />{emp.full_name}</Link> : "—"}</td>
                    <td>{(r.hr_request_types as { name: string } | null)?.name}</td>
                    <td className="cell-primary">{r.subject}{r.details ? <span className="cell-sub"><Tx>{r.details}</Tx></span> : null}</td>
                    <td>{formatDate(r.created_at)}{r.due_date ? <span className="cell-sub"><Tx vars={{ v: formatDate(r.due_date) }}>{"مطلوب قبل {v}"}</Tx></span> : null}</td>
                    <td><StatusBadge map="hr_request_status" value={r.status} /></td>
                    <td><Tx>{r.response ?? "—"}</Tx></td>
                    <td><HrRequestSteps id={r.id} status={r.status} canManage={canManage} isOwner={emp?.user_id === bos.userId} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : <EmptyState title="لا توجد طلبات" />}
      </Card>
    </>
  );
}
