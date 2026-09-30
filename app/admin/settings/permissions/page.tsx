import { getT } from "@/lib/bos/i18n/server";
import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { requirePermission, can } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { db } from "@/lib/bos/db";
import { permissionMatrix } from "@/services/bos/settings-admin";
import { listActiveStaff, userNameMap } from "@/services/bos/shared";
import { PageHeader, Card, EmptyState } from "@/components/bos/ui";
import { formatDateTime } from "@/lib/bos/format";
import { SettingsNav } from "../SettingsNav";
import { OverrideForm, RemoveOverrideButton, ScopeCell } from "../SettingsControls";

const actionLabels: Record<string, string> = { create: "إنشاء", read: "قراءة", update: "تعديل", delete: "حذف", approve: "موافقة", export: "تصدير", assign: "تعيين", manage: "إدارة", view_sensitive: "حساس" };

// Role × permission × scope matrix + per-user overrides (§62).
export default async function PermissionsPage({ searchParams }: { searchParams: SearchParams }) {
  const t = await getT();
  const { bos } = await requirePermission("roles.manage", "all");
  const sp = await readParams(searchParams);
  const { data: roles } = await db().from("roles").select("id, key, name").is("archived_at", null).order("sort_order");
  const role = (roles ?? []).find((r) => r.id === sp.role) ?? (roles ?? [])[0];
  const [matrix, staff, names, { data: overrides }] = await Promise.all([role ? permissionMatrix(role.id) : Promise.resolve(null), listActiveStaff(), userNameMap(), db().from("user_permission_overrides").select("*, permissions(key)").order("created_at", { ascending: false })]);
  const locked = role?.key === "super_admin";
  return (
    <>
      <PageHeader title="الأذونات" breadcrumbs={[{ label: "الإعدادات" }, { label: "الأذونات" }]} />
      <SettingsNav active="permissions" />
      <nav className="bos-tabs" aria-label={t("الأدوار")}>{(roles ?? []).map((r) => <Link key={r.id} href={`/admin/settings/permissions?role=${r.id}`} className={r.id === role?.id ? "active" : undefined}>{r.name}</Link>)}</nav>
      {matrix && role ? (
        <Card title={<Tx vars={{ name: role.name, v: locked ? " — كل الصلاحيات (ثابتة)" : "" }}>{"{name}{v}"}</Tx>} flush>
          <div className="bos-table-scroll">
            <table className="bos-table bos-perm-matrix">
              <thead><tr><th><Tx>الوحدة</Tx></th>{matrix.actions.map((a) => <th key={a}><Tx>{actionLabels[a] ?? a}</Tx></th>)}</tr></thead>
              <tbody>
                {matrix.modules.map((m) => (
                  <tr key={m}>
                    <td dir="ltr" style={{ fontSize: 12 }}>{m}</td>
                    {matrix.actions.map((a) => {
                      const p = matrix.permissions.find((x) => x.module === m && x.action === a);
                      return <td key={a}>{p ? <ScopeCell roleId={role.id} permissionId={p.id} scope={locked ? "all" : p.scope} disabled={locked} /> : null}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
      <Card title="استثناءات المستخدمين">
        {can(bos, "users.manage") ? <OverrideForm users={staff.map((s) => ({ value: s.userId, label: s.name }))} permissions={(matrix?.permissions ?? []).map((p) => ({ value: p.id, label: p.key }))} /> : null}
        {(overrides ?? []).length ? (
          <table className="bos-table" style={{ marginTop: 10 }}>
            <thead><tr><th><Tx>المستخدم</Tx></th><th><Tx>الصلاحية</Tx></th><th><Tx>النوع</Tx></th><th><Tx>النطاق</Tx></th><th><Tx>السبب</Tx></th><th><Tx>التاريخ</Tx></th><th /></tr></thead>
            <tbody>{(overrides ?? []).map((o) => <tr key={`${o.user_id}-${o.permission_id}`}><td>{names.get(o.user_id) ?? "—"}</td><td dir="ltr">{(o.permissions as unknown as { key: string } | null)?.key}</td><td><Tx>{o.effect === "grant" ? "منح" : "منع"}</Tx></td><td><Tx>{o.scope ?? "—"}</Tx></td><td>{o.reason ?? "—"}</td><td>{formatDateTime(o.created_at)}</td><td>{can(bos, "users.manage") ? <RemoveOverrideButton userId={o.user_id} permissionId={o.permission_id} /> : null}</td></tr>)}</tbody>
          </table>
        ) : <EmptyState title="لا توجد استثناءات" />}
      </Card>
    </>
  );
}
