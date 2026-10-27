// Competitors for the first SEO pages (D-257). Every line comes from the
// product's own website, read on the date given; nothing is from a review
// site. A price is listed only when the vendor's pricing page showed the same
// number on two readings (Apollo's and Instantly's didn't: none listed).
// Published with the owner's approval (2026-10-27); review again in
// Admin → SEO → Competitors at least every 90 days.

type L = { en: string; ar: string };
type LL = { en: string[]; ar: string[] };
export interface SeedCompetitor {
  slug: string; name: string; website: string; pricing_url: string; publishes_prices: boolean | null;
  summary: L; best_for: L; strengths: LL; limits: LL;
  pricing: { plan: string; price: string; period: string; source_url: string; checked_at: string; verified: boolean }[];
  facts: { key: string; value: L; source_url: string; checked_at: string; verified: false }[];
  last_reviewed_at?: string;
}

const D = "2026-10-26";
const fact = (key: string, en: string, ar: string, source_url: string) => ({ key, value: { en, ar }, source_url, checked_at: D, verified: false as const });
// Prices read twice from the vendor's own pricing page (2026-10-26 and 2026-10-27, monthly billing) and identical both times.
const price = (plan: string, p: string, period: string, source_url: string) => ({ plan, price: p, period, source_url, checked_at: "2026-10-27", verified: true });

export const competitors: SeedCompetitor[] = [
  {
    slug: "apollo", name: "Apollo.io", website: "https://www.apollo.io", pricing_url: "https://www.apollo.io/pricing", publishes_prices: true,
    summary: {
      en: "A B2B sales platform with its own contact and company database, enrichment, email sequences, a dialer and AI agents that research, build lists and write outreach.",
      ar: "منصة مبيعات B2B لديها قاعدة بيانات خاصة بجهات الاتصال والشركات، مع إثراء البيانات وتسلسلات البريد وخدمة اتصال هاتفي ووكلاء ذكاء اصطناعي يبحثون ويبنون القوائم ويكتبون الرسائل.",
    },
    best_for: { en: "Sales teams that want one large contact database plus sequences and calling in the same tool.", ar: "فرق المبيعات التي تريد قاعدة جهات اتصال كبيرة مع التسلسلات والاتصال في أداة واحدة." },
    strengths: {
      en: ["Says it has 240M contacts and 30M companies", "Email sequences, a parallel dialer and waterfall enrichment in one product", "Says it has 200+ integrations", "A free plan"],
      ar: ["تقول إن لديها 240 مليون جهة اتصال و30 مليون شركة", "تسلسلات بريد واتصال هاتفي متوازٍ وإثراء متعدد المصادر في منتج واحد", "تقول إن لديها أكثر من 200 تكامل", "خطة مجانية"],
    },
    limits: {
      en: ["Pricing is per user and uses credits for emails, phone numbers and enrichment; credits reset each billing cycle and do not roll over (its pricing FAQ)", "Built around filters and a database; it isn't built around describing a customer in Arabic"],
      ar: ["السعر لكل مستخدم ويعتمد على رصيد للبريد وأرقام الهاتف والإثراء، ويتجدد الرصيد كل دورة فوترة ولا يُرحَّل (من أسئلة صفحة أسعارها)", "مبنية حول الفلاتر وقاعدة البيانات، وليست مبنية حول وصف العميل بالعربية"],
    },
    pricing: [], // Its pricing page didn't show prices to our reader: check https://www.apollo.io/pricing and add them.
    facts: [
      fact("database", "240M contacts & 30M companies (its claim)", "240 مليون جهة اتصال و30 مليون شركة (بحسب قولها)", "https://www.apollo.io/"),
      fact("plans", "Free, Basic, Professional and Custom plans", "خطط Free وBasic وProfessional وCustom", "https://www.apollo.io/pricing"),
      fact("credits", "Credits reset each billing cycle and do not roll over", "الرصيد يتجدد كل دورة فوترة ولا يُرحَّل", "https://www.apollo.io/pricing"),
    ],
  },
  {
    slug: "clay", name: "Clay", website: "https://www.clay.com", pricing_url: "https://www.clay.com/pricing", publishes_prices: true,
    summary: {
      en: "A data enrichment and go-to-market workflow tool: tables and a visual canvas that pull data from many vendors, AI research agents (Claygent), scoring and CRM sync.",
      ar: "أداة لإثراء البيانات وبناء مسارات المبيعات والتسويق: جداول ولوحة مرئية تجمع البيانات من مزودين كثيرين، ووكلاء بحث بالذكاء الاصطناعي (Claygent)، وتقييم العملاء، ومزامنة مع CRM.",
    },
    best_for: { en: "Growth and RevOps teams that build their own enrichment and outbound workflows and want to combine many data providers.", ar: "فرق النمو والعمليات التي تبني مسارات الإثراء والتواصل بنفسها وتريد الجمع بين مزودي بيانات كثيرين." },
    strengths: {
      en: ["Says it brings data from 200+ data and AI vendors under one contract", "Waterfall enrichment across providers", "AI research agents and scoring", "Unlimited seats on every plan, including the free one"],
      ar: ["تقول إنها تجمع بيانات أكثر من 200 مزود بيانات وذكاء اصطناعي بعقد واحد", "إثراء متتابع عبر عدة مزودين", "وكلاء بحث بالذكاء الاصطناعي وتقييم للعملاء", "عدد غير محدود من المستخدمين في كل الخطط، ومنها المجانية"],
    },
    limits: {
      en: ["You design the workflow yourself: tables, columns and actions take time to learn", "Usage is counted in actions and data credits per month", "Sending email goes through Clay Sequencer or another sending tool"],
      ar: ["تصمم المسار بنفسك: الجداول والأعمدة والإجراءات تحتاج وقتًا للتعلم", "الاستخدام يُحسب بالإجراءات ورصيد البيانات شهريًا", "إرسال البريد يتم عبر Clay Sequencer أو أداة إرسال أخرى"],
    },
    pricing: [
      price("Free", "$0", "month", "https://www.clay.com/pricing"),
      price("Launch", "from $167", "month", "https://www.clay.com/pricing"),
      price("Growth", "from $446", "month", "https://www.clay.com/pricing"),
      price("Enterprise", "custom", "", "https://www.clay.com/pricing"),
    ],
    facts: [
      fact("vendors", "200+ data and AI vendors in its marketplace", "أكثر من 200 مزود بيانات وذكاء اصطناعي في سوقها", "https://www.clay.com/"),
      fact("free_plan", "Free plan: 500 actions and 100 data credits a month, up to 200 rows per table", "الخطة المجانية: 500 إجراء و100 رصيد بيانات شهريًا، وحتى 200 صف لكل جدول", "https://www.clay.com/pricing"),
    ],
  },
  {
    slug: "zoominfo", name: "ZoomInfo", website: "https://www.zoominfo.com", pricing_url: "https://www.zoominfo.com/pricing", publishes_prices: false,
    summary: {
      en: "An enterprise B2B data and intelligence platform for sales, marketing and RevOps: contact and company data, intent signals, AI agents in its GTM Workspace and many integrations.",
      ar: "منصة بيانات ومعلومات B2B للمؤسسات، لفرق المبيعات والتسويق والعمليات: بيانات جهات الاتصال والشركات، وإشارات نية الشراء، ووكلاء ذكاء اصطناعي في GTM Workspace، وتكاملات كثيرة.",
    },
    best_for: { en: "Larger sales and marketing organisations that need broad data, intent and CRM integrations and buy through a sales process.", ar: "مؤسسات المبيعات والتسويق الأكبر التي تحتاج بيانات واسعة وإشارات نية وتكاملات CRM وتشتري عبر فريق مبيعات." },
    strengths: {
      en: ["Says it covers 500M+ contacts and 100M+ companies", "Intent and account intelligence", "Native Salesforce, HubSpot and Dynamics 365 integrations and 120+ other tools (its claim)"],
      ar: ["تقول إنها تغطي أكثر من 500 مليون جهة اتصال و100 مليون شركة", "إشارات نية الشراء ومعلومات الحسابات", "تكامل مباشر مع Salesforce وHubSpot وDynamics 365 وأكثر من 120 أداة أخرى (بحسب قولها)"],
    },
    limits: {
      en: ["Doesn't publish prices: pricing depends on package, licences and credits and comes from its sales team", "Built for larger teams; there is no self-serve monthly plan on its pricing page"],
      ar: ["لا تنشر أسعارها: السعر يعتمد على الباقة وعدد التراخيص والرصيد ويأتي من فريق المبيعات", "مبنية للفرق الأكبر، ولا توجد خطة شهرية ذاتية الخدمة في صفحة أسعارها"],
    },
    pricing: [],
    facts: [
      fact("data", "500M+ contacts and 100M+ companies (its claim)", "أكثر من 500 مليون جهة اتصال و100 مليون شركة (بحسب قولها)", "https://www.zoominfo.com/"),
      fact("pricing", "Prices are not published; based on features, licences and credit usage", "الأسعار غير منشورة؛ تعتمد على الميزات وعدد التراخيص واستهلاك الرصيد", "https://www.zoominfo.com/pricing"),
    ],
  },
  {
    slug: "lusha", name: "Lusha", website: "https://www.lusha.com", pricing_url: "https://www.lusha.com/pricing/", publishes_prices: true,
    summary: {
      en: "A B2B contact data and enrichment tool with a browser extension, a workspace, an API and CRM integrations; contacts are revealed with credits.",
      ar: "أداة لبيانات جهات اتصال B2B وإثرائها، مع إضافة للمتصفح ومساحة عمل وواجهة برمجة وتكاملات CRM؛ وتُكشف جهات الاتصال بالرصيد.",
    },
    best_for: { en: "Sellers who want emails and phone numbers for people they already found, inside the browser or the CRM.", ar: "البائعون الذين يريدون البريد وأرقام الهاتف لأشخاص وجدوهم بالفعل، داخل المتصفح أو CRM." },
    strengths: {
      en: ["Says it has 515M+ verified contacts and 29M+ companies", "Browser extension, API and MCP with one credit balance", "Says it is GDPR and CCPA compliant with SOC 2 Type II and ISO certifications", "A free plan"],
      ar: ["تقول إن لديها أكثر من 515 مليون جهة اتصال موثقة و29 مليون شركة", "إضافة متصفح وواجهة برمجة وMCP برصيد واحد", "تقول إنها متوافقة مع GDPR وCCPA ولديها SOC 2 Type II وشهادات ISO", "خطة مجانية"],
    },
    limits: {
      en: ["A phone number costs 5 credits and an email 1 credit (its pricing page), so phone-heavy lists use credits fast", "Focused on contact data; finding which companies fit your offer is up to you"],
      ar: ["رقم الهاتف بخمسة أرصدة والبريد برصيد واحد (من صفحة أسعارها)، فالقوائم التي تحتاج أرقامًا كثيرة تستهلك الرصيد بسرعة", "تركيزها على بيانات التواصل؛ أما تحديد الشركات المناسبة لعرضك فعليك أنت"],
    },
    pricing: [
      price("Free", "$0", "month", "https://www.lusha.com/pricing/"),
      price("Starter", "$49.90", "month", "https://www.lusha.com/pricing/"),
      price("Professional", "$69.90", "month", "https://www.lusha.com/pricing/"),
      price("Premium", "$399.90", "month", "https://www.lusha.com/pricing/"),
    ],
    facts: [
      fact("data", "515M+ verified contacts and 29M+ companies (its claim)", "أكثر من 515 مليون جهة اتصال موثقة و29 مليون شركة (بحسب قولها)", "https://www.lusha.com/"),
      fact("credits", "1 credit per email, 5 credits per phone number", "رصيد واحد للبريد وخمسة لرقم الهاتف", "https://www.lusha.com/pricing/"),
    ],
  },
  {
    slug: "cognism", name: "Cognism", website: "https://www.cognism.com", pricing_url: "https://www.cognism.com/pricing", publishes_prices: false,
    summary: {
      en: "A B2B contact data provider known for phone-verified mobile numbers and European coverage, with intent signals, enrichment and CRM exports.",
      ar: "مزود بيانات جهات اتصال B2B معروف بأرقام الجوال المتحقق منها هاتفيًا وتغطية أوروبا، مع إشارات نية الشراء والإثراء والتصدير إلى CRM.",
    },
    best_for: { en: "Teams that call decision makers, especially in Europe, and need compliance features.", ar: "الفرق التي تتصل بصنّاع القرار هاتفيًا، خاصة في أوروبا، وتحتاج ميزات الامتثال." },
    strengths: {
      en: ["Phone-verified mobile numbers", "Built for European markets, with Do-Not-Call coverage across Europe (its claim)", "Intent data (Bombora) on its Pro plan", "Says it complies with GDPR and CCPA"],
      ar: ["أرقام جوال متحقق منها هاتفيًا", "مبنية لأسواق أوروبا، مع تغطية قوائم عدم الاتصال في أوروبا (بحسب قولها)", "بيانات نية الشراء (Bombora) في خطة Pro", "تقول إنها متوافقة مع GDPR وCCPA"],
    },
    limits: {
      en: ["Doesn't publish prices: quotes come from its sales team", "Plans on its pricing page start with 5 seats", "A data provider: writing and sending campaigns happens in other tools"],
      ar: ["لا تنشر أسعارها: العرض يأتي من فريق المبيعات", "الخطط في صفحة أسعارها تبدأ بخمسة مستخدمين", "مزود بيانات: كتابة الحملات وإرسالها يتم في أدوات أخرى"],
    },
    pricing: [],
    facts: [
      fact("plans", "Standard and Pro plans, 5 seats included, prices by quote", "خطتا Standard وPro بخمسة مستخدمين، والسعر بعرض", "https://www.cognism.com/pricing"),
      fact("credits", "One credit = one revealed contact", "رصيد واحد = جهة اتصال واحدة مكشوفة", "https://www.cognism.com/pricing"),
    ],
  },
  {
    slug: "instantly", name: "Instantly", website: "https://instantly.ai", pricing_url: "https://instantly.ai/pricing", publishes_prices: true,
    summary: {
      en: "A cold email platform for sending at volume: unlimited email accounts, warmup, deliverability tools, a B2B lead database sold separately, a CRM and AI reply agents.",
      ar: "منصة بريد بارد للإرسال بكميات كبيرة: حسابات بريد غير محدودة، وتدفئة البريد، وأدوات وصول الرسائل، وقاعدة عملاء B2B تُباع منفصلة، وCRM، ووكلاء رد بالذكاء الاصطناعي.",
    },
    best_for: { en: "Agencies and teams that run high-volume cold email across many mailboxes.", ar: "الوكالات والفرق التي تدير بريدًا باردًا بكميات كبيرة عبر صناديق بريد كثيرة." },
    strengths: {
      en: ["Unlimited email accounts and warmup on its outreach plans", "Deliverability and inbox placement tools", "A lead database and a CRM in the same company", "AI agents for outbound and replies"],
      ar: ["حسابات بريد وتدفئة غير محدودة في خطط الإرسال", "أدوات لوصول الرسائل إلى صندوق الوارد", "قاعدة عملاء وCRM من نفس الشركة", "وكلاء ذكاء اصطناعي للتواصل والردود"],
    },
    limits: {
      en: ["Outreach and lead data are separate plans with separate prices", "Built for volume senders: you bring your own sending domains and mailboxes and look after them"],
      ar: ["الإرسال وبيانات العملاء خطتان منفصلتان بسعرين منفصلين", "مبنية لمن يرسل بكميات كبيرة: تجهّز نطاقات وصناديق الإرسال بنفسك وتعتني بها"],
    },
    pricing: [], // Its pricing page gave our reader inconsistent numbers: check https://instantly.ai/pricing and add them.
    facts: [
      fact("accounts", "Unlimited email accounts and unlimited warmup on outreach plans", "حسابات بريد وتدفئة غير محدودة في خطط الإرسال", "https://instantly.ai/pricing"),
      fact("leads", "B2B lead database on separate credit plans", "قاعدة عملاء B2B بخطط رصيد منفصلة", "https://instantly.ai/pricing"),
    ],
  },
  {
    slug: "smartlead", name: "Smartlead", website: "https://www.smartlead.ai", pricing_url: "https://www.smartlead.ai/pricing", publishes_prices: true,
    summary: {
      en: "A cold email platform with unlimited mailboxes, automatic warmup and sender rotation, a unified inbox, an API and white-label options for agencies.",
      ar: "منصة بريد بارد بصناديق بريد غير محدودة، وتدفئة وتدوير للمرسلين تلقائيًا، وصندوق وارد موحد، وواجهة برمجة، وخيارات العلامة البيضاء للوكالات.",
    },
    best_for: { en: "Lead generation agencies that run outreach for several clients and want white label and an API.", ar: "وكالات جذب العملاء التي تدير التواصل لعدة عملاء وتريد العلامة البيضاء وواجهة برمجة." },
    strengths: {
      en: ["Unlimited mailboxes on every plan", "Warmup, DNS help and sender rotation", "Unified inbox for replies", "API, webhooks and white label on its top plan"],
      ar: ["صناديق بريد غير محدودة في كل الخطط", "تدفئة ومساعدة في إعدادات DNS وتدوير المرسلين", "صندوق وارد موحد للردود", "واجهة برمجة وwebhooks وعلامة بيضاء في الخطة الأعلى"],
    },
    limits: {
      en: ["API and white label come only with its highest plan (its pricing page)", "A sending tool: finding the right companies happens elsewhere"],
      ar: ["واجهة البرمجة والعلامة البيضاء في الخطة الأعلى فقط (من صفحة أسعارها)", "أداة إرسال: إيجاد الشركات المناسبة يتم في مكان آخر"],
    },
    pricing: [
      price("Base", "$39", "month", "https://www.smartlead.ai/pricing"),
      price("Pro", "$94", "month", "https://www.smartlead.ai/pricing"),
      price("Unlimited Smart", "$174", "month", "https://www.smartlead.ai/pricing"),
      price("Unlimited Prime", "$379", "month", "https://www.smartlead.ai/pricing"),
    ],
    facts: [
      fact("mailboxes", "Unlimited mailboxes on every plan", "صناديق بريد غير محدودة في كل الخطط", "https://www.smartlead.ai/pricing"),
      fact("base", "Base plan: 2,000 contacts and 6,000 sends a month", "خطة Base: ألفا جهة اتصال و6 آلاف رسالة شهريًا", "https://www.smartlead.ai/pricing"),
    ],
  },
  {
    slug: "hunter", name: "Hunter", website: "https://hunter.io", pricing_url: "https://hunter.io/pricing", publishes_prices: true,
    summary: {
      en: "An email finding and verification tool: find the email addresses of a company or a person, verify them, find leads with Discover and send cold email sequences.",
      ar: "أداة للعثور على البريد الإلكتروني والتحقق منه: اعثر على عناوين بريد شركة أو شخص، وتحقق منها، وابحث عن عملاء بـ Discover، وأرسل تسلسلات بريد بارد.",
    },
    best_for: { en: "People who know which companies they want and need their email addresses, verified.", ar: "من يعرف الشركات التي يريدها ويحتاج عناوين بريدها متحققًا منها." },
    strengths: {
      en: ["Domain search, email finder and verifier in one place", "A free plan with 50 credits a month", "Simple credit pricing and an API"],
      ar: ["البحث بالنطاق والعثور على البريد والتحقق منه في مكان واحد", "خطة مجانية بخمسين رصيدًا شهريًا", "تسعير بسيط بالرصيد وواجهة برمجة"],
    },
    limits: {
      en: ["Built around email addresses; describing an ideal customer and ranking companies by fit is limited to its Discover filters", "Number of connected email accounts depends on the plan"],
      ar: ["مبنية حول عناوين البريد؛ ووصف العميل المثالي وترتيب الشركات حسب التطابق محدود بفلاتر Discover", "عدد حسابات البريد المتصلة يعتمد على الخطة"],
    },
    pricing: [
      price("Free", "$0", "month", "https://hunter.io/pricing"),
      price("Starter", "$49", "month", "https://hunter.io/pricing"),
      price("Growth", "$149", "month", "https://hunter.io/pricing"),
      price("Scale", "$299", "month", "https://hunter.io/pricing"),
    ],
    facts: [
      fact("free", "Free plan: 50 credits a month", "الخطة المجانية: 50 رصيدًا شهريًا", "https://hunter.io/pricing"),
      fact("credit", "1 search credit = 1 email found", "رصيد بحث واحد = بريد واحد", "https://hunter.io/pricing"),
    ],
  },
];
