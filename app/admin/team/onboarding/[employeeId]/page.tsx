import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission, can } from "@/lib/bos/auth";
import { db } from "@/lib/bos/db";
import { canSeeEmployee } from "@/services/bos/team-scope";
import { listEmployeeChecklists } from "@/services/bos/onboarding";
import { refreshEmployeeOnboardingSafe } from "@/services/bos/employees";
import { userNameMap } from "@/services/bos/shared";
import { PageHeader, Card, EmptyState, StatusBadge } from "@/components/bos/ui";
import { ChecklistView } from "../../TeamViews";
import { LoginControls, RefreshOnboardingButton } from "../../TeamControls";

// Employee onboarding checklist (IT §15): sections, confirmations, linked actions.
export default async function EmployeeOnboardingPage({ params }: { params: Promise<{ employeeId: string }> }) {
  const { bos } = await requirePermission("onboarding.read");
  const { employeeId } = await params;
  const { data: emp } = await db().from("employees").select("id, user_id, full_name, position, lifecycle_status, manager_id").eq("id", employeeId).maybeSingle();
  if (!emp) notFound();
  const isSelf = emp.user_id === bos.userId;
  if (!isSelf && !(await canSeeEmployee(bos, "onboarding.read", emp))) notFound();
  await refreshEmployeeOnboardingSafe(employeeId, null);
  const [checklists, names] = await Promise.all([listEmployeeChecklists(employeeId), userNameMap()]);
  const canManage = can(bos, "onboarding.update") || can(bos, "onboarding.manage");
  return (
    <>
      <PageHeader
        title={<Tx vars={{ full_name: emp.full_name }}>{"تهيئة: {full_name}"}</Tx>}
        subtitle={<span className="bos-row" style={{ gap: 8 }}><StatusBadge map="employee_lifecycle_status" value={emp.lifecycle_status} />{emp.position ?? ""}</span>}
        breadcrumbs={[{ label: "الفريق" }, { label: "التهيئة", href: "/admin/team/onboarding" }, { label: emp.full_name }]}
        actions={
          <>
            <RefreshOnboardingButton employeeId={employeeId} />
            {!emp.user_id && can(bos, "employees.manage") ? <LoginControls employeeId={employeeId} hasLogin={false} disabled={false} /> : null}
            <Link className="admin-btn small secondary" href={`/admin/team/employees/${employeeId}?tab=access`}><Tx>الصلاحيات</Tx></Link>
            <Link className="admin-btn small secondary" href={`/admin/team/employees/${employeeId}?tab=devices`}><Tx>الأجهزة</Tx></Link>
          </>
        }
      />
      {checklists.length ? checklists.map((cl) => (
        <Card key={cl.id} title={cl.template_key === "employee_offboarding" ? "إنهاء الخدمة (مستنتج من المواصفات — بانتظار التأكيد)" : "قائمة التهيئة"}>
          <ChecklistView
            employeeId={employeeId}
            checklist={cl}
            names={names}
            canManage={canManage}
            links={{
              bos_account: { href: `/admin/team/employees/${employeeId}`, label: "إنشاء حساب الدخول" },
              company_email: { href: `/admin/team/employees/${employeeId}?tab=access`, label: "حسابات الشركة" },
              required_access_active: { href: `/admin/team/employees/${employeeId}?tab=access`, label: "ملف الصلاحيات" },
              role_assigned: { href: `/admin/team/employees/${employeeId}/edit`, label: "الأدوار" },
              manager_assigned: { href: `/admin/team/employees/${employeeId}/edit`, label: "تعيين المدير" },
              team_assigned: { href: `/admin/team/employees/${employeeId}/edit`, label: "تعيين الفريق" },
              device_assigned: { href: "/admin/team/devices", label: "تسليم جهاز" },
              device_received: { href: `/admin/team/employees/${employeeId}?tab=devices`, label: "تأكيد الاستلام" },
              kpis_assigned: { href: "/admin/team/kpis?view=assignments", label: "تخصيص المؤشرات" },
              manager_meeting: { href: "/admin/communication/meetings/new", label: "جدولة اجتماع" },
              mfa_enabled: { href: `/admin/team/employees/${employeeId}?tab=access`, label: "حالة 2FA" },
              access_revoked: { href: `/admin/team/employees/${employeeId}?tab=access`, label: "سحب الصلاحيات" },
              accounts_suspended: { href: `/admin/team/employees/${employeeId}?tab=access`, label: "حسابات الشركة" },
              devices_returned: { href: `/admin/team/employees/${employeeId}?tab=devices`, label: "الأجهزة" },
            }}
          />
          <p className="bos-faint" style={{ fontSize: 12, marginTop: 10 }}><Tx>البنود «التلقائية» تكتمل من بيانات النظام. التأكيدات الثلاثة (الموظف، المدير، الإدارة) متاحة بعد إكمال باقي البنود المطلوبة، وعند اكتمالها يصبح الموظف «نشطاً».</Tx></p>
        </Card>
      )) : <EmptyState title="لا توجد قائمة تهيئة لهذا الموظف" />}
    </>
  );
}
