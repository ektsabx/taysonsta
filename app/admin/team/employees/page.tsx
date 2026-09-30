import { RelTime } from "@/components/bos/RelTime";
import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { requirePermission, can } from "@/lib/bos/auth";
import { readParams, pageOf, type SearchParams } from "@/lib/bos/params";
import { listEmployees } from "@/services/bos/employees";
import { listDepartments, listTeams } from "@/services/bos/shared";
import { PageHeader, StatusBadge, EmptyState, UserAvatar } from "@/components/bos/ui";
import { DataTable } from "@/components/bos/DataTable";
import { FilterBar } from "@/components/bos/FilterBar";
import { formatTime } from "@/lib/bos/format";
import { statusOptions } from "@/lib/bos/labels";
import { db } from "@/lib/bos/db";
import { SubNav } from "@/components/bos/SubNav";
import { hrSection } from "@/lib/bos/hr-nav";
import { listEmployeeCategories } from "@/services/bos/hr/people";
import { currentBranchSelection } from "@/lib/bos/branch";

export default async function EmployeesPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos, scope } = await requirePermission("employees.read");
  const params = await readParams(searchParams);
  const [result, departments, teams, categories, { data: managers }, { data: locations }] = await Promise.all([
    listEmployees(bos, scope, { ...params, page: pageOf(params) }),
    listDepartments(),
    listTeams(),
    listEmployeeCategories(),
    db().from("employees").select("id, full_name").is("archived_at", null).in("lifecycle_status", ["active", "on_leave", "onboarding"]).order("full_name"),
    db().from("employees").select("work_location").not("work_location", "is", null),
  ]);
  const { branches } = await currentBranchSelection(bos);
  const managerOptions = (managers ?? []).map((m) => ({ value: m.id, label: m.full_name }));
  const locationOptions = [...new Set((locations ?? []).map((l) => l.work_location as string))].sort().map((l) => ({ value: l, label: l }));
  return (
    <>
      <PageHeader
        title="الموظفون"
        subtitle={<Tx vars={{ total: result.total }}>{"{total} موظف"}</Tx>}
        breadcrumbs={[{ label: "الفريق" }, { label: "الموظفون" }]}
        actions={can(bos, "employees.create") ? <Link href="/admin/team/employees/new" className="admin-btn small"><Tx>+ موظف جديد</Tx></Link> : null}
      />
      <SubNav items={hrSection(bos, "employees")} active="list" label="أقسام الموظفين" />
      <FilterBar
        searchPlaceholder="بحث بالاسم أو البريد أو المسمى أو الكود..."
        filters={[
          { key: "department", label: "القسم", type: "select", options: departments.map((d) => ({ value: d.id, label: d.name })) },
          { key: "team", label: "الفريق", type: "select", options: teams.map((t) => ({ value: t.id, label: t.name })) },
          { key: "manager", label: "المدير", type: "select", options: managerOptions },
          ...(branches.length > 1 ? [{ key: "branch", label: "الفرع", type: "select" as const, options: branches.map((b) => ({ value: b.id, label: b.name })) }] : []),
          ...(locationOptions.length ? [{ key: "location", label: "الفرع", type: "select" as const, options: locationOptions }] : []),
          ...(categories.length ? [{ key: "category", label: "التصنيف", type: "select" as const, options: categories.map((c) => ({ value: c.id, label: c.name })) }] : []),
          { key: "status", label: "الحالة", type: "select", options: statusOptions("employee_lifecycle_status") },
          { key: "type", label: "نوع التوظيف", type: "select", options: statusOptions("employment_type") },
          { key: "archived", label: "المؤرشفون", type: "select", options: [{ value: "1", label: "عرض المؤرشفين" }] },
        ]}
      />
      <DataTable
        tableId="employees"
        columns={[
          { key: "name", label: "الموظف", primary: true, alwaysVisible: true },
          { key: "department", label: "القسم / الفريق" },
          { key: "manager", label: "المدير" },
          { key: "roles", label: "الأدوار" },
          { key: "status", label: "الحالة" },
          { key: "type", label: "التوظيف", defaultHidden: true },
          { key: "tz", label: "الفرع / الدولة" },
          { key: "today", label: "حضور اليوم" },
          { key: "activity", label: "آخر نشاط في النظام", defaultHidden: true },
        ]}
        total={result.total}
        page={result.page}
        pageSize={result.pageSize}
        exportHref={can(bos, "employees.export") ? "/api/bos/export/employees" : undefined}
        empty={<EmptyState title="لا يوجد موظفون" />}
        rows={result.rows.map((e) => ({
          id: e.id,
          cells: {
            name: (
              <Link href={`/admin/team/employees/${e.id}`} className="bos-row" style={{ gap: 8 }}>
                <UserAvatar name={e.full_name} employeeId={e.id} version={e.photo_updated_at} />
                <span>
                  {e.full_name}
                  <span className="cell-sub">{e.position ?? ""}{e.employee_code ? ` · ${e.employee_code}` : ""}</span>
                </span>
              </Link>
            ),
            department: [(e.departments as { name: string } | null)?.name, (e.teams as { name: string } | null)?.name].filter(Boolean).join(" / ") || "—",
            manager: e.managerName ?? "—",
            roles: e.roleNames.length ? e.roleNames.join("، ") : <span className="bos-faint"><Tx>{e.user_id ? "بدون دور" : "بدون حساب دخول"}</Tx></span>,
            status: <StatusBadge map="employee_lifecycle_status" value={e.lifecycle_status} />,
            type: <StatusBadge map="employment_type" value={e.employment_type} />,
            tz: <span>{[e.work_location, e.country].filter(Boolean).join(" · ") || "—"}<span className="cell-sub" dir="ltr">{e.timezone}</span></span>,
            today: e.today ? <span><StatusBadge map="attendance_status" value={e.today.status} />{e.today.first_clock_in ? <span className="cell-sub">{formatTime(e.today.first_clock_in, e.timezone)}</span> : null}</span> : <StatusBadge map="attendance_status" value="not_clocked_in" />,
            activity: e.last_activity_at ? <RelTime value={e.last_activity_at} /> : "—",
          },
        }))}
      />
    </>
  );
}
