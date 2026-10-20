import type { Tone } from "@/lib/bos/labels";

export const kindLabel: Record<string, string> = { purchased: "بيانات مشتراة", open_data: "بيانات مفتوحة", registry: "سجل حكومي", crawl: "زحف المواقع", partner: "شريك", other: "أخرى" };
export const statusLabel: Record<string, { label: string; tone: Tone }> = {
  mapping: { label: "ربط الأعمدة", tone: "info" },
  importing: { label: "جارٍ الاستيراد", tone: "info" },
  ready: { label: "جاهزة", tone: "success" },
  deleted: { label: "محذوفة", tone: "neutral" },
};
