import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { db, type Tables } from "@/lib/bos/db";
import { ForbiddenError } from "@/lib/bos/errors";
import { pageAllowed, type PageRule } from "@/lib/bos/page-access";
import { resolvePermissions, scopeAtLeast, type PermissionKey, type Scope, type GrantRow, type OverrideRow } from "@/lib/bos/permissions";

// Lifecycle states in which an employee may use the BOS (docs/bos/03 + 27).
const STAFF_ALLOWED_STATUSES: Tables<"employees">["lifecycle_status"][] = [
  "pending_onboarding",
  "onboarding",
  "active",
  "on_leave",
  "offboarding",
];

export interface BosUser {
  user: User;
  userId: string;
  email: string;
  employee: Tables<"employees">;
  roleKeys: string[];
  roleNames: string[];
  isSuperAdmin: boolean;
  permissions: Map<string, Scope>;
}

export type BosSession =
  | { status: "anonymous" }
  | { status: "not_staff"; user: User }
  | { status: "inactive"; user: User; reason: string }
  | { status: "ok"; bos: BosUser };

export const getBosSession = cache(async (): Promise<BosSession> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { status: "anonymous" };
  }

  // Proposal clients and portal clients are real auth users but never staff.
  // app_metadata is server-controlled and cannot be set by the user.
  const appRole = user.app_metadata?.role;
  if (appRole === "proposal_client" || appRole === "client") {
    return { status: "not_staff", user };
  }

  const client = db();
  const { data: employee } = await client.from("employees").select("*").eq("user_id", user.id).maybeSingle();

  if (!employee) {
    return { status: "not_staff", user };
  }
  if (employee.archived_at || !STAFF_ALLOWED_STATUSES.includes(employee.lifecycle_status)) {
    return { status: "inactive", user, reason: employee.lifecycle_status };
  }

  const { data: roleRows } = await client
    .from("user_roles")
    .select("role_id, roles!inner(key, name, archived_at)")
    .eq("user_id", user.id);

  const roles = (roleRows ?? [])
    .map((r) => r.roles as unknown as { key: string; name: string; archived_at: string | null })
    .filter((r) => !r.archived_at);
  const roleIds = (roleRows ?? [])
    .filter((r) => !(r.roles as unknown as { archived_at: string | null }).archived_at)
    .map((r) => r.role_id);
  const roleKeys = roles.map((r) => r.key);
  const isSuperAdmin = roleKeys.includes("super_admin");

  const [{ data: grantRows }, { data: overrideRows }] = await Promise.all([
    roleIds.length
      ? client.from("role_permissions").select("scope, permissions!inner(key)").in("role_id", roleIds)
      : Promise.resolve({ data: [] as { scope: Scope; permissions: unknown }[] }),
    client.from("user_permission_overrides").select("effect, scope, permissions!inner(key)").eq("user_id", user.id),
  ]);

  const grants: GrantRow[] = (grantRows ?? []).map((g) => ({
    key: (g.permissions as unknown as { key: string }).key,
    scope: g.scope as Scope,
  }));
  const overrides: OverrideRow[] = (overrideRows ?? []).map((o) => ({
    key: (o.permissions as unknown as { key: string }).key,
    effect: o.effect as "grant" | "deny",
    scope: o.scope as Scope,
  }));

  return {
    status: "ok",
    bos: {
      user,
      userId: user.id,
      email: user.email ?? employee.email ?? "",
      employee,
      roleKeys,
      roleNames: roles.map((r) => r.name),
      isSuperAdmin,
      permissions: resolvePermissions(grants, overrides, isSuperAdmin),
    },
  };
});

export async function getBosUser(): Promise<BosUser | null> {
  const session = await getBosSession();
  return session.status === "ok" ? session.bos : null;
}

// Pages: redirect to login (no session) or the forbidden page (non-staff,
// inactive). Server actions should use requireBosUserForAction instead.
export async function requireBosUser(): Promise<BosUser> {
  const session = await getBosSession();
  if (session.status === "anonymous") {
    redirect("/admin/login");
  }
  if (session.status !== "ok") {
    redirect("/admin/forbidden");
  }
  return session.bos;
}

export async function requireBosUserForAction(): Promise<BosUser> {
  const session = await getBosSession();
  if (session.status !== "ok") {
    throw new ForbiddenError("انتهت الجلسة أو ليس لديك صلاحية. سجّل الدخول مرة أخرى.");
  }
  return session.bos;
}

export function scopeOf(bos: BosUser, key: PermissionKey): Scope | undefined {
  return bos.permissions.get(key);
}

export function can(bos: BosUser, key: PermissionKey, atLeast: Scope = "own"): boolean {
  return scopeAtLeast(bos.permissions.get(key), atLeast);
}

// Page-level restriction for the current request path (Settings → Security).
export const pageRules = cache(async (): Promise<PageRule[]> => {
  const { data } = await db().from("bos_settings").select("value").eq("key", "page_access").maybeSingle();
  const rules = (data?.value as { rules?: PageRule[] } | null)?.rules;
  return Array.isArray(rules) ? rules.filter((r) => typeof r?.prefix === "string" && Array.isArray(r.role_keys)) : [];
});

async function currentPageAllowed(bos: BosUser): Promise<boolean> {
  if (bos.isSuperAdmin) return true;
  const rules = await pageRules();
  if (!rules.length) return true;
  const path = (await headers()).get("x-pathname");
  return !path || pageAllowed(rules, path, bos.roleKeys, bos.isSuperAdmin);
}

// Page guard: returns the user and the scope granted for `key`.
export async function requirePermission(key: PermissionKey, atLeast: Scope = "own"): Promise<{ bos: BosUser; scope: Scope }> {
  const bos = await requireBosUser();
  const scope = bos.permissions.get(key);
  if (!scopeAtLeast(scope, atLeast)) {
    redirect("/admin/forbidden");
  }
  if (!(await currentPageAllowed(bos))) redirect("/admin/forbidden");
  return { bos, scope: scope as Scope };
}

// Action guard: throws ForbiddenError instead of redirecting.
export async function authorize(key: PermissionKey, atLeast: Scope = "own"): Promise<{ bos: BosUser; scope: Scope }> {
  const bos = await requireBosUserForAction();
  const scope = bos.permissions.get(key);
  if (!scopeAtLeast(scope, atLeast)) {
    throw new ForbiddenError();
  }
  return { bos, scope: scope as Scope };
}

// Users whose records fall in my "team" scope: members of my team, my
// direct and indirect reports, and — for department managers — everyone in
// that department. Always includes me.
export const getTeamUserIds = cache(async (bos: BosUser): Promise<string[]> => {
  const { data } = await db()
    .from("employees")
    .select("id, user_id, manager_id, team_id, department_id")
    .is("archived_at", null);
  const employees = data ?? [];
  const ids = new Set<string>([bos.userId]);

  const { data: managedDepartments } = await db().from("departments").select("id").eq("manager_user_id", bos.userId);
  const deptIds = new Set((managedDepartments ?? []).map((d) => d.id));

  for (const e of employees) {
    if (!e.user_id) continue;
    if (bos.employee.team_id && e.team_id === bos.employee.team_id) ids.add(e.user_id);
    if (e.department_id && deptIds.has(e.department_id)) ids.add(e.user_id);
  }

  const childrenByManager = new Map<string, typeof employees>();
  for (const e of employees) {
    if (!e.manager_id) continue;
    const list = childrenByManager.get(e.manager_id) ?? [];
    list.push(e);
    childrenByManager.set(e.manager_id, list);
  }
  const stack = [bos.employee.id];
  const seen = new Set<string>();
  while (stack.length) {
    const current = stack.pop()!;
    if (seen.has(current)) continue;
    seen.add(current);
    for (const child of childrenByManager.get(current) ?? []) {
      if (child.user_id) ids.add(child.user_id);
      stack.push(child.id);
    }
  }

  return [...ids];
});

// Resolve which user ids a scope covers for "owner"-style columns.
// `null` means unrestricted (all records).
export async function scopeUserIds(bos: BosUser, scope: Scope): Promise<string[] | null> {
  switch (scope) {
    case "all":
      return null;
    case "team":
      return getTeamUserIds(bos);
    default:
      return [bos.userId];
  }
}

export async function requestMeta(): Promise<{ ip: string | null; userAgent: string | null }> {
  const h = await headers();
  const ip = h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;
  return { ip, userAgent: h.get("user-agent") };
}
