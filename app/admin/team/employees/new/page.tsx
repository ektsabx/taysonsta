import { requirePermission, can } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { db } from "@/lib/bos/db";
import { getSetting } from "@/lib/bos/settings";
import { listCurrencies, listDepartments, listRoles, listTeams } from "@/services/bos/shared";
import { candidateDefaults } from "@/services/bos/employees";
import { PageHeader } from "@/components/bos/ui";
import { listEmployeeCategories } from "@/services/bos/hr/people";
import { EmployeeForm } from "../EmployeeForm";
import { createEmployeeAction } from "../../actions";

// Create employee (§29): starts onboarding + access checklist (IT §7, §14).
// ?fromApplication= prefills from an accepted career application.
export default async function NewEmployeePage({ searchParams }: { searchParams: SearchParams }) {
  const { bos } = await requirePermission("employees.create");
  const sp = await readParams(searchParams);
  const [departments, teams, roles, currencies, { data: managers }, { data: schedules }, company, categories, app] = await Promise.all([
    listDepartments(),
    listTeams(),
    listRoles(),
    listCurrencies(),
    db().from("employees").select("id, full_name").is("archived_at", null).in("lifecycle_status", ["active", "on_leave", "onboarding"]).order("full_name"),
    db().from("work_schedules").select("id, name").eq("is_active", true).order("name"),
    getSetting("company"),
    listEmployeeCategories(),
    sp.fromApplication ? candidateDefaults(sp.fromApplication) : Promise.resolve(null),
  ]);
  const a = app as Record<string, unknown> | null;
  return (
    <>
      <PageHeader title="موظف جديد" subtitle={a ? "من طلب توظيف" : undefined} />
      <EmployeeForm
        action={createEmployeeAction}
        isNew
        departments={departments.map((d) => ({ value: d.id, label: d.name }))}
        teams={teams.map((t) => ({ value: t.id, label: t.name, department_id: t.department_id }))}
        managers={(managers ?? []).map((m) => ({ value: m.id, label: m.full_name }))}
        schedules={(schedules ?? []).map((s) => ({ value: s.id, label: s.name }))}
        roles={roles.filter((r) => !r.is_client_role && (bos.isSuperAdmin || r.key !== "super_admin")).map((r) => ({ value: r.id, label: r.name }))}
        currencies={currencies}
        canSensitive={can(bos, "employees.view_sensitive")}
        canRoles={can(bos, "roles.assign") || can(bos, "employees.manage")}
        emailDomain={(company as { email_domain?: string }).email_domain ?? null}
        categories={categories.map((c) => ({ value: c.id, label: c.name }))}
        initial={a ? { full_name: `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim(), personal_email: (a.email as string) ?? null, phone: (a.phone as string) ?? null, country: (a.country as string) ?? null, career_application_id: sp.fromApplication } : {}}
      />
    </>
  );
}
