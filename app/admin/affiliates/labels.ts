// Labels for Yolias Admin → Affiliates (kept out of page files: Next only
// allows its own exports there).

type Tone = "success" | "warning" | "danger" | "info" | "neutral";

export const affiliateStatusLabel: Record<string, string> = { pending: "قيد المراجعة", approved: "معتمد", rejected: "مرفوض", suspended: "معلّق", disabled: "مغلق" };
export const affiliateStatusTone: Record<string, Tone> = { pending: "warning", approved: "success", rejected: "danger", suspended: "danger", disabled: "neutral" };

export const commissionStatusLabel: Record<string, string> = { pending: "معلّقة (فترة الانتظار)", approved: "معتمدة", available: "متاحة للسحب", processing: "داخل طلب سحب", paid: "مدفوعة", rejected: "مرفوضة", reversed: "معكوسة" };
export const commissionStatusTone: Record<string, Tone> = { pending: "warning", approved: "info", available: "success", processing: "info", paid: "success", rejected: "danger", reversed: "danger" };
export const commissionKindLabel: Record<string, string> = { payment: "دفعة", reversal: "استرداد عمولة مدفوعة", adjustment: "تسوية يدوية" };

export const payoutStatusLabel: Record<string, string> = { requested: "مطلوب", approved: "تمت الموافقة", processing: "قيد التحويل", paid: "تم تسجيل الدفع", rejected: "مرفوض", failed: "فشل" };
export const payoutStatusTone: Record<string, Tone> = { requested: "warning", approved: "info", processing: "info", paid: "success", rejected: "danger", failed: "danger" };

/** What each risk flag means, for the reviewer. Flags never reject anything on their own. */
export const riskFlagLabel: Record<string, string> = {
  same_network_as_affiliate: "التسجيل من نفس شبكة المسوّق (عنوان IP مطابق). قد يكون إحالة ذاتية أو نفس المكتب.",
  many_signups_same_network: "عدة تسجيلات من نفس الشبكة لنفس المسوّق خلال يوم.",
  admin_review: "وضعها الفريق قيد المراجعة.",
  refunded_during_payout: "استُردت الدفعة بينما العمولة داخل طلب سحب مفتوح.",
};

export const eventLabel: Record<string, string> = {
  "affiliate.applied": "قدّم طلب الانضمام", "affiliate.approved": "تمت الموافقة على المسوّق", "affiliate.rejected": "تم رفض المسوّق", "affiliate.suspended": "تم تعليق المسوّق",
  "affiliate.disabled": "تم إغلاق حساب المسوّق", "affiliate.note": "ملاحظة داخلية", "affiliate.payout_details": "غيّر بيانات السحب",
  "referral.created": "إحالة جديدة", "referral.self_blocked": "منع إحالة ذاتية",
  "commission.created": "عمولة جديدة", "commission.skipped": "دفعة لم تُحتسب لها عمولة", "commission.available": "أصبحت العمولة متاحة", "commission.hold": "وُضعت العمولة قيد المراجعة",
  "commission.release": "رُفع تعليق العمولة", "commission.approve": "اعتُمدت العمولة", "commission.reject": "رُفضت العمولة", "commission.reversed": "عُكست العمولة",
  "commission.adjustment": "تسوية يدوية", "commission.error": "خطأ أثناء احتساب عمولة",
  "payout.requested": "طلب سحب", "payout.request_refused": "رُفض طلب سحب تلقائيًا", "payout.approved": "موافقة على السحب", "payout.processing": "بدء التحويل",
  "payout.paid": "تسجيل إتمام الدفع", "payout.rejected": "رفض السحب", "payout.failed": "فشل التحويل", "program.updated": "تعديل إعدادات البرنامج",
};

export const skipReasonLabel: Record<string, string> = {
  program_disabled: "البرنامج متوقف", test_payment: "دفعة اختبار", currency: "عملة غير مدعومة", plan_not_eligible: "خطة غير مؤهلة", packs_not_eligible: "باقات العملاء غير مؤهلة",
  customer_excluded: "عميل مستثنى", self_referral: "المسوّق عضو في مساحة العمل الدافعة", below_minimum: "أقل من الحد الأدنى للدفعة", not_recurring: "العمولات المتكررة متوقفة",
  recurring_limit: "تجاوز عدد الدفعات المسموح", affiliate_suspended: "المسوّق معلّق", affiliate_disabled: "المسوّق مغلق", affiliate_pending: "المسوّق غير معتمد", affiliate_rejected: "المسوّق مرفوض",
};

export const cents = (v: number | string | null | undefined) => `$${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v ?? 0) / 100)}`;
