import { Tx } from "@/components/bos/I18n";
import { notFound } from "next/navigation";
import { requirePermission, can } from "@/lib/bos/auth";
import { NotFoundError } from "@/lib/bos/errors";
import { db } from "@/lib/bos/db";
import { getSetting } from "@/lib/bos/settings";
import { getEmployee } from "@/services/bos/employees";
import { canSeeUser } from "@/services/bos/team-scope";
import { listCurrencies, listDepartments, listRoles, listTeams } from "@/services/bos/shared";
import { PageHeader } from "@/components/bos/ui";
import { listEmployeeCategories } from "@/services/bos/hr/people";
import { currentBranchSelection } from "@/lib/bos/branch";
import { EmployeeForm } from "../../EmployeeForm";
import { updateEmployeeAction } from "../../../actions";

export default async function EditEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { bos } = await requirePermission("employees.update");
  const { id } = await params;
  let emp;
  try {
    emp = await getEmployee(id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  if (bos.permissions.get("employees.update") !== "all" && !(emp.user_id && (await canSeeUser(bos, "employees.update", emp.user_id)))) notFound();
  const [departments, teams, roles, currencies, { data: managers }, { data: schedules }, company, categories] = await Promise.all([
    listDepartments(),
    listTeams(),
    listRoles(),
    listCurrencies(),
    db().from("employees").select("id, full_name").is("archived_at", null).neq("id", id).order("full_name"),
    db().from("work_schedules").select("id, name").eq("is_active", true).order("name"),
    getSetting("company"),
    listEmployeeCategories(),
  ]);
  const canSensitive = can(bos, "employees.view_sensitive");
  return (
    <>
      <PageHeader title={<Tx vars={{ full_name: emp.full_name }}>{"تعديل: {full_name}"}</Tx>} breadcrumbs={[{ label: "الموظفون", href: "/admin/team/employees" }, { label: emp.full_name, href: `/admin/team/employees/${id}` }, { label: "تعديل" }]} />
      <EmployeeForm
        action={updateEmployeeAction.bind(null, id)}
        initial={{ ...emp, hourly_cost: canSensitive ? emp.hourly_cost : null, role_ids: emp.roles.map((r) => r.id) }}
        departments={departments.map((d) => ({ value: d.id, label: d.name }))}
        teams={teams.map((t) => ({ value: t.id, label: t.name, department_id: t.department_id }))}
        managers={(managers ?? []).map((m) => ({ value: m.id, label: m.full_name }))}
        schedules={(schedules ?? []).map((s) => ({ value: s.id, label: s.name }))}
        roles={roles.filter((r) => !r.is_client_role && (bos.isSuperAdmin || r.key !== "super_admin")).map((r) => ({ value: r.id, label: r.name }))}
        currencies={currencies}
        canSensitive={canSensitive}
        canRoles={(can(bos, "roles.assign") || can(bos, "employees.manage")) && !!emp.user_id}
        hasLogin={!!emp.user_id}
        emailDomain={(company as { email_domain?: string }).email_domain ?? null}
        categories={categories.map((c) => ({ value: c.id, label: c.name }))}
        branches={(await currentBranchSelection(bos)).branches.map((b) => ({ value: b.id, label: b.name }))}
      />
    </>
  );
}
