import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { requirePermission } from "@/lib/bos/auth";
import { db } from "@/lib/bos/db";
import { PageHeader, Card, StatusBadge } from "@/components/bos/ui";
import { ArchiveRoleButton, CloneRoleButton, RoleForm } from "../SettingsControls";

export default async function RolesPage() {
  await requirePermission("roles.manage", "all");
  const [{ data: roles }, { data: counts }, { data: perms }] = await Promise.all([db().from("roles").select("*").order("sort_order"), db().from("user_roles").select("role_id"), db().from("role_permissions").select("role_id")]);
  const users = new Map<string, number>();
  for (const c of counts ?? []) users.set(c.role_id, (users.get(c.role_id) ?? 0) + 1);
  const pc = new Map<string, number>();
  for (const p of perms ?? []) pc.set(p.role_id, (pc.get(p.role_id) ?? 0) + 1);
  return (
    <>
      <PageHeader title="الأدوار" actions={<RoleForm id={null} label="+ دور" />} />
      <Card flush>
        <BosTable className="bos-table responsive">
          <thead><tr><th><Tx>الدور</Tx></th><th><Tx>المفتاح</Tx></th><th><Tx>المستخدمون</Tx></th><th><Tx>الصلاحيات</Tx></th><th /></tr></thead>
          <tbody>
            {(roles ?? []).map((r) => (
              <tr key={r.id} style={r.archived_at ? { opacity: 0.55 } : undefined}>
                <td className="cell-primary">{r.name}{r.is_system ? <StatusBadge tone="neutral" label="نظام" /> : null}{r.is_client_role ? <StatusBadge tone="accent" label="عميل" /> : null}{r.description ? <span className="cell-sub"><Tx>{r.description}</Tx></span> : null}</td>
                <td dir="ltr">{r.key}</td>
                <td>{users.get(r.id) ?? 0}</td>
                <td><Link className="bos-link" href={`/admin/settings/permissions?role=${r.id}`}><Tx>{r.key === "super_admin" ? "الكل" : pc.get(r.id) ?? 0}</Tx></Link></td>
                <td className="col-actions"><RoleForm id={r.id} label="تعديل" initial={{ key: r.key, name: r.name, description: r.description, sort_order: r.sort_order, is_system: r.is_system }} /><CloneRoleButton id={r.id} name={r.name} />{!r.is_system ? <ArchiveRoleButton id={r.id} archived={!!r.archived_at} /> : null}</td>
              </tr>
            ))}
          </tbody>
        </BosTable>
      </Card>
    </>
  );
}
