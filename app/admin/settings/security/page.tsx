import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { requirePermission } from "@/lib/bos/auth";
import { db } from "@/lib/bos/db";
import { getSetting } from "@/lib/bos/settings";
import { listRoles } from "@/services/bos/shared";
import { PageHeader, Card, StatusBadge } from "@/components/bos/ui";
import { formatDateTime } from "@/lib/bos/format";
import { SettingsNav } from "../SettingsNav";
import { SettingsForm } from "../SettingsForm";
import { PageRulesEditor } from "../users/UserControls";

export default async function SecuritySettingsPage() {
  await requirePermission("settings.manage", "all");
  const [security, pageAccess, roles, { data: failed }, { data: mfa }] = await Promise.all([
    getSetting("security"), getSetting("page_access"), listRoles(),
    db().from("login_history").select("email, ip, failure_reason, created_at").eq("success", false).order("created_at", { ascending: false }).limit(30),
    db().from("employees").select("mfa_status").is("archived_at", null),
  ]);
  const enabled = (mfa ?? []).filter((m) => m.mfa_status === "enabled").length;
  return (
    <>
      <PageHeader title="الأمان" subtitle="تغييرات هذا القسم تُبلَّغ للمديرين العامين وتُسجّل في التدقيق" breadcrumbs={[{ label: "الإعدادات" }, { label: "الأمان" }]} />
      <SettingsNav active="security" />
      <Card title="السياسات">
        <SettingsForm settingKey="security" value={security} fields={[
          { path: "password_min_length", label: "الحد الأدنى لطول كلمة المرور", type: "number", min: 8, max: 128 },
          { path: "session_timeout_minutes", label: "انتهاء الجلسة (دقائق)", type: "number", min: 15 },
          { path: "login_max_attempts", label: "محاولات الدخول المسموحة", type: "number", min: 3, max: 50 },
          { path: "login_window_minutes", label: "نافذة المحاولات (دقائق)", type: "number", min: 1 },
          { path: "require_2fa_role_keys", label: "أدوار يُلزم لها 2FA", type: "multiselect", options: roles.filter((r) => !r.is_client_role).map((r) => ({ value: r.key, label: r.name })) },
        ]} />
      </Card>
      <Card title="الدخول عبر Google">
        <SettingsForm settingKey="security" value={security} fields={[
          { path: "google_sign_in", label: "تفعيل الدخول عبر Google", type: "boolean", hint: "للموظفين الحاليين النشطين فقط — لا يُنشئ حسابات جديدة. يتطلب تفعيل مزود Google في Supabase Auth بمعرّف OAuth الخاص بالشركة." },
          { path: "google_allowed_domains", label: "النطاقات المسموحة (فارغ = أي نطاق لموظف موجود)", type: "list", hint: "مثال: taysonsta.com" },
        ]} />
      </Card>
      <Card title="قيود الصفحات حسب الدور">
        <p className="bos-faint" style={{ fontSize: 12.5, marginBottom: 10 }}><Tx>قيد إضافي فوق صلاحيات الوحدات: المسار يظهر ويُفتح فقط للأدوار المحددة. المدير العام يرى كل شيء دائماً.</Tx></p>
        <PageRulesEditor rules={pageAccess.rules} roles={roles.filter((r) => !r.is_client_role).map((r) => ({ value: r.key, label: r.name }))} />
      </Card>
      <Card title={<Tx vars={{ enabled, v: (mfa ?? []).length }}>{"التزام 2FA: {enabled} / {v} موظف"}</Tx>}>
        <Link className="bos-link" href="/admin/team/access?view=mfa"><Tx>عرض غير الملتزمين</Tx></Link>
      </Card>
      <Card title="آخر محاولات الدخول الفاشلة" flush>
        <table className="bos-table responsive">
          <thead><tr><th><Tx>الوقت</Tx></th><th><Tx>البريد</Tx></th><th><Tx>السبب</Tx></th><th>IP</th></tr></thead>
          <tbody>{(failed ?? []).map((f, i) => <tr key={i}><td>{formatDateTime(f.created_at)}</td><td dir="ltr">{f.email}</td><td><StatusBadge tone="danger" label={f.failure_reason ?? "—"} /></td><td dir="ltr">{f.ip ? String(f.ip) : "—"}</td></tr>)}</tbody>
        </table>
      </Card>
    </>
  );
}
