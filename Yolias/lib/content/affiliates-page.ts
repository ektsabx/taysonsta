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
  termsTitle: string; facts: { rate: string; recurring: string; recurringFor: string; recurringAlways: string; firstOnly: string; topups: string; noTopups: string; hold: string; minPayout: string; window: string };
  stepsTitle: string; steps: { title: string; body: string }[];
  rulesTitle: string; rules: string[];
  faqTitle: string; faq: { q: string; a: string }[];
  cta: { title: string; body: string; signedOut: string; signedIn: string };
  become: string; haveAccount: string; fullTerms: string;
  network: { title: string; lead: string; level: string; success: string; newPartner: string; empty: string; tiers: Record<"partner" | "silver" | "gold" | "platinum", string>; tiersNote: string };
  calculator: { title: string; lead: string; plan: string; period: string; customers: string; perMonth: string; perYear: string; note: string };
}> = {
  en: {
    eyebrow: "AFFILIATE PROGRAM",
    title: "Earn by introducing Yolias to businesses that sell services.",
    seoTitle: "Yolias Affiliate Program",
    lead: "Join in a minute. No application and no subscription. Share your referral link and earn a commission on the payments of the customers you refer.",
    metaDescription: "Join the Yolias affiliate program: share your link, earn a commission on qualifying payments of the customers you refer, and follow every commission and payout in your dashboard.",
    closed: "The affiliate program isn’t open right now.",
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
      { title: "Every feature on every plan", body: "Your referrals get the whole product on any plan, with unlimited users, so the choice is only how much they need each month." },
      { title: "Unlimited users", body: "Teams don’t pay per seat, so a whole sales team can use one plan." },
      { title: "Your own dashboard", body: "See visits, signups, paying customers and every commission and payout in your affiliate dashboard inside Yolias." },
    ],
    calcTitle: "How your commission is calculated",
    calcLead: "Your commission is a percentage of what the customer actually paid for the plan, created when our payment provider confirms the payment. Here is what that means with today’s prices:",
    calcCols: { plan: "Plan", payment: "Customer pays", perPayment: "You earn per payment", perCustomer: "Most per customer" },
    monthly: "monthly", annual: "yearly", noLimit: "No limit",
    calcNote: "Examples use current list prices before tax. Discounts, refunds and disputes change the amount; refunded payments reverse their commission.",
    termsTitle: "The current terms",
    facts: { rate: "Commission", recurring: "Recurring payments", recurringFor: "Up to {count} payments per customer", recurringAlways: "For as long as the customer pays", firstOnly: "First payment only", topups: "every top-up during the customer’s first {count} months, from their first payment", noTopups: "not eligible", hold: "Waiting period", minPayout: "Minimum payout", window: "Referral window" },
    stepsTitle: "How it works",
    steps: [
      { title: "Join", body: "Enter your name and email on Yolias Partners and accept the terms. No application, no review and no Yolias subscription needed." },
      { title: "Share your link", body: "You get your personal referral link right away in your partner dashboard. Add a campaign tag to compare where your signups come from." },
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
      { q: "Do I need a Yolias subscription to join?", a: "No. Yolias Partners has its own sign-in and dashboard. Join with your name and email; if you already use Yolias, the same email works." },
      { q: "Do I earn if my referral starts on a free trial?", a: "Not during the trial: it is free, so there is no payment yet. The commission is created from the first real payment after it." },
      { q: "What happens if a visitor clicks two affiliate links?", a: "The program settings decide: either the first or the most recent valid link keeps the referral. The current rule is shown in your dashboard." },
      { q: "Can I see who I referred?", a: "You see each referral with a short reference, its signup date and whether it became a paying customer. Customers’ names and emails stay private." },
      { q: "How are payouts sent?", a: "You choose an enabled payout method and enter your details. The team reviews each request, sends the money and records the transfer reference, and you get an email at every step." },
    ],
    cta: { title: "Ready to join?", body: "Join Yolias Partners and get your referral link right away.", signedOut: "Join Yolias Partners", signedIn: "Open my partner dashboard" },
    become: "Become a partner", haveAccount: "Already a partner? Log in", fullTerms: "Read the full partner terms",
    network: {
      title: "Our certified partner network",
      lead: "Creators, entrepreneurs and agencies who recommend Yolias. Levels and success rates come from real referrals and confirmed payments.",
      level: "Partnership level", success: "Success rate", newPartner: "New partner",
      empty: "Our first partners are joining now. Join and be among the first in the network.",
      tiers: { partner: "Partner", silver: "Silver", gold: "Gold", platinum: "Platinum" },
      tiersNote: "Levels: Silver from 3 paying customers, Gold from 10, Platinum from 25. Success rate = referrals who became paying customers (shown from 5 referrals).",
    },
    calculator: {
      title: "Estimate your earnings",
      lead: "Move the slider to see what you could earn with today’s commission and prices.",
      plan: "Plan", period: "Billing", customers: "Paying customers you refer",
      perMonth: "Estimated commission per month", perYear: "Estimated commission in the first year",
      note: "An estimate from current list prices before tax and the current commission. Real commissions follow confirmed payments; refunds reverse them.",
    },
  },
  ar: {
    eyebrow: "برنامج الأفلييت",
    title: "اربح بتعريف الشركات التي تبيع خدمات بيولياس.",
    seoTitle: "برنامج الأفلييت في يولياس",
    lead: "انضم في دقيقة. بدون طلب انضمام وبدون اشتراك. شارك رابط الإحالة الخاص بك واربح عمولة على مدفوعات العملاء الذين تحيلهم.",
    metaDescription: "انضم إلى برنامج الأفلييت في يولياس: شارك رابطك، واربح عمولة على الدفعات المؤهلة للعملاء الذين تحيلهم، وتابع كل عمولة وطلب سحب في لوحتك.",
    closed: "برنامج الأفلييت غير متاح حاليًا.",
    heroRate: "عمولة {rate}",
    heroRateNote: "على كل دفعة مؤهلة من العملاء الذين تحيلهم",
    audienceTitle: "مصمم لمن يتحدث مع الشركات",
    audienceLead: "إذا كان جمهورك يبيع خدمات أو يدير فريق مبيعات أو يبحث عن عملائه القادمين، فيولياس يحل مشكلة موجودة لديهم بالفعل.",
    audiences: [
      { title: "الوكالات والاستشاريون", body: "رشّح يولياس لعملائك الذين يحتاجون قائمة ثابتة من الشركات للبيع لها، واربح أثناء استخدامهم له." },
      { title: "صناع المحتوى والمدربون", body: "تشرح المبيعات أو التسويق أو العمل الحر؟ اعرض يولياس في درس أو نشرة بريدية وشارك رابطك." },
      { title: "المجتمعات ورواد الأعمال", body: "تدير مجتمع مؤسسين أو مجتمع B2B أو برنامج شركات ناشئة؟ امنح أعضاءك طريقة أسرع للعثور على العملاء." },
    ],
    whyTitle: "لماذا يسهل ترشيح يولياس",
    why: [
      { title: "مشكلة واضحة ونتيجة واضحة", body: "تصف الشركة لمن تبيع، ويجد يولياس شركات مطابقة لديها وسيلة تواصل. يفهمها الناس في جملة واحدة." },
      { title: "كل الميزات في كل خطة", body: "يحصل من تحيلهم على المنتج كاملًا في أي خطة مع مستخدمين غير محدودين، فيبقى الاختيار فقط في حجم ما يحتاجونه كل شهر." },
      { title: "مستخدمون غير محدودين", body: "لا يدفع الفريق مقابل كل مستخدم، فيستطيع فريق المبيعات كله استخدام خطة واحدة." },
      { title: "لوحتك الخاصة", body: "تابع الزيارات والتسجيلات والعملاء الدافعين وكل عمولة وطلب سحب من لوحة الأفلييت داخل يولياس." },
    ],
    calcTitle: "كيف تُحسب عمولتك",
    calcLead: "عمولتك نسبة مما دفعه العميل فعلًا مقابل الخطة، وتُنشأ عندما يؤكد مزود الدفع الدفعة. هذا ما تعنيه بأسعار اليوم:",
    calcCols: { plan: "الخطة", payment: "يدفع العميل", perPayment: "تربح عن كل دفعة", perCustomer: "الحد الأقصى لكل عميل" },
    monthly: "شهريًا", annual: "سنويًا", noLimit: "بلا حد",
    calcNote: "الأمثلة بأسعار القائمة الحالية قبل الضرائب. الخصومات والاسترداد والاعتراضات تغيّر المبلغ، والدفعات المستردة تعكس عمولتها.",
    termsTitle: "الشروط الحالية",
    facts: { rate: "العمولة", recurring: "الدفعات المتكررة", recurringFor: "حتى {count} دفعات لكل عميل", recurringAlways: "طالما استمر العميل في الدفع", firstOnly: "الدفعة الأولى فقط", topups: "كل شحن خلال أول {count} شهرًا من أول دفعة للعميل", noTopups: "غير مؤهل", hold: "فترة الانتظار", minPayout: "الحد الأدنى للسحب", window: "مدة الإحالة" },
    stepsTitle: "كيف يعمل",
    steps: [
      { title: "انضم", body: "أدخل اسمك وبريدك في شركاء يولياس ووافق على الشروط. بدون طلب انضمام ولا مراجعة ولا اشتراك في يولياس." },
      { title: "شارك رابطك", body: "تحصل على رابط الإحالة الخاص بك فورًا في لوحة الشركاء. أضف وسم حملة لتقارن مصادر التسجيلات." },
      { title: "اربح من مدفوعات حقيقية", body: "عندما يسجّل شخص عبر رابطك ويدفع لخطة مؤهلة، تُنشأ عمولة من تلك الدفعة بعد أن يؤكدها مزود الدفع." },
      { title: "اسحب أرباحك", body: "بعد فترة الانتظار تصبح العمولة متاحة. اطلب السحب عند الوصول إلى الحد الأدنى، ويرسله الفريق إلى الطريقة التي تختارها." },
    ],
    rulesTitle: "القواعد",
    rules: [
      "العمولات تأتي فقط من الدفعات التي يؤكدها مزود الدفع، ولا عمولة على التسجيل المجاني أو الدفع الفاشل.",
      "الدفعات المستردة أو المعترض عليها تعكس عمولتها.",
      "لا يُسمح بإحالة نفسك أو شركتك.",
      "تُحفظ الزيارة في متصفح الزائر طوال مدة الإحالة، ولا يمكن نسبة التسجيل من جهاز آخر أو مع حظر ملفات تعريف الارتباط.",
      "يراجع فريق يولياس طلبات السحب ويرسلها يدويًا.",
    ],
    faqTitle: "أسئلة شائعة",
    faq: [
      { q: "هل أحتاج اشتراكًا في يولياس للانضمام؟", a: "لا. لشركاء يولياس تسجيل دخول ولوحة خاصة. انضم باسمك وبريدك، وإن كنت تستخدم يولياس فنفس البريد يعمل." },
      { q: "هل أربح إذا بدأ من أحلته بتجربة مجانية؟", a: "ليس أثناء التجربة، فهي مجانية ولا توجد دفعة بعد. وتُنشأ العمولة من أول دفعة حقيقية بعدها." },
      { q: "ماذا يحدث إذا ضغط الزائر على رابطي أفلييت؟", a: "تحدد إعدادات البرنامج ذلك: إما أول رابط صالح أو آخر رابط صالح يحتفظ بالإحالة، والقاعدة الحالية معروضة في لوحتك." },
      { q: "هل أرى من أحلتهم؟", a: "ترى كل إحالة برقم مرجعي قصير وتاريخ التسجيل وهل أصبحت عميلًا دافعًا. أسماء العملاء وبريدهم يبقيان خاصين." },
      { q: "كيف تُرسل المبالغ؟", a: "تختار طريقة سحب مفعّلة وتدخل بياناتك. يراجع الفريق كل طلب ويرسل المبلغ ويسجّل مرجع التحويل، وتصلك رسالة في كل خطوة." },
    ],
    cta: { title: "مستعد للانضمام؟", body: "انضم إلى شركاء يولياس واحصل على رابط الإحالة فورًا.", signedOut: "انضم إلى شركاء يولياس", signedIn: "افتح لوحة الشريك" },
    become: "كن شريكًا", haveAccount: "شريك بالفعل؟ سجّل الدخول", fullTerms: "اقرأ شروط الشركاء كاملة",
    network: {
      title: "شبكة شركائنا المعتمدين",
      lead: "صنّاع محتوى ورواد أعمال ووكالات يرشّحون يولياس. المستويات ومعدلات النجاح محسوبة من إحالات حقيقية ودفعات مؤكدة.",
      level: "مستوى الشراكة", success: "معدل النجاح", newPartner: "شريك جديد",
      empty: "أوائل شركائنا ينضمون الآن. انضم وكن من أوائل أعضاء الشبكة.",
      tiers: { partner: "شريك", silver: "فضي", gold: "ذهبي", platinum: "بلاتيني" },
      tiersNote: "المستويات: فضي من 3 عملاء دافعين، ذهبي من 10، بلاتيني من 25. معدل النجاح = نسبة الإحالات التي أصبحت عملاء دافعين (يظهر من 5 إحالات).",
    },
    calculator: {
      title: "احسب أرباحك المتوقعة",
      lead: "حرّك المؤشر لترى ما يمكنك ربحه بالعمولة والأسعار الحالية.",
      plan: "الخطة", period: "الفوترة", customers: "العملاء الدافعون الذين تحيلهم",
      perMonth: "العمولة المتوقعة شهريًا", perYear: "العمولة المتوقعة في السنة الأولى",
      note: "تقدير بأسعار القائمة الحالية قبل الضرائب والعمولة الحالية. العمولات الفعلية تتبع الدفعات المؤكدة، والاسترداد يعكسها.",
    },
  },
};
