import type { Localized } from "./types";

// Solutions pages (owner, 2026-11-03, D-276): Yolias, the AI advertising
// platform for customer acquisition, for one kind of business. Each page
// says who that business sells to, the campaign it would launch and what it
// gets back. Written confident and short (owner's copy rule): the shared
// parts are built once below, each solution adds its own customers, problem,
// uses and example campaign.

export const solutionSlugs = [
  "marketing-agencies",
  "software-agencies",
  "consultants",
  "recruitment-agencies",
  "freelancers",
  "real-estate",
  "sales-teams",
] as const;
export type SolutionSlug = (typeof solutionSlugs)[number];

export interface Solution {
  /** Short name for menus and cards. */
  name: string;
  /** One line for menus. */
  tagline: string;
  title: string;
  lead: string;
  metaDescription: string;
  /** Three outcomes, benefit first (numbered on the page). */
  pillars: { title: string; body: string }[];
  problemTitle: string;
  problem: string[];
  helpsTitle: string;
  helps: { title: string; body: string }[];
  useCasesTitle: string;
  useCases: string[];
  icpTitle: string;
  icpIntro: string;
  /** An example campaign, written the way a member would set it. */
  icp: string;
  stepsTitle: string;
  steps: string[];
  valueTitle: string;
  value: string;
}

export const solutionsPage: Localized<{ eyebrow: string; title: string; lead: string; related: string; cta: { title: string; body: string; primary: string; secondary: string }; note: string; learnMore: string; heroChecks: string[]; pillarsTitle: string }> = {
  en: {
    eyebrow: "SOLUTIONS",
    title: "Customer acquisition for every business that sells to businesses.",
    lead: "Yolias is an AI advertising platform: you define the customers you want, and AI campaigns reach the decision makers and bring back meetings, leads and sales.",
    related: "Other solutions",
    cta: { title: "Launch your first campaign.", body: "Choose the goal, define your customers and let the AI work.", primary: "Get started", secondary: "See pricing" },
    note: "",
    learnMore: "Learn more",
    heroChecks: ["Every feature on every plan", "Live in minutes", "Unlimited users"],
    pillarsTitle: "What you get",
  },
  ar: {
    eyebrow: "الحلول",
    title: "اكتساب العملاء لكل شركة تبيع للشركات.",
    lead: "يولياس منصة إعلانات بالذكاء الاصطناعي: تحدد العملاء الذين تريدهم، فتصل الحملات الذكية إلى صنّاع القرار وتأتيك باجتماعات وعملاء ومبيعات.",
    related: "حلول أخرى",
    cta: { title: "أطلق حملتك الأولى.", body: "اختر الهدف، وحدد عملاءك، ودع الذكاء الاصطناعي يعمل.", primary: "ابدأ الآن", secondary: "عرض الأسعار" },
    note: "",
    learnMore: "اعرف المزيد",
    heroChecks: ["كل الميزات في كل خطة", "جاهز خلال دقائق", "مستخدمون بلا حد"],
    pillarsTitle: "ما الذي تحصل عليه",
  },
};

type L = { en: string; ar: string };
interface Spec {
  name: L; tagline: L; title: L; lead: L; meta: L;
  /** Who they sell to, plural, for the shared sentences ("clinics and restaurants"). */
  buyers: L;
  problem: { en: string[]; ar: string[] };
  useCases: { en: string[]; ar: string[] };
  icp: L;
  value: L;
}

function build(s: Spec): Localized<Solution> {
  const side = (l: "en" | "ar"): Solution => l === "en" ? {
    name: s.name.en, tagline: s.tagline.en, title: s.title.en, lead: s.lead.en, metaDescription: s.meta.en,
    pillars: [
      { title: "New customers every week", body: `Define the ${s.buyers.en} you want. Yolias reaches new decision makers every day, within your budget.` },
      { title: "Conversations, not impressions", body: "Every person gets a personal message from your mailbox. Yolias AI answers, follows up and books the meeting." },
      { title: "Cost per result, in plain sight", body: "Every campaign shows its meetings, leads and sales and what each one cost, like an ads manager." },
    ],
    problemTitle: "Why growth stalls",
    problem: s.problem.en,
    helpsTitle: "One platform, from the first contact to the customer",
    helps: [
      { title: "Campaigns like an ads manager", body: "Goal, budget, audiences and message in three steps. Budget moves to the audiences that convert." },
      { title: "Audiences of decision makers", body: "Countries and cities, industries, company size and job titles, or a lookalike of your best customers." },
      { title: "Yolias AI", body: "Writes to each person, answers questions and objections, and books meetings on your calendar." },
      { title: "Pixel and revenue", body: "The Yolias pixel counts purchases and leads on your website, so every campaign shows its revenue." },
    ],
    useCasesTitle: `What ${s.name.en.toLowerCase()} run on Yolias`,
    useCases: s.useCases.en,
    icpTitle: "A campaign you could launch today",
    icpIntro: "Goal and audience",
    icp: s.icp.en,
    stepsTitle: "Live in four steps",
    steps: ["Choose the goal: meetings, leads or sales.", `Define the ${s.buyers.en} you want and who decides there.`, "Pick the mailbox, tone and language, and launch.", "Watch results and cost per result; the budget follows what works."],
    valueTitle: "What it's worth",
    value: s.value.en,
  } : {
    name: s.name.ar, tagline: s.tagline.ar, title: s.title.ar, lead: s.lead.ar, metaDescription: s.meta.ar,
    pillars: [
      { title: "عملاء جدد كل أسبوع", body: `حدد ${s.buyers.ar} الذين تريدهم، ويصل يولياس إلى صنّاع قرار جدد كل يوم داخل ميزانيتك.` },
      { title: "محادثات لا مشاهدات", body: "كل شخص تصله رسالة شخصية من بريدك، ويرد Yolias AI ويتابع ويحجز الاجتماع." },
      { title: "تكلفة كل نتيجة أمامك", body: "كل حملة تعرض اجتماعاتها وعملاءها ومبيعاتها وتكلفة كل منها، مثل مدير الإعلانات." },
    ],
    problemTitle: "لماذا يتوقف النمو",
    problem: s.problem.ar,
    helpsTitle: "منصة واحدة، من أول تواصل حتى العميل",
    helps: [
      { title: "حملات مثل مدير الإعلانات", body: "الهدف والميزانية والجماهير والرسالة في ثلاث خطوات، وتتجه الميزانية إلى الجماهير التي تحقق نتائج." },
      { title: "جماهير من صنّاع القرار", body: "الدول والمدن، والمجالات، وحجم الشركة، والمسميات الوظيفية، أو جمهور مشابه لأفضل عملائك." },
      { title: "Yolias AI", body: "يكتب لكل شخص، ويجيب عن الأسئلة والاعتراضات، ويحجز الاجتماعات في تقويمك." },
      { title: "البيكسل والإيرادات", body: "يحسب بيكسل يولياس المشتريات والعملاء المحتملين على موقعك، فتعرض كل حملة إيراداتها." },
    ],
    useCasesTitle: `ما الذي يطلقه ${s.name.ar} على يولياس`,
    useCases: s.useCases.ar,
    icpTitle: "حملة يمكنك إطلاقها اليوم",
    icpIntro: "الهدف والجمهور",
    icp: s.icp.ar,
    stepsTitle: "جاهز في أربع خطوات",
    steps: ["اختر الهدف: اجتماعات أو عملاء محتملون أو مبيعات.", `حدد ${s.buyers.ar} الذين تريدهم ومن يملك القرار فيهم.`, "اختر البريد والأسلوب واللغة، وأطلق الحملة.", "تابع النتائج وتكلفة النتيجة، وتتجه الميزانية إلى ما ينجح."],
    valueTitle: "ما الذي يستحقه",
    value: s.value.ar,
  };
  return { en: side("en"), ar: side("ar") };
}

export const solutions: Record<SolutionSlug, Localized<Solution>> = {
  "marketing-agencies": build({
    name: { en: "Marketing Agencies", ar: "وكالات التسويق" },
    tagline: { en: "Win retainers from businesses that need growth.", ar: "اكسب عقودًا من شركات تحتاج النمو." },
    title: { en: "New retainers for your marketing agency, every month.", ar: "عقود جديدة لوكالة التسويق كل شهر." },
    lead: { en: "Yolias reaches the owners and marketing heads of the businesses you serve best, writes to each one and books the meeting. Your team spends its time on pitches, not lists.", ar: "يصل يولياس إلى أصحاب الشركات ومديري التسويق في القطاعات التي تخدمها بأفضل شكل، ويكتب لكل منهم ويحجز الاجتماع. وفريقك يقضي وقته في العروض، لا في القوائم." },
    meta: { en: "Get marketing agency clients with AI campaigns: Yolias reaches business owners and marketing heads and books the meetings.", ar: "عملاء لوكالة التسويق بحملات ذكية: يصل يولياس إلى أصحاب الشركات ومديري التسويق ويحجز الاجتماعات." },
    buyers: { en: "businesses", ar: "الشركات" },
    problem: {
      en: ["Referrals are great until they stop. Most agencies grow in bursts, then wait.", "Ads bring browsers, not decision makers, and every lead costs more each quarter."],
      ar: ["الترشيحات ممتازة حتى تتوقف. معظم الوكالات تنمو على دفعات ثم تنتظر.", "الإعلانات تجلب متصفحين لا صنّاع قرار، وتكلفة العميل ترتفع كل ربع سنة."],
    },
    useCases: {
      en: ["Clinics and restaurants in your city that need bookings", "E-commerce brands launching in a new country", "Companies hiring a marketing manager you can replace", "Lookalikes of your three best retainers"],
      ar: ["عيادات ومطاعم في مدينتك تحتاج حجوزات أكثر", "متاجر إلكترونية تتوسع إلى دولة جديدة", "شركات توظّف مدير تسويق يمكنك أن تغني عنه", "شركات تشبه أفضل ثلاثة عملاء لديك"],
    },
    icp: { en: "Goal: meetings. Audience: dental and cosmetic clinics in Riyadh and Jeddah, 5–50 employees, owners and clinic managers.", ar: "الهدف: اجتماعات. الجمهور: عيادات الأسنان والتجميل في الرياض وجدة، من 5 إلى 50 موظفًا، الملاك ومديرو العيادات." },
    value: { en: "One retainer covers months of Yolias. Every campaign shows its meetings and cost per meeting, so you know exactly what a new client costs you.", ar: "عقد واحد يغطي تكلفة يولياس لشهور. وكل حملة تعرض اجتماعاتها وتكلفة الاجتماع، فتعرف بالضبط كم يكلفك العميل الجديد." },
  }),
  "software-agencies": build({
    name: { en: "Software Agencies", ar: "شركات البرمجيات" },
    tagline: { en: "Projects from companies that need software built.", ar: "مشاريع من شركات تحتاج برمجيات." },
    title: { en: "Fill your development pipeline with the right projects.", ar: "املأ جدول مشاريعك البرمجية بالمشاريع المناسبة." },
    lead: { en: "Yolias reaches the founders, CTOs and operations heads of companies that need apps, platforms and integrations, and books the discovery call.", ar: "يصل يولياس إلى المؤسسين ومديري التقنية والعمليات في الشركات التي تحتاج تطبيقات ومنصات وتكاملات، ويحجز مكالمة التعرّف." },
    meta: { en: "Get software development clients with AI campaigns: Yolias reaches founders and CTOs and books discovery calls.", ar: "عملاء لشركة البرمجيات بحملات ذكية: يصل يولياس إلى المؤسسين ومديري التقنية ويحجز مكالمات التعرّف." },
    buyers: { en: "companies", ar: "الشركات" },
    problem: {
      en: ["Big projects come in waves, and the gap between them eats the margin.", "Freelance marketplaces race to the bottom on price."],
      ar: ["المشاريع الكبيرة تأتي على موجات، والفجوة بينها تأكل الأرباح.", "منصات العمل الحر سباق نحو أقل سعر."],
    },
    useCases: {
      en: ["Logistics and retail companies still running on spreadsheets", "Funded startups hiring their first engineers", "Companies whose website is slow or outdated", "Lookalikes of your best past clients"],
      ar: ["شركات لوجستيات وتجزئة ما زالت تعمل على جداول البيانات", "شركات ناشئة حصلت على تمويل وتوظّف أول مهندسيها", "شركات موقعها بطيء أو قديم", "شركات تشبه أفضل عملائك السابقين"],
    },
    icp: { en: "Goal: meetings. Audience: logistics and delivery companies in Saudi Arabia and the UAE, 20–200 employees, founders, CTOs and operations directors.", ar: "الهدف: اجتماعات. الجمهور: شركات اللوجستيات والتوصيل في السعودية والإمارات، من 20 إلى 200 موظف، المؤسسون ومديرو التقنية والعمليات." },
    value: { en: "A single project covers months of Yolias. You see the cost of every discovery call before you scale a campaign.", ar: "مشروع واحد يغطي شهورًا من يولياس. وترى تكلفة كل مكالمة تعرّف قبل أن توسّع الحملة." },
  }),
  consultants: build({
    name: { en: "Consultants", ar: "الاستشاريون" },
    tagline: { en: "Clients who need your expertise, now.", ar: "عملاء يحتاجون خبرتك الآن." },
    title: { en: "A steady flow of consulting clients.", ar: "تدفق مستمر من عملاء الاستشارات." },
    lead: { en: "Yolias reaches the executives who hire consultants like you, writes to each one in your voice and books the first call.", ar: "يصل يولياس إلى التنفيذيين الذين يستعينون بمستشارين مثلك، ويكتب لكل منهم بأسلوبك ويحجز المكالمة الأولى." },
    meta: { en: "Get consulting clients with AI campaigns: Yolias reaches the executives who hire consultants and books the first call.", ar: "عملاء للاستشارات بحملات ذكية: يصل يولياس إلى التنفيذيين الذين يستعينون بمستشارين ويحجز المكالمة الأولى." },
    buyers: { en: "companies", ar: "الشركات" },
    problem: {
      en: ["Your calendar depends on your network, and your network is finite.", "Content builds trust slowly; pipelines need conversations now."],
      ar: ["جدولك يعتمد على شبكة علاقاتك، وشبكة العلاقات محدودة.", "المحتوى يبني الثقة ببطء، والمبيعات تحتاج محادثات الآن."],
    },
    useCases: {
      en: ["Mid-size companies expanding into new markets", "Family businesses preparing for growth or succession", "Companies hiring for a role your expertise covers", "Executives in the industries you know best"],
      ar: ["شركات متوسطة تتوسع إلى أسواق جديدة", "شركات عائلية تستعد للنمو أو انتقال الإدارة", "شركات توظّف لدور تغطيه خبرتك", "تنفيذيون في القطاعات التي تعرفها جيدًا"],
    },
    icp: { en: "Goal: meetings. Audience: manufacturing and distribution companies in Egypt and Saudi Arabia, 50–500 employees, CEOs and COOs.", ar: "الهدف: اجتماعات. الجمهور: شركات التصنيع والتوزيع في مصر والسعودية، من 50 إلى 500 موظف، الرؤساء التنفيذيون ومديرو العمليات." },
    value: { en: "One engagement covers months of Yolias. Yolias shows what each meeting costs, so you invest in the audiences that sign.", ar: "تعاقد واحد يغطي شهورًا من يولياس. ويعرض يولياس تكلفة كل اجتماع، فتستثمر في الجماهير التي توقّع." },
  }),
  "recruitment-agencies": build({
    name: { en: "Recruitment Agencies", ar: "وكالات التوظيف" },
    tagline: { en: "Companies hiring right now.", ar: "شركات توظّف الآن." },
    title: { en: "Reach the companies hiring right now.", ar: "صِل إلى الشركات التي توظّف الآن." },
    lead: { en: "Yolias finds companies with open roles in your specialties, reaches the hiring managers and HR heads, and books the call.", ar: "يجد يولياس الشركات التي لديها وظائف مفتوحة في تخصصاتك، ويصل إلى مديري التوظيف والموارد البشرية، ويحجز المكالمة." },
    meta: { en: "Get recruitment clients with AI campaigns: Yolias reaches companies that are hiring and books calls with hiring managers.", ar: "عملاء لوكالة التوظيف بحملات ذكية: يصل يولياس إلى الشركات التي توظّف ويحجز مكالمات مع مديري التوظيف." },
    buyers: { en: "companies", ar: "الشركات" },
    problem: {
      en: ["By the time a role is on every job board, five agencies have called.", "Cold calling HR doesn't scale and rarely reaches the person who decides."],
      ar: ["حين تظهر الوظيفة في كل المواقع، تكون خمس وكالات قد اتصلت.", "الاتصال البارد بالموارد البشرية لا يتوسع ونادرًا ما يصل إلى صاحب القرار."],
    },
    useCases: {
      en: ["Companies hiring engineers, sales or finance roles", "Fast-growing startups after a funding round", "Companies opening a new branch or market", "Hiring managers in the industries you place"],
      ar: ["شركات توظّف مهندسين أو مبيعات أو مالية", "شركات ناشئة سريعة النمو بعد جولة تمويل", "شركات تفتتح فرعًا أو سوقًا جديدًا", "مديرو توظيف في القطاعات التي تخدمها"],
    },
    icp: { en: "Goal: meetings. Audience: tech and fintech companies in the UAE and Saudi Arabia hiring engineers, 50–1,000 employees, HR heads and engineering managers.", ar: "الهدف: اجتماعات. الجمهور: شركات التقنية والتقنية المالية في الإمارات والسعودية التي توظّف مهندسين، من 50 إلى 1,000 موظف، مديرو الموارد البشرية والهندسة." },
    value: { en: "One placement fee covers months of campaigns. You see the cost of every new client meeting.", ar: "رسوم تعيين واحد تغطي شهورًا من الحملات. وترى تكلفة كل اجتماع مع عميل جديد." },
  }),
  freelancers: build({
    name: { en: "Freelancers", ar: "المستقلون" },
    tagline: { en: "Direct clients, no marketplace fees.", ar: "عملاء مباشرون بدون عمولات المنصات." },
    title: { en: "Direct clients for your freelance business.", ar: "عملاء مباشرون لعملك المستقل." },
    lead: { en: "Yolias reaches the businesses that need your skills, writes to the person who decides and books the call. No bidding, no platform fees.", ar: "يصل يولياس إلى الشركات التي تحتاج مهاراتك، ويكتب لصاحب القرار ويحجز المكالمة. بدون مزايدات ولا عمولات منصات." },
    meta: { en: "Get direct freelance clients with AI campaigns: Yolias reaches the decision makers who need your skills and books calls.", ar: "عملاء مباشرون للمستقلين بحملات ذكية: يصل يولياس إلى أصحاب القرار الذين يحتاجون مهاراتك ويحجز المكالمات." },
    buyers: { en: "businesses", ar: "الشركات" },
    problem: {
      en: ["Marketplaces take a cut and push prices down.", "Between projects, finding the next client takes the time you should bill."],
      ar: ["المنصات تأخذ نسبة وتدفع الأسعار للأسفل.", "بين المشاريع، البحث عن العميل التالي يأكل الوقت الذي يجب أن تتقاضى عنه."],
    },
    useCases: {
      en: ["Local businesses that need a website or design", "Startups that need a developer or marketer part-time", "Agencies that outsource overflow work", "Lookalikes of your favorite clients"],
      ar: ["أنشطة محلية تحتاج موقعًا أو تصميمًا", "شركات ناشئة تحتاج مطورًا أو مسوقًا بدوام جزئي", "وكالات تعطي جزءًا من عملها لمستقلين", "شركات تشبه أفضل عملائك"],
    },
    icp: { en: "Goal: meetings. Audience: restaurants, cafés and clinics in Cairo and Dubai with an outdated website, owners.", ar: "الهدف: اجتماعات. الجمهور: مطاعم ومقاهٍ وعيادات في القاهرة ودبي بموقع قديم، الملاك." },
    value: { en: "Start from $5. One direct client is worth more than months of marketplace bids.", ar: "ابدأ من 5 دولارات. وعميل مباشر واحد أفضل من شهور من المزايدات على المنصات." },
  }),
  "real-estate": build({
    name: { en: "Commercial Real Estate", ar: "العقار التجاري" },
    tagline: { en: "Companies about to need space.", ar: "شركات على وشك أن تحتاج مساحات." },
    title: { en: "Reach the companies about to need new space.", ar: "صِل إلى الشركات التي ستحتاج مساحات جديدة." },
    lead: { en: "Yolias reaches growing companies and their decision makers, writes to each one about your properties and books the viewing.", ar: "يصل يولياس إلى الشركات النامية وصنّاع القرار فيها، ويكتب لكل منهم عن عقاراتك ويحجز المعاينة." },
    meta: { en: "Get commercial real estate tenants with AI campaigns: Yolias reaches growing companies and books viewings.", ar: "مستأجرون للعقار التجاري بحملات ذكية: يصل يولياس إلى الشركات النامية ويحجز المعاينات." },
    buyers: { en: "companies", ar: "الشركات" },
    problem: {
      en: ["Listings wait for tenants who are already searching, along with every competitor.", "Growing companies decide on space long before they browse listings."],
      ar: ["الإعلانات تنتظر مستأجرين يبحثون بالفعل، ومعهم كل المنافسين.", "الشركات النامية تقرر حاجتها للمساحة قبل أن تتصفح الإعلانات بوقت طويل."],
    },
    useCases: {
      en: ["Companies hiring fast that will outgrow their office", "Firms entering a new city", "Clinics and retailers opening new branches", "Companies whose lease ends this year"],
      ar: ["شركات توظّف بسرعة وستضيق بها مكاتبها", "شركات تدخل مدينة جديدة", "عيادات ومتاجر تفتتح فروعًا جديدة", "شركات ينتهي عقد إيجارها هذا العام"],
    },
    icp: { en: "Goal: meetings. Audience: tech and services companies in Riyadh growing past 50 employees, CEOs, COOs and office managers.", ar: "الهدف: اجتماعات. الجمهور: شركات التقنية والخدمات في الرياض التي تجاوزت 50 موظفًا، الرؤساء التنفيذيون ومديرو العمليات والمكاتب." },
    value: { en: "One lease covers months of campaigns. Every viewing has a clear cost.", ar: "عقد إيجار واحد يغطي شهورًا من الحملات. ولكل معاينة تكلفة واضحة." },
  }),
  "sales-teams": build({
    name: { en: "Sales Teams", ar: "فرق المبيعات" },
    tagline: { en: "More qualified meetings for every rep.", ar: "اجتماعات مؤهلة أكثر لكل مندوب." },
    title: { en: "More qualified meetings for your sales team.", ar: "اجتماعات مؤهلة أكثر لفريق المبيعات." },
    lead: { en: "Yolias runs customer acquisition as an AI campaign: it reaches the accounts you target, answers the replies and books meetings on each rep's calendar.", ar: "يشغّل يولياس البحث عن العملاء كحملة ذكية: يصل إلى الحسابات التي تستهدفها، ويرد على الردود، ويحجز الاجتماعات في تقويم كل مندوب." },
    meta: { en: "AI customer acquisition campaigns for sales teams: Yolias reaches target accounts, answers replies and books meetings for every rep.", ar: "البحث عن العملاء بالذكاء الاصطناعي لفرق المبيعات: يصل يولياس إلى الحسابات المستهدفة ويرد ويحجز الاجتماعات لكل مندوب." },
    buyers: { en: "accounts", ar: "الحسابات" },
    problem: {
      en: ["Reps spend most of the week researching and writing instead of selling.", "Ads and inbound don't cover the accounts you actually want."],
      ar: ["المندوبون يقضون معظم الأسبوع في البحث والكتابة بدل البيع.", "الإعلانات والطلبات الواردة لا تغطي الحسابات التي تريدها فعلًا."],
    },
    useCases: {
      en: ["Target account lists by industry and size", "New markets before you hire local reps", "Lookalikes of your closed-won customers", "Re-engaging accounts that went quiet"],
      ar: ["قوائم حسابات مستهدفة حسب المجال والحجم", "أسواق جديدة قبل توظيف مندوبين محليين", "حسابات تشبه العملاء الذين أغلقتم معهم صفقات", "إعادة التواصل مع حسابات توقفت"],
    },
    icp: { en: "Goal: meetings. Audience: retail and e-commerce companies in the GCC, 100–2,000 employees, heads of operations and IT.", ar: "الهدف: اجتماعات. الجمهور: شركات التجزئة والتجارة الإلكترونية في الخليج، من 100 إلى 2,000 موظف، رؤساء العمليات وتقنية المعلومات." },
    value: { en: "Unlimited users on every plan. Each rep's meetings and cost per meeting in one view.", ar: "مستخدمون بلا حد في كل خطة. واجتماعات كل مندوب وتكلفة الاجتماع في مكان واحد." },
  }),
};

export function isSolutionSlug(s: string): s is SolutionSlug {
  return (solutionSlugs as readonly string[]).includes(s);
}
