import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { requirePermission } from "@/lib/bos/auth";
import { getSetting } from "@/lib/bos/settings";
import { configTables } from "@/lib/bos/config-tables";
import { listConfigRows } from "@/services/bos/settings-admin";
import { listCurrencies } from "@/services/bos/shared";
import { PageHeader, Card } from "@/components/bos/ui";
import { SettingsNav } from "../SettingsNav";
import { SettingsForm } from "../SettingsForm";
import { ConfigTableEditor } from "../ConfigTableEditor";
import { settingsLookups } from "../lookups";
import { BrandUploader } from "../CompanyControls";

const approverHint = "manager | role:<key> | user:<id>";

export default async function CompanySettingsPage() {
  await requirePermission("settings.manage", "all");
  const [company, sales, delivery, completion, finance, policies, contracts, currencies, lookups, departments, teams, sla, expCats] = await Promise.all([
    getSetting("company"), getSetting("sales"), getSetting("delivery"), getSetting("project_completion"), getSetting("finance"), getSetting("approval_policies"), getSetting("contracts"), listCurrencies(), settingsLookups(),
    listConfigRows("departments"), listConfigRows("teams"), listConfigRows("sla_policies"), listConfigRows("expense_categories"),
  ]);
  const curOpts = currencies.map((c) => ({ value: c, label: c }));
  const ap = (k: string) => [{ path: `${k}.required`, label: `${k}: تتطلب موافقة`, type: "boolean" as const }, { path: `${k}.approver`, label: `${k}: الموافِق`, type: "text" as const, hint: approverHint }];
  return (
    <>
      <PageHeader title="إعدادات الشركة" breadcrumbs={[{ label: "الإعدادات" }, { label: "الشركة" }]} actions={<span className="bos-row" style={{ gap: 6 }}><Link className="admin-btn small secondary" href="/admin/settings/branches"><Tx>الفروع</Tx></Link><Link className="admin-btn small secondary" href="/admin/settings/dashboards"><Tx>تخطيطات لوحات التحكم</Tx></Link></span>} />
      <SettingsNav active="company" />
      <Card title="الهوية البصرية">
        <div className="bos-row" style={{ gap: 24, flexWrap: "wrap" }}>
          <div><div className="bos-kv-label"><Tx>الشعار</Tx></div><BrandUploader kind="logo" current={!!company.logo_path} /></div>
          <div><div className="bos-kv-label"><Tx>الأيقونة</Tx></div><BrandUploader kind="icon" current={!!company.icon_path} /></div>
        </div>
      </Card>
      <Card title="بيانات الشركة">
        <SettingsForm settingKey="company" value={company as unknown as Record<string, unknown>} fields={[
          { path: "name", label: "اسم الشركة", type: "text" }, { path: "legal_name", label: "الاسم القانوني", type: "text" }, { path: "trade_name", label: "الاسم التجاري", type: "text" },
          { path: "commercial_registration", label: "رقم السجل التجاري", type: "text" }, { path: "tax_id", label: "الرقم الضريبي", type: "text" },
          { path: "website", label: "الموقع الإلكتروني", type: "text" }, { path: "contact_email", label: "البريد الرسمي", type: "text" }, { path: "contact_phone", label: "الهاتف", type: "text" }, { path: "email_domain", label: "نطاق البريد الرسمي", type: "text" },
          { path: "address", label: "العنوان", type: "text" }, { path: "country", label: "الدولة", type: "text" }, { path: "region", label: "المحافظة / المنطقة", type: "text" }, { path: "city", label: "المدينة", type: "text" }, { path: "postal_code", label: "الرمز البريدي", type: "text" },
          { path: "description", label: "وصف الشركة", type: "text" },
          { path: "brand_primary", label: "اللون الأساسي (#RRGGBB)", type: "text" }, { path: "brand_accent", label: "اللون الثانوي (#RRGGBB)", type: "text" },
        ]} />
      </Card>
      <Card title="الإعدادات الإقليمية واللغة">
        <SettingsForm settingKey="company" value={company as unknown as Record<string, unknown>} fields={[
          { path: "base_currency", label: "العملة الافتراضية", type: "select", options: curOpts, hint: "المعاملات السابقة تحتفظ بعملتها الأصلية — تغيير الافتراضية لا يغيّرها" },
          { path: "timezone", label: "المنطقة الزمنية الافتراضية", type: "text", hint: "IANA مثل Africa/Cairo — لكل فرع منطقته من صفحة الفروع" },
          { path: "enabled_languages", label: "اللغات المفعّلة", type: "multiselect", options: [{ value: "ar", label: "العربية" }, { value: "en", label: "English" }] },
          { path: "default_language", label: "اللغة الافتراضية", type: "select", options: [{ value: "ar", label: "العربية" }, { value: "en", label: "English" }] },
          { path: "default_theme", label: "الوضع الافتراضي", type: "select", options: [{ value: "dark", label: "داكن" }, { value: "light", label: "فاتح" }, { value: "system", label: "حسب الجهاز" }] },
          { path: "date_format", label: "تنسيق التاريخ", type: "select", options: [{ value: "d MMM yyyy", label: "28 Sep 2026" }, { value: "dd/MM/yyyy", label: "28/09/2026" }, { value: "MM/dd/yyyy", label: "09/28/2026" }, { value: "yyyy-MM-dd", label: "2026-09-28" }] },
          { path: "time_format", label: "تنسيق الوقت", type: "select", options: [{ value: "24h", label: "24 ساعة" }, { value: "12h", label: "12 ساعة (ص/م)" }] },
          { path: "number_locale", label: "تنسيق الأرقام والمبالغ", type: "select", options: [{ value: "en-US", label: "1,234.56" }, { value: "ar-EG", label: "١٬٢٣٤٫٥٦ (عربي)" }, { value: "ar-SA", label: "١٬٢٣٤٫٥٦ (السعودية)" }] },
          { path: "week_start", label: "بداية الأسبوع", type: "select", options: [{ value: "6", label: "السبت" }, { value: "0", label: "الأحد" }, { value: "1", label: "الإثنين" }] },
        ]} />
        <p className="bos-faint" style={{ fontSize: 12 }}><Tx>أيام ومواعيد العمل والعطلات مصدرها الوحيد:</Tx> <Link className="bos-link" href="/admin/team/schedules/list"><Tx>الفريق ← الجداول</Tx></Link> <Tx>و</Tx><Link className="bos-link" href="/admin/team/schedules/holidays"><Tx>العطلات</Tx></Link> <Tx>(لا تكرار هنا).</Tx></p>
      </Card>
      <Card title="حسابات التواصل الاجتماعي">
        <SettingsForm settingKey="company" value={company as unknown as Record<string, unknown>} fields={[
          { path: "social.facebook", label: "Facebook", type: "text" }, { path: "social.instagram", label: "Instagram", type: "text" }, { path: "social.linkedin", label: "LinkedIn", type: "text" },
          { path: "social.x", label: "X / Twitter", type: "text" }, { path: "social.youtube", label: "YouTube", type: "text" }, { path: "social.tiktok", label: "TikTok", type: "text" },
          { path: "social.snapchat", label: "Snapchat", type: "text" }, { path: "social.threads", label: "Threads", type: "text" }, { path: "social.telegram", label: "Telegram", type: "text" }, { path: "social.whatsapp", label: "WhatsApp", type: "text" },
        ]} />
      </Card>
      <div className="bos-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 12 }}>
        <Card><ConfigTableEditor tableKey="departments" spec={configTables.departments} rows={departments} lookups={lookups} /></Card>
        <Card><ConfigTableEditor tableKey="teams" spec={configTables.teams} rows={teams} lookups={lookups} /></Card>
      </div>
      <Card title="قواعد المبيعات">
        <SettingsForm settingKey="sales" value={sales} fields={[{ path: "qualified_min_score", label: "الحد الأدنى للتأهيل (0–100)", type: "number", min: 0, max: 100 }, { path: "require_payment_terms_for_won", label: "شروط الدفع إلزامية قبل «مكسوبة»", type: "boolean" }, { path: "require_signed_contract_for_won", label: "عقد موقّع إلزامي قبل «مكسوبة»", type: "boolean" }, { path: "deal_won_requires_approval", label: "«مكسوبة» تتطلب موافقة", type: "boolean" }]} />
      </Card>
      <div className="bos-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 12 }}>
        <Card title="التسليم وتعيين مديري المشاريع">
          <SettingsForm settingKey="delivery" value={delivery} fields={[{ path: "pm_assignment", label: "طريقة التعيين", type: "select", options: [{ value: "round_robin", label: "دوري" }, { value: "least_loaded", label: "الأقل انشغالاً" }, { value: "specific", label: "شخص محدد" }, { value: "manual", label: "يدوي" }] }, { path: "pm_user_id", label: "مدير المشروع المحدد", type: "select", options: [{ value: "", label: "—" }, ...lookups.users] }, { path: "senior_pm_user_ids", label: "مجموعة كبار المديرين", type: "multiselect", options: lookups.users }, { path: "support_period_days", label: "فترة الدعم بعد التسليم (أيام)", type: "number", min: 0 }]} />
        </Card>
        <Card title="سياسة إكمال المشروع">
          <SettingsForm settingKey="project_completion" value={completion} fields={[{ path: "allow_complete_with_pending_payment", label: "السماح بالإكمال مع دفعة معلقة", type: "boolean" }, { path: "allow_complete_with_pending_approvals", label: "السماح بالإكمال مع موافقات معلقة", type: "boolean" }]} />
        </Card>
        <Card title="المالية">
          <SettingsForm settingKey="finance" value={finance} fields={[{ path: "auto_send_first_invoice", label: "إرسال الفاتورة الأولى تلقائياً", type: "boolean" }, { path: "allow_overpayment", label: "السماح بالدفع الزائد", type: "boolean" }, { path: "default_payment_due_days", label: "مهلة الاستحقاق الافتراضية (أيام)", type: "number", min: 0 }, { path: "profitability_revenue_basis", label: "أساس الربحية", type: "select", options: [{ value: "collected", label: "المحصّل" }, { value: "invoiced", label: "المفوتر" }] }]} />
        </Card>
        <Card title="العقود">
          <SettingsForm settingKey="contracts" value={contracts} fields={[{ path: "store_signer_ip", label: "حفظ IP الموقّع", type: "boolean" }]} />
        </Card>
      </div>
      <Card title="سياسات الموافقة">
        <SettingsForm settingKey="approval_policies" value={policies} fields={[...ap("proposal"), ...ap("expense"), ...ap("leave"), ...ap("attendance_correction"), ...ap("overtime"), ...ap("invoice"), { path: "access_request.steps", label: "طلب وصول: الخطوات", type: "list", hint: "manager, role:admin" }, { path: "access_request_sensitive.steps", label: "طلب وصول حساس: الخطوات", type: "list", hint: "manager, role:super_admin" }]} />
      </Card>
      <div className="bos-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 12 }}>
        <Card><ConfigTableEditor tableKey="sla_policies" spec={configTables.sla_policies} rows={sla} lookups={lookups} /></Card>
        <Card><ConfigTableEditor tableKey="expense_categories" spec={configTables.expense_categories} rows={expCats} lookups={lookups} defaults={{ is_active: true, cost_type: "other" }} /></Card>
      </div>
    </>
  );
}
