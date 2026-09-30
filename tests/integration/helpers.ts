import { db } from "@/lib/bos/db";
import type { BosUser } from "@/lib/bos/auth";
import type { Scope } from "@/lib/bos/permissions";

// Builds the same BosUser the app resolves for a signed-in staff member.
export async function bosUserFor(email: string): Promise<BosUser> {
  const c = db();
  const { data: emp } = await c.from("employees").select("*").eq("email", email).single();
  if (!emp?.user_id) throw new Error(`no staff user ${email}`);
  const { data: roles } = await c.from("user_roles").select("roles(id, key, name)").eq("user_id", emp.user_id);
  const roleRows = (roles ?? []).map((r) => r.roles as unknown as { id: string; key: string; name: string });
  const { data: perms } = await c.from("role_permissions").select("scope, permissions(key)").in("role_id", roleRows.map((r) => r.id));
  const rank: Record<string, number> = { own: 1, assigned: 2, team: 3, all: 4 };
  const permissions = new Map<string, Scope>();
  for (const p of perms ?? []) {
    const key = (p.permissions as unknown as { key: string }).key;
    const cur = permissions.get(key);
    if (!cur || rank[p.scope] > rank[cur]) permissions.set(key, p.scope as Scope);
  }
  const isSuperAdmin = roleRows.some((r) => r.key === "super_admin");
  return { user: { id: emp.user_id } as BosUser["user"], userId: emp.user_id, email, employee: emp, roleKeys: roleRows.map((r) => r.key), roleNames: roleRows.map((r) => r.name), isSuperAdmin, permissions: permissions as BosUser["permissions"] };
}

export function uniq(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}
