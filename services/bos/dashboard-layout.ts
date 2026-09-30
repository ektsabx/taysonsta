import "server-only";
import type { BosUser } from "@/lib/bos/auth";
import { db } from "@/lib/bos/db";
import { widgetByKey, defaultLayouts, roleDashboard, type WidgetDef } from "@/lib/bos/widgets";

// Role-aware dashboard (§6, §79): union of the widget layouts of the user's
// roles (admin-configurable per role, overridable per user), filtered by
// the permission each widget requires. A widget without permission is
// never rendered and its query never runs.
export async function resolveWidgets(bos: BosUser): Promise<WidgetDef[]> {
  const client = db();
  const { data: roleRows } = await client.from("user_roles").select("role_id, roles!inner(key)").eq("user_id", bos.userId);
  const roleIds = (roleRows ?? []).map((r) => r.role_id);

  const { data: personal } = await client.from("dashboard_layouts").select("widgets").eq("user_id", bos.userId).maybeSingle();
  let keys: string[] = [];

  if (personal && Array.isArray(personal.widgets) && personal.widgets.length) {
    keys = (personal.widgets as { key: string }[]).map((w) => w.key);
  } else {
    const { data: roleLayouts } = roleIds.length ? await client.from("dashboard_layouts").select("role_id, widgets").in("role_id", roleIds) : { data: [] };
    const layoutByRole = new Map((roleLayouts ?? []).map((l) => [l.role_id, (l.widgets as { key: string }[]).map((w) => w.key)]));
    const dashboards = new Set<string>();
    keys.push(...defaultLayouts.employee);
    for (const row of roleRows ?? []) {
      const key = (row.roles as unknown as { key: string }).key;
      const custom = layoutByRole.get(row.role_id);
      if (custom) keys.push(...custom);
      else if (roleDashboard[key] && !dashboards.has(roleDashboard[key])) {
        dashboards.add(roleDashboard[key]);
        keys.push(...defaultLayouts[roleDashboard[key]]);
      }
    }
  }

  const seen = new Set<string>();
  const order: Record<string, number> = { executive: 0, finance: 1, bd: 2, pm: 3, employee: 4 };
  return keys
    .filter((k) => !seen.has(k) && seen.add(k))
    .map((k) => widgetByKey.get(k))
    .filter((w): w is WidgetDef => !!w && w.perm.every((p) => bos.permissions.has(p)))
    .sort((a, b) => (order[a.dashboard] ?? 9) - (order[b.dashboard] ?? 9));
}

