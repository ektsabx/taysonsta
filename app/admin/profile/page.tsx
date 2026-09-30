import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { requireBosUser } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { db } from "@/lib/bos/db";
import { PageHeader, Card, KeyValues, StatusBadge, Tabs, UserAvatar } from "@/components/bos/ui";
import { formatDate, formatDateTime } from "@/lib/bos/format";
import { MfaSetup } from "./MfaSetup";
import { syncBosMfaStatus } from "@/services/bos/it-access";
import { getUiPrefs } from "@/lib/bos/i18n/server";

export default async function ProfilePage({ searchParams }: { searchParams: SearchParams }) {
  const ui = await getUiPrefs();
  const bos = await requireBosUser();
  const sp = await readParams(searchParams);
  const tab = sp.tab === "security" ? "security" : "profile";
  const emp = bos.employee;
  const [{ data: dept }, { data: mgr }, { data: branch }, { data: lastLogin }, mfaStatus] = await Promise.all([
    emp.department_id ? db().from("departments").select("name").eq("id", emp.department_id).maybeSingle() : Promise.resolve({ data: null }),
    emp.manager_id ? db().from("employees").select("full_name").eq("id", emp.manager_id).maybeSingle() : Promise.resolve({ data: null }),
    emp.branch_id ? db().from("branches").select("name, name_en").eq("id", emp.branch_id).maybeSingle() : Promise.resolve({ data: null }),
    // Previous successful sign-in (the current one is the latest row).
    db().from("login_history").select("created_at, method").eq("user_id", bos.userId).eq("success", true).order("created_at", { ascending: false }).range(1, 1).maybeSingle(),
    // Real 2FA state from the auth provider, not just the stored flag.
    tab === "security" ? syncBosMfaStatus(emp.id).catch(() => emp.mfa_status) : Promise.resolve(emp.mfa_status),
  ]);
  return (
    <>
      <PageHeader title={<span className="bos-row" style={{ gap: 10 }}><UserAvatar name={emp.full_name} size="lg" />{emp.full_name}</span>} subtitle={bos.roleNames.join("، ")} actions={<Link className="admin-btn small secondary" href={`/admin/team/employees/${emp.id}`}><Tx>ملف الموظف الكامل</Tx></Link>} />
      <Tabs tabs={[{ key: "profile", label: "بياناتي" }, { key: "security", label: "الأمان" }]} active={tab} baseHref="/admin/profile" />
      {tab === "profile" ? (
        <Card>
          <KeyValues items={[{ label: "البريد", value: <span dir="ltr">{bos.email}</span> }, { label: "المسمى", value: emp.position }, { label: "القسم", value: dept?.name }, { label: "المدير", value: mgr?.full_name }, { label: "تاريخ البدء", value: formatDate(emp.start_date) }, { label: "المنطقة الزمنية", value: <span dir="ltr">{emp.timezone}</span> }, { label: "الفرع", value: ui.locale === "en" && branch?.name_en ? branch.name_en : branch?.name }, { label: "آخر دخول", value: lastLogin ? `${formatDateTime(lastLogin.created_at)}${lastLogin.method === "google" ? " · Google" : ""}` : "—" }, { label: "الحالة", value: <StatusBadge map="employee_lifecycle_status" value={emp.lifecycle_status} /> }]} />
          <p className="bos-faint" style={{ fontSize: 12, marginTop: 10 }}><Tx>البيانات الوظيفية للعرض فقط وتُعدَّل من الموارد البشرية. لتغيير كلمة المرور أو استعادة الحساب اطلب رابط إعادة التعيين من مسؤول النظام.</Tx></p>
        </Card>
      ) : null}
      {tab === "security" ? (
        <Card title="تطبيق المصادقة (التحقق بخطوتين)">
          <MfaSetup status={mfaStatus ?? "not_configured"} />
        </Card>
      ) : null}
    </>
  );
}
