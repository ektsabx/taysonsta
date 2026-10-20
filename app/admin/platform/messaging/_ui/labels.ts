// Labels and tones for Messaging & Automation lists (Arabic; the Admin
// English dictionary translates them).
export const flowStatus = {
  draft: { tone: "neutral", label: "مسودة" }, active: { tone: "success", label: "فعّال" }, paused: { tone: "warning", label: "متوقف مؤقتًا" }, archived: { tone: "neutral", label: "مؤرشف" },
} as const;
export const campaignStatus = {
  draft: { tone: "neutral", label: "مسودة" }, scheduled: { tone: "info", label: "مجدولة" }, sending: { tone: "info", label: "جارٍ الإرسال" }, sent: { tone: "success", label: "أُرسلت" },
  canceled: { tone: "neutral", label: "ملغاة" }, failed: { tone: "danger", label: "فشلت" },
} as const;
export const enrollmentStatus = {
  active: { tone: "info", label: "داخل المسار" }, completed: { tone: "success", label: "أكمل" }, exited: { tone: "neutral", label: "خرج" }, goal_reached: { tone: "success", label: "حقق الهدف" }, failed: { tone: "danger", label: "فشل" },
} as const;
export const classLabel: Record<string, string> = { transactional: "تشغيلية", lifecycle: "دورة حياة", marketing: "تسويقية" };
export const activityKind: Record<string, string> = {
  entered: "دخل المسار", step: "خطوة", queued: "رسالة في الطابور", sent: "قبلها Resend", skipped: "تُخطّيت", waiting: "انتظار", branch: "تفرّع", notification: "إشعار داخل المنصة",
  exited: "خرج", goal: "حقق الهدف", completed: "اكتمل", error: "خطأ", retry: "إعادة محاولة", test: "تجربة",
};
export const mailStatus: Record<string, { tone: "info" | "success" | "warning" | "danger" | "neutral"; label: string }> = {
  queued: { tone: "info", label: "في الطابور" }, sent: { tone: "success", label: "قبلها Resend" }, skipped: { tone: "warning", label: "لم تُرسل" }, failed: { tone: "danger", label: "فشلت" }, canceled: { tone: "neutral", label: "أُلغيت قبل الإرسال" },
};
export const deliveryLabel: Record<string, string> = { delivered: "وصلت", delayed: "تأخر التسليم", bounced: "ارتدت", complained: "بلاغ إزعاج" };
export const pct = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 1000) / 10}%` : "-");
