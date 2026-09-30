import "server-only";
import { cache } from "react";
import { db } from "@/lib/bos/db";
import { getTeamUserIds, type BosUser } from "@/lib/bos/auth";
import type { PermissionKey, Scope } from "@/lib/bos/permissions";

// People managers see their people (docs/bos/12, 13: "managers (team)").
// Everyone the user manages: direct/indirect reports, members of teams they
// lead and departments they manage.
export const managedUserIds = cache(async (bos: BosUser): Promise<string[]> => {
  const [{ data: emps }, { data: teams }, { data: depts }] = await Promise.all([
    db().from("employees").select("id, user_id, manager_id, team_id, department_id").is("archived_at", null),
    db().from("teams").select("id").eq("lead_user_id", bos.userId),
    db().from("departments").select("id").eq("manager_user_id", bos.userId),
  ]);
  const all = emps ?? [];
  const teamIds = new Set((teams ?? []).map((t) => t.id));
  const deptIds = new Set((depts ?? []).map((d) => d.id));
  const ids = new Set<string>();
  for (const e of all) {
    if (!e.user_id || e.user_id === bos.userId) continue;
    if ((e.team_id && teamIds.has(e.team_id)) || (e.department_id && deptIds.has(e.department_id))) ids.add(e.user_id);
  }
  const children = new Map<string, typeof all>();
  for (const e of all) if (e.manager_id) children.set(e.manager_id, [...(children.get(e.manager_id) ?? []), e]);
  const stack = [bos.employee.id];
  const seen = new Set<string>();
  while (stack.length) {
    const cur = stack.pop()!;
    if (seen.has(cur)) continue;
    seen.add(cur);
    for (const c of children.get(cur) ?? []) {
      if (c.user_id) ids.add(c.user_id);
      stack.push(c.id);
    }
  }
  return [...ids];
});

// Employee ids (including people without a BOS login yet, e.g. new hires)
// in the user's management chain.
export const managedEmployeeIds = cache(async (bos: BosUser): Promise<string[]> => {
  const { data } = await db().from("employees").select("id, manager_id").is("archived_at", null);
  const children = new Map<string, string[]>();
  for (const e of data ?? []) if (e.manager_id) children.set(e.manager_id, [...(children.get(e.manager_id) ?? []), e.id]);
  const out: string[] = [];
  const stack = [bos.employee.id];
  const seen = new Set<string>();
  while (stack.length) {
    const cur = stack.pop()!;
    if (seen.has(cur)) continue;
    seen.add(cur);
    for (const c of children.get(cur) ?? []) {
      out.push(c);
      stack.push(c);
    }
  }
  return out;
});

// Employees visible for an HR-type permission, by employee id.
export async function peopleEmployeeIds(bos: BosUser, key: PermissionKey): Promise<string[] | null> {
  const { users } = await peopleScope(bos, key);
  if (users === null) return null;
  const [{ data }, managed] = await Promise.all([db().from("employees").select("id").in("user_id", users.length ? users : ["00000000-0000-0000-0000-000000000000"]), managedEmployeeIds(bos)]);
  return [...new Set([...(data ?? []).map((e) => e.id), ...managed])];
}

export async function canSeeEmployee(bos: BosUser, key: PermissionKey, employee: { id: string; user_id: string | null }) {
  if (bos.permissions.get(key) === "all" || employee.id === bos.employee.id) return true;
  if (employee.user_id && (await canSeeUser(bos, key, employee.user_id))) return true;
  return (await managedEmployeeIds(bos)).includes(employee.id);
}

export async function isPeopleManager(bos: BosUser) {
  return (await managedUserIds(bos)).length > 0;
}

// Users visible for an HR-type permission: `all` → null (unrestricted);
// `team` → team scope; `own` → me plus the people I manage.
export async function peopleScope(bos: BosUser, key: PermissionKey): Promise<{ users: string[] | null; scope: Scope | undefined; manages: boolean }> {
  const scope = bos.permissions.get(key);
  const managed = await managedUserIds(bos);
  if (scope === "all") return { users: null, scope, manages: managed.length > 0 };
  if (scope === "team") return { users: [...new Set([...(await getTeamUserIds(bos)), ...managed])], scope, manages: true };
  return { users: [bos.userId, ...managed], scope, manages: managed.length > 0 };
}

export async function canSeeUser(bos: BosUser, key: PermissionKey, userId: string) {
  const { users } = await peopleScope(bos, key);
  return users === null || users.includes(userId);
}
