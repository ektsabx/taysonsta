// Standardized event catalogue (docs/bos/20). Used by the workflow builder
// (trigger select + suggested condition fields) and validation.

export interface EventType {
  key: string;
  label: string;
  group: string;
  fields?: string[];
}

const e = (group: string, list: [string, string, string[]?][]): EventType[] => list.map(([key, label, fields]) => ({ key, label, group, fields }));

export const eventCatalog: EventType[] = [
  ...e("العملاء المحتملون", [
    ["lead.created", "إنشاء عميل محتمل", ["entity.assigned_to", "entity.source_id", "entity.country", "entity.estimated_budget", "entity.priority", "entity.total_score"]],
    ["lead.assigned", "تعيين عميل محتمل", ["assignee_user_id"]],
    ["lead.contacted", "التواصل مع عميل محتمل"],
    ["lead.replied", "رد عميل محتمل"],
    ["lead.qualified", "تأهيل عميل محتمل", ["entity.total_score"]],
    ["lead.stage_changed", "تغيير مرحلة عميل محتمل", ["to", "from"]],
    ["lead.converted", "تحويل لصفقة", ["deal_id"]],
    ["lead.lost", "خسارة عميل محتمل", ["reason"]],
    ["lead.unassigned_owner_inactive", "مالك غير نشط"],
  ]),
  ...e("الصفقات", [
    ["deal.created", "إنشاء صفقة", ["entity.value", "entity.currency"]],
    ["deal.updated", "تحديث صفقة"],
    ["deal.stage_changed", "تغيير مرحلة صفقة", ["to", "from"]],
    ["deal.proposal_sent", "إرسال مقترح للصفقة"],
    ["deal.won", "صفقة مكسوبة", ["value", "value_base", "currency", "project_id", "client_id", "entity.is_upsell"]],
    ["deal.lost", "صفقة خاسرة", ["reason"]],
  ]),
  ...e("المقترحات والعقود", [
    ["proposal.sent", "إرسال مقترح"], ["proposal.viewed", "مشاهدة مقترح"], ["proposal.accepted", "قبول مقترح"], ["proposal.rejected", "رفض مقترح"], ["proposal.expired", "انتهاء مقترح"],
    ["contract.sent", "إرسال عقد"], ["contract.signed", "توقيع عقد", ["deal_id"]], ["contract.expired", "انتهاء عقد"],
  ]),
  ...e("المالية", [
    ["invoice.created", "إنشاء فاتورة"], ["invoice.sent", "إرسال فاتورة"], ["invoice.overdue", "فاتورة متأخرة", ["entity.balance", "entity.currency", "client_id"]], ["invoice.paid", "سداد فاتورة"],
    ["payment.created", "تسجيل دفعة"], ["payment.completed", "اكتمال دفعة", ["amount", "currency", "deal_id", "project_id"]], ["payment.failed", "فشل دفعة"], ["payment.refunded", "استرداد دفعة"],
    ["commission.created", "إنشاء عمولة"], ["commission.eligible", "استحقاق عمولة"], ["commission.approved", "اعتماد عمولة"], ["commission.paid", "صرف عمولة"],
  ]),
  ...e("المشاريع والمهام", [
    ["project.created", "إنشاء مشروع", ["deal_id", "client_id"]], ["project.pm_assigned", "تعيين مدير مشروع", ["pm_id"]], ["project.status_changed", "تغيير حالة مشروع", ["to", "from"]],
    ["project.delayed", "مشروع متأخر"], ["project.completed", "اكتمال مشروع", ["client_id"]], ["project.satisfaction_submitted", "تقييم العميل", ["score"]],
    ["milestone.completed", "اكتمال مرحلة"], ["milestone.overdue", "مرحلة متأخرة"],
    ["task.created", "إنشاء مهمة"], ["task.assigned", "تعيين مهمة", ["assignee_user_id"]], ["task.completed", "اكتمال مهمة"], ["task.overdue", "مهمة متأخرة", ["overdue_days", "assignee_user_id"]],
    ["change_request.created", "طلب تغيير"], ["change_request.approved", "اعتماد طلب تغيير"], ["change_request.rejected", "رفض طلب تغيير"],
  ]),
  ...e("الأنشطة والتواصل", [
    ["activity.logged", "تسجيل نشاط"], ["activity.completed", "إكمال نشاط"], ["activity.reminder_due", "تذكير متابعة"],
    ["meeting.scheduled", "جدولة اجتماع"], ["meeting.upcoming", "اجتماع قريب"], ["meeting.completed", "اكتمال اجتماع", ["organizer_id"]],
    ["chat.mentioned", "إشارة في المحادثة"], ["chat.client_message", "رسالة من العميل"], ["file.uploaded", "رفع ملف"],
  ]),
  ...e("الموافقات", [["approval.requested", "طلب موافقة", ["approval_type"]], ["approval.decided", "قرار موافقة", ["decision", "approval_type"]]]),
  ...e("الدعم", [
    ["ticket.created", "تذكرة جديدة", ["priority", "client_id", "project_id"]], ["ticket.assigned", "تعيين تذكرة"], ["ticket.replied", "رد على تذكرة"], ["ticket.client_replied", "رد العميل"], ["ticket.status_changed", "تغيير حالة تذكرة", ["to"]], ["ticket.sla_breached", "تجاوز SLA", ["priority"]],
    ["bug.created", "خطأ برمجي جديد", ["severity"]], ["bug.status_changed", "تغيير حالة خطأ", ["to"]], ["bug.ready_for_qa", "جاهز للاختبار"],
    ["feature_request.created", "طلب ميزة"], ["feature_request.status_changed", "تغيير حالة طلب ميزة", ["to"]],
  ]),
  ...e("العملاء", [["client.created", "إنشاء حساب"], ["client.assigned", "تعيين مدير حساب"], ["onboarding.started", "بدء تهيئة"], ["onboarding.completed", "اكتمال تهيئة"], ["onboarding.overdue", "تهيئة متأخرة"]]),
  ...e("الفريق والحضور", [
    ["attendance.clock_in", "بدء العمل"], ["attendance.clock_out", "إنهاء العمل"], ["attendance.open_session_detected", "جلسة مفتوحة"], ["attendance.reminder", "تذكير الحضور"],
    ["attendance.correction_requested", "طلب تصحيح"], ["attendance.correction_approved", "قبول تصحيح"], ["attendance.correction_rejected", "رفض تصحيح"],
    ["leave.requested", "طلب إجازة"], ["leave.approved", "قبول إجازة"], ["leave.rejected", "رفض إجازة"], ["overtime.requested", "طلب عمل إضافي"], ["overtime.decided", "قرار عمل إضافي"],
    ["employee.created", "إنشاء موظف"], ["employee.lifecycle_changed", "تغيير حالة موظف", ["from", "to"]], ["review.submitted", "مراجعة أداء"],
  ]),
  ...e("IT والصلاحيات", [
    ["access.requested", "طلب وصول"], ["access.granted", "منح وصول"], ["access.revoked", "سحب وصول"], ["access.expired", "انتهاء وصول"],
    ["device.assigned", "تسليم جهاز"], ["device.returned", "استرجاع جهاز"], ["device.security_check_due", "فحص أمان مستحق"], ["security.mfa_required", "2FA مطلوب"],
  ]),
  ...e("المعرفة", [["kb.article_published", "نشر مقال", ["kind"]], ["kb.policy_updated", "تحديث سياسة"]]),
  // Events emitted by the modules that were missing from the catalogue, plus
  // Master-upgrade Phase 6 events (docs/bos/30 §9, §18, §20).
  ...e("الموافقات", [["approval.changes_requested", "طلب تعديلات على طلب موافقة", ["approval_type"]], ["approval.resubmitted", "إعادة تقديم طلب موافقة", ["approval_type"]], ["approval.overdue", "موافقة متأخرة", ["approval_type", "hours_overdue"]]]),
  ...e("المقترحات والعقود", [["proposal.created", "إنشاء مقترح"], ["proposal.submitted", "تقديم مقترح للمراجعة"], ["proposal.expiring", "مقترح قارب على الانتهاء"], ["contract.created", "إنشاء عقد"], ["contract.viewed", "مشاهدة عقد"], ["contract.document_uploaded", "رفع مستند عقد"], ["contract.cancelled", "إلغاء عقد"], ["contract.ended", "انتهاء عقد"], ["change_request.applied", "تطبيق طلب تغيير"]]),
  ...e("الصفقات", [["deal.reopened", "إعادة فتح صفقة"], ["deal.value_changed_after_won", "تغيير قيمة صفقة بعد الكسب"]]),
  ...e("المالية", [["invoice.cancelled", "إلغاء فاتورة"], ["commission.adjustment_required", "تعديل عمولة مطلوب"]]),
  ...e("المشاريع والمهام", [["project.member_added", "إضافة عضو للمشروع"], ["project.member_removed_with_tasks", "إزالة عضو لديه مهام"], ["project.pm_assignment_required", "مطلوب تعيين مدير مشروع"], ["project.cancelled_with_unpaid_invoices", "إلغاء مشروع بفواتير غير مسددة"], ["project.satisfaction_recorded", "تسجيل رضا العميل"], ["milestone.created", "إنشاء مرحلة"], ["issue.created", "مشكلة جديدة"], ["issue.assigned", "تعيين مشكلة"], ["issue.status_changed", "تغيير حالة مشكلة"], ["time.logged", "تسجيل وقت"], ["comment.added", "تعليق جديد"]]),
  ...e("الأنشطة والتواصل", [["meeting.invited", "دعوة اجتماع"], ["file.shared", "مشاركة ملف"]]),
  ...e("الدعم", [["bug.assigned", "تعيين خطأ برمجي"]]),
  ...e("العملاء", [["client.merged", "دمج حسابين"]]),
  ...e("الفريق والحضور", [["employee.manager_changed", "تغيير المدير المباشر"], ["employee.promoted", "ترقية موظف"], ["employee.probation_ending", "قرب انتهاء فترة الاختبار"], ["employee.reports_need_reassignment", "مرؤوسون يحتاجون مديراً"], ["compensation.changed", "تغيير الراتب"], ["offboarding.started", "بدء إنهاء الخدمة"], ["offboarding.completed", "اكتمال إنهاء الخدمة"], ["user.invited", "دعوة موظف للنظام"]]),
  ...e("الموارد البشرية", [
    ["employee_document.uploaded", "رفع مستند موظف"], ["employee_document.rejected", "رفض مستند موظف"], ["employee_document.expiring", "مستند قارب على الانتهاء"], ["employee_contract.expiring", "عقد موظف قارب على الانتهاء"],
    ["employee_expense.decided", "قرار مصروف موظف"], ["employee_expense.approved", "اعتماد مصروف موظف"], ["employee_expense.reimbursed", "استرداد مصروف موظف"],
    ["hr_request.decided", "قرار طلب موارد بشرية"], ["hr_request.completed", "اكتمال طلب موارد بشرية"], ["loan.decided", "قرار سلفة / قرض"], ["bonus.decided", "قرار مكافأة"],
    ["payroll.approved", "اعتماد الرواتب"], ["payroll.paid", "صرف الرواتب"], ["payslip.published", "نشر قسيمة الراتب"],
    ["candidate.stage_changed", "تغيير مرحلة المرشح"], ["candidate.hired", "تعيين مرشح"], ["interview.scheduled", "جدولة مقابلة"],
    ["performance.feedback_requested", "طلب تقييم 360"], ["performance.goal_assigned", "هدف جديد"], ["kpi.period_computed", "حساب المؤشرات"],
  ]),
  ...e("الدعم", [["conversation.created", "محادثة دعم جديدة", ["channel", "customer_id"]], ["conversation.customer_message", "رسالة جديدة من عميل", ["channel"]], ["conversation.assigned", "إسناد محادثة", ["assignee_user_id"]], ["conversation.escalated", "تصعيد محادثة", ["priority"]], ["conversation.resolved", "حل محادثة"]]),
  ...e("النظام والتكاملات", [["automation.failed", "فشل مسار عمل"], ["integration.failed", "فشل تكامل"], ["security.settings_changed", "تغيير إعدادات الأمان"], ["security.alert", "تنبيه أمني"], ["document.issued", "إصدار مستند"]]),
];

export const eventMap = new Map(eventCatalog.map((ev) => [ev.key, ev]));
export const eventGroups = [...new Set(eventCatalog.map((ev) => ev.group))];
