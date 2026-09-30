// Shared labels for the social area.
export const postStatus: Record<string, { label: string; tone: "neutral" | "info" | "success" | "warning" | "danger" | "accent" }> = {
  draft: { label: "مسودة", tone: "neutral" },
  in_review: { label: "قيد المراجعة", tone: "warning" },
  changes_requested: { label: "مطلوب تعديلات", tone: "warning" },
  approved: { label: "معتمد", tone: "info" },
  scheduled: { label: "مجدول", tone: "accent" },
  publishing: { label: "قيد النشر", tone: "info" },
  published: { label: "منشور", tone: "success" },
  partially_published: { label: "منشور جزئياً", tone: "warning" },
  failed: { label: "فشل", tone: "danger" },
  cancelled: { label: "ملغى", tone: "neutral" },
};

export const targetStatus: Record<string, { label: string; tone: "neutral" | "info" | "success" | "warning" | "danger" }> = {
  pending: { label: "بالانتظار", tone: "neutral" },
  publishing: { label: "قيد النشر", tone: "info" },
  published: { label: "منشور", tone: "success" },
  failed: { label: "فشل", tone: "danger" },
  manual_pending: { label: "بانتظار النشر اليدوي", tone: "warning" },
  cancelled: { label: "ملغى", tone: "neutral" },
};
