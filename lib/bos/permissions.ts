// Permission model (docs/bos/03-auth-permissions.md).
// Keys are `<module>.<action>`; each grant carries a record scope.

export const permissionActions = [
  "create",
  "read",
  "update",
  "delete",
  "approve",
  "export",
  "assign",
  "manage",
  "view_sensitive",
] as const;

export type PermissionAction = (typeof permissionActions)[number];

export const permissionModules = [
  "dashboard", "leads", "deals", "activities", "proposals", "contracts", "invoices", "payments", "commissions", "expenses", "vendors", "revenue", "clients", "contacts", "communications", "approvals", "files", "employees", "attendance", "leave", "overtime", "kpis", "performance", "onboarding", "devices", "chat", "meetings", "email", "notifications", "knowledge", "tickets", "reports", "settings", "users", "roles", "audit", "calendar", "search", "payroll", "recruitment", "hr_documents", "hr_requests", "integrations", "documents", "conversations", "content", "ads", "imports", "location",
  // Yolias platform modules (docs/09-yolias-admin.md §B).
  "platform",
] as const;

export type PermissionModule = (typeof permissionModules)[number];
export type PermissionKey = `${PermissionModule}.${PermissionAction}`;

export type Scope = "own" | "assigned" | "team" | "all";

const scopeRank: Record<Scope, number> = { own: 1, assigned: 2, team: 3, all: 4 };

export function maxScope(a: Scope | undefined, b: Scope | undefined): Scope | undefined {
  if (!a) return b;
  if (!b) return a;
  return scopeRank[a] >= scopeRank[b] ? a : b;
}

export function scopeAtLeast(scope: Scope | undefined, required: Scope): boolean {
  return scope !== undefined && scopeRank[scope] >= scopeRank[required];
}

export interface GrantRow {
  key: string;
  scope: Scope;
}

export interface OverrideRow {
  key: string;
  effect: "grant" | "deny";
  scope: Scope;
}

// Max scope per permission across roles, then user overrides: deny removes,
// grant raises (never lowers) the scope.
export function resolvePermissions(grants: GrantRow[], overrides: OverrideRow[], isSuperAdmin: boolean): Map<string, Scope> {
  const map = new Map<string, Scope>();

  if (isSuperAdmin) {
    for (const mod of permissionModules) {
      for (const action of permissionActions) {
        map.set(`${mod}.${action}`, "all");
      }
    }
  }

  for (const grant of grants) {
    const next = maxScope(map.get(grant.key), grant.scope);
    if (next) map.set(grant.key, next);
  }

  for (const override of overrides) {
    if (override.effect === "deny") {
      map.delete(override.key);
    } else {
      const next = maxScope(map.get(override.key), override.scope);
      if (next) map.set(override.key, next);
    }
  }

  return map;
}
