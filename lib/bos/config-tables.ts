// Declarative specs for simple configuration tables edited in Settings
// (docs/bos/22). Client-safe: the server builds zod validation from these,
// the client renders forms from them.

export type FieldType = "text" | "textarea" | "number" | "money" | "boolean" | "date" | "time" | "select" | "user" | "role" | "department" | "currency" | "weekdays" | "json" | "list";

export interface FieldSpec {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  pattern?: string;
  hint?: string;
  listed?: boolean;
}

export interface TableSpec {
  table: string;
  title: string;
  pk?: string;
  order: string;
  softDelete?: "is_active" | "archived_at" | null;
  fields: FieldSpec[];
}

const priority = [{ value: "low", label: "منخفضة" }, { value: "medium", label: "متوسطة" }, { value: "high", label: "عالية" }, { value: "urgent", label: "عاجلة" }];

export const configTables: Record<string, TableSpec> = {
  departments: { table: "departments", title: "الأقسام", order: "name", softDelete: "archived_at", fields: [{ key: "name", label: "الاسم", type: "text", required: true, listed: true }, { key: "manager_user_id", label: "المدير", type: "user", listed: true }] },
  teams: { table: "teams", title: "الفرق", order: "name", softDelete: "archived_at", fields: [{ key: "name", label: "الاسم", type: "text", required: true, listed: true }, { key: "department_id", label: "القسم", type: "department", listed: true }, { key: "lead_user_id", label: "قائد الفريق", type: "user", listed: true }] },
  lead_sources: { table: "lead_sources", title: "مصادر العملاء المحتملين", order: "sort_order", softDelete: "is_active", fields: [{ key: "name", label: "الاسم", type: "text", required: true, listed: true }, { key: "sort_order", label: "الترتيب", type: "number", listed: true }, { key: "is_active", label: "نشط", type: "boolean", listed: true }] },
  commission_rules: {
    table: "commission_rules", title: "قواعد العمولة", order: "priority", softDelete: "is_active",
    fields: [
      { key: "name", label: "الاسم", type: "text", required: true, listed: true },
      { key: "trigger", label: "الاستحقاق عند", type: "select", required: true, listed: true, options: [{ value: "deal_won", label: "كسب الصفقة" }, { value: "contract_signed", label: "توقيع العقد" }, { value: "payment_collected", label: "تحصيل دفعة" }, { value: "full_payment", label: "السداد الكامل" }] },
      { key: "basis", label: "الأساس", type: "select", required: true, listed: true, options: [{ value: "percentage", label: "نسبة مئوية" }, { value: "fixed", label: "مبلغ ثابت" }] },
      { key: "rate", label: "النسبة %", type: "number", min: 0, max: 100, listed: true },
      { key: "fixed_amount", label: "المبلغ الثابت", type: "money" },
      { key: "currency", label: "العملة", type: "currency" },
      { key: "role_id", label: "الدور", type: "role", listed: true },
      { key: "user_id", label: "موظف محدد", type: "user" },
      { key: "min_amount", label: "الحد الأدنى للصفقة", type: "money" },
      { key: "max_amount", label: "الحد الأعلى للصفقة", type: "money" },
      { key: "valid_from", label: "ساري من", type: "date" },
      { key: "valid_to", label: "ساري حتى", type: "date" },
      { key: "priority", label: "الأولوية", type: "number", listed: true },
      { key: "is_active", label: "نشط", type: "boolean", listed: true },
    ],
  },
  work_schedules: {
    table: "work_schedules", title: "جداول العمل", order: "name", softDelete: null,
    fields: [
      { key: "name", label: "الاسم", type: "text", required: true, listed: true },
      { key: "work_days", label: "أيام العمل", type: "weekdays", required: true, listed: true },
      { key: "start_time", label: "البداية", type: "time", required: true, listed: true },
      { key: "end_time", label: "النهاية", type: "time", required: true, listed: true },
      { key: "break_minutes", label: "الاستراحة (د)", type: "number", min: 0, max: 600, listed: true },
      { key: "grace_minutes", label: "السماح (د)", type: "number", min: 0, max: 240, listed: true },
      { key: "half_day_minutes", label: "حد نصف اليوم (د)", type: "number", min: 0, max: 1440 },
      { key: "overtime_after_minutes", label: "الإضافي بعد (د)", type: "number", min: 0, max: 1440 },
      { key: "timezone", label: "المنطقة الزمنية", type: "text", required: true, listed: true },
      { key: "is_default", label: "افتراضي", type: "boolean", listed: true },
    ],
  },
  holidays: { table: "holidays", title: "العطلات الرسمية", order: "date", softDelete: null, fields: [{ key: "date", label: "التاريخ", type: "date", required: true, listed: true }, { key: "name", label: "الاسم", type: "text", required: true, listed: true }, { key: "kind", label: "النوع", type: "select", listed: true, options: [{ value: "public", label: "رسمية" }, { value: "company", label: "شركة" }] }, { key: "is_paid", label: "مدفوعة", type: "boolean" }, { key: "country", label: "الدولة (فارغ = الكل)", type: "text", listed: true }] },
  leave_types: { table: "leave_types", title: "أنواع الإجازات", order: "sort_order", softDelete: "is_active", fields: [{ key: "key", label: "المفتاح", type: "text", required: true, pattern: "^[a-z_]+$", listed: true }, { key: "name", label: "الاسم", type: "text", required: true, listed: true }, { key: "is_paid", label: "مدفوعة", type: "boolean", listed: true }, { key: "annual_allowance_days", label: "الرصيد السنوي (أيام)", type: "number", min: 0, max: 365, listed: true }, { key: "requires_approval", label: "تتطلب موافقة", type: "boolean", listed: true }, { key: "requires_reason", label: "تتطلب سبباً", type: "boolean" }, { key: "approval_steps", label: "خطوات الموافقة (فارغ = المدير)", type: "list", hint: "manager, role:hr, user:<id> — بالترتيب", listed: true }, { key: "carry_forward_max_days", label: "أقصى ترحيل (أيام)", type: "number", min: 0, max: 365 }, { key: "max_consecutive_days", label: "أقصى أيام متصلة", type: "number", min: 0, max: 365 }, { key: "min_notice_days", label: "الإشعار المسبق (أيام)", type: "number", min: 0, max: 365 }, { key: "eligible_gender", label: "متاحة لـ", type: "select", options: [{ value: "female", label: "الإناث" }, { value: "male", label: "الذكور" }] }, { key: "sort_order", label: "الترتيب", type: "number" }, { key: "is_active", label: "نشط", type: "boolean", listed: true }] },
  employee_categories: { table: "employee_categories", title: "تصنيفات الموظفين", order: "sort_order", softDelete: "is_active", fields: [{ key: "name", label: "الاسم", type: "text", required: true, listed: true }, { key: "description", label: "الوصف", type: "text", listed: true }, { key: "sort_order", label: "الترتيب", type: "number" }, { key: "is_active", label: "نشط", type: "boolean", listed: true }] },
  salary_components: {
    table: "salary_components", title: "بنود الراتب (البدلات والاستقطاعات)", order: "sort_order", softDelete: "is_active",
    fields: [
      { key: "key", label: "المفتاح", type: "text", required: true, pattern: "^[a-z0-9_]+$", listed: true },
      { key: "name", label: "الاسم", type: "text", required: true, listed: true },
      { key: "kind", label: "النوع", type: "select", required: true, listed: true, options: [{ value: "earning", label: "استحقاق" }, { value: "deduction", label: "استقطاع" }] },
      { key: "category", label: "الفئة", type: "select", required: true, listed: true, options: [{ value: "housing", label: "سكن" }, { value: "transportation", label: "انتقال" }, { value: "allowance", label: "بدل" }, { value: "other_earning", label: "استحقاق آخر" }, { value: "insurance", label: "تأمين" }, { value: "tax", label: "ضريبة" }, { value: "other_deduction", label: "استقطاع آخر" }] },
      { key: "calc_type", label: "طريقة الحساب", type: "select", required: true, listed: true, options: [{ value: "fixed", label: "مبلغ ثابت" }, { value: "percent_of_basic", label: "نسبة من الأساسي" }] },
      { key: "default_value", label: "القيمة الافتراضية", type: "money" },
      { key: "taxable", label: "خاضع للضريبة", type: "boolean", listed: true },
      { key: "sort_order", label: "الترتيب", type: "number" },
      { key: "is_active", label: "نشط", type: "boolean", listed: true },
    ],
  },
  document_types: {
    table: "document_types", title: "أنواع مستندات الموظفين", order: "sort_order", softDelete: "is_active",
    fields: [
      { key: "key", label: "المفتاح", type: "text", required: true, pattern: "^[a-z0-9_]+$", listed: true },
      { key: "name", label: "الاسم", type: "text", required: true, listed: true },
      { key: "category", label: "الفئة", type: "select", required: true, listed: true, options: [{ value: "identity", label: "هوية" }, { value: "employment", label: "توظيف وعقود" }, { value: "qualification", label: "مؤهلات" }, { value: "finance", label: "مالية" }, { value: "insurance", label: "تأمينات" }, { value: "tax", label: "ضرائب" }, { value: "medical", label: "طبي" }, { value: "performance", label: "أداء" }, { value: "disciplinary", label: "تأديبي" }, { value: "payroll", label: "رواتب" }, { value: "other", label: "أخرى" }] },
      { key: "requires_expiry", label: "له تاريخ انتهاء", type: "boolean", listed: true },
      { key: "alert_days_before", label: "التنبيه قبل الانتهاء (أيام)", type: "number", min: 0, max: 365 },
      { key: "required_for_onboarding", label: "مطلوب في التهيئة", type: "boolean", listed: true },
      { key: "employee_can_upload", label: "يرفعه الموظف", type: "boolean" },
      { key: "visible_to_employee", label: "يراه الموظف", type: "boolean" },
      { key: "visible_to_manager", label: "يراه المدير", type: "boolean" },
      { key: "sort_order", label: "الترتيب", type: "number" },
      { key: "is_active", label: "نشط", type: "boolean", listed: true },
    ],
  },
  hr_request_types: {
    table: "hr_request_types", title: "أنواع طلبات الموظفين", order: "sort_order", softDelete: "is_active",
    fields: [
      { key: "key", label: "المفتاح", type: "text", required: true, pattern: "^[a-z0-9_]+$", listed: true },
      { key: "name", label: "الاسم", type: "text", required: true, listed: true },
      { key: "description", label: "الوصف", type: "text" },
      { key: "approval_steps", label: "خطوات الموافقة", type: "list", required: true, hint: "manager, role:hr, role:finance…", listed: true },
      { key: "requires_attachment", label: "يتطلب مرفقاً", type: "boolean" },
      { key: "sort_order", label: "الترتيب", type: "number" },
      { key: "is_active", label: "نشط", type: "boolean", listed: true },
    ],
  },
  sla_policies: { table: "sla_policies", title: "سياسات SLA للدعم", order: "priority", softDelete: null, fields: [{ key: "priority", label: "الأولوية", type: "select", required: true, options: priority, listed: true }, { key: "first_response_minutes", label: "أول رد (دقائق)", type: "number", required: true, min: 1, listed: true }, { key: "resolution_minutes", label: "الحل (دقائق)", type: "number", required: true, min: 1, listed: true }] },
  expense_categories: { table: "expense_categories", title: "فئات المصروفات", order: "name", softDelete: "is_active", fields: [{ key: "name", label: "الاسم", type: "text", required: true, listed: true }, { key: "cost_type", label: "نوع التكلفة", type: "select", listed: true, options: [{ value: "employee", label: "موظف" }, { value: "freelancer", label: "مستقل" }, { value: "vendor", label: "مورد" }, { value: "infrastructure", label: "بنية تحتية" }, { value: "third_party", label: "طرف ثالث" }, { value: "other", label: "أخرى" }] }, { key: "is_active", label: "نشط", type: "boolean", listed: true }] },
};
