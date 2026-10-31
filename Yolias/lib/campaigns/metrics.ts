// Metric registry (owner, 2026-10-31, D-272): every number the Campaigns
// table can show is described once here (id, names, how it is computed from
// the counts, its format, whether it is on by default). The table, its column
// picker, saved views, the export and Yolias AI read this list; nothing is
// hard-coded in the screen. compute() returns null when the number can't be
// worked out (nothing sent yet, no spend): shown as "–", never as 0.

export interface Counts {
  found: number;
  contacted: number;
  sent: number;
  delivered: number;
  bounced: number;
  replies: number;
  interested: number;
  meetingRequests: number;
  meetings: number;
  held: number;
  qualified: number;
  customers: number;
  revenueUsd: number;
  spendUsd: number;
  prospectsUsed: number;
}

export const zeroCounts = (): Counts => ({ found: 0, contacted: 0, sent: 0, delivered: 0, bounced: 0, replies: 0, interested: 0, meetingRequests: 0, meetings: 0, held: 0, qualified: 0, customers: 0, revenueUsd: 0, spendUsd: 0, prospectsUsed: 0 });
export const addCounts = (a: Counts, b: Counts): Counts => Object.fromEntries(Object.keys(a).map((k) => [k, a[k as keyof Counts] + b[k as keyof Counts]])) as unknown as Counts;

export type MetricFormat = "count" | "pct" | "usd" | "ratio";
export interface Metric {
  id: string;
  label: { en: string; ar: string };
  description: { en: string; ar: string };
  format: MetricFormat;
  compute: (c: Counts) => number | null;
  defaultVisible: boolean;
}

const rate = (a: number, b: number) => (b > 0 ? a / b : null);
const cost = (spend: number, n: number) => (spend > 0 && n > 0 ? spend / n : null);

export const METRICS: Metric[] = [
  { id: "contacted", label: { en: "Contacted", ar: "تم التواصل" }, description: { en: "People sent at least one email (each person once).", ar: "أشخاص أُرسلت لهم رسالة واحدة على الأقل (كل شخص مرة)." }, format: "count", compute: (c) => c.contacted, defaultVisible: true },
  { id: "replies", label: { en: "Replies", ar: "الردود" }, description: { en: "People who replied (automatic replies don't count).", ar: "أشخاص ردّوا (الردود التلقائية لا تُحسب)." }, format: "count", compute: (c) => c.replies, defaultVisible: true },
  { id: "interested", label: { en: "Interested", ar: "مهتمون" }, description: { en: "People whose reply showed interest or asked for a meeting.", ar: "أشخاص أظهر ردهم اهتمامًا أو طلب اجتماعًا." }, format: "count", compute: (c) => c.interested, defaultVisible: true },
  { id: "meetings", label: { en: "Meetings", ar: "الاجتماعات" }, description: { en: "Meetings booked (canceled ones excluded).", ar: "اجتماعات محجوزة (بدون الملغاة)." }, format: "count", compute: (c) => c.meetings, defaultVisible: true },
  { id: "spend", label: { en: "Spend", ar: "الإنفاق" }, description: { en: "Prospects used × your rate per prospect.", ar: "العملاء المحتملون المستهلكون × سعر العميل المحتمل." }, format: "usd", compute: (c) => c.spendUsd, defaultVisible: true },
  { id: "found", label: { en: "Prospects found", ar: "مكتشفون" }, description: { en: "People and companies the campaign's audiences found.", ar: "أشخاص وشركات وجدتهم جماهير الحملة." }, format: "count", compute: (c) => c.found, defaultVisible: false },
  { id: "sent", label: { en: "Emails sent", ar: "رسائل مرسلة" }, description: { en: "Emails your mailbox accepted.", ar: "رسائل قبلها صندوق بريدك." }, format: "count", compute: (c) => c.sent, defaultVisible: false },
  { id: "delivery_rate", label: { en: "Delivery rate", ar: "نسبة الوصول" }, description: { en: "Sent emails that didn't bounce.", ar: "الرسائل المرسلة التي لم ترتد." }, format: "pct", compute: (c) => rate(c.delivered, c.sent), defaultVisible: false },
  { id: "reply_rate", label: { en: "Reply rate", ar: "نسبة الرد" }, description: { en: "Replies ÷ contacted.", ar: "الردود ÷ من تم التواصل معهم." }, format: "pct", compute: (c) => rate(c.replies, c.contacted), defaultVisible: false },
  { id: "positive_rate", label: { en: "Positive reply rate", ar: "نسبة الردود الإيجابية" }, description: { en: "Interested ÷ contacted.", ar: "المهتمون ÷ من تم التواصل معهم." }, format: "pct", compute: (c) => rate(c.interested, c.contacted), defaultVisible: false },
  { id: "meeting_rate", label: { en: "Meeting booking rate", ar: "نسبة حجز الاجتماعات" }, description: { en: "Meetings ÷ contacted.", ar: "الاجتماعات ÷ من تم التواصل معهم." }, format: "pct", compute: (c) => rate(c.meetings, c.contacted), defaultVisible: false },
  { id: "held", label: { en: "Meetings held", ar: "اجتماعات تمت" }, description: { en: "Meetings that took place.", ar: "اجتماعات حدثت فعلًا." }, format: "count", compute: (c) => c.held, defaultVisible: false },
  { id: "qualified", label: { en: "Qualified opportunities", ar: "فرص مؤهلة" }, description: { en: "Meetings you marked qualified.", ar: "اجتماعات حددتها كمؤهلة." }, format: "count", compute: (c) => c.qualified, defaultVisible: false },
  { id: "customers", label: { en: "Customers won", ar: "عملاء مكتسبون" }, description: { en: "Deals won from people this campaign contacted first, within 180 days.", ar: "صفقات مكسوبة من أشخاص تواصلت معهم الحملة أولًا، خلال 180 يومًا." }, format: "count", compute: (c) => c.customers, defaultVisible: false },
  { id: "conversion_rate", label: { en: "Conversion rate", ar: "نسبة التحويل" }, description: { en: "Customers ÷ contacted.", ar: "العملاء ÷ من تم التواصل معهم." }, format: "pct", compute: (c) => rate(c.customers, c.contacted), defaultVisible: false },
  { id: "revenue", label: { en: "Revenue", ar: "الإيرادات" }, description: { en: "Value of the deals won (when you entered it).", ar: "قيمة الصفقات المكسوبة (حين تدخلها)." }, format: "usd", compute: (c) => c.revenueUsd, defaultVisible: false },
  { id: "cost_per_contacted", label: { en: "Cost per contacted", ar: "تكلفة الشخص المتواصل معه" }, description: { en: "Spend ÷ contacted.", ar: "الإنفاق ÷ من تم التواصل معهم." }, format: "usd", compute: (c) => cost(c.spendUsd, c.contacted), defaultVisible: false },
  { id: "cost_per_reply", label: { en: "Cost per reply", ar: "تكلفة الرد" }, description: { en: "Spend ÷ replies.", ar: "الإنفاق ÷ الردود." }, format: "usd", compute: (c) => cost(c.spendUsd, c.replies), defaultVisible: false },
  { id: "cost_per_interested", label: { en: "Cost per interested", ar: "تكلفة المهتم" }, description: { en: "Spend ÷ interested.", ar: "الإنفاق ÷ المهتمون." }, format: "usd", compute: (c) => cost(c.spendUsd, c.interested), defaultVisible: false },
  { id: "cost_per_meeting", label: { en: "Cost per meeting", ar: "تكلفة الاجتماع" }, description: { en: "Spend ÷ meetings.", ar: "الإنفاق ÷ الاجتماعات." }, format: "usd", compute: (c) => cost(c.spendUsd, c.meetings), defaultVisible: false },
  { id: "cost_per_qualified", label: { en: "Cost per qualified opportunity", ar: "تكلفة الفرصة المؤهلة" }, description: { en: "Spend ÷ qualified opportunities.", ar: "الإنفاق ÷ الفرص المؤهلة." }, format: "usd", compute: (c) => cost(c.spendUsd, c.qualified), defaultVisible: false },
  { id: "roas", label: { en: "Return on spend", ar: "العائد على الإنفاق" }, description: { en: "Revenue ÷ spend, when both are known.", ar: "الإيرادات ÷ الإنفاق، حين يُعرف الاثنان." }, format: "ratio", compute: (c) => (c.spendUsd > 0 && c.revenueUsd > 0 ? c.revenueUsd / c.spendUsd : null), defaultVisible: false },
];

export const metric = (id: string) => METRICS.find((m) => m.id === id) ?? null;
export const DEFAULT_COLUMNS = METRICS.filter((m) => m.defaultVisible).map((m) => m.id);
/** Known metric ids only, in the given order, no repeats. */
export const cleanColumns = (ids: unknown): string[] => (Array.isArray(ids) ? [...new Set(ids.filter((x): x is string => typeof x === "string" && Boolean(metric(x))))] : DEFAULT_COLUMNS);

export function formatMetric(v: number | null, format: MetricFormat, locale: "en" | "ar"): string {
  if (v == null) return "–";
  const loc = locale === "ar" ? "ar-EG-u-nu-latn" : "en-US";
  if (format === "pct") return `${(v * 100).toFixed(v * 100 < 10 ? 1 : 0)}%`;
  if (format === "usd") return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: v < 10 ? 2 : 0 }).format(v);
  if (format === "ratio") return `${v.toFixed(1)}×`;
  return new Intl.NumberFormat(loc).format(v);
}

// ---------------------------------------------------------------- date ranges

export type RangePreset = "today" | "yesterday" | "7d" | "14d" | "30d" | "this_month" | "last_month" | "lifetime" | "custom";
export const RANGE_PRESETS: RangePreset[] = ["lifetime", "today", "yesterday", "7d", "14d", "30d", "this_month", "last_month", "custom"];

/** [from, to) in UTC for a preset, in the member's time zone's days (approximated by the offset at "now"). */
export function rangeBounds(preset: RangePreset, now: Date, custom?: { from?: string; to?: string }): { from: string | null; to: string | null } {
  const day = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const t0 = day(now), DAY = 86_400_000;
  const iso = (d: Date) => d.toISOString();
  switch (preset) {
    case "today": return { from: iso(t0), to: null };
    case "yesterday": return { from: iso(new Date(t0.getTime() - DAY)), to: iso(t0) };
    case "7d": return { from: iso(new Date(t0.getTime() - 6 * DAY)), to: null };
    case "14d": return { from: iso(new Date(t0.getTime() - 13 * DAY)), to: null };
    case "30d": return { from: iso(new Date(t0.getTime() - 29 * DAY)), to: null };
    case "this_month": return { from: iso(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))), to: null };
    case "last_month": return { from: iso(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))), to: iso(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))) };
    case "custom": {
      const f = custom?.from && /^\d{4}-\d{2}-\d{2}$/.test(custom.from) ? `${custom.from}T00:00:00.000Z` : null;
      const tt = custom?.to && /^\d{4}-\d{2}-\d{2}$/.test(custom.to) ? iso(new Date(Date.parse(`${custom.to}T00:00:00.000Z`) + DAY)) : null;
      return { from: f, to: tt };
    }
    default: return { from: null, to: null };
  }
}
export const inRange = (at: string | null | undefined, r: { from: string | null; to: string | null }) => Boolean(at) && (!r.from || at! >= r.from) && (!r.to || at! < r.to);
