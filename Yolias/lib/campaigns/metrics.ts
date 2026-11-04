import { OBJECTIVE_SPECS, specOf, type Objective } from "@/lib/engine/objectives";

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
  /** D-274: what Yolias found (people and companies), recipients who opened, and the booking link's visits. */
  foundPeople: number;
  foundCompanies: number;
  opened: number;
  visits: number;
  linkBooked: number;
  abandoned: number;
  /** D-274: people who replied with interest or booked a meeting (a qualified lead). */
  qualifiedLeads: number;
  /** D-274: from the Yolias pixel on the member's site, for people Yolias sent there. */
  siteVisits: number;
  /** Owner, 2026-11-05: people who clicked a link in an email, signed up (CompleteRegistration) and became active (Activated). */
  linkClicks: number;
  signups: number;
  activated: number;
  checkouts: number;
  purchases: number;
  purchaseValue: number;
  formLeads: number;
  /** D-274: the campaign's chosen conversion event (website objectives), its value, and the objective's result (like an ads platform's "Results"). */
  conversions: number;
  conversionValue: number;
  results: number;
}

export const zeroCounts = (): Counts => ({ found: 0, contacted: 0, sent: 0, delivered: 0, bounced: 0, replies: 0, interested: 0, meetingRequests: 0, meetings: 0, confirmed: 0, canceled: 0, held: 0, qualified: 0, customers: 0, revenueUsd: 0, spendUsd: 0, prospectsUsed: 0, foundPeople: 0, foundCompanies: 0, opened: 0, visits: 0, linkBooked: 0, abandoned: 0, qualifiedLeads: 0, siteVisits: 0, linkClicks: 0, signups: 0, activated: 0, checkouts: 0, purchases: 0, purchaseValue: 0, formLeads: 0, conversions: 0, conversionValue: 0, results: 0 });
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

// D-273: Yolias sells meetings, not leads or data. D-274 (owner, 2026-11-02):
// the result is a meeting that took place, so "held" and "cost per held
// meeting" lead (like results and cost per result in Facebook Ads); the basic
// counts the owner asked for sit beside them: what Yolias found (people and
// companies), sent / opened / replied / didn't reply and the rates between
// them, and the booking link's visits, bookings and forms left unfinished.
export const METRICS: Metric[] = [
  { id: "results", label: { en: "Results", ar: "النتائج" }, description: { en: "What the campaign's objective counts: meetings booked, purchases or leads on your website (its conversion event), or leads found.", ar: "ما يحسبه هدف الحملة: الاجتماعات المحجوزة، أو الشراء أو العملاء على موقعك (حدث التحويل)، أو العملاء الذين وُجدوا." }, format: "count", compute: (c) => c.results, defaultVisible: true },
  { id: "cost_per_result", label: { en: "Cost per result", ar: "تكلفة النتيجة" }, description: { en: "Spend ÷ results.", ar: "الإنفاق ÷ النتائج." }, format: "usd", compute: (c) => cost(c.spendUsd, c.results), defaultVisible: true },
  { id: "found", label: { en: "Found by Yolias", ar: "اكتشفهم يولياس" }, description: { en: "People and companies Yolias found for the campaign.", ar: "أشخاص وشركات وجدهم يولياس للحملة." }, format: "count", compute: (c) => c.foundPeople + c.foundCompanies, defaultVisible: true },
  { id: "sent", label: { en: "Sent", ar: "المُرسل" }, description: { en: "Emails your mailbox sent (first emails and follow-ups).", ar: "رسائل أرسلها بريدك (الأولى والمتابعات)." }, format: "count", compute: (c) => c.sent, defaultVisible: true },
  { id: "open_rate", label: { en: "Open rate", ar: "نسبة الفتح" }, description: { en: "People who opened ÷ people contacted. Approximate: some mail apps load images without the person reading, and some block them.", ar: "من فتحوا ÷ من تم التواصل معهم. تقريبية: بعض تطبيقات البريد تحمّل الصور دون قراءة، وبعضها يمنعها." }, format: "pct", compute: (c) => rate(c.opened, c.contacted), defaultVisible: true },
  { id: "reply_rate", label: { en: "Reply rate", ar: "نسبة الرد" }, description: { en: "People who replied ÷ people contacted.", ar: "من ردّوا ÷ من تم التواصل معهم." }, format: "pct", compute: (c) => rate(c.replies, c.contacted), defaultVisible: true },
  { id: "meetings", label: { en: "Meetings", ar: "الاجتماعات" }, description: { en: "Meetings booked (canceled ones excluded).", ar: "اجتماعات محجوزة (بدون الملغاة)." }, format: "count", compute: (c) => c.meetings, defaultVisible: true },
  { id: "cost_per_meeting", label: { en: "Cost per meeting", ar: "تكلفة الاجتماع" }, description: { en: "Everything spent finding and contacting people ÷ meetings booked (at your rate per person).", ar: "كل ما صُرف لإيجاد الأشخاص والتواصل معهم ÷ الاجتماعات المحجوزة (بسعرك للشخص)." }, format: "usd", compute: (c) => cost(c.spendUsd, c.meetings), defaultVisible: true },
  { id: "held", label: { en: "Meetings held", ar: "اجتماعات منعقدة" }, description: { en: "Booked meetings that took place.", ar: "اجتماعات محجوزة حدثت فعلًا." }, format: "count", compute: (c) => c.held, defaultVisible: true },
  { id: "cost_per_held", label: { en: "Cost per held meeting", ar: "تكلفة الاجتماع المنعقد" }, description: { en: "Spend ÷ meetings that took place.", ar: "الإنفاق ÷ الاجتماعات التي حدثت." }, format: "usd", compute: (c) => cost(c.spendUsd, c.held), defaultVisible: false },
  { id: "spend", label: { en: "Spend", ar: "الإنفاق" }, description: { en: "People found for the campaign × your rate per person.", ar: "الأشخاص الذين وُجدوا للحملة × سعر الشخص." }, format: "usd", compute: (c) => c.spendUsd, defaultVisible: true },
  { id: "found_people", label: { en: "People found", ar: "أشخاص مكتشفون" }, description: { en: "People Yolias found for the campaign.", ar: "أشخاص وجدهم يولياس للحملة." }, format: "count", compute: (c) => c.foundPeople, defaultVisible: false },
  { id: "found_companies", label: { en: "Targeted companies", ar: "الشركات المستهدفة" }, description: { en: "Companies Yolias found for the campaign's audiences.", ar: "شركات وجدها يولياس لجماهير الحملة." }, format: "count", compute: (c) => c.foundCompanies, defaultVisible: false },
  { id: "contacted", label: { en: "Reached", ar: "وصلت إليهم" }, description: { en: "People sent at least one email (each person once).", ar: "أشخاص أُرسلت لهم رسالة واحدة على الأقل (كل شخص مرة)." }, format: "count", compute: (c) => c.contacted, defaultVisible: false },
  { id: "delivered", label: { en: "Delivered", ar: "وصلت" }, description: { en: "Sent emails that didn't bounce.", ar: "رسائل أُرسلت ولم ترتد." }, format: "count", compute: (c) => c.delivered, defaultVisible: false },
  { id: "opened", label: { en: "Opened", ar: "فتحوا الرسالة" }, description: { en: "People who opened at least one email (approximate).", ar: "أشخاص فتحوا رسالة واحدة على الأقل (تقريبي)." }, format: "count", compute: (c) => c.opened, defaultVisible: false },
  { id: "replies", label: { en: "Replies", ar: "الردود" }, description: { en: "People who replied (automatic replies don't count).", ar: "أشخاص ردّوا (الردود التلقائية لا تُحسب)." }, format: "count", compute: (c) => c.replies, defaultVisible: false },
  { id: "no_reply", label: { en: "Didn't reply", ar: "لم يردوا" }, description: { en: "People contacted who haven't replied.", ar: "أشخاص تم التواصل معهم ولم يردوا." }, format: "count", compute: (c) => (c.contacted ? Math.max(c.contacted - c.replies, 0) : null), defaultVisible: false },
  { id: "open_to_reply", label: { en: "Replied after opening", ar: "ردّوا من الفاتحين" }, description: { en: "People who replied ÷ people who opened.", ar: "من ردّوا ÷ من فتحوا." }, format: "pct", compute: (c) => rate(c.replies, c.opened), defaultVisible: false },
  { id: "interested", label: { en: "Interested", ar: "المهتمون" }, description: { en: "People whose reply showed interest or asked for a meeting.", ar: "أشخاص أظهر ردهم اهتمامًا أو طلب اجتماعًا." }, format: "count", compute: (c) => c.interested, defaultVisible: false },
  { id: "positive_rate", label: { en: "Positive reply rate", ar: "نسبة الردود الإيجابية" }, description: { en: "Positive replies ÷ contacted.", ar: "الردود الإيجابية ÷ من تم التواصل معهم." }, format: "pct", compute: (c) => rate(c.interested, c.contacted), defaultVisible: false },
  { id: "qualified_leads", label: { en: "Qualified leads", ar: "عملاء مؤهلون" }, description: { en: "People who replied with interest or booked a meeting.", ar: "أشخاص ردّوا باهتمام أو حجزوا اجتماعًا." }, format: "count", compute: (c) => c.qualifiedLeads, defaultVisible: false },
  { id: "cost_per_qualified_lead", label: { en: "Cost per qualified lead", ar: "تكلفة العميل المؤهل" }, description: { en: "Spend ÷ qualified leads.", ar: "الإنفاق ÷ العملاء المؤهلين." }, format: "usd", compute: (c) => cost(c.spendUsd, c.qualifiedLeads), defaultVisible: false },
  { id: "visits", label: { en: "Booking link visits", ar: "زيارات رابط الاجتماع" }, description: { en: "People who opened your booking link from the campaign.", ar: "أشخاص فتحوا رابط حجز الاجتماع من الحملة." }, format: "count", compute: (c) => c.visits, defaultVisible: false },
  { id: "link_booked", label: { en: "Booked from the link", ar: "حجزوا من الرابط" }, description: { en: "Visitors who filled in their details and booked.", ar: "زوار أدخلوا بياناتهم وحجزوا." }, format: "count", compute: (c) => c.linkBooked, defaultVisible: false },
  { id: "abandoned", label: { en: "Started, didn't book", ar: "بدأوا ولم يكملوا" }, description: { en: "Visitors who started the form and left before booking, like an abandoned checkout.", ar: "زوار بدأوا إدخال بياناتهم وغادروا قبل الحجز، مثل سلة تُركت." }, format: "count", compute: (c) => c.abandoned, defaultVisible: false },
  { id: "link_rate", label: { en: "Visit-to-booking rate", ar: "نسبة الحجز من الزيارات" }, description: { en: "Booked from the link ÷ visits.", ar: "الحجوزات من الرابط ÷ الزيارات." }, format: "pct", compute: (c) => rate(c.linkBooked, c.visits), defaultVisible: false },
  { id: "delivery_rate", label: { en: "Delivery rate", ar: "نسبة الوصول" }, description: { en: "Sent emails that didn't bounce.", ar: "الرسائل المرسلة التي لم ترتد." }, format: "pct", compute: (c) => rate(c.delivered, c.sent), defaultVisible: false },
  { id: "bounced", label: { en: "Bounced", ar: "ارتدت" }, description: { en: "Emails that came back undelivered.", ar: "رسائل عادت دون أن تصل." }, format: "count", compute: (c) => c.bounced, defaultVisible: false },
  { id: "meeting_rate", label: { en: "Meeting booking rate", ar: "نسبة حجز الاجتماعات" }, description: { en: "Meetings booked ÷ contacted.", ar: "الاجتماعات المحجوزة ÷ من تم التواصل معهم." }, format: "pct", compute: (c) => rate(c.meetings, c.contacted), defaultVisible: false },
  { id: "show_rate", label: { en: "Show rate", ar: "نسبة الحضور" }, description: { en: "Meetings held ÷ meetings booked.", ar: "الاجتماعات المنعقدة ÷ المحجوزة." }, format: "pct", compute: (c) => rate(c.held, c.meetings), defaultVisible: false },
  { id: "confirmed", label: { en: "Confirmed meetings", ar: "اجتماعات مؤكدة" }, description: { en: "Booked meetings whose guest chose the time or accepted the invitation.", ar: "اجتماعات اختار ضيفها الوقت أو قبل الدعوة." }, format: "count", compute: (c) => c.confirmed, defaultVisible: false },
  { id: "canceled", label: { en: "Canceled meetings", ar: "اجتماعات ملغاة" }, description: { en: "Meetings canceled by either side.", ar: "اجتماعات ألغاها أحد الطرفين." }, format: "count", compute: (c) => c.canceled, defaultVisible: false },
  { id: "cost_per_confirmed", label: { en: "Cost per confirmed meeting", ar: "تكلفة الاجتماع المؤكد" }, description: { en: "Spend ÷ confirmed meetings.", ar: "الإنفاق ÷ الاجتماعات المؤكدة." }, format: "usd", compute: (c) => cost(c.spendUsd, c.confirmed), defaultVisible: false },
  { id: "cost_per_reply", label: { en: "Cost per reply", ar: "تكلفة الرد" }, description: { en: "Spend ÷ replies.", ar: "الإنفاق ÷ الردود." }, format: "usd", compute: (c) => cost(c.spendUsd, c.replies), defaultVisible: false },
  { id: "customers", label: { en: "Deals won", ar: "صفقات مكسوبة" }, description: { en: "People this campaign contacted first who became customers within 180 days.", ar: "أشخاص تواصلت معهم الحملة أولًا وأصبحوا عملاء خلال 180 يومًا." }, format: "count", compute: (c) => c.customers, defaultVisible: false },
  { id: "revenue", label: { en: "Revenue generated", ar: "الإيرادات المحققة" }, description: { en: "Value of the deals won (when you entered it).", ar: "قيمة الصفقات المكسوبة (حين تدخلها)." }, format: "usd", compute: (c) => c.revenueUsd, defaultVisible: false },
  // D-274: website objectives, measured by the Yolias pixel.
  // Owner, 2026-11-05: the path from the email to the customer, on by default.
  { id: "link_clicks", label: { en: "Link clicks", ar: "نقرات الرابط" }, description: { en: "People who clicked a link in an email (mail scanners don't count).", ar: "أشخاص ضغطوا رابطًا داخل الرسالة (لا تُحسب أنظمة فحص البريد)." }, format: "count", compute: (c) => c.linkClicks, defaultVisible: true },
  { id: "site_visits", label: { en: "Visits", ar: "الزيارات" }, description: { en: "People who opened your website (pixel) or your booking page from a Yolias link.", ar: "أشخاص فتحوا موقعك (البيكسل) أو صفحة الحجز من رابط أرسله يولياس." }, format: "count", compute: (c) => c.siteVisits + c.visits, defaultVisible: true },
  { id: "signups", label: { en: "Signups", ar: "التسجيلات" }, description: { en: "CompleteRegistration events from people Yolias sent.", ar: "أحداث التسجيل من أشخاص أرسلهم يولياس." }, format: "count", compute: (c) => c.signups, defaultVisible: true },
  { id: "activated", label: { en: "Activated", ar: "المفعّلون" }, description: { en: "Activated events from people Yolias sent.", ar: "أحداث التفعيل من أشخاص أرسلهم يولياس." }, format: "count", compute: (c) => c.activated, defaultVisible: true },
  { id: "checkouts", label: { en: "Checkout", ar: "بدء الدفع" }, description: { en: "InitiateCheckout events from people Yolias sent.", ar: "أحداث بدء الدفع من أشخاص أرسلهم يولياس." }, format: "count", compute: (c) => c.checkouts, defaultVisible: true },
  { id: "purchases", label: { en: "Purchases", ar: "عمليات الشراء" }, description: { en: "Purchase events from people Yolias sent (pixel).", ar: "أحداث الشراء من أشخاص أرسلهم يولياس (البيكسل)." }, format: "count", compute: (c) => c.purchases, defaultVisible: false },
  { id: "cost_per_purchase", label: { en: "Cost per purchase", ar: "تكلفة الشراء" }, description: { en: "Spend ÷ purchases.", ar: "الإنفاق ÷ عمليات الشراء." }, format: "usd", compute: (c) => cost(c.spendUsd, c.purchases), defaultVisible: false },
  { id: "purchase_value", label: { en: "Purchase value", ar: "قيمة المبيعات" }, description: { en: "Total value of the purchases (USD).", ar: "إجمالي قيمة المشتريات (بالدولار)." }, format: "usd", compute: (c) => c.purchaseValue, defaultVisible: false },
  { id: "purchase_roas", label: { en: "Purchase ROAS", ar: "العائد على الإنفاق (المبيعات)" }, description: { en: "Purchase (or conversion) value ÷ spend.", ar: "قيمة المبيعات (أو التحويلات) ÷ الإنفاق." }, format: "ratio", compute: (c) => { const v = c.purchaseValue || c.conversionValue; return c.spendUsd > 0 && v > 0 ? v / c.spendUsd : null; }, defaultVisible: false },
  { id: "form_leads", label: { en: "Website leads (forms)", ar: "نماذج الموقع" }, description: { en: "Lead events (forms filled) from people Yolias sent.", ar: "أحداث ملء النموذج من أشخاص أرسلهم يولياس." }, format: "count", compute: (c) => c.formLeads, defaultVisible: false },
  { id: "cost_per_form_lead", label: { en: "Cost per website lead", ar: "تكلفة النموذج" }, description: { en: "Spend ÷ website leads.", ar: "الإنفاق ÷ نماذج الموقع." }, format: "usd", compute: (c) => cost(c.spendUsd, c.formLeads), defaultVisible: false },
  { id: "conversions", label: { en: "Website conversions", ar: "تحويلات الموقع" }, description: { en: "The campaign's conversion event on your website (pixel), within the attribution window.", ar: "حدث التحويل الذي اختارته الحملة على موقعك (البيكسل)، خلال نافذة الاحتساب." }, format: "count", compute: (c) => c.conversions, defaultVisible: false },
  { id: "conversion_value", label: { en: "Conversion value", ar: "قيمة التحويلات" }, description: { en: "Total value of the conversions (USD).", ar: "إجمالي قيمة التحويلات (بالدولار)." }, format: "usd", compute: (c) => c.conversionValue, defaultVisible: false },
  { id: "cost_per_lead", label: { en: "Cost per lead", ar: "تكلفة العميل المحتمل" }, description: { en: "Spend ÷ people and companies found that match the targeting.", ar: "الإنفاق ÷ الأشخاص والشركات المطابقين للاستهداف." }, format: "usd", compute: (c) => cost(c.spendUsd, c.foundPeople + c.foundCompanies), defaultVisible: false },
  { id: "cac", label: { en: "Customer acquisition cost", ar: "تكلفة اكتساب العميل" }, description: { en: "Spend ÷ deals won.", ar: "الإنفاق ÷ الصفقات المكسوبة." }, format: "usd", compute: (c) => cost(c.spendUsd, c.customers), defaultVisible: false },
  { id: "roi", label: { en: "ROI", ar: "العائد على الاستثمار" }, description: { en: "(Revenue − spend) ÷ spend, when both are known.", ar: "(الإيرادات − الإنفاق) ÷ الإنفاق، حين يُعرف الاثنان." }, format: "pct", compute: (c) => (c.spendUsd > 0 && c.revenueUsd > 0 ? (c.revenueUsd - c.spendUsd) / c.spendUsd : null), defaultVisible: false },
  { id: "roas", label: { en: "Return on spend", ar: "العائد على الإنفاق" }, description: { en: "Revenue ÷ spend, when both are known.", ar: "الإيرادات ÷ الإنفاق، حين يُعرف الاثنان." }, format: "ratio", compute: (c) => (c.spendUsd > 0 && c.revenueUsd > 0 ? c.revenueUsd / c.spendUsd : null), defaultVisible: false },
];


export const metric = (id: string) => METRICS.find((m) => m.id === id) ?? null;
// The first columns (owner, 2026-11-03): Reached, Replies, Interested, Meetings; then the rest that are on by default.
const LEAD_COLUMNS = ["results", "cost_per_result", "contacted", "replies", "interested", "meetings"];
export const DEFAULT_COLUMNS = [...LEAD_COLUMNS, ...METRICS.filter((m) => m.defaultVisible && !LEAD_COLUMNS.includes(m.id)).map((m) => m.id)];
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

// ---------------------------------------------------------------- objectives (D-274)

// D-279: objectives are entries of the Acquisition Engine (lib/engine/objectives.ts).
export type { Objective } from "@/lib/engine/objectives";
export { OBJECTIVES, isObjective } from "@/lib/engine/objectives";

/** Each objective's result and cost per result, like an ads platform's "Results" columns. */
export const RESULT_OF = Object.fromEntries(Object.values(OBJECTIVE_SPECS).map((s) => [s.id, s.columns])) as Record<Objective, { result: string; cost: string }>;

/** Pure: the objective's result from the counts (unit-tested). */
export function resultOf(objective: string | null | undefined, c: Counts): number {
  return specOf(objective).result(c);
}

/** Ready column sets per objective (the member can still add, move and remove columns). */
export const PRESETS: Record<Objective, string[]> = {
  meetings: ["results", "cost_per_result", "contacted", "replies", "interested", "meetings", "reply_rate", "held", "spend", "cost_per_meeting"],
  purchases: ["results", "cost_per_result", "conversion_value", "purchase_roas", "site_visits", "checkouts", "found", "sent", "reply_rate", "spend"],
  form_leads: ["results", "cost_per_result", "site_visits", "found", "sent", "open_rate", "reply_rate", "spend"],
  qualified_leads: ["results", "cost_per_result", "found_companies", "found_people", "spend"],
};

// ---------------------------------------------------------------- custom metrics (D-274)

export interface CustomMetricDef { id: string; name: string; a: string; op: "+" | "-" | "*" | "/"; b: string; format: MetricFormat }

/** Pure: a custom metric (a name and "metric op metric") as a column like the others; null when an operand can't be worked out. */
export function customMetric(d: CustomMetricDef): Metric {
  const A = metric(d.a), B = metric(d.b);
  return {
    id: `cm:${d.id}`, label: { en: d.name, ar: d.name },
    description: { en: `${A?.label.en ?? d.a} ${d.op} ${B?.label.en ?? d.b}`, ar: `${A?.label.ar ?? d.a} ${d.op} ${B?.label.ar ?? d.b}` },
    format: d.format, defaultVisible: false,
    compute: (c) => {
      const x = A?.compute(c), y = B?.compute(c);
      if (x == null || y == null) return null;
      if (d.op === "/") return y === 0 ? null : x / y;
      return d.op === "+" ? x + y : d.op === "-" ? x - y : x * y;
    },
  };
}
