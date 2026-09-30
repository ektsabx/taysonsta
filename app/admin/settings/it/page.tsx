import { Tx } from "@/components/bos/I18n";
import { requirePermission } from "@/lib/bos/auth";
import { db } from "@/lib/bos/db";
import { configTables } from "@/lib/bos/config-tables";
import { listConfigRows } from "@/services/bos/settings-admin";
import { getSetting } from "@/lib/bos/settings";
import { PageHeader, Card } from "@/components/bos/ui";
import { SettingsNav } from "../SettingsNav";
import { ConfigTableEditor } from "../ConfigTableEditor";
import { SettingsForm } from "../SettingsForm";
import { RequirementCell } from "../SettingsControls";
import { settingsLookups } from "../lookups";

// External apps registry, role tool requirements matrix, access approval chains (IT §5–8).
export default async function ItSettingsPage() {
  await requirePermission("apps.manage", "all");
  const [apps, lookups, { data: roles }, { data: reqs }, policies] = await Promise.all([listConfigRows("external_apps"), settingsLookups(), db().from("roles").select("id, key, name").eq("is_client_role", false).is("archived_at", null).order("sort_order"), db().from("role_app_requirements").select("*"), getSetting("approval_policies")]);
  const active = apps.filter((a) => a.is_active);
  return (
    <>
      <PageHeader title="IT والتطبيقات الخارجية" subtitle="النظام يدير من يجب أن يملك أي وصول — لا يخزّن كلمات مرور أو أسرار MFA" breadcrumbs={[{ label: "الإعدادات" }, { label: "IT" }]} />
      <SettingsNav active="it" />
      <Card><ConfigTableEditor tableKey="external_apps" spec={configTables.external_apps} rows={apps} lookups={lookups} defaults={{ requires_mfa: true, is_active: true }} /></Card>
      <Card title="متطلبات الأدوات حسب الدور" flush>
        <div className="bos-table-scroll">
          <table className="bos-table bos-perm-matrix">
            <thead><tr><th><Tx>الدور</Tx></th>{active.map((a) => <th key={String(a.id)} style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", height: 120, whiteSpace: "nowrap" }}>{String(a.name)}</th>)}</tr></thead>
            <tbody>
              {(roles ?? []).map((r) => (
                <tr key={r.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{r.name}</td>
                  {active.map((a) => {
                    const req = (reqs ?? []).find((x) => x.role_id === r.id && x.app_id === a.id);
                    return <td key={String(a.id)}><RequirementCell roleId={r.id} appId={String(a.id)} required={!!req} level={req?.default_access_level ?? null} levels={(a.access_levels as string[]) ?? []} /></td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="bos-faint" style={{ fontSize: 12, padding: 10 }}><Tx>تغيير الدور يضيف التطبيقات المطلوبة الجديدة لقوائم الموظفين عند إعادة توليدها، والتطبيقات غير المطلوبة تُعلَّم للمراجعة ولا تُسحب تلقائياً.</Tx></p>
      </Card>
      <Card title="سلاسل الموافقة على طلبات الوصول">
        <SettingsForm settingKey="approval_policies" value={policies} fields={[{ path: "access_request.steps", label: "تطبيق عادي: الخطوات", type: "list", hint: "manager, role:admin" }, { path: "access_request_sensitive.steps", label: "تطبيق حساس: الخطوات", type: "list", hint: "manager, role:super_admin" }]} />
      </Card>
    </>
  );
}
