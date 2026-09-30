import "server-only";
import { db } from "@/lib/bos/db";
import { listActiveStaff, listCurrencies, listDepartments, listProducts, listRoles } from "@/services/bos/shared";
import type { Lookups } from "./ConfigTableEditor";

export async function settingsLookups(): Promise<Lookups> {
  const [staff, roles, departments, products, currencies, { data: allCur }] = await Promise.all([listActiveStaff(), listRoles(), listDepartments(), listProducts(), listCurrencies(), db().from("currencies").select("code")]);
  return {
    users: staff.map((s) => ({ value: s.userId, label: s.name })),
    roles: roles.filter((r) => !r.is_client_role).map((r) => ({ value: r.id, label: r.name })),
    departments: departments.map((d) => ({ value: d.id, label: d.name })),
    products: products.map((p) => ({ value: p.id, label: p.name })),
    currencies: [...new Set([...currencies, ...(allCur ?? []).map((c) => c.code)])],
  };
}
