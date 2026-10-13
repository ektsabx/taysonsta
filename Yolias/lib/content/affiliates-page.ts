import type { Localized } from "./types";

// Public page of the affiliate program (/affiliates, D-178/D-179). Numbers
// (rate, recurring payments, waiting period, minimum payout, attribution
// window) come from the live program settings, never from this file.

export const affiliatesPage: Localized<{
  eyebrow: string; title: string; seoTitle: string; lead: string; metaDescription: string; closed: string;
  heroRate: string; heroRateNote: string;
  audienceTitle: string; audienceLead: string; audiences: { title: string; body: string }[];
  whyTitle: string; why: { title: string; body: string }[];
  calcTitle: string; calcLead: string; calcCols: { plan: string; payment: string; perPayment: string; perCustomer: string }; monthly: string; annual: string; noLimit: string; calcNote: string;
  termsTitle: string; facts: { rate: string; recurring: string; recurringFor: string; recurringAlways: string; firstOnly: string; hold: string; minPayout: string; window: string };
  stepsTitle: string; steps: { title: string; body: string }[];
  rulesTitle: string; rules: string[];
  faqTitle: string; faq: { q: string; a: string }[];
  cta: { title: string; body: string; signedOut: string; signedIn: string };
}> = {
  en: {
    eyebrow: "AFFILIATE PROGRAM",
    title: "Earn by introducing Yolias to businesses that sell services.",
    seoTitle: "Yolias Affiliate Program",
    lead: "Join with your Yolias account, share your referral link and earn a commission on the payments of the customers you refer.",
    metaDescription: "Join the Yolias affiliate program: share your link, earn a commission on qualifying payments of the customers you refer, and follow every commission and payout in your dashboard.",
    closed: "The affiliate program isn’t accepting applications right now.",
    heroRate: "{rate} commission",
    heroRateNote: "on every qualifying payment of the customers you refer",
    audienceTitle: "Made for people who talk to businesses",
    audienceLead: "If your audience sells services, runs a sales team or is trying to find its next customers, Yolias solves a problem they already have.",
    audiences: [
      { title: "Agencies and consultants", body: "Recommend Yolias to clients who need a steady list of companies to sell to, and earn while they use it." },
      { title: "Creators and educators", body: "Teach sales, marketing or freelancing? Show Yolias in a tutorial or a newsletter and share your link." },
      { title: "Communities and founders", body: "Run a founder group, a B2B community or a startup program? Give your members a faster way to find customers." },
    ],
    whyTitle: "Why Yolias is easy to recommend",
    why: [
      { title: "A clear problem, a clear result", body: "Businesses describe who they sell to; Yolias finds matching companies with a way to reach them. People understand it in one sentence." },
      { title: "A free trial on every plan", body: "Your referrals can try the plan they choose for 7 days before the first payment, which makes the first step easier." },
      { title: "Unlimited users", body: "Teams don’t pay per seat, so a whole sales team can use one plan." },
      { title: "Your own dashboard", body: "See visits, signups, paying customers and every commission and payout in your affiliate dashboard inside Yolias." },
    ],
    calcTitle: "How your commission is calculated",
    calcLead: "Your commission is a percentage of what the customer actually paid for the plan, created when our payment provider confirms the payment. Here is what that means with today’s prices:",
    calcCols: { plan: "Plan", payment: "Customer pays", perPayment: "You earn per payment", perCustomer: "Most per customer" },
    monthly: "monthly", annual: "yearly", noLimit: "No limit",
    calcNote: "Examples use current list prices before tax. Discounts, refunds and disputes change the amount; refunded payments reverse their commission.",
    termsTitle: "The current terms",
    facts: { rate: "Commission", recurring: "Recurring payments", recurringFor: "Up to {count} payments per customer", recurringAlways: "For as long as the customer pays", firstOnly: "First payment only", hold: "Waiting period", minPayout: "Minimum payout", window: "Referral window" },
    stepsTitle: "How it works",
    steps: [
      { title: "Apply", body: "Sign in to Yolias, open Affiliate program from your account menu, answer a few questions and accept the terms. The team reviews every application." },
      { title: "Share your link", body: "Once approved you get a personal referral link. Add a campaign tag to compare where your signups come from." },
      { title: "Earn on real payments", body: "When someone signs up through your link and pays for a qualifying plan, a commission is created from that payment, confirmed by our payment provider." },
      { title: "Withdraw", body: "After the waiting period the commission becomes available. Request a payout once you reach the minimum; the team sends it to your chosen method." },
    ],
    rulesTitle: "The rules",
    rules: [
      "Commissions come only from payments our payment provider confirms. Free signups and failed payments earn nothing.",
      "Refunded or disputed payments reverse their commission.",
      "Referring yourself or your own company isn’t allowed.",
      "A visit is remembered in the visitor’s browser for the referral window. Signups on another device or with cookies blocked can’t be attributed.",
      "Payouts are reviewed and sent manually by the Yolias team.",
    ],
    faqTitle: "Questions",
    faq: [
      { q: "Do I need a Yolias account to join?", a: "Yes. The program uses your Yolias account; there is no separate login. Any Yolias account can apply." },
      { q: "Do I earn while my referral is on the free trial?", a: "No. The trial is free, so there is no payment yet. The commission is created from the first real payment after the trial." },
      { q: "What happens if a visitor clicks two affiliate links?", a: "The program settings decide: either the first or the most recent valid link keeps the referral. The current rule is shown in your dashboard." },
      { q: "Can I see who I referred?", a: "You see each referral with a short reference, its signup date and whether it became a paying customer. Customers’ names and emails stay private." },
      { q: "How are payouts sent?", a: "You choose an enabled payout method and enter your details. The team reviews each request, sends the money and records the transfer reference, and you get an email at every step." },
    ],
    cta: { title: "Ready to join?", body: "Create a Yolias account or sign in, then apply from your account menu.", signedOut: "Create an account", signedIn: "Open the affiliate program" },
  },
  ar: {
    eyebrow: "برنامج الأفلييت",
    title: "اربح بتعريف الشركات التي تبيع خدمات بيولـياس.",
    seoTitle: "برنامج الأفلييت في يولـياس",
    lead: "انضم بحسابك في يولـياس، وشارك رابط الإحالة الخاص بك، واربح عمولة على مدفوعات العملاء الذين تحيلهم.",
    metaDescription: "انضم إلى برنامج الأفلييت في يولـياس: شارك رابطك، واربح عمولة على الدفعات المؤهلة للعملاء الذين تحيلهم، وتابع كل عمولة وطلب سحب في لوحتك.",
    closed: "برنامج الأفلييت لا يستقبل طلبات حاليًا.",
    heroRate: "عمولة {rate}",
    heroRateNote: "على كل دفعة مؤهلة من العملاء الذين تحيلهم",
    audienceTitle: "مصمم لمن يتحدث مع الشركات",
    audienceLead: "إذا كان جمهورك يبيع خدمات أو يدير فريق مبيعات أو يبحث عن عملائه القادمين، فيولـياس يحل مشكلة موجودة لديهم بالفعل.",
    audiences: [
      { title: "الوكالات والاستشاريون", body: "رشّح يولـياس لعملائك الذين يحتاجون قائمة ثابتة من الشركات للبيع لها، واربح أثناء استخدامهم له." },
      { title: "صناع المحتوى والمدربون", body: "تشرح المبيعات أو التسويق أو العمل الحر؟ اعرض يولـياس في درس أو نشرة بريدية وشارك رابطك." },
      { title: "المجتمعات ورواد الأعمال", body: "تدير مجتمع مؤسسين أو مجتمع B2B أو برنامج شركات ناشئة؟ امنح أعضاءك طريقة أسرع للعثور على العملاء." },
    ],
    whyTitle: "لماذا يسهل ترشيح يولـياس",
    why: [
      { title: "مشكلة واضحة ونتيجة واضحة", body: "تصف الشركة لمن تبيع، ويجد يولـياس شركات مطابقة لديها وسيلة تواصل. يفهمها الناس في جملة واحدة." },
      { title: "تجربة مجانية في كل خطة", body: "يستطيع من تحيلهم تجربة الخطة التي يختارونها 7 أيام قبل أول دفعة، وهذا يسهّل الخطوة الأولى." },
      { title: "مستخدمون غير محدودين", body: "لا يدفع الفريق مقابل كل مستخدم، فيستطيع فريق المبيعات كله استخدام خطة واحدة." },
      { title: "لوحتك الخاصة", body: "تابع الزيارات والتسجيلات والعملاء الدافعين وكل عمولة وطلب سحب من لوحة الأفلييت داخل يولـياس." },
    ],
    calcTitle: "كيف تُحسب عمولتك",
    calcLead: "عمولتك نسبة مما دفعه العميل فعلًا مقابل الخطة، وتُنشأ عندما يؤكد مزود الدفع الدفعة. هذا ما تعنيه بأسعار اليوم:",
    calcCols: { plan: "الخطة", payment: "يدفع العميل", perPayment: "تربح عن كل دفعة", perCustomer: "الحد الأقصى لكل عميل" },
    monthly: "شهريًا", annual: "سنويًا", noLimit: "بلا حد",
    calcNote: "الأمثلة بأسعار القائمة الحالية قبل الضرائب. الخصومات والاسترداد والاعتراضات تغيّر المبلغ، والدفعات المستردة تعكس عمولتها.",
    termsTitle: "الشروط الحالية",
    facts: { rate: "العمولة", recurring: "الدفعات المتكررة", recurringFor: "حتى {count} دفعات لكل عميل", recurringAlways: "طالما استمر العميل في الدفع", firstOnly: "الدفعة الأولى فقط", hold: "فترة الانتظار", minPayout: "الحد الأدنى للسحب", window: "مدة الإحالة" },
    stepsTitle: "كيف يعمل",
    steps: [
      { title: "قدّم", body: "سجّل الدخول إلى يولـياس، وافتح برنامج الأفلييت من قائمة حسابك، وأجب عن بعض الأسئلة ووافق على الشروط. يراجع الفريق كل طلب." },
      { title: "شارك رابطك", body: "بعد الموافقة تحصل على رابط إحالة خاص بك. أضف وسم حملة لتقارن مصادر التسجيلات." },
      { title: "اربح من مدفوعات حقيقية", body: "عندما يسجّل شخص عبر رابطك ويدفع لخطة مؤهلة، تُنشأ عمولة من تلك الدفعة بعد أن يؤكدها مزود الدفع." },
      { title: "اسحب أرباحك", body: "بعد فترة الانتظار تصبح العمولة متاحة. اطلب السحب عند الوصول إلى الحد الأدنى، ويرسله الفريق إلى الطريقة التي تختارها." },
    ],
    rulesTitle: "القواعد",
    rules: [
      "العمولات تأتي فقط من الدفعات التي يؤكدها مزود الدفع، ولا عمولة على التسجيل المجاني أو الدفع الفاشل.",
      "الدفعات المستردة أو المعترض عليها تعكس عمولتها.",
      "لا يُسمح بإحالة نفسك أو شركتك.",
      "تُحفظ الزيارة في متصفح الزائر طوال مدة الإحالة، ولا يمكن نسبة التسجيل من جهاز آخر أو مع حظر ملفات تعريف الارتباط.",
      "يراجع فريق يولـياس طلبات السحب ويرسلها يدويًا.",
    ],
    faqTitle: "أسئلة شائعة",
    faq: [
      { q: "هل أحتاج حسابًا في يولـياس للانضمام؟", a: "نعم. يستخدم البرنامج حسابك في يولـياس دون تسجيل دخول منفصل، ويمكن لأي حساب في يولـياس التقديم." },
      { q: "هل أربح أثناء التجربة المجانية لمن أحلته؟", a: "لا. التجربة مجانية فلا توجد دفعة بعد، وتُنشأ العمولة من أول دفعة حقيقية بعد التجربة." },
      { q: "ماذا يحدث إذا ضغط الزائر على رابطي أفلييت؟", a: "تحدد إعدادات البرنامج ذلك: إما أول رابط صالح أو آخر رابط صالح يحتفظ بالإحالة، والقاعدة الحالية معروضة في لوحتك." },
      { q: "هل أرى من أحلتهم؟", a: "ترى كل إحالة برقم مرجعي قصير وتاريخ التسجيل وهل أصبحت عميلًا دافعًا. أسماء العملاء وبريدهم يبقيان خاصين." },
      { q: "كيف تُرسل المبالغ؟", a: "تختار طريقة سحب مفعّلة وتدخل بياناتك. يراجع الفريق كل طلب ويرسل المبلغ ويسجّل مرجع التحويل، وتصلك رسالة في كل خطوة." },
    ],
    cta: { title: "مستعد للانضمام؟", body: "أنشئ حسابًا في يولـياس أو سجّل الدخول، ثم قدّم من قائمة حسابك.", signedOut: "إنشاء حساب", signedIn: "افتح برنامج الأفلييت" },
  },
};
