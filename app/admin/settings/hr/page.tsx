import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireBosUser } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { getSetting } from "@/lib/bos/settings";
import { configTables } from "@/lib/bos/config-tables";
import { listConfigRows } from "@/services/bos/settings-admin";
import { PageHeader, Card, Tabs } from "@/components/bos/ui";
import { SettingsNav } from "../SettingsNav";
import { SettingsForm } from "../SettingsForm";
import { ConfigTableEditor } from "../ConfigTableEditor";
import { settingsLookups } from "../lookups";

const stepsHint = "بالترتيب، مثال: manager, role:hr, role:finance — أو user:<id>";

// HR Settings (docs/bos/28 §5): leave types, schedules/shifts, holidays,
// salary components, overtime / attendance / payroll rules, approval rules,
// employee types (categories), departments, teams, document & request types.
export default async function HrSettingsPage({ searchParams }: { searchParams: SearchParams }) {
  const bos = await requireBosUser();
  const all = (k: Parameters<typeof bos.permissions.get>[0]) => bos.isSuperAdmin || bos.permissions.get(k) === "all";
  const settings = all("settings.manage");
  const hr = settings || all("attendance.manage");
  const payroll = settings || all("payroll.manage");
  if (!hr && !payroll) redirect("/admin/forbidden");
  const sp = await readParams(searchParams);
  const tabs = [
    { key: "organization", label: "الهيكل والتصنيفات", hidden: !hr },
    { key: "attendance", label: "قواعد الحضور", hidden: !hr },
    { key: "leave", label: "أنواع الإجازات", hidden: !hr },
    { key: "payroll", label: "الرواتب والعمل الإضافي", hidden: !payroll },
    { key: "documents", label: "المستندات والطلبات", hidden: !hr },
    { key: "approvals", label: "قواعد الموافقة", hidden: !settings },
    { key: "permissions", label: "صلاحيات الموارد البشرية", hidden: !settings },
  ];
  const tab = tabs.some((t) => t.key === sp.s && !t.hidden) ? (sp.s as string) : (tabs.find((t) => !t.hidden)?.key ?? "organization");
  const lookups = await settingsLookups();
  const rows = async (k: string) => listConfigRows(k);

  let body: React.ReactNode = null;
  if (tab === "organization") {
    const [departments, teams, categories] = await Promise.all([rows("departments"), rows("teams"), rows("employee_categories")]);
    body = (
      <div className="bos-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: 12 }}>
        <Card><ConfigTableEditor tableKey="departments" spec={configTables.departments} rows={departments} lookups={lookups} /></Card>
        <Card><ConfigTableEditor tableKey="teams" spec={configTables.teams} rows={teams} lookups={lookups} /></Card>
        <Card><ConfigTableEditor tableKey="employee_categories" spec={configTables.employee_categories} rows={categories} lookups={lookups} defaults={{ is_active: true }} /></Card>
        <Card title="أنواع التوظيف"><p className="bos-faint" style={{ fontSize: 13 }}><Tx>دوام كامل، دوام جزئي، متعاقد (Contract)، متدرب، مستقل — قائمة ثابتة في النظام. استخدم «تصنيفات الموظفين» لأي تصنيف إضافي (مثل: إداري، ميداني، إدارة عليا).</Tx></p></Card>
      </div>
    );
  } else if (tab === "attendance") {
    const policy = await getSetting("attendance_policy");
    body = (
      <>
        <Card title="الجداول والورديات والعطلات">
          <p style={{ fontSize: 13 }}><Tx>جداول العمل (بساعات لكل يوم)، الورديات، تعيين الجداول على مستوى الشركة/القسم/الفريق/الموظف، العطلات الرسمية وعطلات الشركة وأيام الراحة المخصصة تُدار من</Tx> <Link className="bos-link" href="/admin/team/schedules/list"><Tx>الفريق ← الجداول</Tx></Link>.</p>
        </Card>
        <Card title="قواعد الحضور">
          <SettingsForm settingKey="attendance_policy" value={policy as unknown as Record<string, unknown>} fields={[
            { path: "overtime_basis", label: "طريقة حساب الإضافي", type: "select", options: [{ value: "after_schedule_end", label: "الخروج بعد نهاية الدوام المجدول" }, { value: "worked_beyond_expected", label: "إجمالي العمل فوق الساعات المتوقعة" }] },
            { path: "forgotten_clock_out.auto_close_at_schedule_end", label: "نسيان الخروج: إغلاق تلقائي عند نهاية الدوام", type: "boolean" },
            { path: "forgotten_clock_out.require_employee_correction", label: "نسيان الخروج: يتطلب تصحيحاً من الموظف", type: "boolean" },
            { path: "forgotten_clock_out.notify_employee", label: "نسيان الخروج: إشعار الموظف", type: "boolean" },
            { path: "forgotten_clock_out.notify_manager", label: "نسيان الخروج: إشعار المدير", type: "boolean" },
            { path: "forgotten_clock_out.mark_requires_review", label: "نسيان الخروج: وضع علامة للمراجعة", type: "boolean" },
            { path: "auto_close_after_minutes", label: "الكشف بعد نهاية الدوام بـ (دقائق)", type: "number", min: 0 },
            { path: "expected_includes_break", label: "الوقت المتوقع يشمل الاستراحة", type: "boolean" },
            { path: "deduct_scheduled_break", label: "خصم الاستراحة المجدولة إن لم تُسجل", type: "boolean" },
            { path: "reminder_after_minutes", label: "تذكير عدم بدء العمل بعد (دقائق من السماح)", type: "number", min: 0 },
            { path: "lock_before_date", label: "قفل التعديلات قبل تاريخ (بعد الرواتب)", type: "date" },
          ]} />
        </Card>
      </>
    );
  } else if (tab === "leave") {
    const leaveTypes = await rows("leave_types");
    body = <Card><ConfigTableEditor tableKey="leave_types" spec={configTables.leave_types} rows={leaveTypes} lookups={lookups} defaults={{ is_paid: true, requires_approval: true, is_active: true }} /></Card>;
  } else if (tab === "payroll") {
    const [components, policy] = await Promise.all([rows("salary_components"), getSetting("payroll_policy")]);
    body = (
      <>
        <Card><ConfigTableEditor tableKey="salary_components" spec={configTables.salary_components} rows={components} lookups={lookups} defaults={{ kind: "earning", category: "allowance", calc_type: "fixed", taxable: true, is_active: true }} /></Card>
        <Card title="قواعد الرواتب والعمل الإضافي والاستقطاعات">
          <SettingsForm settingKey="payroll_policy" value={policy as unknown as Record<string, unknown>} fields={[
            { path: "working_days_basis", label: "أساس الأجر اليومي", type: "select", options: [{ value: "schedule", label: "أيام العمل المجدولة في الشهر" }, { value: "fixed_30", label: "30 يوماً ثابتة" }] },
            { path: "absence_deduction", label: "خصم أيام الغياب", type: "boolean" },
            { path: "unpaid_leave_deduction", label: "خصم الإجازات بدون أجر", type: "boolean" },
            { path: "late_deduction", label: "خصم التأخير", type: "select", options: [{ value: "none", label: "لا يوجد" }, { value: "per_minute", label: "بالدقيقة (بعد السماح الشهري)" }] },
            { path: "late_grace_minutes_per_month", label: "سماح التأخير الشهري (دقائق)", type: "number", min: 0 },
            { path: "include_commissions", label: "صرف العمولات المعتمدة مع الراتب", type: "boolean" },
            { path: "include_reimbursements", label: "استرداد المصروفات المعتمدة مع الراتب", type: "boolean" },
            { path: "overtime.source", label: "مصدر العمل الإضافي", type: "select", options: [{ value: "approved_requests", label: "طلبات الإضافي المعتمدة" }, { value: "attendance", label: "دقائق الإضافي في الحضور" }] },
            { path: "overtime.standard_monthly_hours", label: "ساعات العمل الشهرية القياسية", type: "number", min: 1 },
            { path: "overtime.workday_multiplier", label: "معامل الإضافي — يوم عمل", type: "number", min: 0 },
            { path: "overtime.day_off_multiplier", label: "معامل الإضافي — يوم راحة", type: "number", min: 0 },
            { path: "overtime.holiday_multiplier", label: "معامل الإضافي — عطلة رسمية", type: "number", min: 0 },
            { path: "insurance.enabled", label: "خصم التأمينات الاجتماعية", type: "boolean" },
            { path: "insurance.employee_percent", label: "نسبة حصة الموظف %", type: "number", min: 0, max: 100 },
            { path: "insurance.basis", label: "أساس التأمينات", type: "select", options: [{ value: "basic", label: "الأساسي" }, { value: "gross", label: "الإجمالي" }] },
            { path: "insurance.cap_monthly", label: "الحد الأقصى الشهري للتأمينات", type: "number", min: 0 },
            { path: "tax.enabled", label: "خصم ضريبة كسب العمل", type: "boolean" },
            { path: "tax.exemption_monthly", label: "الإعفاء الشهري", type: "number", min: 0 },
            { path: "tax.brackets", label: "الشرائح الضريبية الشهرية (تصاعدية)", type: "json", hint: 'مثال: [{"up_to": 5000, "rate": 0}, {"up_to": 10000, "rate": 10}, {"up_to": null, "rate": 20}] — حسب قانون الدولة' },
            { path: "salary_expense_category", label: "فئة مصروف الرواتب في المالية", type: "text" },
          ]} />
        </Card>
      </>
    );
  } else if (tab === "documents") {
    const [docTypes, requestTypes] = await Promise.all([rows("document_types"), rows("hr_request_types")]);
    body = (
      <>
        <Card><ConfigTableEditor tableKey="document_types" spec={configTables.document_types} rows={docTypes} lookups={lookups} defaults={{ category: "other", alert_days_before: 30, employee_can_upload: true, visible_to_employee: true, is_active: true }} /></Card>
        <Card><ConfigTableEditor tableKey="hr_request_types" spec={configTables.hr_request_types} rows={requestTypes} lookups={lookups} defaults={{ approval_steps: ["manager"], is_active: true }} /></Card>
      </>
    );
  } else if (tab === "approvals") {
    const policies = await getSetting("approval_policies");
    body = (
      <Card title="قواعد الموافقة للموارد البشرية">
        <SettingsForm settingKey="approval_policies" value={policies as unknown as Record<string, unknown>} fields={[
          { path: "leave.required", label: "الإجازات تحتاج موافقة", type: "boolean" },
          { path: "leave.approver", label: "جهة موافقة الإجازات (الافتراضي — لكل نوع قواعده)", type: "text", hint: "manager أو role:hr" },
          { path: "overtime.required", label: "العمل الإضافي يحتاج موافقة", type: "boolean" },
          { path: "overtime.approver", label: "جهة موافقة العمل الإضافي", type: "text" },
          { path: "attendance_correction.approver", label: "جهة موافقة تصحيح الحضور", type: "text" },
          { path: "employee_expense.steps", label: "مصروفات الموظفين", type: "list", hint: stepsHint },
          { path: "advance.steps", label: "سلف الرواتب", type: "list", hint: stepsHint },
          { path: "loan.steps", label: "قروض الموظفين", type: "list", hint: stepsHint },
          { path: "bonus.steps", label: "المكافآت", type: "list", hint: stepsHint },
          { path: "salary_adjustment.steps", label: "تعديل الرواتب والترقيات", type: "list", hint: stepsHint },
          { path: "payroll.steps", label: "اعتماد دورات الرواتب", type: "list", hint: stepsHint },
          { path: "job_offer.required", label: "عروض العمل تحتاج اعتماداً داخلياً قبل الإرسال", type: "boolean" },
          { path: "job_offer.steps", label: "اعتماد عروض العمل", type: "list", hint: stepsHint },
        ]} />
        <p className="bos-faint" style={{ fontSize: 12 }}><Tx>طلبات الموظفين الأخرى لها خطوات موافقة لكل نوع في «المستندات والطلبات».</Tx></p>
      </Card>
    );
  } else if (tab === "permissions") {
    body = (
      <Card title="صلاحيات الموارد البشرية">
        <ul style={{ fontSize: 13, lineHeight: 2 }}>
          <li><strong>HR</strong> <Tx>(مدير الموارد البشرية): كل الموارد البشرية بما فيها الرواتب (تحضير) والبيانات الحساسة.</Tx></li>
          <li><strong>HR Staff</strong><Tx>: الموظفون والحضور والإجازات والمستندات والطلبات والتوظيف — بدون الرواتب والبيانات الحساسة.</Tx></li>
          <li><strong>Finance</strong><Tx>: اعتماد وصرف الرواتب، المكافآت، السلف، مصروفات الموظفين.</Tx></li>
          <li><strong><Tx>المدير المباشر</Tx></strong><Tx>: يرى فريقه ويوافق على الإجازات والإضافي والمصروفات والطلبات ويكتب مراجعات الأداء (من الهيكل الإداري).</Tx></li>
          <li><strong><Tx>الموظف</Tx></strong><Tx>: الخدمة الذاتية فقط (ملفي).</Tx></li>
        </ul>
        <p style={{ fontSize: 13 }}><Tx>عدّل الأدوار والصلاحيات من</Tx> <Link className="bos-link" href="/admin/settings/roles"><Tx>الأدوار</Tx></Link> <Tx>و</Tx><Link className="bos-link" href="/admin/settings/permissions"><Tx>الأذونات</Tx></Link> <Tx>(الوحدات: employees, attendance, leave, overtime, payroll, recruitment, hr_documents, hr_requests, performance, kpis, onboarding).</Tx></p>
      </Card>
    );
  }

  return (
    <>
      <PageHeader title="إعدادات الموارد البشرية" breadcrumbs={[{ label: "الإعدادات" }, { label: "الموارد البشرية" }]} />
      <SettingsNav active="hr" />
      <Tabs tabs={tabs} active={tab} baseHref="/admin/settings/hr" param="s" />
      {body}
    </>
  );
}
