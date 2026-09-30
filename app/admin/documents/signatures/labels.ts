export const requestStatus: Record<string, { label: string; tone: "neutral" | "info" | "success" | "warning" | "danger" }> = {
  draft: { label: "مسودة", tone: "neutral" }, sent: { label: "مُرسل", tone: "info" }, delivered: { label: "تم الاطلاع", tone: "info" }, partially_signed: { label: "موقّع جزئياً", tone: "warning" },
  completed: { label: "مكتمل التوقيع", tone: "success" }, declined: { label: "مرفوض", tone: "danger" }, voided: { label: "ملغى", tone: "neutral" }, expired: { label: "منتهي", tone: "danger" }, failed: { label: "فشل", tone: "danger" },
};
export const signerStatus: Record<string, { label: string; tone: "neutral" | "info" | "success" | "warning" | "danger" }> = {
  created: { label: "بانتظار دوره", tone: "neutral" }, sent: { label: "أُرسل", tone: "info" }, delivered: { label: "فتح المستند", tone: "info" }, signed: { label: "وقّع", tone: "success" }, declined: { label: "رفض", tone: "danger" }, voided: { label: "ملغى", tone: "neutral" },
};
export const eventLabels: Record<string, string> = {
  sent: "أُرسل للتوقيع", signer_sent: "أُرسل إلى موقّع", signer_delivered: "فتح المستند", signer_signed: "وقّع", signer_declined: "رفض التوقيع", delivered: "تم الاطلاع", partially_signed: "توقيع جزئي",
  completed: "اكتمل التوقيع", declined: "رُفض", voided: "أُلغي", expired: "انتهت المهلة", resent: "أُعيد الإرسال", download_failed: "تعذر تنزيل النسخة الموقعة", contract_signature_error: "تعذر تسجيل التوقيع على العقد",
};
export const roleLabels: Record<string, string> = { client: "العميل", company: "الشركة", employee: "الموظف", witness: "شاهد", other: "أخرى" };
