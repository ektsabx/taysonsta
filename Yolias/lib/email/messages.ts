// Every Yolias product email beyond the original four, grouped by category
// (account, subscription, billing, usage, updates, security). Same layout and
// voice as templates.ts. No "@/" imports: the email build script and the
// preview page load this file directly.
//
// A template exists here only for an event Yolias really has, or will have
// as soon as its feature lands (payments: D-007). See lib/email/catalog.ts
// for who receives each one and what triggers it.

import { layout, price, type EmailLocale, type RenderedEmail } from "./templates.ts";

const C = { ink: "#141413", muted: "#6b6b66", line: "#e8e8e3", red: "#cf2525" };
const FONT_EN = "'DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
const FONT_AR = "'Noto Kufi Arabic','Segoe UI',Tahoma,Arial,sans-serif";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
const money = (amount: number, currency?: "USD") => `<span dir="ltr">${price(amount, currency)}</span>`;
function day(iso: string, l: EmailLocale) {
  return new Intl.DateTimeFormat(l === "ar" ? "ar-u-nu-latn" : "en-US", { year: "numeric", month: "long", day: "numeric" }).format(new Date(iso));
}
function moment(iso: string, l: EmailLocale) {
  return new Intl.DateTimeFormat(l === "ar" ? "ar-u-nu-latn" : "en-US", { dateStyle: "long", timeStyle: "short", timeZone: "UTC" }).format(new Date(iso)) + " UTC";
}
function table(l: EmailLocale, items: [string, string][]): string {
  const font = l === "ar" ? FONT_AR : FONT_EN;
  const end = l === "ar" ? "left" : "right";
  const cell = `font-family:${font};font-size:14px;line-height:1.5;padding:10px 0;border-bottom:1px solid ${C.line}`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${items
    .map(([k, v]) => `<tr><td style="${cell};color:${C.muted}">${esc(k)}</td><td style="${cell};color:${C.ink};text-align:${end}">${v}</td></tr>`)
    .join("")}</table>`;
}
const link = (href: string, text: string) => `<a href="${href}" style="color:${C.ink}">${esc(text)}</a>`;
const warn = (html: string) => `<span style="color:${C.red}">${html}</span>`;

interface Copy {
  subject: string;
  preheader: string;
  heading: string;
  body: string[];
  button?: { label: string; href: string };
  extra?: string;
  footnote: string;
}
const T = (l: EmailLocale, en: string, ar: string) => (l === "ar" ? ar : en);
function render(l: EmailLocale, siteUrl: string, c: Copy): RenderedEmail {
  return { subject: c.subject, html: layout({ locale: l, siteUrl, preheader: c.preheader, heading: c.heading, body: c.body, button: c.button, extra: c.extra, footnote: c.footnote }) };
}

const securityNote = (l: EmailLocale, site: string) =>
  T(l, `If this wasn’t you, ${link(`${site}/`, "sign out of all devices")} from Settings → Account and ${link(`${site}/contact?topic=support`, "contact us")}.`,
    `إذا لم تكن أنت، ${link(`${site}/`, "سجّل الخروج من كل الأجهزة")} من الإعدادات ← الحساب و${link(`${site}/contact?topic=support`, "تواصل معنا")}.`);
const billingNote = (l: EmailLocale, site: string) =>
  T(l, `Questions about billing? ${link(`${site}/contact?topic=support`, "Contact us")}.`, `لديك سؤال عن الفوترة؟ ${link(`${site}/contact?topic=support`, "تواصل معنا")}.`);
const testNote = (l: EmailLocale) => warn(T(l, "Test mode — no real charge was made.", "وضع الاختبار — لم يتم تحصيل أي مبلغ فعلي."));

/* ───────────────────────── Data per message ───────────────────────── */

interface Base {
  siteUrl: string;
}
interface PlanData extends Base {
  planName: string;
  period: "monthly" | "annual";
  amount: number;
  currency?: "USD";
  periodEnd: string;
  test: boolean;
}
interface PlanChangeData extends PlanData {
  fromPlanName: string;
  prospectsPerMonth: number;
}
interface InvoiceData extends Base {
  invoiceId: string;
  invoiceNumber: string;
  planName: string;
  amount: number;
  currency?: "USD";
  dueAt: string | null;
  test: boolean;
}
interface PaymentProblemData extends Base {
  planName: string;
  amount: number;
  currency?: "USD";
  reason: string | null;
  retryAt: string | null;
}
interface RefundData extends Base {
  invoiceNumber: string;
  amount: number;
  currency?: "USD";
  reason: string | null;
}
interface SignInData extends Base {
  at: string;
  device: string;
  ip: string | null;
}

export type AnnouncementType = "new_feature" | "feature_available" | "feature_updated" | "important_changes" | "plan_changes" | "pricing_change" | "service_update";

export interface MessageData {
  welcome: Base & { name: string | null };
  account_deleted: Base & { email: string };
  new_sign_in: SignInData;
  suspicious_sign_in: Base & { attempts: number; windowMinutes: number };
  security_alert: Base & { event: "signed_out_everywhere" | "email_changed" | "account_suspended" | "account_restored"; at: string };
  plan_welcome: PlanData & { prospectsPerMonth: number };
  subscription_activated: PlanData;
  renewal_upcoming: PlanData;
  subscription_renewed: PlanData & { invoiceId: string; invoiceNumber: string };
  subscription_ending: Base & { planName: string; endsAt: string };
  plan_upgraded: PlanChangeData;
  plan_downgraded: PlanChangeData;
  subscription_paused: Base & { planName: string; reason: string | null };
  access_restored: Base & { planName: string };
  payment_failed: PaymentProblemData;
  payment_method_attention: Base & { reason: string | null };
  invoice_ready: InvoiceData;
  refund_processed: RefundData;
  refund_issued: RefundData;
  payment_overdue: PaymentProblemData & { daysOverdue: number };
  prospects_added: Base & { added: number; allowance: number; reason: string | null };
  announcement: Base & { type: AnnouncementType; title: string; body: string; ctaLabel: string | null; ctaUrl: string | null };
}
export type MessageKind = keyof MessageData;

const announcementEyebrow: Record<AnnouncementType, [string, string]> = {
  new_feature: ["Introducing", "جديد"],
  feature_available: ["Now available", "متاح الآن"],
  feature_updated: ["Updated", "تحديث"],
  important_changes: ["Important changes to Yolias", "تغييرات مهمة في يولـياس"],
  plan_changes: ["Changes to your plan", "تغييرات على خطتك"],
  pricing_change: ["New pricing coming", "أسعار جديدة قادمة"],
  service_update: ["Service update", "تحديث الخدمة"],
};

/** Admin-written text: escaped, blank lines become paragraphs. */
function paragraphs(text: string): string[] {
  return text.split(/\n\s*\n/).map((p) => esc(p.trim()).replace(/\n/g, "<br>")).filter(Boolean);
}

/* ───────────────────────── Messages ───────────────────────── */

const messages: { [K in MessageKind]: (l: EmailLocale, d: MessageData[K]) => Copy } = {
  /* Account */
  welcome: (l, d) => ({
    subject: T(l, "Welcome to Yolias", "أهلًا بك في يولـياس"),
    preheader: T(l, "Tell Yolias who you sell to. It finds the decision makers.", "أخبر يولـياس بمن تبيع له، وسيجد لك صنّاع القرار."),
    heading: T(l, d.name ? `Welcome to Yolias, ${d.name}` : "Welcome to Yolias", d.name ? `أهلًا بك في يولـياس يا ${d.name}` : "أهلًا بك في يولـياس"),
    body: [
      T(l, "Your workspace is ready. Describe your ideal customer in one sentence — industry, market, company size, titles — by typing or by voice, in Arabic or English.",
        "مساحة عملك جاهزة. صِف عميلك المثالي في جملة واحدة — المجال والسوق وحجم الشركة والمسميات — بالكتابة أو بالصوت، بالعربية أو الإنجليزية."),
      T(l, "Yolias turns it into a search, finds matching companies and their decision makers, and scores each match.",
        "يحوّلها يولـياس إلى عملية بحث، ويجد الشركات المطابقة وصنّاع القرار فيها، ويقيّم كل نتيجة."),
    ],
    button: { label: T(l, "Start your first search", "ابدأ أول عملية بحث"), href: `${d.siteUrl}/` },
    footnote: T(l, `Need a hand? Visit the ${link(`${d.siteUrl}/help-center`, "Help Center")}.`, `تحتاج مساعدة؟ زر ${link(`${d.siteUrl}/help-center`, "مركز المساعدة")}.`),
  }),
  account_deleted: (l, d) => ({
    subject: T(l, "Your Yolias account has been deleted", "تم حذف حسابك في يولـياس"),
    preheader: T(l, "This confirms your account was deleted.", "هذا تأكيد بحذف حسابك."),
    heading: T(l, "Your account has been deleted", "تم حذف حسابك"),
    body: [
      T(l, `The Yolias account for <strong dir="ltr">${esc(d.email)}</strong> was deleted, together with the data you owned in it. You won’t receive further emails about it.`,
        `تم حذف حساب يولـياس الخاص بـ <strong dir="ltr">${esc(d.email)}</strong> مع البيانات التي كنت تملكها فيه. لن تصلك رسائل أخرى بخصوصه.`),
      T(l, "You’re welcome back any time with a new account.", "يسعدنا عودتك في أي وقت بحساب جديد."),
    ],
    footnote: T(l, `Didn’t delete your account? ${link(`${d.siteUrl}/contact?topic=support`, "Contact us right away")}.`, `لم تحذف حسابك؟ ${link(`${d.siteUrl}/contact?topic=support`, "تواصل معنا فورًا")}.`),
  }),

  /* Security */
  new_sign_in: (l, d) => ({
    subject: T(l, "New sign-in to your Yolias account", "تسجيل دخول جديد إلى حسابك في يولـياس"),
    preheader: T(l, `Signed in from ${d.device}.`, `تم تسجيل الدخول من ${d.device}.`),
    heading: T(l, "New sign-in detected", "تم رصد تسجيل دخول جديد"),
    body: [T(l, "Your account was just signed in to from a device we haven’t seen before.", "تم تسجيل الدخول إلى حسابك للتو من جهاز لم نره من قبل.")],
    extra: table(l, [
      [T(l, "Time", "الوقت"), moment(d.at, l)],
      [T(l, "Device", "الجهاز"), esc(d.device)],
      ...(d.ip ? ([[T(l, "IP address", "عنوان IP"), `<span dir="ltr">${esc(d.ip)}</span>`]] as [string, string][]) : []),
    ]),
    footnote: securityNote(l, d.siteUrl),
  }),
  suspicious_sign_in: (l, d) => ({
    subject: T(l, "Unusual sign-in activity on your Yolias account", "نشاط تسجيل دخول غير معتاد على حسابك في يولـياس"),
    preheader: T(l, `${d.attempts} sign-in links were requested in ${d.windowMinutes} minutes.`, `تم طلب ${d.attempts} روابط دخول خلال ${d.windowMinutes} دقيقة.`),
    heading: T(l, "Suspicious sign-in attempts", "محاولات دخول مشبوهة"),
    body: [
      T(l, `Someone requested <strong>${d.attempts}</strong> sign-in links for your account in the last ${d.windowMinutes} minutes. Links only work from your inbox, so your account is safe as long as your email is.`,
        `طلب أحدهم <strong>${d.attempts}</strong> روابط تسجيل دخول لحسابك خلال آخر ${d.windowMinutes} دقيقة. الروابط تعمل فقط من بريدك، لذا يبقى حسابك آمنًا طالما بريدك آمن.`),
      T(l, "Don’t click a sign-in link you didn’t ask for.", "لا تضغط على رابط دخول لم تطلبه."),
    ],
    footnote: securityNote(l, d.siteUrl),
  }),
  security_alert: (l, d) => {
    const what: Record<MessageData["security_alert"]["event"], [string, string]> = {
      signed_out_everywhere: ["You were signed out of Yolias on all devices.", "تم تسجيل خروجك من يولـياس على كل الأجهزة."],
      email_changed: ["The email address of your Yolias account was changed.", "تم تغيير البريد الإلكتروني لحسابك في يولـياس."],
      account_suspended: ["Your Yolias account was suspended by our team. You can’t sign in until it’s restored.", "قام فريقنا بإيقاف حسابك في يولـياس مؤقتًا. لا يمكنك تسجيل الدخول حتى تتم استعادته."],
      account_restored: ["Your Yolias account was restored. You can sign in again.", "تمت استعادة حسابك في يولـياس. يمكنك تسجيل الدخول مجددًا."],
    };
    return {
      subject: T(l, "Security alert for your Yolias account", "تنبيه أمني لحسابك في يولـياس"),
      preheader: T(l, what[d.event][0], what[d.event][1]),
      heading: T(l, "Security alert", "تنبيه أمني"),
      body: [T(l, what[d.event][0], what[d.event][1]), `<span style="color:${C.muted}">${moment(d.at, l)}</span>`],
      footnote: d.event === "account_suspended" || d.event === "account_restored"
        ? T(l, `Questions? ${link(`${d.siteUrl}/contact?topic=support`, "Contact us")}.`, `لديك سؤال؟ ${link(`${d.siteUrl}/contact?topic=support`, "تواصل معنا")}.`)
        : securityNote(l, d.siteUrl),
    };
  },

  /* Subscription */
  plan_welcome: (l, d) => ({
    subject: T(l, `Welcome to the ${d.planName} plan`, `أهلًا بك في خطة ${d.planName}`),
    preheader: T(l, `${d.prospectsPerMonth} prospects a month are ready for you.`, `${d.prospectsPerMonth} عميل محتمل شهريًا بانتظارك.`),
    heading: T(l, `Welcome to ${d.planName}`, `أهلًا بك في ${d.planName}`),
    body: [
      T(l, `Your subscription is active. Your workspace now gets <strong>${d.prospectsPerMonth}</strong> prospects every month, for everyone on your team.`,
        `اشتراكك فعّال. تحصل مساحة عملك الآن على <strong>${d.prospectsPerMonth}</strong> عميل محتمل كل شهر، لكل أعضاء فريقك.`),
      ...(d.test ? [testNote(l)] : []),
    ],
    extra: table(l, [[T(l, "Plan", "الخطة"), esc(d.planName)], [T(l, "Renews on", "يتجدد في"), day(d.periodEnd, l)]]),
    button: { label: T(l, "Start a search", "ابدأ البحث"), href: `${d.siteUrl}/` },
    footnote: billingNote(l, d.siteUrl),
  }),
  subscription_activated: (l, d) => ({
    subject: T(l, "Your Yolias subscription has been activated", "تم تفعيل اشتراكك في يولـياس"),
    preheader: T(l, `${d.planName} is active again.`, `${d.planName} فعّال من جديد.`),
    heading: T(l, "Your subscription is active", "اشتراكك فعّال"),
    body: [T(l, `<strong>${esc(d.planName)}</strong> is active again. It renews on ${day(d.periodEnd, l)}.`, `<strong>${esc(d.planName)}</strong> فعّال من جديد ويتجدد في ${day(d.periodEnd, l)}.`), ...(d.test ? [testNote(l)] : [])],
    button: { label: T(l, "Open Yolias", "افتح يولـياس"), href: `${d.siteUrl}/` },
    footnote: billingNote(l, d.siteUrl),
  }),
  renewal_upcoming: (l, d) => ({
    subject: T(l, `Your ${d.planName} plan renews on ${day(d.periodEnd, l)}`, `يتجدد اشتراك ${d.planName} في ${day(d.periodEnd, l)}`),
    preheader: T(l, "No action needed if you’d like to continue.", "لا تحتاج لفعل أي شيء إذا أردت الاستمرار."),
    heading: T(l, "Your subscription will renew soon", "سيتجدد اشتراكك قريبًا"),
    body: [
      T(l, `<strong>${esc(d.planName)}</strong> renews on ${day(d.periodEnd, l)} for ${money(d.amount, d.currency)}. Your prospects allowance starts fresh with it.`,
        `يتجدد <strong>${esc(d.planName)}</strong> في ${day(d.periodEnd, l)} بمبلغ ${money(d.amount, d.currency)}، ويبدأ معه رصيد العملاء المحتملين من جديد.`),
      ...(d.test ? [testNote(l)] : []),
    ],
    button: { label: T(l, "Manage billing", "إدارة الفوترة"), href: `${d.siteUrl}/` },
    footnote: T(l, "To stop the renewal, cancel from Settings → Billing before that date.", "لإيقاف التجديد، ألغِ الاشتراك من الإعدادات ← الفوترة قبل هذا التاريخ."),
  }),
  subscription_renewed: (l, d) => ({
    subject: T(l, `Your ${d.planName} plan has renewed`, `تم تجديد اشتراك ${d.planName}`),
    preheader: T(l, `Next renewal: ${day(d.periodEnd, l)}.`, `التجديد القادم: ${day(d.periodEnd, l)}.`),
    heading: T(l, "Your subscription has renewed", "تم تجديد اشتراكك"),
    body: [T(l, `Thanks for staying with Yolias. <strong>${esc(d.planName)}</strong> continues until ${day(d.periodEnd, l)}.`, `شكرًا لبقائك مع يولـياس. يستمر <strong>${esc(d.planName)}</strong> حتى ${day(d.periodEnd, l)}.`), ...(d.test ? [testNote(l)] : [])],
    extra: table(l, [[T(l, "Invoice", "الفاتورة"), `<span dir="ltr">${esc(d.invoiceNumber)}</span>`], [T(l, "Amount", "المبلغ"), money(d.amount, d.currency)]]),
    button: { label: T(l, "View invoice", "عرض الفاتورة"), href: `${d.siteUrl}/invoices/${d.invoiceId}` },
    footnote: billingNote(l, d.siteUrl),
  }),
  subscription_ending: (l, d) => ({
    subject: T(l, `Your ${d.planName} plan ends on ${day(d.endsAt, l)}`, `ينتهي اشتراك ${d.planName} في ${day(d.endsAt, l)}`),
    preheader: T(l, "Resume any time before then to keep your plan.", "استأنف في أي وقت قبل ذلك للاحتفاظ بخطتك."),
    heading: T(l, "Your subscription is ending", "اشتراكك على وشك الانتهاء"),
    body: [T(l, `<strong>${esc(d.planName)}</strong> ends on ${day(d.endsAt, l)}. Your workspace then moves to Free; your searches and prospects stay saved.`,
      `ينتهي <strong>${esc(d.planName)}</strong> في ${day(d.endsAt, l)}، ثم تنتقل مساحة العمل إلى الخطة المجانية مع بقاء عمليات البحث والعملاء المحتملين محفوظين.`)],
    button: { label: T(l, "Resume plan", "استئناف الاشتراك"), href: `${d.siteUrl}/` },
    footnote: T(l, "Resume from Settings → Billing.", "يمكنك الاستئناف من الإعدادات ← الفوترة."),
  }),
  plan_upgraded: (l, d) => ({
    subject: T(l, `Your plan has been upgraded to ${d.planName}`, `تمت ترقية خطتك إلى ${d.planName}`),
    preheader: T(l, `${d.prospectsPerMonth} prospects a month from now on.`, `${d.prospectsPerMonth} عميل محتمل شهريًا من الآن.`),
    heading: T(l, "Your plan has been upgraded", "تمت ترقية خطتك"),
    body: [T(l, `You moved from ${esc(d.fromPlanName)} to <strong>${esc(d.planName)}</strong>. Your workspace now gets <strong>${d.prospectsPerMonth}</strong> prospects a month.`,
      `انتقلت من ${esc(d.fromPlanName)} إلى <strong>${esc(d.planName)}</strong>. تحصل مساحة عملك الآن على <strong>${d.prospectsPerMonth}</strong> عميل محتمل شهريًا.`), ...(d.test ? [testNote(l)] : [])],
    extra: table(l, [[T(l, "Amount", "المبلغ"), money(d.amount, d.currency)], [T(l, "Renews on", "يتجدد في"), day(d.periodEnd, l)]]),
    button: { label: T(l, "Open Yolias", "افتح يولـياس"), href: `${d.siteUrl}/` },
    footnote: billingNote(l, d.siteUrl),
  }),
  plan_downgraded: (l, d) => ({
    subject: T(l, `Your plan has been changed to ${d.planName}`, `تم تغيير خطتك إلى ${d.planName}`),
    preheader: T(l, `${d.prospectsPerMonth} prospects a month from now on.`, `${d.prospectsPerMonth} عميل محتمل شهريًا من الآن.`),
    heading: T(l, "Your plan has been downgraded", "تم تخفيض خطتك"),
    body: [T(l, `You moved from ${esc(d.fromPlanName)} to <strong>${esc(d.planName)}</strong>. Your workspace now gets <strong>${d.prospectsPerMonth}</strong> prospects a month. Everything you found so far stays saved.`,
      `انتقلت من ${esc(d.fromPlanName)} إلى <strong>${esc(d.planName)}</strong>. تحصل مساحة عملك الآن على <strong>${d.prospectsPerMonth}</strong> عميل محتمل شهريًا، وكل ما وجدته حتى الآن يبقى محفوظًا.`), ...(d.test ? [testNote(l)] : [])],
    button: { label: T(l, "See plans", "عرض الخطط"), href: `${d.siteUrl}/checkout` },
    footnote: billingNote(l, d.siteUrl),
  }),
  subscription_paused: (l, d) => ({
    subject: T(l, "Your Yolias subscription has been paused", "تم إيقاف اشتراكك في يولـياس مؤقتًا"),
    preheader: T(l, "New searches are paused until it’s resolved.", "عمليات البحث الجديدة متوقفة حتى يتم الحل."),
    heading: T(l, "Your subscription has been paused", "تم إيقاف اشتراكك مؤقتًا"),
    body: [T(l, `<strong>${esc(d.planName)}</strong> is paused${d.reason ? `: ${esc(d.reason)}` : "."} Your searches and prospects stay saved.`, `تم إيقاف <strong>${esc(d.planName)}</strong> مؤقتًا${d.reason ? `: ${esc(d.reason)}` : "."} تبقى عمليات البحث والعملاء المحتملون محفوظين.`)],
    button: { label: T(l, "Manage billing", "إدارة الفوترة"), href: `${d.siteUrl}/` },
    footnote: billingNote(l, d.siteUrl),
  }),
  access_restored: (l, d) => ({
    subject: T(l, "Your Yolias access has been restored", "تمت استعادة وصولك إلى يولـياس"),
    preheader: T(l, `${d.planName} is active again.`, `${d.planName} فعّال من جديد.`),
    heading: T(l, "Your subscription access has been restored", "تمت استعادة الوصول إلى اشتراكك"),
    body: [T(l, `Everything is back to normal: <strong>${esc(d.planName)}</strong> is active and you can run searches again.`, `عاد كل شيء كما كان: <strong>${esc(d.planName)}</strong> فعّال ويمكنك البحث من جديد.`)],
    button: { label: T(l, "Open Yolias", "افتح يولـياس"), href: `${d.siteUrl}/` },
    footnote: billingNote(l, d.siteUrl),
  }),

  /* Payments & billing */
  payment_failed: (l, d) => ({
    subject: T(l, "Your Yolias payment failed", "فشلت عملية الدفع في يولـياس"),
    preheader: T(l, `We couldn’t charge ${price(d.amount, d.currency)} for ${d.planName}.`, `لم نتمكن من تحصيل ${price(d.amount, d.currency)} لاشتراك ${d.planName}.`),
    heading: T(l, "Payment failed", "فشل الدفع"),
    body: [
      T(l, `We couldn’t charge ${money(d.amount, d.currency)} for <strong>${esc(d.planName)}</strong>${d.reason ? ` (${esc(d.reason)})` : ""}.`, `لم نتمكن من تحصيل ${money(d.amount, d.currency)} لاشتراك <strong>${esc(d.planName)}</strong>${d.reason ? ` (${esc(d.reason)})` : ""}.`),
      d.retryAt ? T(l, `We’ll try again on ${day(d.retryAt, l)}. Update your payment method to avoid an interruption.`, `سنحاول مرة أخرى في ${day(d.retryAt, l)}. حدّث وسيلة الدفع لتجنب أي انقطاع.`)
        : T(l, "Update your payment method to keep your plan.", "حدّث وسيلة الدفع للاحتفاظ بخطتك."),
    ],
    button: { label: T(l, "Update payment method", "تحديث وسيلة الدفع"), href: `${d.siteUrl}/` },
    footnote: billingNote(l, d.siteUrl),
  }),
  payment_method_attention: (l, d) => ({
    subject: T(l, "Your payment method needs attention", "وسيلة الدفع تحتاج إلى انتباهك"),
    preheader: T(l, "Update it to keep your Yolias plan running.", "حدّثها لاستمرار خطتك في يولـياس."),
    heading: T(l, "Your payment method needs attention", "وسيلة الدفع تحتاج إلى انتباهك"),
    body: [T(l, `${d.reason ? esc(d.reason) + ". " : ""}Please update your payment method so your next renewal goes through.`, `${d.reason ? esc(d.reason) + ". " : ""}يرجى تحديث وسيلة الدفع حتى يتم التجديد القادم بنجاح.`)],
    button: { label: T(l, "Update payment method", "تحديث وسيلة الدفع"), href: `${d.siteUrl}/` },
    footnote: billingNote(l, d.siteUrl),
  }),
  invoice_ready: (l, d) => ({
    subject: T(l, `Your Yolias invoice ${d.invoiceNumber} is ready`, `فاتورتك ${d.invoiceNumber} من يولـياس جاهزة`),
    preheader: T(l, `${price(d.amount, d.currency)} for ${d.planName}.`, `${price(d.amount, d.currency)} لاشتراك ${d.planName}.`),
    heading: T(l, "Your invoice is ready", "فاتورتك جاهزة"),
    body: [T(l, `Your invoice for <strong>${esc(d.planName)}</strong> is ready to view and download.`, `فاتورة اشتراك <strong>${esc(d.planName)}</strong> جاهزة للعرض والتنزيل.`), ...(d.test ? [testNote(l)] : [])],
    extra: table(l, [
      [T(l, "Invoice", "الفاتورة"), `<span dir="ltr">${esc(d.invoiceNumber)}</span>`],
      [T(l, "Amount", "المبلغ"), money(d.amount, d.currency)],
      ...(d.dueAt ? ([[T(l, "Due", "تاريخ الاستحقاق"), day(d.dueAt, l)]] as [string, string][]) : []),
    ]),
    button: { label: T(l, "View invoice", "عرض الفاتورة"), href: `${d.siteUrl}/invoices/${d.invoiceId}` },
    footnote: billingNote(l, d.siteUrl),
  }),
  refund_processed: (l, d) => ({
    subject: T(l, "Your Yolias refund is being processed", "جارٍ معالجة استرداد مبلغك من يولـياس"),
    preheader: T(l, `${price(d.amount, d.currency)} for invoice ${d.invoiceNumber}.`, `${price(d.amount, d.currency)} للفاتورة ${d.invoiceNumber}.`),
    heading: T(l, "Refund processed", "تمت معالجة الاسترداد"),
    body: [T(l, `We’ve processed a refund of ${money(d.amount, d.currency)} for invoice <span dir="ltr">${esc(d.invoiceNumber)}</span>${d.reason ? ` (${esc(d.reason)})` : ""}. Your bank usually shows it within 5–10 business days.`,
      `قمنا بمعالجة استرداد ${money(d.amount, d.currency)} للفاتورة <span dir="ltr">${esc(d.invoiceNumber)}</span>${d.reason ? ` (${esc(d.reason)})` : ""}. يظهر عادةً في حسابك البنكي خلال 5–10 أيام عمل.`)],
    footnote: billingNote(l, d.siteUrl),
  }),
  refund_issued: (l, d) => ({
    subject: T(l, "Your Yolias refund has been issued", "تم إصدار استرداد مبلغك من يولـياس"),
    preheader: T(l, `${price(d.amount, d.currency)} is on its way back to you.`, `${price(d.amount, d.currency)} في طريقها إليك.`),
    heading: T(l, "Refund issued", "تم إصدار الاسترداد"),
    body: [T(l, `A refund of ${money(d.amount, d.currency)} for invoice <span dir="ltr">${esc(d.invoiceNumber)}</span> was sent to your original payment method.`,
      `تم إرسال استرداد ${money(d.amount, d.currency)} للفاتورة <span dir="ltr">${esc(d.invoiceNumber)}</span> إلى وسيلة الدفع الأصلية.`)],
    footnote: billingNote(l, d.siteUrl),
  }),
  payment_overdue: (l, d) => ({
    subject: T(l, "Your Yolias payment is overdue", "دفعتك في يولـياس متأخرة"),
    preheader: T(l, `${d.daysOverdue} days overdue for ${d.planName}.`, `متأخرة ${d.daysOverdue} يومًا لاشتراك ${d.planName}.`),
    heading: T(l, "Payment overdue", "دفعة متأخرة"),
    body: [T(l, `Your payment of ${money(d.amount, d.currency)} for <strong>${esc(d.planName)}</strong> is ${d.daysOverdue} days overdue. Please pay or update your payment method to avoid your plan being paused.`,
      `دفعتك بقيمة ${money(d.amount, d.currency)} لاشتراك <strong>${esc(d.planName)}</strong> متأخرة ${d.daysOverdue} يومًا. يرجى الدفع أو تحديث وسيلة الدفع لتجنب إيقاف خطتك.`)],
    button: { label: T(l, "Pay now", "ادفع الآن"), href: `${d.siteUrl}/` },
    footnote: billingNote(l, d.siteUrl),
  }),

  /* Usage (Prospects, never credits: rule 26) */
  prospects_added: (l, d) => ({
    subject: T(l, `${d.added} prospects added to your workspace`, `تمت إضافة ${d.added} عميل محتمل إلى مساحة عملك`),
    preheader: T(l, `This month’s allowance is now ${d.allowance}.`, `أصبح رصيد هذا الشهر ${d.allowance}.`),
    heading: T(l, "Prospects added", "تمت إضافة عملاء محتملين"),
    body: [T(l, `<strong>${d.added}</strong> prospects were added to your workspace for this month${d.reason ? ` (${esc(d.reason)})` : ""}. Your allowance is now <strong>${d.allowance}</strong>.`,
      `تمت إضافة <strong>${d.added}</strong> عميل محتمل إلى مساحة عملك لهذا الشهر${d.reason ? ` (${esc(d.reason)})` : ""}. أصبح رصيدك <strong>${d.allowance}</strong>.`)],
    button: { label: T(l, "Start a search", "ابدأ البحث"), href: `${d.siteUrl}/` },
    footnote: T(l, "Unused prospects reset at the start of next month.", "يتجدد الرصيد غير المستخدم في بداية الشهر القادم."),
  }),

  /* Product updates */
  announcement: (l, d) => ({
    subject: d.type === "new_feature" ? T(l, `Introducing ${d.title}`, `جديد: ${d.title}`) : d.type === "feature_available" ? T(l, `${d.title} is now available`, `${d.title} متاح الآن`)
      : d.type === "feature_updated" ? T(l, `${d.title} has been updated`, `تم تحديث ${d.title}`) : d.title,
    preheader: `${T(l, announcementEyebrow[d.type][0], announcementEyebrow[d.type][1])} · ${d.title}`,
    heading: d.title,
    body: [`<span style="font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:${C.red};font-weight:700">${esc(T(l, announcementEyebrow[d.type][0], announcementEyebrow[d.type][1]))}</span>`, ...paragraphs(d.body)],
    button: d.ctaLabel && d.ctaUrl ? { label: d.ctaLabel, href: d.ctaUrl } : undefined,
    footnote: T(l, `You’re receiving this because “Product updates” is on. ${link(`${d.siteUrl}/`, "Notification settings")}`, `تصلك هذه الرسالة لأن «تحديثات المنتج» مفعّلة. ${link(`${d.siteUrl}/`, "إعدادات الإشعارات")}`),
  }),
};

export function renderMessage<K extends MessageKind>(kind: K, locale: EmailLocale, data: MessageData[K]): RenderedEmail {
  return render(locale, data.siteUrl, messages[kind](locale, data));
}

export const messageKinds = Object.keys(messages) as MessageKind[];
