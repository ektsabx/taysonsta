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
  /** D-273: booked meetings the guest chose or accepted (sales_meetings.confirmed_at). */
  confirmed: number;
  canceled: number;
  held: number;
  qualified: number;
  customers: number;
  revenueUsd: number;
  spendUsd: number;
  prospectsUsed: number;
}

export const zeroCounts = (): Counts => ({ found: 0, contacted: 0, sent: 0, delivered: 0, bounced: 0, replies: 0, interested: 0, meetingRequests: 0, meetings: 0, confirmed: 0, canceled: 0, held: 0, qualified: 0, customers: 0, revenueUsd: 0, spendUsd: 0, prospectsUsed: 0 });
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

// D-273: Yolias sells meetings, not leads or data: no "prospects found" or
// "qualified opportunities" columns. Cost per meeting is the headline number
// (like cost per result in Facebook Ads), from booked meetings; the confirmed
// and held versions sit beside it.
export const METRICS: Metric[] = [
  { id: "sent", label: { en: "Sent", ar: "المُرسل" }, description: { en: "Emails your mailbox sent (first emails and follow-ups).", ar: "رسائل أرسلها بريدك (الأولى والمتابعات)." }, format: "count", compute: (c) => c.sent, defaultVisible: true },
  { id: "reply_rate", label: { en: "Reply rate", ar: "نسبة الرد" }, description: { en: "People who replied ÷ people contacted.", ar: "من ردّوا ÷ من تم التواصل معهم." }, format: "pct", compute: (c) => rate(c.replies, c.contacted), defaultVisible: true },
  { id: "interested", label: { en: "Interested", ar: "مهتمون" }, description: { en: "People whose reply showed interest or asked for a meeting.", ar: "أشخاص أظهر ردهم اهتمامًا أو طلب اجتماعًا." }, format: "count", compute: (c) => c.interested, defaultVisible: true },
  { id: "meetings", label: { en: "Meetings", ar: "الاجتماعات" }, description: { en: "Meetings booked (canceled ones excluded).", ar: "اجتماعات محجوزة (بدون الملغاة)." }, format: "count", compute: (c) => c.meetings, defaultVisible: true },
  { id: "cost_per_meeting", label: { en: "Cost per meeting", ar: "تكلفة الاجتماع" }, description: { en: "Spend ÷ meetings booked.", ar: "الإنفاق ÷ الاجتماعات المحجوزة." }, format: "usd", compute: (c) => cost(c.spendUsd, c.meetings), defaultVisible: true },
  { id: "spend", label: { en: "Spend", ar: "الإنفاق" }, description: { en: "People found for the campaign × your rate per person.", ar: "الأشخاص الذين وُجدوا للحملة × سعر الشخص." }, format: "usd", compute: (c) => c.spendUsd, defaultVisible: true },
  { id: "contacted", label: { en: "Contacted", ar: "تم التواصل" }, description: { en: "People sent at least one email (each person once).", ar: "أشخاص أُرسلت لهم رسالة واحدة على الأقل (كل شخص مرة)." }, format: "count", compute: (c) => c.contacted, defaultVisible: false },
  { id: "replies", label: { en: "Replies", ar: "الردود" }, description: { en: "People who replied (automatic replies don't count).", ar: "أشخاص ردّوا (الردود التلقائية لا تُحسب)." }, format: "count", compute: (c) => c.replies, defaultVisible: false },
  { id: "delivery_rate", label: { en: "Delivery rate", ar: "نسبة الوصول" }, description: { en: "Sent emails that didn't bounce.", ar: "الرسائل المرسلة التي لم ترتد." }, format: "pct", compute: (c) => rate(c.delivered, c.sent), defaultVisible: false },
  { id: "bounced", label: { en: "Bounced", ar: "ارتدت" }, description: { en: "Emails that came back undelivered.", ar: "رسائل عادت دون أن تصل." }, format: "count", compute: (c) => c.bounced, defaultVisible: false },
  { id: "positive_rate", label: { en: "Interest rate", ar: "نسبة الاهتمام" }, description: { en: "Interested ÷ contacted.", ar: "المهتمون ÷ من تم التواصل معهم." }, format: "pct", compute: (c) => rate(c.interested, c.contacted), defaultVisible: false },
  { id: "meeting_rate", label: { en: "Meeting rate", ar: "نسبة حجز الاجتماعات" }, description: { en: "Meetings ÷ contacted.", ar: "الاجتماعات ÷ من تم التواصل معهم." }, format: "pct", compute: (c) => rate(c.meetings, c.contacted), defaultVisible: false },
  { id: "confirmed", label: { en: "Confirmed meetings", ar: "اجتماعات مؤكدة" }, description: { en: "Booked meetings whose guest chose the time or accepted the invitation.", ar: "اجتماعات اختار ضيفها الوقت أو قبل الدعوة." }, format: "count", compute: (c) => c.confirmed, defaultVisible: false },
  { id: "held", label: { en: "Meetings held", ar: "اجتماعات تمت" }, description: { en: "Meetings that took place.", ar: "اجتماعات حدثت فعلًا." }, format: "count", compute: (c) => c.held, defaultVisible: false },
  { id: "canceled", label: { en: "Canceled meetings", ar: "اجتماعات ملغاة" }, description: { en: "Meetings canceled by either side.", ar: "اجتماعات ألغاها أحد الطرفين." }, format: "count", compute: (c) => c.canceled, defaultVisible: false },
  { id: "cost_per_confirmed", label: { en: "Cost per confirmed meeting", ar: "تكلفة الاجتماع المؤكد" }, description: { en: "Spend ÷ confirmed meetings.", ar: "الإنفاق ÷ الاجتماعات المؤكدة." }, format: "usd", compute: (c) => cost(c.spendUsd, c.confirmed), defaultVisible: false },
  { id: "cost_per_held", label: { en: "Cost per held meeting", ar: "تكلفة الاجتماع الذي تم" }, description: { en: "Spend ÷ meetings that took place.", ar: "الإنفاق ÷ الاجتماعات التي حدثت." }, format: "usd", compute: (c) => cost(c.spendUsd, c.held), defaultVisible: false },
  { id: "cost_per_reply", label: { en: "Cost per reply", ar: "تكلفة الرد" }, description: { en: "Spend ÷ replies.", ar: "الإنفاق ÷ الردود." }, format: "usd", compute: (c) => cost(c.spendUsd, c.replies), defaultVisible: false },
  { id: "customers", label: { en: "Customers won", ar: "عملاء مكتسبون" }, description: { en: "People this campaign contacted first who became customers within 180 days.", ar: "أشخاص تواصلت معهم الحملة أولًا وأصبحوا عملاء خلال 180 يومًا." }, format: "count", compute: (c) => c.customers, defaultVisible: false },
  { id: "revenue", label: { en: "Revenue", ar: "الإيرادات" }, description: { en: "Value of the deals won (when you entered it).", ar: "قيمة الصفقات المكسوبة (حين تدخلها)." }, format: "usd", compute: (c) => c.revenueUsd, defaultVisible: false },
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
  // Dollars always with the sign (D-273); cents below $100 when there are any.
  if (format === "usd") { const cents = v < 100 && Math.round(v * 100) % 100 !== 0; return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 }).format(v); }
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
