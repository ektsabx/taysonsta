// Messaging & Automation catalog (owner brief 2026-10-20, D-243): the events
// a flow can start from, exit on or aim for, and the user facts its rules can
// check. Shared by the Yolias engine and Yolias Admin (imported by relative
// path), so no "@/" imports here. Labels are Arabic (the Admin's language;
// its English dictionary translates them).
//
// Every event is a row in public.funnel_events (the event registry). Most are
// written by database triggers from server truth (payments, subscription
// events, profiles, searches); a few by the app (pricing / checkout pages)
// and a few by the messaging sweep (time-based: trial ending, inactivity).

export type EventGroup = "account" | "usage" | "billing";

export interface EventDef {
  id: string;
  group: EventGroup;
  label: string;
  description: string;
  /** Where the event comes from (shown in Admin). */
  source: "trigger" | "app" | "sweep" | "derived";
  /** A derived event is a registry event with a filter on its props. */
  base?: string;
  where?: { prop: string; in: string[] };
  /** False: not recorded by Yolias (shown, but can't be picked). */
  available?: boolean;
  /** Props flows can read from this event (rules "event.<prop>"). */
  props?: string[];
}

export const EVENTS: EventDef[] = [
  { id: "user_registered", group: "account", label: "مستخدم سجّل", description: "أول دخول بحساب جديد (يتم التسجيل برابط دخول على البريد، فالبريد مؤكد).", source: "trigger", props: ["source"] },
  { id: "email_verified", group: "account", label: "تأكيد البريد", description: "التسجيل في Yolias يتم برابط دخول، فكل حساب مؤكد من لحظة إنشائه: استخدم «مستخدم سجّل».", source: "trigger", available: false },
  { id: "onboarding_completed", group: "account", label: "أكمل الإعداد الأولي", description: "أنهى المستخدم صفحة الإعداد (بيانات الشركة).", source: "trigger" },
  { id: "user_inactive", group: "account", label: "أصبح غير نشط", description: "لم يفتح Yolias منذ عدد الأيام المحدد في الإعدادات.", source: "sweep", props: ["days"] },
  { id: "user_returned", group: "account", label: "عاد إلى المنصة", description: "فتح Yolias بعد أن سُجّل غير نشط.", source: "sweep", props: ["days_away"] },
  { id: "user_stopped_using", group: "usage", label: "توقف عن استخدام المنتج", description: "لم يفتح Yolias منذ المدة الطويلة المحددة في الإعدادات.", source: "sweep", props: ["days"] },
  { id: "search_started", group: "usage", label: "بدأ بحثًا", description: "كتب المستخدم طلب بحث جديد.", source: "trigger" },
  { id: "search_completed", group: "usage", label: "اكتمل بحث", description: "انتهى بحث (كاملًا أو بنتائج أقل من المطلوب).", source: "trigger", props: ["prospects", "status"] },
  { id: "prospects_found", group: "usage", label: "وجد عملاء محتملين", description: "انتهى بحث بعميل محتمل واحد على الأقل.", source: "trigger", props: ["prospects"] },
  { id: "usage_milestone", group: "usage", label: "وصل إلى مرحلة استخدام", description: "تجاوزت مساحة العمل 10 أو 50 أو 100 أو 500 أو 1000 عميل محتمل.", source: "trigger", props: ["milestone", "prospects"] },
  { id: "plans_viewed", group: "billing", label: "شاهد صفحة الأسعار", description: "زيارة لصفحة الأسعار من المتصفح (مشاهدة، لا تعني نية شراء مؤكدة).", source: "app" },
  { id: "checkout_opened", group: "billing", label: "بدأ الدفع (Checkout)", description: "فتح صفحة الدفع لخطة.", source: "app", props: ["plan"] },
  { id: "checkout_abandoned", group: "billing", label: "ترك الدفع", description: "صفحة دفع بلا نشاط بعد المدة المحددة في تتبع الدفع، وبلا دفعة مؤكدة.", source: "trigger", props: ["reason", "plan"] },
  { id: "payment_cancelled", group: "billing", label: "ألغى الدفع", description: "ترك صفحة مزود الدفع أو عاد منها دون إتمام، أو انتهت صلاحيتها.", source: "derived", base: "checkout_abandoned", where: { prop: "reason", in: ["left_at_gateway", "returned_not_completed", "gateway_expired"] }, props: ["reason", "plan"] },
  { id: "payment_failed", group: "billing", label: "فشل الدفع", description: "رفض مزود الدفع العملية (مؤكد من المزود).", source: "trigger", props: ["reason", "plan"] },
  { id: "payment_succeeded", group: "billing", label: "نجح الدفع", description: "دفعة مؤكدة من مزود الدفع.", source: "trigger", props: ["plan"] },
  { id: "subscription_activated", group: "billing", label: "بدأ الاشتراك", description: "تفعيل خطة مدفوعة أو تجربة بعد تأكيد الدفع.", source: "trigger", props: ["plan", "status"] },
  { id: "checkout_recovered", group: "billing", label: "استُعيد دفع متروك", description: "اشترك المستخدم بعد أن ترك صفحة دفع سابقة.", source: "trigger", props: ["plan"] },
  { id: "trial_started", group: "billing", label: "بدأت التجربة", description: "بدء الفترة التجريبية.", source: "trigger", props: ["plan"] },
  { id: "trial_ending_soon", group: "billing", label: "التجربة قاربت على الانتهاء", description: "تبقّى على نهاية التجربة عدد الأيام المحدد في الإعدادات.", source: "sweep", props: ["days_left"] },
  { id: "trial_expired", group: "billing", label: "انتهت التجربة", description: "انتهت الفترة التجريبية.", source: "trigger", props: ["plan"] },
  { id: "subscription_renewed", group: "billing", label: "تجدد الاشتراك", description: "تجديد مدفوع ومؤكد.", source: "trigger", props: ["plan"] },
  { id: "subscription_cancelled", group: "billing", label: "ألغى الاشتراك", description: "طلب إلغاء الخطة (تبقى فعالة حتى نهاية الفترة).", source: "trigger", props: ["plan"] },
  { id: "subscription_ended", group: "billing", label: "انتهى الاشتراك", description: "انتهت الخطة فعليًا.", source: "trigger", props: ["plan"] },
  { id: "payment_overdue", group: "billing", label: "دفعة متأخرة", description: "تجديد لم يُدفع في موعده.", source: "trigger", props: ["plan"] },
];

export const EVENT_IDS = EVENTS.map((e) => e.id);
export const eventDef = (id: string | null | undefined) => EVENTS.find((e) => e.id === id) ?? null;
export const selectableEvents = EVENTS.filter((e) => e.available !== false);

/** The catalog event ids a registry row stands for (itself, plus any derived event it matches). */
export function eventIdsFor(name: string, props: Record<string, unknown> | null | undefined): string[] {
  const ids = EVENTS.some((e) => e.id === name && !e.base) ? [name] : [];
  for (const e of EVENTS) {
    if (e.base !== name || !e.where) continue;
    const v = props?.[e.where.prop];
    if (typeof v === "string" && e.where.in.includes(v)) ids.push(e.id);
  }
  return ids;
}

// ── User facts (public.msg_user_facts) that rules can check ──

export type FieldType = "bool" | "number" | "enum" | "text";

export interface FieldDef {
  id: string;
  label: string;
  type: FieldType;
  options?: { value: string; label: string }[];
  unit?: string;
}

export const FIELDS: FieldDef[] = [
  { id: "has_plan", label: "لديه خطة فعالة (مدفوعة أو تجربة)", type: "bool" },
  { id: "subscription_status", label: "حالة الاشتراك", type: "enum", options: [
    { value: "none", label: "بدون اشتراك" }, { value: "trialing", label: "فترة تجريبية" }, { value: "active", label: "مشترك" },
    { value: "test", label: "اشتراك تجريبي (وضع الاختبار)" }, { value: "past_due", label: "دفعة متأخرة" }, { value: "canceled", label: "ملغى" },
  ] },
  { id: "plan", label: "الخطة", type: "enum", options: [{ value: "free", label: "بدون خطة" }, { value: "pro", label: "Pro" }, { value: "growth", label: "Growth" }, { value: "scale", label: "Scale" }] },
  { id: "billing_period", label: "فترة الفوترة", type: "enum", options: [{ value: "monthly", label: "شهري" }, { value: "annual", label: "سنوي" }] },
  { id: "cancel_at_period_end", label: "طلب الإلغاء في نهاية الفترة", type: "bool" },
  { id: "trial_days_left", label: "الأيام المتبقية في التجربة", type: "number", unit: "يوم" },
  { id: "open_checkout", label: "لديه دفع مفتوح أو متروك لم يكتمل", type: "bool" },
  { id: "failed_payments_7d", label: "مرات فشل الدفع آخر 7 أيام", type: "number" },
  { id: "days_since_signup", label: "أيام منذ التسجيل", type: "number", unit: "يوم" },
  { id: "days_inactive", label: "أيام بدون استخدام", type: "number", unit: "يوم" },
  { id: "onboarded", label: "أكمل الإعداد الأولي", type: "bool" },
  { id: "searches", label: "عدد عمليات البحث", type: "number" },
  { id: "prospects", label: "عدد العملاء المحتملين المكتشفين", type: "number" },
  { id: "language", label: "لغة المستخدم", type: "enum", options: [{ value: "ar", label: "العربية" }, { value: "en", label: "English" }] },
  { id: "country", label: "الدولة (رمز من حرفين)", type: "text" },
  { id: "role", label: "الدور في مساحة العمل", type: "enum", options: [{ value: "owner", label: "المالك" }, { value: "admin", label: "مسؤول" }, { value: "member", label: "عضو" }] },
  { id: "marketing_opt_in", label: "وافق على رسائل تحديثات المنتج", type: "bool" },
  { id: "event.plan", label: "الحدث: الخطة", type: "text" },
  { id: "event.reason", label: "الحدث: السبب", type: "text" },
  { id: "event.prospects", label: "الحدث: عدد العملاء المحتملين", type: "number" },
  { id: "event.milestone", label: "الحدث: المرحلة", type: "number" },
];

export const fieldDef = (id: string) => FIELDS.find((f) => f.id === id) ?? null;

export const OPS: Record<FieldType, { value: string; label: string }[]> = {
  bool: [{ value: "is", label: "هو" }],
  number: [{ value: "gte", label: "≥" }, { value: "lte", label: "≤" }, { value: "gt", label: ">" }, { value: "lt", label: "<" }, { value: "is", label: "=" }],
  enum: [{ value: "in", label: "واحد من" }, { value: "not_in", label: "ليس من" }],
  text: [{ value: "is", label: "يساوي" }, { value: "is_not", label: "لا يساوي" }, { value: "contains", label: "يحتوي" }, { value: "exists", label: "موجود" }, { value: "not_exists", label: "غير موجود" }],
};

// ── Steps a flow can run ──

export const STEP_TYPES = [
  { type: "email", label: "إرسال إيميل" },
  { type: "notification", label: "إشعار داخل المنصة" },
  { type: "wait", label: "انتظار" },
  { type: "branch", label: "تفرّع حسب شرط" },
  { type: "exit", label: "إنهاء المسار" },
] as const;

// ── Template variables ──

export const VARIABLES: { name: string; label: string; sample: string }[] = [
  { name: "first_name", label: "الاسم الأول", sample: "Sara" },
  { name: "full_name", label: "الاسم الكامل", sample: "Sara Ahmed" },
  { name: "email", label: "البريد", sample: "sara@example.com" },
  { name: "company", label: "اسم مساحة العمل", sample: "Nile Logistics" },
  { name: "plan", label: "الخطة الحالية", sample: "Growth" },
  { name: "checkout_plan", label: "الخطة في آخر دفع", sample: "Growth" },
  { name: "checkout_plan_suffix", label: "« (الخطة)» إن وُجدت", sample: " (Growth)" },
  { name: "trial_ends", label: "تاريخ نهاية التجربة", sample: "October 27, 2026" },
  { name: "app_url", label: "رابط فتح Yolias", sample: "https://www.yolias.com/" },
  { name: "pricing_url", label: "رابط الأسعار", sample: "https://www.yolias.com/pricing" },
  { name: "checkout_url", label: "رابط إكمال الاشتراك", sample: "https://www.yolias.com/checkout?plan=growth" },
  { name: "unsubscribe_url", label: "رابط إلغاء الاشتراك من الرسائل", sample: "https://www.yolias.com/unsubscribe/…" },
];

export const EMAIL_CLASSES = [
  { value: "transactional", label: "تشغيلية (عن الحساب أو الدفع، تُرسل دائمًا)" },
  { value: "lifecycle", label: "دورة حياة (ترحيب واستعادة، تتوقف لمن ألغى الاشتراك من الرسائل)" },
  { value: "marketing", label: "تسويقية (إعلانات وعروض، تتوقف لمن ألغى الاشتراك من الرسائل)" },
] as const;
export type EmailClass = (typeof EMAIL_CLASSES)[number]["value"];
