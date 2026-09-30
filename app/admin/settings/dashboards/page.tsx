import { getT } from "@/lib/bos/i18n/server";
import Link from "next/link";
import { requirePermission } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { db } from "@/lib/bos/db";
import { widgets, defaultLayouts, roleDashboard } from "@/lib/bos/widgets";
import { PageHeader } from "@/components/bos/ui";
import { SettingsNav } from "../SettingsNav";
import { LayoutEditor } from "../../dashboard/LayoutEditor";

// Role dashboard layouts (Admin, §79). Widgets still render only when the
// viewer holds the widget's permission.
export default async function DashboardLayoutsPage({ searchParams }: { searchParams: SearchParams }) {
  const t = await getT();
  await requirePermission("settings.manage", "all");
  const sp = await readParams(searchParams);
  const { data: roles } = await db().from("roles").select("id, key, name").eq("is_client_role", false).is("archived_at", null).order("sort_order");
  const role = (roles ?? []).find((r) => r.id === sp.role) ?? (roles ?? [])[0];
  const { data: layout } = role ? await db().from("dashboard_layouts").select("widgets").eq("role_id", role.id).maybeSingle() : { data: null };
  const initial = layout ? (layout.widgets as { key: string }[]).map((w) => w.key) : role && roleDashboard[role.key] ? defaultLayouts[roleDashboard[role.key]] : defaultLayouts.employee;
  return (
    <>
      <PageHeader title="تخطيطات لوحة التحكم حسب الدور" breadcrumbs={[{ label: "الإعدادات" }, { label: "لوحات التحكم" }]} />
      <SettingsNav active="company" />
      <nav className="bos-tabs" aria-label={t("الأدوار")}>{(roles ?? []).map((r) => <Link key={r.id} href={`/admin/settings/dashboards?role=${r.id}`} className={r.id === role?.id ? "active" : undefined}>{r.name}</Link>)}</nav>
      {role ? <LayoutEditor key={role.id} roleId={role.id} available={widgets.map((w) => ({ key: w.key, title: w.title, dashboard: w.dashboard }))} initial={initial} /> : null}
    </>
  );
}
