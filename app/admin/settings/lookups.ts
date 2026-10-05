import "server-only";
import { listActiveStaff, listCurrencies, listDepartments, listRoles } from "@/services/bos/shared";
import type { Lookups } from "./ConfigTableEditor";

export async function settingsLookups(): Promise<Lookups> {
  const [staff, roles, departments, currencies] = await Promise.all([listActiveStaff(), listRoles(), listDepartments(), listCurrencies()]);
  return {
    users: staff.map((s) => ({ value: s.userId, label: s.name })),
    roles: roles.filter((r) => !r.is_client_role).map((r) => ({ value: r.id, label: r.name })),
    departments: departments.map((d) => ({ value: d.id, label: d.name })),
    currencies,
  };
}
