// Advertising metric definitions (docs/bos/30 §14). Every derived metric is
// null when its inputs don't exist — never 0 by default, never estimated.
// Currencies are never mixed: totals are per currency unless the caller
// converts explicitly with a dated exchange rate.

export interface AdTotals { spend: number; impressions: number; clicks: number; conversions: number | null; conversionValue: number | null; reach?: number | null }

const r2 = (n: number) => Math.round(n * 100) / 100;
const r4 = (n: number) => Math.round(n * 10000) / 10000;

export function ctr(t: Pick<AdTotals, "clicks" | "impressions">) { return t.impressions > 0 ? r2((t.clicks / t.impressions) * 100) : null; }
export function cpc(t: Pick<AdTotals, "spend" | "clicks">) { return t.clicks > 0 ? r4(t.spend / t.clicks) : null; }
export function cpm(t: Pick<AdTotals, "spend" | "impressions">) { return t.impressions > 0 ? r2((t.spend / t.impressions) * 1000) : null; }
export function cpa(t: Pick<AdTotals, "spend" | "conversions">) { return t.conversions != null && t.conversions > 0 ? r2(t.spend / t.conversions) : null; }
export function roas(t: Pick<AdTotals, "spend" | "conversionValue">) { return t.conversionValue != null && t.conversionValue > 0 && t.spend > 0 ? r2(t.conversionValue / t.spend) : null; }

export const metricDefinitions: Record<string, string> = {
  spend: "المبلغ المنفق كما تحسبه المنصة، بعملة الحساب الإعلاني.",
  impressions: "عدد مرات ظهور الإعلانات.",
  reach: "عدد الأشخاص الفريدين — لا يُجمع عبر الأيام، لذا يظهر لليوم الواحد فقط.",
  clicks: "النقرات كما تعرّفها المنصة (قد تشمل كل النقرات لا روابط فقط).",
  ctr: "نسبة النقر = النقرات ÷ مرات الظهور × 100.",
  cpc: "تكلفة النقرة = الإنفاق ÷ النقرات.",
  cpm: "تكلفة الألف ظهور = الإنفاق ÷ مرات الظهور × 1000.",
  conversions: "التحويلات حسب أنواع الأحداث المختارة في الإعدادات (مثل الشراء أو العميل المحتمل).",
  cpa: "تكلفة التحويل = الإنفاق ÷ التحويلات (يظهر فقط إن وُجدت تحويلات).",
  conversion_value: "قيمة التحويلات كما ترسلها المنصة (من البكسل/التتبع).",
  roas: "العائد على الإنفاق الإعلاني = قيمة التحويلات ÷ الإنفاق (يظهر فقط إن وُجدت قيمة وإنفاق).",
};

export function addTotals(a: AdTotals, b: Omit<AdTotals, "reach">): AdTotals {
  return {
    spend: r2(a.spend + b.spend),
    impressions: a.impressions + b.impressions,
    clicks: a.clicks + b.clicks,
    conversions: a.conversions == null && b.conversions == null ? null : (a.conversions ?? 0) + (b.conversions ?? 0),
    conversionValue: a.conversionValue == null && b.conversionValue == null ? null : r2((a.conversionValue ?? 0) + (b.conversionValue ?? 0)),
  };
}

export const emptyTotals = (): AdTotals => ({ spend: 0, impressions: 0, clicks: 0, conversions: null, conversionValue: null });

export function derive(t: AdTotals) {
  return { ...t, ctr: ctr(t), cpc: cpc(t), cpm: cpm(t), cpa: cpa(t), roas: roas(t) };
}

// Week (ISO, Monday) / month bucket for trends.
export function bucket(day: string, by: "day" | "week" | "month") {
  if (by === "day") return day;
  if (by === "month") return day.slice(0, 7);
  const d = new Date(`${day}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - dow * 86400_000).toISOString().slice(0, 10);
}
