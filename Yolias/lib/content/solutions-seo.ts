import type { Localized } from "./types";
import type { SolutionSlug } from "./solutions";

// Search intent, limits and real questions for each Solutions page (D-179).
// The title targets what people in that business actually search for; the
// limits say plainly what Yolias can't do for them; every answer describes
// the product as it works today (no promised results or future features).

export interface SolutionSeo {
  /** Page title (before " | Yolias"): the search intent the page answers. */
  seoTitle: string;
  limitsTitle: string;
  limits: string[];
  faqTitle: string;
  faq: { q: string; a: string }[];
}

const limitsEn = {
  contacts: "Yolias shows the business contact details a company publishes (for example on its website). It doesn’t promise a personal email or phone number for every decision maker.",
  coverage: "What Yolias finds depends on your market and on the data sources connected to it. A search that needs a source Yolias doesn’t have yet waits and tells you so.",
  outreach: "Yolias writes and sends a campaign from your own mailbox (Gmail or any IMAP/SMTP account) only after you approve it, and brings the replies to your Inbox.",
};
const limitsAr = {
  contacts: "يعرض يولياس بيانات التواصل التي تنشرها الشركة (على موقعها مثلًا). ولا يعد ببريد أو رقم شخصي لكل صانع قرار.",
  coverage: "ما يجده يولياس يعتمد على سوقك وعلى مصادر البيانات المتصلة به. البحث الذي يحتاج مصدرًا غير متاح بعد ينتظر ويخبرك بذلك.",
  outreach: "يكتب يولياس الحملة ويرسلها من Gmail أو بريد IMAP/SMTP الخاص بك فقط بعد موافقتك، ويعيد الردود إلى المحادثات.",
};

const common = {
  en: { limitsTitle: "What Yolias doesn’t do", faqTitle: "Questions" },
  ar: { limitsTitle: "ما لا يفعله يولياس", faqTitle: "أسئلة شائعة" },
};

export const solutionSeo: Record<SolutionSlug, Localized<SolutionSeo>> = {
  "marketing-agencies": {
    en: {
      ...common.en,
      seoTitle: "Find Clients for Your Marketing Agency with AI",
      limits: [limitsEn.contacts, "Yolias can’t know whether a business needs marketing help. It matches your criteria and explains why; you judge the need.", limitsEn.outreach],
      faq: [
        { q: "Can Yolias find businesses in one city or area?", a: "Yes. Describe the category and the city or area, for example dental clinics in Jeddah. A local business search returns matching businesses with their website and, when the source provides them, their rating and number of reviews." },
        { q: "Will Yolias tell me which businesses need marketing?", a: "No tool can know that for certain. Yolias finds businesses that match the industry, size and location you describe and explains why each one matched, so you can decide quickly who is worth a proposal." },
        { q: "Can my whole agency team use the same lists?", a: "Yes. Every plan includes unlimited users. Teammates join your workspace as owner, admin or member and see the same campaigns and prospects." },
      ],
    },
    ar: {
      ...common.ar,
      seoTitle: "اعثر على عملاء لوكالة التسويق بالذكاء الاصطناعي",
      limits: [limitsAr.contacts, "لا يستطيع يولياس معرفة ما إذا كان النشاط يحتاج خدمات تسويق. يطابق معاييرك ويشرح السبب، والتقدير لك.", limitsAr.outreach],
      faq: [
        { q: "هل يجد يولياس أنشطة تجارية في مدينة أو منطقة محددة؟", a: "نعم. صِف النشاط والمدينة أو المنطقة، مثل عيادات الأسنان في جدة. يعيد بحث الأنشطة المحلية الأنشطة المطابقة مع موقعها الإلكتروني، ومع التقييم وعدد المراجعات عندما يوفرها المصدر." },
        { q: "هل يخبرني يولياس بالأنشطة التي تحتاج تسويقًا؟", a: "لا توجد أداة تعرف ذلك بيقين. يجد يولياس الأنشطة المطابقة للقطاع والحجم والموقع الذي تصفه ويشرح سبب تطابق كل منها، لتقرر بسرعة من يستحق عرضًا." },
        { q: "هل يستطيع كل فريق الوكالة العمل على نفس القوائم؟", a: "نعم. كل الخطط تشمل مستخدمين غير محدودين، وينضم الزملاء إلى مساحة عملك كمالك أو مسؤول أو عضو ويرون نفس الحملات والعملاء المحتملين." },
      ],
    },
  },
  "software-agencies": {
    en: {
      ...common.en,
      seoTitle: "Find Clients for Your Software Development Agency",
      limits: [limitsEn.contacts, "Yolias can’t confirm technical details such as which tools or apps a company already uses. Treat them as points to check before you pitch.", limitsEn.coverage],
      faq: [
        { q: "Can Yolias check whether a company already has a mobile app?", a: "You can include it in your request, and Yolias uses what it finds publicly about each company and explains its reasoning. It can’t confirm every technical detail, so check it before you pitch." },
        { q: "Can I find companies similar to my best clients?", a: "Yes. A company lookalike search starts from companies you name and looks for similar ones, when a data source that offers it is connected." },
        { q: "Does Yolias write the first message?", a: "Yes. Yolias writes an email from your company profile and the facts it found about the prospect. You review it, and Yolias sends it from your own mailbox once you approve." },
      ],
    },
    ar: {
      ...common.ar,
      seoTitle: "اعثر على عملاء لشركة تطوير البرمجيات",
      limits: [limitsAr.contacts, "لا يستطيع يولياس تأكيد التفاصيل التقنية مثل الأدوات أو التطبيقات التي تستخدمها الشركة. اعتبرها نقاطًا تتحقق منها قبل العرض.", limitsAr.coverage],
      faq: [
        { q: "هل يتحقق يولياس مما إذا كان لدى الشركة تطبيق جوال؟", a: "يمكنك ذكر ذلك في طلبك، ويستخدم يولياس ما يجده علنًا عن كل شركة ويشرح منطقه. لكنه لا يستطيع تأكيد كل تفصيل تقني، فتحقق منه قبل العرض." },
        { q: "هل يمكنني إيجاد شركات تشبه أفضل عملائي؟", a: "نعم. يبدأ بحث الشركات المشابهة من شركات تذكرها ويبحث عن أمثالها، عندما يكون مصدر بيانات يوفر ذلك متصلًا." },
        { q: "هل يكتب يولياس الرسالة الأولى؟", a: "يجهّز يولياس رسالة بريد أو LinkedIn من ملف شركتك والمعلومات التي وجدها عن العميل المحتمل، وتعدّلها وترسلها من حسابك." },
      ],
    },
  },
  consultants: {
    en: {
      ...common.en,
      seoTitle: "Find Consulting Clients that Match Your Expertise",
      limits: [limitsEn.contacts, "For very narrow niches Yolias may return fewer matches. It never pads a list with companies that don’t fit.", limitsEn.outreach],
      faq: [
        { q: "Can I target specific roles such as COO or operations director?", a: "Yes. Name the roles in your request. Yolias looks for decision makers with matching titles at each company it finds; when none is found, the company still appears so you can research it." },
        { q: "Does Yolias work for niche industries?", a: "It works with any industry you can describe. Small niches return fewer companies, and results depend on the public information available about them." },
        { q: "Can a search keep running?", a: "Yes. A campaign can run on a schedule and keep adding new matching companies until it reaches its target or its end date." },
      ],
    },
    ar: {
      ...common.ar,
      seoTitle: "اعثر على عملاء استشارات يناسبون خبرتك",
      limits: [limitsAr.contacts, "في التخصصات الضيقة جدًا قد يجد يولياس عددًا أقل، ولا يملأ القائمة بشركات لا تناسب.", limitsAr.outreach],
      faq: [
        { q: "هل يمكنني استهداف مناصب محددة مثل مدير العمليات؟", a: "نعم. اذكر المناصب في طلبك، ويبحث يولياس عن صنّاع القرار بالمسميات المطابقة في كل شركة يجدها. وإن لم يجد أحدًا تظهر الشركة لتبحث فيها بنفسك." },
        { q: "هل يعمل يولياس مع القطاعات المتخصصة؟", a: "يعمل مع أي قطاع يمكنك وصفه. التخصصات الصغيرة تعيد شركات أقل، والنتائج تعتمد على المعلومات المتاحة عنها." },
        { q: "هل يمكن أن يستمر البحث؟", a: "نعم. يمكن أن تعمل الحملة على جدول زمني وتضيف شركات مطابقة جديدة حتى تصل إلى هدفها أو تاريخ انتهائها." },
      ],
    },
  },
  "recruitment-agencies": {
    en: {
      ...common.en,
      seoTitle: "Find Hiring Companies for Your Recruitment Agency",
      limits: ["Yolias uses hiring as a signal only when a connected source provides job postings. Otherwise it can’t confirm that a company is hiring.", limitsEn.contacts, "There’s no direct ATS or CRM sync yet. Export your prospects to CSV."],
      faq: [
        { q: "How does Yolias know a company is hiring?", a: "When a connected data source provides job postings, Yolias uses them as a hiring signal and shows it on the result. Without such a source it can’t confirm hiring and says so instead of guessing." },
        { q: "Can I reach HR managers or hiring managers?", a: "Yes. Name the roles in your request, for example HR manager or CFO, and Yolias looks for people with those titles at the companies it finds." },
        { q: "Can I move results into my ATS or CRM?", a: "Export your saved prospects to CSV and import them into your system. HubSpot and Google Sheets connections are planned." },
      ],
    },
    ar: {
      ...common.ar,
      seoTitle: "اعثر على شركات توظّف لوكالة التوظيف",
      limits: ["يستخدم يولياس التوظيف كمؤشر فقط عندما يوفر مصدر متصل إعلانات الوظائف، وإلا فلا يستطيع تأكيد أن الشركة توظّف.", limitsAr.contacts, "لا توجد مزامنة مباشرة مع أنظمة التوظيف أو CRM بعد. صدّر العملاء المحتملين إلى CSV."],
      faq: [
        { q: "كيف يعرف يولياس أن الشركة توظّف؟", a: "عندما يوفر مصدر بيانات متصل إعلانات الوظائف، يستخدمها يولياس كمؤشر توظيف ويعرضه مع النتيجة. وبدون هذا المصدر لا يستطيع التأكيد ويوضح ذلك بدل التخمين." },
        { q: "هل يمكنني الوصول إلى مديري الموارد البشرية؟", a: "نعم. اذكر المناصب في طلبك، مثل مدير الموارد البشرية أو المدير المالي، ويبحث يولياس عن أصحاب هذه المسميات في الشركات التي يجدها." },
        { q: "هل يمكن نقل النتائج إلى نظام التوظيف أو CRM؟", a: "صدّر العملاء المحتملين المحفوظين إلى CSV واستوردهم في نظامك. الربط مع HubSpot وGoogle Sheets مخطط له." },
      ],
    },
  },
  freelancers: {
    en: {
      ...common.en,
      seoTitle: "Find Clients as a Freelancer with AI Prospecting",
      limits: [limitsEn.contacts, "Ratings and reviews appear only when the data source provides them.", limitsEn.outreach],
      faq: [
        { q: "Is Yolias worth it for one person?", a: "Yes. Every plan includes every feature and unlimited users, the plans differ only in their monthly limits, and you can start with Pro and upgrade when you need more." },
        { q: "Can I look for small local businesses?", a: "Yes. Describe the type of business and the city, for example restaurants and cafés in Dubai, and Yolias runs a local business search." },
        { q: "Can my first message be in my client’s language?", a: "Yes. Yolias can draft messages in 15 languages, including Arabic and English." },
      ],
    },
    ar: {
      ...common.ar,
      seoTitle: "اعثر على عملاء كمستقل بالذكاء الاصطناعي",
      limits: [limitsAr.contacts, "يظهر التقييم وعدد المراجعات فقط عندما يوفرها مصدر البيانات.", limitsAr.outreach],
      faq: [
        { q: "هل يناسب يولياس شخصًا يعمل وحده؟", a: "نعم. كل خطة تشمل كل الميزات ومستخدمين غير محدودين، والخطط تختلف فقط في حدودها الشهرية، ويمكنك البدء بخطة برو والترقية عندما تحتاج المزيد." },
        { q: "هل يمكنني البحث عن أنشطة محلية صغيرة؟", a: "نعم. صِف نوع النشاط والمدينة، مثل المطاعم والمقاهي في دبي، ويشغّل يولياس بحثًا عن الأنشطة المحلية." },
        { q: "هل يمكن أن تكون رسالتي الأولى بلغة العميل؟", a: "نعم. يجهّز يولياس الرسائل بـ 15 لغة منها العربية والإنجليزية." },
      ],
    },
  },
  "real-estate": {
    en: {
      ...common.en,
      seoTitle: "Commercial Real Estate Prospecting with AI",
      limits: ["Yolias finds companies and organizations, not individual home buyers.", "It can’t see leases or moving plans. It finds companies by size, location and the signals available, and you qualify the opportunity.", limitsEn.contacts],
      faq: [
        { q: "Can Yolias tell me which companies are moving offices?", a: "No. Yolias can’t see leases or moving plans. It finds companies that match the size, location and signals you describe, such as hiring when a source provides it, and you qualify the opportunity." },
        { q: "Does Yolias find home buyers?", a: "No. Yolias finds companies, organizations and local businesses. It isn’t a tool for finding individual residential buyers." },
        { q: "Can I search by city or district?", a: "Yes. Describe the area in your request, for example technology companies in Riyadh, and Yolias uses it as a criterion." },
      ],
    },
    ar: {
      ...common.ar,
      seoTitle: "البحث عن عملاء العقار التجاري: شركات قد تحتاج مساحات",
      limits: ["يجد يولياس الشركات والمؤسسات، لا الأفراد الراغبين في شراء منازل.", "لا يرى عقود الإيجار أو خطط الانتقال. يجد الشركات حسب الحجم والموقع والمؤشرات المتاحة، والتقييم لك.", limitsAr.contacts],
      faq: [
        { q: "هل يخبرني يولياس بالشركات التي ستنقل مكاتبها؟", a: "لا. لا يرى يولياس عقود الإيجار أو خطط الانتقال. يجد الشركات المطابقة للحجم والموقع والمؤشرات التي تصفها، مثل التوظيف عندما يوفره مصدر، والتقييم لك." },
        { q: "هل يجد يولياس مشترين للمنازل؟", a: "لا. يجد يولياس الشركات والمؤسسات والأنشطة المحلية، وليس أداة لإيجاد الأفراد المشترين للعقار السكني." },
        { q: "هل يمكنني البحث حسب المدينة أو الحي؟", a: "نعم. صِف المنطقة في طلبك، مثل شركات التقنية في الرياض، ويستخدمها يولياس كمعيار." },
      ],
    },
  },
  "sales-teams": {
    en: {
      ...common.en,
      seoTitle: "AI Prospecting for B2B Sales Teams",
      limits: [limitsEn.coverage, "There’s no direct CRM sync yet. Export prospects to CSV; HubSpot and Google Sheets connections are planned.", limitsEn.outreach],
      faq: [
        { q: "How is the match score calculated?", a: "From your own criteria: market, industry, company size, signals and role. Each prospect shows which of them matched, instead of an unexplained number." },
        { q: "Can the whole sales team use one account?", a: "Yes. Every plan includes unlimited users, with owner, admin and member roles in each workspace." },
        { q: "Does Yolias connect to our CRM?", a: "Not directly yet. Export saved prospects to CSV and import them into your CRM. HubSpot and Google Sheets connections are planned." },
      ],
    },
    ar: {
      ...common.ar,
      seoTitle: "البحث عن العملاء بالذكاء الاصطناعي لفرق المبيعات B2B",
      limits: [limitsAr.coverage, "لا توجد مزامنة مباشرة مع CRM بعد. صدّر العملاء المحتملين إلى CSV، والربط مع HubSpot وGoogle Sheets مخطط له.", limitsAr.outreach],
      faq: [
        { q: "كيف تُحسب نسبة التطابق؟", a: "من معاييرك أنت: السوق والقطاع وحجم الشركة والمؤشرات والمنصب. يعرض كل عميل محتمل ما تطابق منها بدل رقم بلا تفسير." },
        { q: "هل يستطيع كل فريق المبيعات استخدام حساب واحد؟", a: "نعم. كل الخطط تشمل مستخدمين غير محدودين، مع أدوار المالك والمسؤول والعضو في كل مساحة عمل." },
        { q: "هل يتصل يولياس بنظام CRM لدينا؟", a: "ليس مباشرة بعد. صدّر العملاء المحفوظين إلى CSV واستوردهم في نظامك. الربط مع HubSpot وGoogle Sheets مخطط له." },
      ],
    },
  },
};
