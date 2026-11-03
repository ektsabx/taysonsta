import type { Localized } from "./types";

// Search intent pages (D-179; rewritten for the AI advertising platform,
// owner 2026-11-03, D-276): one page per question people type when they look
// for customers, answered first in two sentences (the part answer engines
// quote), then how a Yolias campaign does it. Confident and short (owner's
// copy rule). Research behind each page: docs/20-seo-geo-aeo-ar.md.

export const useCaseSlugs = ["ai-prospecting", "find-clients", "icp-company-search", "find-decision-makers", "local-business-leads", "similar-companies"] as const;
export type UseCaseSlug = (typeof useCaseSlugs)[number];

export interface UseCase {
  name: string;
  /** Title tag (before " | Yolias") and H1: the query the page answers. */
  title: string;
  h1: string;
  metaDescription: string;
  lead: string;
  /** A direct answer in two or three sentences (the part answer engines quote). */
  answerTitle: string;
  answer: string;
  forTitle: string;
  forWho: string[];
  problemTitle: string;
  problem: string[];
  stepsTitle: string;
  steps: { title: string; body: string }[];
  exampleTitle: string;
  exampleNote: string;
  example: string;
  getTitle: string;
  get: string[];
  limitsTitle: string;
  /** Empty: pages don't list what Yolias doesn't do (owner's copy rule). */
  limits: string[];
  faq: { q: string; a: string }[];
  /** Related solutions pages (internal links). */
  solutions: string[];
}

export const useCasesPage: Localized<{ eyebrow: string; title: string; lead: string; metaDescription: string; faqTitle: string; related: string; solutionsTitle: string; cta: { title: string; body: string; primary: string; secondary: string }; exampleLabel: string }> = {
  en: {
    eyebrow: "USE CASES",
    title: "What you can do with Yolias",
    lead: "Campaigns that reach the customers you choose, from the first contact to the meeting.",
    metaDescription: "Find clients, decision makers, local businesses and companies like your best customers with Yolias, the AI advertising platform for customer acquisition.",
    faqTitle: "Questions",
    related: "More use cases",
    solutionsTitle: "Solutions for your business",
    cta: { title: "Launch your first campaign.", body: "Choose the goal, define your customers and let the AI work.", primary: "Get started", secondary: "See pricing" },
    exampleLabel: "Example campaign",
  },
  ar: {
    eyebrow: "حالات الاستخدام",
    title: "ما الذي يمكنك فعله مع يولياس",
    lead: "حملات تصل إلى العملاء الذين تختارهم، من أول تواصل حتى الاجتماع.",
    metaDescription: "اعثر على عملاء وصنّاع قرار وأنشطة محلية وشركات تشبه أفضل عملائك مع يولياس، منصة الإعلانات بالذكاء الاصطناعي لاكتساب العملاء.",
    faqTitle: "أسئلة شائعة",
    related: "حالات استخدام أخرى",
    solutionsTitle: "حلول لنوع عملك",
    cta: { title: "أطلق حملتك الأولى.", body: "اختر الهدف، وحدد عملاءك، ودع الذكاء الاصطناعي يعمل.", primary: "ابدأ الآن", secondary: "عرض الأسعار" },
    exampleLabel: "مثال على حملة",
  },
};

type L = { en: string; ar: string };
type LL = { en: string[]; ar: string[] };
interface Spec {
  name: L; title: L; h1: L; meta: L; lead: L; answerTitle: L; answer: L;
  forWho: LL; problem: LL; example: L; get: LL;
  faq: { en: { q: string; a: string }[]; ar: { q: string; a: string }[] };
  solutions: string[];
}

const steps = {
  en: [
    { title: "Choose the goal", body: "Meetings, sales, website leads or qualified leads." },
    { title: "Define the audience", body: "Countries and cities, industries, company size and job titles, or a lookalike of your best customers." },
    { title: "Launch", body: "Pick the mailbox, tone and language. Yolias finds the people, writes to each one and follows up." },
    { title: "Get the results", body: "Yolias AI answers and books. Every campaign shows its results and cost per result." },
  ],
  ar: [
    { title: "اختر الهدف", body: "اجتماعات، أو مبيعات، أو عملاء محتملون من موقعك، أو عملاء محتملون مؤهلون." },
    { title: "حدد الجمهور", body: "الدول والمدن، والمجالات، وحجم الشركة، والمسميات الوظيفية، أو جمهور مشابه لأفضل عملائك." },
    { title: "أطلق الحملة", body: "اختر البريد والأسلوب واللغة، ويجد يولياس الأشخاص ويكتب لكل منهم ويتابع." },
    { title: "احصل على النتائج", body: "يرد Yolias AI ويحجز، وتعرض كل حملة نتائجها وتكلفة النتيجة." },
  ],
};

function build(s: Spec): Localized<UseCase> {
  const side = (l: "en" | "ar"): UseCase => ({
    name: s.name[l], title: s.title[l], h1: s.h1[l], metaDescription: s.meta[l], lead: s.lead[l],
    answerTitle: s.answerTitle[l], answer: s.answer[l],
    forTitle: l === "en" ? "Who it's for" : "لمن هذا", forWho: s.forWho[l],
    problemTitle: l === "en" ? "Why it's hard without Yolias" : "لماذا هو صعب بدون يولياس", problem: s.problem[l],
    stepsTitle: l === "en" ? "How it works" : "كيف يعمل", steps: steps[l],
    exampleTitle: l === "en" ? "A campaign you could launch today" : "حملة يمكنك إطلاقها اليوم", exampleNote: l === "en" ? "Goal and audience" : "الهدف والجمهور", example: s.example[l],
    getTitle: l === "en" ? "What you get" : "ما الذي تحصل عليه", get: s.get[l],
    limitsTitle: "", limits: [],
    faq: s.faq[l], solutions: s.solutions,
  });
  return { en: side("en"), ar: side("ar") };
}

const getCommon: LL = {
  en: ["Decision makers reached every day, within your budget", "A personal message to each one, from your mailbox", "Replies answered and meetings booked", "Results and cost per result for every campaign and audience"],
  ar: ["صنّاع قرار يُتواصل معهم كل يوم داخل ميزانيتك", "رسالة شخصية لكل منهم من بريدك", "ردود تُجاب واجتماعات تُحجز", "النتائج وتكلفة النتيجة لكل حملة وجمهور"],
};

export const useCases: Record<UseCaseSlug, Localized<UseCase>> = {
  "ai-prospecting": build({
    name: { en: "AI prospecting", ar: "البحث عن العملاء بالذكاء الاصطناعي" },
    title: { en: "AI Prospecting: Reach Your Ideal Customers Automatically", ar: "البحث عن العملاء بالذكاء الاصطناعي: صِل إلى عملائك المثاليين تلقائيًا" },
    h1: { en: "AI prospecting that books the meeting", ar: "بحث عن العملاء بالذكاء الاصطناعي يحجز الاجتماع" },
    meta: { en: "AI prospecting with Yolias: define your ideal customers, and AI campaigns find the decision makers, write to each one and book meetings.", ar: "البحث عن العملاء بالذكاء الاصطناعي مع يولياس: حدد عملاءك المثاليين، فتجد الحملات الذكية صنّاع القرار وتكتب لكل منهم وتحجز الاجتماعات." },
    lead: { en: "Yolias turns prospecting into a campaign: you define the customer, AI does the finding, the writing, the follow-up and the booking.", ar: "يحوّل يولياس البحث عن العملاء إلى حملة: تحدد العميل، والذكاء الاصطناعي يجد ويكتب ويتابع ويحجز." },
    answerTitle: { en: "What is AI prospecting?", ar: "ما هو البحث عن العملاء بالذكاء الاصطناعي؟" },
    answer: { en: "AI prospecting uses AI to find the companies and people who match your ideal customer and to start the conversation with each one. In Yolias it runs as a campaign with a goal: it reaches the decision makers, answers their replies and books meetings, and shows the cost of every result.", ar: "البحث عن العملاء بالذكاء الاصطناعي يستخدم الذكاء الاصطناعي لإيجاد الشركات والأشخاص المطابقين لعميلك المثالي وبدء المحادثة مع كل منهم. وفي يولياس يعمل كحملة لها هدف: يصل إلى صنّاع القرار، ويرد على ردودهم ويحجز الاجتماعات، ويعرض تكلفة كل نتيجة." },
    forWho: { en: ["Agencies, consultants and freelancers who want new clients every month", "B2B sales teams with target accounts", "Founders selling before they hire a sales team"], ar: ["الوكالات والاستشاريون والمستقلون الذين يريدون عملاء جددًا كل شهر", "فرق مبيعات الشركات التي لديها حسابات مستهدفة", "المؤسسون الذين يبيعون قبل توظيف فريق مبيعات"] },
    problem: { en: ["Lists take days to build and go stale in weeks.", "Writing, following up and booking eat the time you should spend selling."], ar: ["بناء القوائم يأخذ أيامًا وتتقادم خلال أسابيع.", "الكتابة والمتابعة والحجز تأكل الوقت الذي يجب أن تقضيه في البيع."] },
    example: { en: "Goal: meetings. Audience: logistics companies in the UAE, 100–500 employees, operations directors and COOs.", ar: "الهدف: اجتماعات. الجمهور: شركات اللوجستيات في الإمارات، من 100 إلى 500 موظف، مديرو العمليات." },
    get: getCommon,
    faq: {
      en: [
        { q: "Is AI prospecting the same as buying a lead list?", a: "No. A list is a file. Yolias reaches the people who match your audience, writes to them and books meetings, and learns which audiences bring results." },
        { q: "Do I need to know filters or industry codes?", a: "No. Choose countries, industries, company size and job titles, or let Yolias AI prepare the campaign from one sentence." },
      ],
      ar: [
        { q: "هل البحث بالذكاء الاصطناعي مثل شراء قائمة عملاء؟", a: "لا. القائمة ملف. أما يولياس فيصل إلى الأشخاص المطابقين لجمهورك ويكتب لهم ويحجز الاجتماعات، ويتعلم أي الجماهير تجلب نتائج." },
        { q: "هل أحتاج إلى معرفة الفلاتر أو رموز القطاعات؟", a: "لا. اختر الدول والمجالات وحجم الشركة والمسميات الوظيفية، أو دع يولياس AI يجهز الحملة من جملة واحدة." },
      ],
    },
    solutions: ["sales-teams", "marketing-agencies", "consultants"],
  }),
  "find-clients": build({
    name: { en: "Find clients", ar: "إيجاد العملاء" },
    title: { en: "How to Find Clients for Your Business with AI", ar: "كيف تجد عملاء لنشاطك بالذكاء الاصطناعي" },
    h1: { en: "How to find clients for your business", ar: "كيف تجد عملاء لنشاطك" },
    meta: { en: "How to find clients: define the customers you want and let an AI campaign reach the decision makers and book meetings. Here's how Yolias does it.", ar: "كيف تجد عملاء: حدد العملاء الذين تريدهم ودع حملة ذكية تصل إلى صنّاع القرار وتحجز الاجتماعات. هكذا يفعلها يولياس." },
    lead: { en: "The fastest way to new clients is to choose them, then reach the person who decides with a message that fits.", ar: "أسرع طريق إلى عملاء جدد أن تختارهم، ثم تصل إلى صاحب القرار برسالة تناسبه." },
    answerTitle: { en: "How do I find clients for my business?", ar: "كيف أجد عملاء لنشاطي؟" },
    answer: { en: "Pick the companies your service fits best, reach the person who decides with a short personal message, follow up twice and offer a time to talk. Yolias runs all of it as one campaign and shows what each new meeting costs.", ar: "اختر الشركات التي تناسبها خدمتك أكثر، وصِل إلى صاحب القرار برسالة شخصية قصيرة، وتابع مرتين، واعرض موعدًا للحديث. ويشغّل يولياس كل ذلك كحملة واحدة ويعرض تكلفة كل اجتماع جديد." },
    forWho: { en: ["Service businesses and agencies", "Consultants and freelancers", "Founders and small sales teams"], ar: ["شركات الخدمات والوكالات", "الاستشاريون والمستقلون", "المؤسسون وفرق المبيعات الصغيرة"] },
    problem: { en: ["Referrals are unpredictable.", "Ads reach browsers, not the people who sign."], ar: ["الترشيحات لا يمكن توقعها.", "الإعلانات تصل إلى متصفحين، لا إلى من يوقّع."] },
    example: { en: "Goal: meetings. Audience: private clinics in Cairo and Alexandria, 5–50 employees, owners.", ar: "الهدف: اجتماعات. الجمهور: العيادات الخاصة في القاهرة والإسكندرية، من 5 إلى 50 موظفًا، الملاك." },
    get: getCommon,
    faq: {
      en: [{ q: "How many clients can I expect?", a: "On average 0.5–1.5% of the people reached book a meeting with a personal first email. Each campaign shows your real rate and cost per meeting." }],
      ar: [{ q: "كم عميلًا أتوقع؟", a: "في المتوسط يحجز 0.5–1.5% من الأشخاص الذين يُتواصل معهم اجتماعًا مع رسالة أولى شخصية. وتعرض كل حملة معدلك الحقيقي وتكلفة الاجتماع." }],
    },
    solutions: ["freelancers", "marketing-agencies", "consultants"],
  }),
  "icp-company-search": build({
    name: { en: "Companies that match your ICP", ar: "شركات تطابق ملف عميلك المثالي" },
    title: { en: "Find Companies that Match Your Ideal Customer Profile", ar: "اعثر على شركات تطابق ملف عميلك المثالي" },
    h1: { en: "Reach the companies that match your ideal customer profile", ar: "صِل إلى الشركات التي تطابق ملف عميلك المثالي" },
    meta: { en: "Turn your ideal customer profile into a campaign: Yolias reaches the matching companies and decision makers and books meetings.", ar: "حوّل ملف عميلك المثالي إلى حملة: يصل يولياس إلى الشركات وصنّاع القرار المطابقين ويحجز الاجتماعات." },
    lead: { en: "Your ideal customer profile becomes an audience: industry, size, country and the roles that decide.", ar: "يتحول ملف عميلك المثالي إلى جمهور: المجال والحجم والدولة والمناصب التي تقرر." },
    answerTitle: { en: "How do I find companies that match my ICP?", ar: "كيف أجد شركات تطابق ملف عميلي المثالي؟" },
    answer: { en: "Write your ideal customer as an audience: industries, countries and cities, company size and job titles. Yolias reaches the companies that match, explains why each one fits and starts the conversation.", ar: "اكتب عميلك المثالي كجمهور: المجالات، والدول والمدن، وحجم الشركة، والمسميات الوظيفية. ويصل يولياس إلى الشركات المطابقة، ويوضح سبب تطابق كل منها، ويبدأ المحادثة." },
    forWho: { en: ["B2B companies with a clear ideal customer", "Sales teams building target accounts", "Agencies specialized by industry"], ar: ["شركات تبيع للشركات ولديها عميل مثالي واضح", "فرق مبيعات تبني حسابات مستهدفة", "وكالات متخصصة في قطاع"] },
    problem: { en: ["Generic databases don't know your market.", "A profile on a slide doesn't bring meetings."], ar: ["قواعد البيانات العامة لا تعرف سوقك.", "ملف العميل على شريحة عرض لا يجلب اجتماعات."] },
    example: { en: "Goal: meetings. Audience: SaaS companies in Saudi Arabia, 20–200 employees, founders and CTOs.", ar: "الهدف: اجتماعات. الجمهور: شركات SaaS في السعودية، من 20 إلى 200 موظف، المؤسسون ومديرو التقنية." },
    get: getCommon,
    faq: {
      en: [{ q: "Can I use my existing customers as the profile?", a: "Yes. Upload them or pick a past campaign, and Yolias builds a lookalike audience of companies like them." }],
      ar: [{ q: "هل أستخدم عملائي الحاليين كملف للعميل المثالي؟", a: "نعم. ارفعهم أو اختر حملة سابقة، ويبني يولياس جمهورًا مشابهًا من شركات تشبههم." }],
    },
    solutions: ["sales-teams", "software-agencies", "marketing-agencies"],
  }),
  "find-decision-makers": build({
    name: { en: "Find decision makers", ar: "إيجاد صنّاع القرار" },
    title: { en: "How to Find Decision Makers in Companies", ar: "كيف تجد صنّاع القرار في الشركات" },
    h1: { en: "Reach the decision makers at the companies you want", ar: "صِل إلى صنّاع القرار في الشركات التي تريدها" },
    meta: { en: "How to find decision makers: target companies and job titles, and Yolias reaches the people who decide and books meetings.", ar: "كيف تجد صنّاع القرار: استهدف الشركات والمسميات الوظيفية، ويصل يولياس إلى من يملك القرار ويحجز الاجتماعات." },
    lead: { en: "The company is the target; the person who decides is the conversation.", ar: "الشركة هي الهدف، وصاحب القرار هو المحادثة." },
    answerTitle: { en: "How do I find decision-makers in companies?", ar: "كيف أجد صنّاع القرار في الشركات؟" },
    answer: { en: "Start from the companies that fit, then the job title that decides for what you sell: the founder or owner in small companies, the head of the department in larger ones. Yolias reaches those people at each matching company and writes to each one.", ar: "ابدأ بالشركات المناسبة، ثم المسمى الوظيفي الذي يقرر فيما تبيعه: المؤسس أو المالك في الشركات الصغيرة، ورئيس القسم في الأكبر. ويصل يولياس إلى هؤلاء في كل شركة مطابقة ويكتب لكل منهم." },
    forWho: { en: ["Anyone selling to companies", "Agencies and consultants", "Sales teams"], ar: ["كل من يبيع للشركات", "الوكالات والاستشاريون", "فرق المبيعات"] },
    problem: { en: ["Generic inboxes rarely reach the person who signs.", "Finding the right name at each company takes hours."], ar: ["البريد العام نادرًا ما يصل إلى من يوقّع.", "إيجاد الاسم الصحيح في كل شركة يأخذ ساعات."] },
    example: { en: "Goal: meetings. Audience: hotels in Dubai and Riyadh, 50–500 employees, general managers and heads of sales.", ar: "الهدف: اجتماعات. الجمهور: الفنادق في دبي والرياض، من 50 إلى 500 موظف، المديرون العامون ورؤساء المبيعات." },
    get: getCommon,
    faq: {
      en: [{ q: "How do I find decision-makers in companies?", a: "Target the companies that fit and the job titles that decide. In Yolias you add those titles to a campaign's audience and it reaches the decision makers at each matching company." }],
      ar: [{ q: "كيف أجد صنّاع القرار في الشركات؟", a: "استهدف الشركات المناسبة والمسميات الوظيفية التي تقرر. وفي يولياس تضيف هذه المسميات إلى جمهور الحملة فيصل إلى صنّاع القرار في كل شركة مطابقة." }],
    },
    solutions: ["sales-teams", "recruitment-agencies", "consultants"],
  }),
  "local-business-leads": build({
    name: { en: "Local business leads", ar: "عملاء من الأنشطة المحلية" },
    title: { en: "Find Local Business Leads by City and Category", ar: "عملاء من الأنشطة المحلية حسب المدينة والنشاط" },
    h1: { en: "Reach local businesses by city and category", ar: "صِل إلى الأنشطة المحلية حسب المدينة والنشاط" },
    meta: { en: "Find local business leads: clinics, restaurants, gyms and shops by city. Yolias reaches the owners and books meetings.", ar: "عملاء من الأنشطة المحلية: عيادات ومطاعم وصالات رياضية ومتاجر حسب المدينة. يصل يولياس إلى الملاك ويحجز الاجتماعات." },
    lead: { en: "Clinics, restaurants, gyms and shops in the cities you choose, with the owners reached directly.", ar: "عيادات ومطاعم وصالات رياضية ومتاجر في المدن التي تختارها، مع الوصول إلى الملاك مباشرة." },
    answerTitle: { en: "How do I find local business leads?", ar: "كيف أجد عملاء من الأنشطة المحلية؟" },
    answer: { en: "Choose the category and the cities. Yolias finds the businesses there, reaches the owners with a message about their business and books the call.", ar: "اختر النشاط والمدن، ويجد يولياس الأنشطة هناك، ويصل إلى الملاك برسالة عن نشاطهم، ويحجز المكالمة." },
    forWho: { en: ["Marketing and web design agencies", "Software for clinics, restaurants and retail", "Suppliers to local businesses"], ar: ["وكالات التسويق وتصميم المواقع", "برمجيات للعيادات والمطاعم والتجزئة", "الموردون للأنشطة المحلية"] },
    problem: { en: ["Maps show businesses, not the person who decides.", "Walking in doesn't scale past one city."], ar: ["الخرائط تعرض الأنشطة، لا من يملك القرار.", "الزيارات المباشرة لا تتوسع لأكثر من مدينة."] },
    example: { en: "Goal: meetings. Audience: gyms and fitness studios in Riyadh, Jeddah and Dammam, owners.", ar: "الهدف: اجتماعات. الجمهور: الصالات الرياضية واستوديوهات اللياقة في الرياض وجدة والدمام، الملاك." },
    get: getCommon,
    faq: {
      en: [{ q: "Can I target one neighborhood or city?", a: "Yes. Pick cities and regions in any country, and exclude the ones you don't want." }],
      ar: [{ q: "هل أستهدف حيًا أو مدينة واحدة؟", a: "نعم. اختر المدن والمناطق في أي دولة، واستبعد ما لا تريده." }],
    },
    solutions: ["marketing-agencies", "freelancers", "software-agencies"],
  }),
  "similar-companies": build({
    name: { en: "Companies like your best customers", ar: "شركات تشبه أفضل عملائك" },
    title: { en: "Find Companies Similar to Your Best Customers", ar: "اعثر على شركات تشبه أفضل عملائك" },
    h1: { en: "Reach companies like your best customers", ar: "صِل إلى شركات تشبه أفضل عملائك" },
    meta: { en: "Lookalike audiences for B2B: Yolias finds companies like your best customers, reaches the decision makers and books meetings.", ar: "جماهير مشابهة للشركات: يجد يولياس شركات تشبه أفضل عملائك، ويصل إلى صنّاع القرار ويحجز الاجتماعات." },
    lead: { en: "A lookalike audience for B2B: your best customers in, more like them out.", ar: "جمهور مشابه للشركات: أفضل عملائك في البداية، وشركات مثلهم في النهاية." },
    answerTitle: { en: "How do I find companies similar to my customers?", ar: "كيف أجد شركات تشبه عملائي؟" },
    answer: { en: "Give Yolias your best customers, from a file or a past campaign. It finds the traits they share, builds a lookalike audience and reaches the decision makers at each company.", ar: "أعطِ يولياس أفضل عملائك، من ملف أو حملة سابقة، فيجد الصفات المشتركة بينهم ويبني جمهورًا مشابهًا ويصل إلى صنّاع القرار في كل شركة." },
    forWho: { en: ["Companies with a handful of great customers", "Sales teams scaling what already works", "Agencies cloning their best accounts"], ar: ["شركات لديها عدد قليل من العملاء الممتازين", "فرق مبيعات توسّع ما ينجح بالفعل", "وكالات تكرر أفضل حساباتها"] },
    problem: { en: ["Your best customers share traits you can't search for by hand.", "Generic targeting dilutes what made them great."], ar: ["أفضل عملائك يشتركون في صفات لا يمكن البحث عنها يدويًا.", "الاستهداف العام يضيّع ما جعلهم ممتازين."] },
    example: { en: "Goal: meetings. Audience: lookalike of your 10 best customers, similarity 7 of 10, Saudi Arabia and the UAE.", ar: "الهدف: اجتماعات. الجمهور: مشابه لأفضل 10 عملاء لديك، تشابه 7 من 10، السعودية والإمارات." },
    get: getCommon,
    faq: {
      en: [{ q: "How many customers do I need for a lookalike?", a: "Five or more gives a usable audience; twenty or more gives high confidence. Yolias shows the confidence for each one." }],
      ar: [{ q: "كم عميلًا أحتاج لجمهور مشابه؟", a: "خمسة أو أكثر تعطي جمهورًا صالحًا، وعشرون أو أكثر تعطي ثقة عالية. ويعرض يولياس درجة الثقة لكل جمهور." }],
    },
    solutions: ["sales-teams", "software-agencies", "marketing-agencies"],
  }),
};

export function isUseCaseSlug(s: string): s is UseCaseSlug {
  return (useCaseSlugs as readonly string[]).includes(s);
}
