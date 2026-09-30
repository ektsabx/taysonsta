import "server-only";
import { db } from "@/lib/bos/db";
import { listCurrencies, listDepartments, listRoles, listTeams } from "@/services/bos/shared";
import { listSalaryComponents } from "@/services/bos/hr/people";

// Option lists shared by the recruitment pages.
export async function recruitmentLookups() {
  const [departments, teams, currencies, roles, components, { data: staff }] = await Promise.all([
    listDepartments(),
    listTeams(),
    listCurrencies(),
    listRoles(),
    listSalaryComponents(),
    db().from("employees").select("id, user_id, full_name").is("archived_at", null).in("lifecycle_status", ["active", "on_leave", "onboarding"]).order("full_name"),
  ]);
  return {
    departments: departments.map((d) => ({ value: d.id, label: d.name })),
    teams: teams.map((t) => ({ value: t.id, label: t.name })),
    currencies,
    roles: roles.filter((r) => !r.is_client_role && r.key !== "super_admin").map((r) => ({ value: r.id, label: r.name })),
    components: components.filter((c) => c.kind === "earning").map((c) => ({ value: c.id, label: c.name })),
    users: (staff ?? []).filter((s) => s.user_id).map((s) => ({ value: s.user_id as string, label: s.full_name })),
    managers: (staff ?? []).map((s) => ({ value: s.id, label: s.full_name })),
  };
}
