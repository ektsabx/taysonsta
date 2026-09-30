// Action parameter specs for the workflow builder (client-safe; mirrors the
// handlers in actions.ts). Templates may only use {{payload.x}} placeholders.

export type ParamType = "text" | "textarea" | "number" | "select" | "boolean" | "recipients" | "assignee" | "roles" | "users";

export interface ParamSpec {
  key: string;
  label: string;
  type: ParamType;
  options?: { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
}

export const relationOptions = [
  { value: "assignee", label: "المسؤول عن السجل" },
  { value: "owner", label: "المالك" },
  { value: "pm", label: "مدير المشروع" },
  { value: "account_manager", label: "مدير الحساب" },
  { value: "manager_of_assignee", label: "مدير المسؤول" },
];

export const actionSpecs: Record<string, { label: string; params: ParamSpec[] }> = {
  notify: { label: "إرسال إشعار", params: [{ key: "recipients", label: "المستلمون", type: "recipients", required: true }, { key: "title", label: "العنوان", type: "text", placeholder: "صفقة جديدة: {{payload.name}}" }, { key: "body", label: "النص", type: "textarea" }] },
  assign_record: { label: "تعيين مسؤول", params: [{ key: "entity", label: "السجل", type: "select", options: [{ value: "", label: "سجل الحدث" }, { value: "lead", label: "عميل محتمل" }, { value: "deal", label: "صفقة" }, { value: "task", label: "مهمة" }, { value: "ticket", label: "تذكرة" }] }, { key: "strategy", label: "الطريقة", type: "select", options: [{ value: "round_robin", label: "دوري" }, { value: "least_loaded", label: "الأقل انشغالاً" }, { value: "specific", label: "شخص محدد" }] }, { key: "role", label: "الدور (للدوري/الأقل انشغالاً)", type: "text", placeholder: "business_development" }, { key: "user_id", label: "الشخص (للمحدد)", type: "users" }, { key: "overwrite", label: "استبدال المسؤول الحالي", type: "boolean" }] },
  create_task: { label: "إنشاء مهمة", params: [{ key: "title", label: "العنوان", type: "text", required: true }, { key: "assignee", label: "المسؤول", type: "assignee" }, { key: "fallback_role", label: "دور بديل", type: "text", placeholder: "project_manager" }, { key: "due_offset_days", label: "الاستحقاق بعد (أيام)", type: "number" }, { key: "priority", label: "الأولوية", type: "select", options: [{ value: "low", label: "منخفضة" }, { value: "medium", label: "متوسطة" }, { value: "high", label: "عالية" }, { value: "urgent", label: "عاجلة" }] }] },
  create_activity: { label: "إنشاء نشاط متابعة", params: [{ key: "activity_type", label: "النوع", type: "select", options: [{ value: "follow_up", label: "متابعة" }, { value: "call", label: "مكالمة" }, { value: "email", label: "بريد" }, { value: "meeting", label: "اجتماع" }] }, { key: "title", label: "العنوان", type: "text" }, { key: "assignee", label: "المسؤول", type: "assignee" }, { key: "fallback_role", label: "دور بديل", type: "text" }, { key: "due_offset_days", label: "الاستحقاق بعد (أيام)", type: "number" }] },
  assign_pm: { label: "تعيين مدير مشروع", params: [{ key: "strategy", label: "الطريقة", type: "select", options: [{ value: "round_robin", label: "دوري" }, { value: "least_loaded", label: "الأقل انشغالاً" }, { value: "senior_pool", label: "مجموعة كبار المديرين" }, { value: "specific", label: "شخص محدد" }] }, { key: "user_id", label: "الشخص (للمحدد)", type: "users" }] },
  add_project_members: { label: "إضافة أعضاء للمشروع", params: [{ key: "role_keys", label: "الأدوار", type: "roles" }, { key: "user_ids", label: "أشخاص", type: "users" }] },
  create_onboarding_checklist: { label: "إنشاء قائمة تهيئة", params: [{ key: "template", label: "القالب", type: "select", options: [{ value: "client_onboarding", label: "تهيئة العميل" }, { value: "employee_onboarding", label: "تهيئة الموظف" }] }] },
  generate_access_checklist: { label: "إنشاء قائمة الصلاحيات", params: [] },
  ensure_project_channel: { label: "إنشاء قناة المشروع", params: [] },
  post_system_message: { label: "رسالة نظام في قناة", params: [{ key: "channel", label: "القناة", type: "select", options: [{ value: "project", label: "قناة المشروع" }, { value: "sales", label: "قناة المبيعات" }] }, { key: "text", label: "النص", type: "textarea", placeholder: "{{payload.summary}}" }] },
  send_email: { label: "إرسال بريد إلكتروني", params: [{ key: "to", label: "إلى (relation:contact / بريد)", type: "text" }, { key: "subject", label: "الموضوع", type: "text" }, { key: "body", label: "النص", type: "textarea" }] },
  update_field: { label: "تحديث حقل", params: [{ key: "entity", label: "السجل", type: "select", options: [{ value: "lead", label: "عميل محتمل" }, { value: "deal", label: "صفقة" }, { value: "task", label: "مهمة" }, { value: "project", label: "مشروع" }, { value: "ticket", label: "تذكرة" }] }, { key: "field", label: "الحقل", type: "text", placeholder: "priority" }, { key: "value", label: "القيمة", type: "text" }] },
  change_status: { label: "تغيير الحالة", params: [{ key: "entity", label: "السجل", type: "select", options: [{ value: "ticket", label: "تذكرة" }, { value: "task", label: "مهمة" }] }, { key: "status", label: "الحالة الجديدة", type: "text", placeholder: "in_progress" }] },
  create_approval: { label: "طلب موافقة", params: [{ key: "approval_type", label: "النوع", type: "select", options: [{ value: "scope", label: "النطاق" }, { value: "design", label: "التصميم" }, { value: "invoice", label: "فاتورة" }, { value: "expense", label: "مصروف" }] }, { key: "approver", label: "الموافِق (manager / role:x / user:id)", type: "text", placeholder: "role:finance" }, { key: "title", label: "العنوان", type: "text" }] },
  create_invoice: { label: "إنشاء فاتورة", params: [{ key: "schedule_index", label: "رقم الدفعة في الجدول", type: "number" }] },
  create_project: { label: "إنشاء مشروع", params: [] },
  create_payment_schedule: { label: "إنشاء جدول دفعات", params: [] },
  webhook: { label: "Webhook", params: [{ key: "url", label: "الرابط (https، نطاق مسموح)", type: "text" }] },
};
