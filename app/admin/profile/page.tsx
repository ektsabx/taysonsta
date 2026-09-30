import { getUiPrefs } from "@/lib/bos/i18n/server";
import { UiPreferenceSwitches } from "@/components/bos/UiPreferences";
import { getT } from "@/lib/bos/i18n/server";
import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { requireBosUser } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { db } from "@/lib/bos/db";
import { PageHeader, Card, KeyValues, StatusBadge, Tabs, UserAvatar } from "@/components/bos/ui";
import { ActionForm, SubmitButton } from "@/components/bos/Form";
import { formatDate, formatDateTime } from "@/lib/bos/format";
import { savePreferencesAction } from "./actions";
import { MfaSetup } from "./MfaSetup";

const eventLabels: Record<string, string> = {
  "lead.assigned": "تعيين عميل محتمل", "lead.replied": "رد عميل محتمل", "meeting.upcoming": "اجتماع قريب", "meeting.scheduled": "دعوة اجتماع",
  "activity.reminder_due": "متابعة مستحقة", "task.assigned": "تعيين مهمة", "task.overdue": "مهمة متأخرة", "task.completed": "اكتمال مهمة",
  "deal.updated": "تحديث صفقة", "deal.stage_changed": "تغيير مرحلة صفقة", "deal.won": "صفقة مكسوبة", "deal.lost": "صفقة خاسرة",
  "payment.completed": "دفعة مستلمة", "payment.failed": "فشل دفعة", "invoice.overdue": "فاتورة متأخرة", "project.delayed": "مشروع متأخر",
  "project.completed": "اكتمال مشروع", "project.pm_assigned": "تعيين مدير مشروع", "approval.requested": "طلب موافقة", "approval.decided": "قرار موافقة",
  "chat.client_message": "رسالة عميل", "chat.mentioned": "إشارة في المحادثة", "ticket.created": "تذكرة جديدة", "ticket.assigned": "تعيين تذكرة",
  "ticket.replied": "رد على تذكرة", "ticket.sla_breached": "تجاوز SLA", "attendance.reminder": "تذكير الحضور", "attendance.open_session_detected": "جلسة حضور مفتوحة",
  "attendance.correction_approved": "قبول تصحيح حضور", "attendance.correction_rejected": "رفض تصحيح حضور", "leave.requested": "طلب إجازة", "leave.approved": "قبول إجازة",
  "leave.rejected": "رفض إجازة", "overtime.decided": "قرار عمل إضافي", "commission.approved": "اعتماد عمولة", "commission.eligible": "استحقاق عمولة",
  "commission.paid": "صرف عمولة", "access.granted": "منح وصول", "access.revoked": "سحب وصول", "access.request_approved": "قبول طلب وصول",
  "access.request_rejected": "رفض طلب وصول", "access.expired": "انتهاء وصول", "device.assigned": "تسليم جهاز", "security.mfa_required": "تفعيل 2FA مطلوب",
  "onboarding.started": "بدء تهيئة", "onboarding.completed": "اكتمال تهيئة", "review.submitted": "مراجعة أداء", "employee.lifecycle_changed": "تغيير حالة موظف",
  "client.assigned": "تعيين حساب", "change_request.created": "طلب تغيير", "change_request.approved": "اعتماد طلب تغيير", "file.shared": "مشاركة ملف",
};

export default async function ProfilePage({ searchParams }: { searchParams: SearchParams }) {
  const ui = await getUiPrefs();
  const t = await getT();
  const bos = await requireBosUser();
  const sp = await readParams(searchParams);
  const tab = ["profile", "notifications", "security"].includes(sp.tab ?? "") ? (sp.tab as string) : "profile";
  const emp = bos.employee;
  const [{ data: subs }, { data: prefs }, { data: dept }, { data: mgr }, { data: branch }, { data: lastLogin }] = await Promise.all([
    db().from("notification_subscriptions").select("event_type, channels, user_configurable").eq("is_active", true),
    db().from("notification_preferences").select("*").eq("user_id", bos.userId),
    emp.department_id ? db().from("departments").select("name").eq("id", emp.department_id).maybeSingle() : Promise.resolve({ data: null }),
    emp.manager_id ? db().from("employees").select("full_name").eq("id", emp.manager_id).maybeSingle() : Promise.resolve({ data: null }),
    emp.branch_id ? db().from("branches").select("name, name_en").eq("id", emp.branch_id).maybeSingle() : Promise.resolve({ data: null }),
    // Previous successful sign-in (the current one is the latest row).
    db().from("login_history").select("created_at, method").eq("user_id", bos.userId).eq("success", true).order("created_at", { ascending: false }).range(1, 1).maybeSingle(),
  ]);
  const catalog = new Map<string, { channels: Set<string>; configurable: boolean }>();
  for (const s of subs ?? []) {
    const e = catalog.get(s.event_type) ?? { channels: new Set<string>(), configurable: false };
    for (const c of s.channels) e.channels.add(c);
    e.configurable = e.configurable || s.user_configurable;
    catalog.set(s.event_type, e);
  }
  const prefOf = new Map((prefs ?? []).map((p) => [p.event_type, p]));
  return (
    <>
      <PageHeader title={<span className="bos-row" style={{ gap: 10 }}><UserAvatar name={emp.full_name} size="lg" />{emp.full_name}</span>} subtitle={bos.roleNames.join("، ")} breadcrumbs={[{ label: "ملفي الشخصي" }]} actions={<Link className="admin-btn small secondary" href={`/admin/team/employees/${emp.id}`}><Tx>ملف الموظف الكامل</Tx></Link>} />
      <Tabs tabs={[{ key: "profile", label: "بياناتي" }, { key: "notifications", label: "تفضيلات الإشعارات" }, { key: "security", label: "الأمان" }]} active={tab} baseHref="/admin/profile" />
      {tab === "profile" ? (
        <Card>
          <KeyValues items={[{ label: "البريد", value: <span dir="ltr">{bos.email}</span> }, { label: "المسمى", value: emp.position }, { label: "القسم", value: dept?.name }, { label: "المدير", value: mgr?.full_name }, { label: "تاريخ البدء", value: formatDate(emp.start_date) }, { label: "المنطقة الزمنية", value: <span dir="ltr">{emp.timezone}</span> }, { label: "الفرع", value: ui.locale === "en" && branch?.name_en ? branch.name_en : branch?.name }, { label: "آخر دخول", value: lastLogin ? `${formatDateTime(lastLogin.created_at)}${lastLogin.method === "google" ? " · Google" : ""}` : "—" }, { label: "الحالة", value: <StatusBadge map="employee_lifecycle_status" value={emp.lifecycle_status} /> }]} />
          <p className="bos-faint" style={{ fontSize: 12, marginTop: 10 }}><Tx>لتعديل بياناتك الوظيفية تواصل مع الموارد البشرية.</Tx> <Link className="bos-link" href="/admin/reset-password"><Tx>تغيير كلمة المرور</Tx></Link></p>
        </Card>
      ) : null}
      {tab === "profile" ? (
        <Card title="المظهر واللغة">
          <UiPreferenceSwitches locale={ui.locale} theme={ui.theme} />
          <p className="bos-faint" style={{ fontSize: 12, marginTop: 6 }}><Tx>يُحفظ على حسابك ويُطبّق على كل أجهزتك. الافتراضي من إعدادات الشركة.</Tx></p>
        </Card>
      ) : null}
      {tab === "notifications" ? (
        <Card title="تفضيلات الإشعارات" actions={<Link className="bos-link" href="/admin/communication/notifications"><Tx>الإشعارات</Tx></Link>}>
          <ActionForm action={savePreferencesAction} successMessage="تم الحفظ">
            <div className="bos-table-scroll">
              <table className="bos-table">
                <thead><tr><th><Tx>الحدث</Tx></th><th><Tx>داخل النظام</Tx></th><th><Tx>البريد</Tx></th><th>Push</th></tr></thead>
                <tbody>
                  {[...catalog.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([type, info]) => {
                    const p = prefOf.get(type);
                    const cell = (ch: "in_app" | "email" | "push") =>
                      info.channels.has(ch) ? (
                        info.configurable ? <input type="checkbox" name={`${type}:${ch}`} defaultChecked={p ? p[ch] : ch !== "push"} aria-label={`${type} ${ch}`} /> : <span title={t("إشعار إلزامي")}>🔒</span>
                      ) : <span className="bos-faint">—</span>;
                    return (
                      <tr key={type}>
                        <td><Tx>{eventLabels[type] ?? type}</Tx><span className="cell-sub" dir="ltr"><Tx>{type}</Tx></span></td>
                        <td>{cell("in_app")}</td>
                        <td>{cell("email")}</td>
                        <td>{cell("push")}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="bos-faint" style={{ fontSize: 12 }}><Tx>🔒 = إشعار إلزامي (مثل طلبات الموافقة) لا يمكن إيقافه. البريد والـ Push يعملان عند تفعيل التكاملات.</Tx></p>
            <div className="bos-form-actions"><SubmitButton label="حفظ التفضيلات" /></div>
          </ActionForm>
        </Card>
      ) : null}
      {tab === "security" ? (
        <Card title="التحقق بخطوتين (2FA)">
          <MfaSetup enabled={emp.mfa_status === "enabled"} />
        </Card>
      ) : null}
    </>
  );
}
