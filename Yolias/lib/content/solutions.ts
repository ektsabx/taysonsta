import type { Localized } from "./types";

// Solutions pages (2026-10-12): how Yolias helps one kind of team with one
// business problem. Written around what Yolias does today: a plain-language
// description of the ideal customer becomes a search; matching
// companies (or local businesses) arrive with a match explanation and the
// public business contact details found on their websites; Yolias drafts
// messages that the user sends from their own accounts; prospects export to
// CSV. Nothing here promises results, verified personal contacts or signals
// Yolias can't always provide.

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
  /** An example request, written the way a user would type it. */
  icp: string;
  stepsTitle: string;
  steps: string[];
  valueTitle: string;
  value: string;
}

export const solutionsPage: Localized<{ eyebrow: string; title: string; lead: string; related: string; cta: { title: string; body: string; primary: string; secondary: string }; note: string; learnMore: string; heroChecks: string[]; pillarsTitle: string }> = {
  en: {
    eyebrow: "SOLUTIONS",
    title: "Customer discovery for the way your business sells.",
    lead: "Yolias turns a description of your ideal customer into a list of matching companies you can review, save and contact from your own accounts. See how it fits your work.",
    related: "Other solutions",
    cta: { title: "Describe your first ideal customer.", body: "Create an account, write who you want to reach and review the campaign Yolias builds from it.", primary: "Try Yolias", secondary: "See pricing" },
    note: "Results depend on your market and on the public information available about each company. Yolias doesn’t guarantee a number of leads, meetings or sales.",
    learnMore: "Learn more",
    heroChecks: ["Every feature on every plan", "Set up in minutes", "Unlimited users"],
    pillarsTitle: "What changes for your team",
  },
  ar: {
    eyebrow: "الحلول",
    title: "اكتشاف العملاء بالطريقة التي يبيع بها عملك.",
    lead: "يحوّل يولياس وصف عميلك المثالي إلى قائمة بالشركات المطابقة يمكنك مراجعتها وحفظها والتواصل معها من حساباتك أنت. تعرّف على كيف يناسب عملك.",
    related: "حلول أخرى",
    cta: { title: "صِف أول عميل مثالي لك.", body: "أنشئ حسابًا، واكتب من تريد الوصول إليه، وراجع الحملة التي يبنيها يولياس من وصفك.", primary: "جرّب يولياس", secondary: "عرض الأسعار" },
    note: "تعتمد النتائج على سوقك وعلى المعلومات العامة المتاحة عن كل شركة. ولا يضمن يولياس عددًا محددًا من العملاء المحتملين أو الاجتماعات أو المبيعات.",
    learnMore: "اعرف المزيد",
    heroChecks: ["كل الميزات في كل خطة", "الإعداد في دقائق", "مستخدمون غير محدودين"],
    pillarsTitle: "ما الذي يتغير لفريقك",
  },
};

export const solutions: Record<SolutionSlug, Localized<Solution>> = {
  "marketing-agencies": {
    en: {
      name: "Marketing Agencies",
      tagline: "Find businesses that need your agency’s services.",
      title: "Find businesses that need your agency’s services.",
      lead: "Describe the clients your agency serves best. Yolias finds companies that match, explains why each one fits and gives you a starting point for a relevant first message.",
      metaDescription: "Yolias helps marketing agencies find businesses that match their ideal client profile, with match explanations and public business contact details.",
      pillars: [
        { title: "Pipeline that doesn’t wait for referrals", body: "Describe the clients you serve best and get matching companies every week, so new business doesn’t depend on who calls you." },
        { title: "Pitch the clients you can win", body: "Each company comes with the reason it matched your industries, markets and size, so proposals go to businesses that fit your retainer." },
        { title: "From list to first message in one place", body: "Save the companies you want, then Yolias writes each first email and sends it from your own mailbox once you approve." },
      ],
      problemTitle: "The problem",
      problem: [
        "Most agencies grow through referrals until referrals slow down. Then the team spends hours searching directories and social media for businesses that might need help, with no clear way to tell a good fit from a waste of time.",
        "Generic lead lists don’t know which industries you understand, which markets you work in or what size of client can afford your retainer.",
      ],
      helpsTitle: "How Yolias helps",
      helps: [
        { title: "Your ideal client in one sentence", body: "Write the industries, markets and company sizes you serve, in Arabic or English. Yolias turns it into criteria and a search." },
        { title: "Companies with a reason", body: "Each company shows why it matched your criteria, so you can decide quickly who is worth a proposal." },
        { title: "Public contact details", body: "Where a company publishes a business email or phone number on its website, Yolias shows it with the result." },
        { title: "A first message to adapt", body: "Yolias writes an email from your company profile and the facts it holds. You review it and Yolias sends it from your own mailbox." },
      ],
      useCasesTitle: "Use cases",
      useCases: [
        "Build a shortlist of companies in an industry where your agency already has case studies.",
        "Open a new city or country with a list of local businesses in the categories you serve.",
        "Keep a campaign running weekly so new matching companies keep arriving.",
      ],
      icpTitle: "Example ideal customer",
      icpIntro: "An agency that runs paid social for clinics might write:",
      icp: "Private dental and dermatology clinics in Riyadh and Jeddah with their own website and 10 to 100 employees, where I can reach the owner or marketing manager.",
      stepsTitle: "How to use Yolias",
      steps: [
        "Complete your Company Knowledge: what your agency offers and who it serves.",
        "Describe your ideal client in Yolias AI and confirm the campaign setup.",
        "Review the matched companies, save the ones you want and remove the rest.",
        "Prepare a message for each company, then send it yourself or export the list to CSV.",
      ],
      valueTitle: "What you can expect",
      value: "Less time searching and a shortlist built around your own criteria, so your team spends its time on the conversations most likely to become clients.",
    },
    ar: {
      name: "وكالات التسويق",
      tagline: "اعثر على الشركات التي تحتاج خدمات وكالتك.",
      title: "اعثر على الشركات التي تحتاج خدمات وكالتك.",
      lead: "صِف العملاء الذين تخدمهم وكالتك بأفضل شكل. يجد يولياس الشركات المطابقة، ويوضح سبب مناسبة كل منها، ويمنحك بداية لرسالة أولى مناسبة.",
      metaDescription: "يساعد يولياس وكالات التسويق على إيجاد الشركات المطابقة لملف عميلها المثالي، مع توضيح سبب التطابق وبيانات التواصل العامة للشركات.",
      pillars: [
        { title: "عملاء جدد دون انتظار الترشيحات", body: "صِف العملاء الذين تخدمهم بأفضل شكل واحصل على شركات مطابقة كل أسبوع، فلا يعتمد نمو وكالتك على من يتصل بك." },
        { title: "اعرض خدماتك على من يمكنك كسبه", body: "تأتي كل شركة مع سبب مطابقتها لقطاعاتك وأسواقك وحجم عملائك، فتذهب عروضك إلى شركات تناسب رسومك." },
        { title: "من القائمة إلى أول رسالة في مكان واحد", body: "احفظ الشركات التي تريدها، ويكتب يولياس أول بريد لكل منها ويرسله من بريدك بعد موافقتك." },
      ],
      problemTitle: "المشكلة",
      problem: [
        "تنمو معظم الوكالات بالترشيحات حتى تتباطأ الترشيحات. عندها يقضي الفريق ساعات في البحث في الأدلة ووسائل التواصل عن شركات قد تحتاج المساعدة، دون طريقة واضحة لتمييز العميل المناسب من غيره.",
        "قوائم العملاء العامة لا تعرف القطاعات التي تفهمها، ولا الأسواق التي تعمل فيها، ولا حجم العميل القادر على تحمّل رسوم خدماتك.",
      ],
      helpsTitle: "كيف يساعدك يولياس",
      helps: [
        { title: "عميلك المثالي في جملة واحدة", body: "اكتب القطاعات والأسواق وأحجام الشركات التي تخدمها، بالعربية أو الإنجليزية، ويحوّلها يولياس إلى معايير وبحث." },
        { title: "شركات مع سبب واضح", body: "توضح كل شركة سبب مطابقتها لمعاييرك، لتقرر بسرعة من يستحق عرضًا." },
        { title: "بيانات تواصل عامة", body: "عندما تنشر الشركة بريدًا أو هاتفًا للعمل على موقعها، يعرضه يولياس مع النتيجة." },
        { title: "رسالة أولى قابلة للتعديل", body: "يكتب يولياس مسودة رسالة بريد أو LinkedIn من ملف شركتك والمعلومات المتاحة لديه، وتعدّلها وترسلها من حسابك أنت." },
      ],
      useCasesTitle: "حالات الاستخدام",
      useCases: [
        "بناء قائمة مختصرة من الشركات في قطاع لدى وكالتك فيه دراسات حالة.",
        "دخول مدينة أو دولة جديدة بقائمة من الأنشطة المحلية في الفئات التي تخدمها.",
        "إبقاء حملة تعمل أسبوعيًا لتصلك شركات مطابقة جديدة باستمرار.",
      ],
      icpTitle: "مثال على العميل المثالي",
      icpIntro: "وكالة تدير الإعلانات المدفوعة للعيادات قد تكتب:",
      icp: "عيادات أسنان وجلدية خاصة في الرياض وجدة لديها موقع إلكتروني ومن 10 إلى 100 موظف، وأريد الوصول إلى المالك أو مدير التسويق.",
      stepsTitle: "كيف تستخدم يولياس",
      steps: [
        "أكمل معرفة الشركة: ما تقدمه وكالتك ومن تخدم.",
        "صِف عميلك المثالي في Yolias AI وأكّد إعداد الحملة.",
        "راجع الشركات المطابقة، واحفظ ما تريد واستبعد الباقي.",
        "جهّز رسالة لكل شركة ثم أرسلها بنفسك، أو صدّر القائمة إلى ملف CSV.",
      ],
      valueTitle: "ما الذي تتوقعه",
      value: "وقت أقل في البحث، وقائمة مختصرة مبنية على معاييرك، ليقضي فريقك وقته في المحادثات الأقرب إلى أن تصبح عملاء.",
    },
  },
  "software-agencies": {
    en: {
      name: "Software Agencies",
      tagline: "Discover companies that could benefit from your software services.",
      title: "Discover companies that could benefit from your software services.",
      lead: "Tell Yolias which companies need what you build: apps, platforms, integrations or ongoing development. It finds matching companies and explains each match.",
      metaDescription: "Yolias helps software and development agencies discover companies that match the projects they deliver, with match explanations and public business contact details.",
      pillars: [
        { title: "Find companies that need what you build", body: "Write the kind of company that needs apps, platforms or integrations, and Yolias finds matching companies in the markets you sell to." },
        { title: "Spend sales time on real fits", body: "Every result explains why it matched, so your team reviews a short list instead of researching companies one by one." },
        { title: "A steady flow, not a one-off list", body: "Keep a campaign running daily or weekly and new matching companies keep arriving in Prospects, ready to review." },
      ],
      problemTitle: "The problem",
      problem: [
        "Software projects are large and the right client is specific: the right industry, a team that can’t build it alone, a budget that fits. Finding those companies by hand is slow.",
        "Broad lead databases return thousands of names with no sign of which ones need your kind of work.",
      ],
      helpsTitle: "How Yolias helps",
      helps: [
        { title: "Criteria from your own words", body: "Describe the industries, company sizes and markets you serve and the services you offer. Yolias builds the search from it." },
        { title: "Explained matches", body: "Every company shows which criteria it meets, so you can prioritise the best fits before writing a proposal." },
        { title: "Website research", body: "Yolias reads each company’s own website to understand what it does and to find public business contact details." },
        { title: "Messages you control", body: "Yolias writes a first email based on your offer; you review it and it goes out from your own mailbox." },
      ],
      useCasesTitle: "Use cases",
      useCases: [
        "Find companies in an industry where you have already shipped a successful product.",
        "Build a list of mid-size businesses in a new market before a business trip.",
        "Run a continuous campaign for a specialised service, such as e-commerce or ERP integrations.",
      ],
      icpTitle: "Example ideal customer",
      icpIntro: "A studio that builds mobile apps for retailers might write:",
      icp: "Retail and e-commerce companies in the UAE and Saudi Arabia with 50 to 500 employees that sell online but don’t have their own mobile app, and I want to reach the CTO or head of digital.",
      stepsTitle: "How to use Yolias",
      steps: [
        "Add your services and the clients you serve to your Company Knowledge.",
        "Describe the companies that need your work and set the campaign goal.",
        "Review the companies and their match explanations; save the strongest fits.",
        "Prepare messages from the results or export the list to your CRM through CSV.",
      ],
      valueTitle: "What you can expect",
      value: "A focused list of companies that fit your services, built in minutes instead of days of manual research.",
    },
    ar: {
      name: "شركات البرمجيات",
      tagline: "اكتشف الشركات التي يمكن أن تستفيد من خدماتك البرمجية.",
      title: "اكتشف الشركات التي يمكن أن تستفيد من خدماتك البرمجية.",
      lead: "أخبر يولياس بالشركات التي تحتاج ما تبنيه: تطبيقات أو منصات أو تكاملات أو تطوير مستمر. يجد الشركات المطابقة ويوضح سبب كل تطابق.",
      metaDescription: "يساعد يولياس شركات تطوير البرمجيات على اكتشاف الشركات المطابقة للمشاريع التي تنفذها، مع توضيح سبب التطابق وبيانات التواصل العامة للشركات.",
      pillars: [
        { title: "اعثر على الشركات التي تحتاج ما تبنيه", body: "اكتب نوع الشركة التي تحتاج تطبيقات أو منصات أو تكاملات، ويجد يولياس شركات مطابقة في الأسواق التي تبيع فيها." },
        { title: "وقت المبيعات للشركات المناسبة فعلًا", body: "توضح كل نتيجة سبب مطابقتها، فيراجع فريقك قائمة مختصرة بدل البحث عن كل شركة على حدة." },
        { title: "تدفق مستمر لا قائمة لمرة واحدة", body: "اترك حملة تعمل يوميًا أو أسبوعيًا، وتصل شركات مطابقة جديدة إلى العملاء المحتملين جاهزة للمراجعة." },
      ],
      problemTitle: "المشكلة",
      problem: [
        "مشاريع البرمجيات كبيرة والعميل المناسب محدد: القطاع المناسب، وفريق لا يستطيع بناءها وحده، وميزانية مناسبة. وإيجاد هذه الشركات يدويًا بطيء.",
        "قواعد بيانات العملاء الواسعة تعيد آلاف الأسماء دون أي إشارة إلى من يحتاج نوع عملك.",
      ],
      helpsTitle: "كيف يساعدك يولياس",
      helps: [
        { title: "معايير من كلماتك أنت", body: "صِف القطاعات وأحجام الشركات والأسواق التي تخدمها والخدمات التي تقدمها، ويبني يولياس البحث منها." },
        { title: "تطابق موضّح", body: "توضح كل شركة المعايير التي تحققها، لتعطي الأولوية للأنسب قبل كتابة العرض." },
        { title: "بحث في المواقع", body: "يقرأ يولياس موقع كل شركة لفهم نشاطها وإيجاد بيانات التواصل العامة للعمل." },
        { title: "رسائل تتحكم بها", body: "اكتب مسودة أول رسالة بريد أو LinkedIn بناءً على عرضك، وراجعها وأرسلها من حسابك." },
      ],
      useCasesTitle: "حالات الاستخدام",
      useCases: [
        "إيجاد شركات في قطاع سبق أن أطلقت فيه منتجًا ناجحًا.",
        "بناء قائمة بالشركات المتوسطة في سوق جديد قبل رحلة عمل.",
        "تشغيل حملة مستمرة لخدمة متخصصة، مثل تكاملات التجارة الإلكترونية أو أنظمة ERP.",
      ],
      icpTitle: "مثال على العميل المثالي",
      icpIntro: "استوديو يبني تطبيقات الجوال لتجار التجزئة قد يكتب:",
      icp: "شركات تجزئة وتجارة إلكترونية في الإمارات والسعودية من 50 إلى 500 موظف تبيع عبر الإنترنت وليس لديها تطبيق جوال خاص بها، وأريد الوصول إلى المدير التقني أو رئيس القسم الرقمي.",
      stepsTitle: "كيف تستخدم يولياس",
      steps: [
        "أضف خدماتك والعملاء الذين تخدمهم إلى معرفة الشركة.",
        "صِف الشركات التي تحتاج عملك وحدد هدف الحملة.",
        "راجع الشركات وأسباب تطابقها، واحفظ الأنسب منها.",
        "جهّز الرسائل من النتائج أو صدّر القائمة إلى نظام CRM عبر ملف CSV.",
      ],
      valueTitle: "ما الذي تتوقعه",
      value: "قائمة مركّزة بالشركات المناسبة لخدماتك، تُبنى في دقائق بدل أيام من البحث اليدوي.",
    },
  },
  consultants: {
    en: {
      name: "Consultants",
      tagline: "Find organizations that match your expertise.",
      title: "Find organizations that match your expertise.",
      lead: "Your expertise fits some organizations far better than others. Describe them once and Yolias finds the ones that match, with the reasons.",
      metaDescription: "Yolias helps independent consultants and consulting firms find organizations that match their expertise, with match explanations and public contact details.",
      pillars: [
        { title: "Your expertise, matched to the right organizations", body: "Describe the organizations your experience fits best and Yolias finds the ones that match, with the reasons." },
        { title: "Less research, more conversations", body: "Skip the hours of searching. Review a list built around your own criteria and keep the organizations worth a call." },
        { title: "Outreach that sounds like you", body: "Yolias drafts a first message from your profile and what it knows about the organization. You edit it and send it yourself." },
      ],
      problemTitle: "The problem",
      problem: [
        "Consultants sell expertise, so the best prospects are organizations facing the exact problem you solve. Finding them usually means personal networks and slow manual research.",
        "Time spent prospecting is time not billed, so it has to be focused.",
      ],
      helpsTitle: "How Yolias helps",
      helps: [
        { title: "Describe the organizations you help", body: "Industry, size, market and the situation you solve, written in plain language." },
        { title: "A shortlist, not a database", body: "Yolias returns matching organizations with an explanation of each match, so you review a short list instead of filtering a large one." },
        { title: "Know before you reach out", body: "Each result links to the company’s website and the public business contact details Yolias found there." },
        { title: "Your voice, your account", body: "Draft a short introduction based on your expertise. Nothing goes out until you approve it, and it goes from your own account." },
      ],
      useCasesTitle: "Use cases",
      useCases: [
        "Find family businesses in a sector where you advise on governance or growth.",
        "Prepare a list of organizations to approach about a new service you launch.",
        "Research the companies in a market before speaking at an event there.",
      ],
      icpTitle: "Example ideal customer",
      icpIntro: "An operations consultant might write:",
      icp: "Logistics and distribution companies in Egypt with 100 to 1,000 employees that operate their own warehouses, and I want to reach the COO or operations director.",
      stepsTitle: "How to use Yolias",
      steps: [
        "Describe your expertise and the clients you serve in your Company Knowledge.",
        "Write the kind of organization you want to work with and start a campaign.",
        "Read the match explanations and keep the organizations worth approaching.",
        "Yolias writes a personal introduction for each and sends it from your own mailbox once you approve.",
      ],
      valueTitle: "What you can expect",
      value: "Prospecting time spent on organizations that fit your expertise, and more of your week left for client work.",
    },
    ar: {
      name: "المستشارون",
      tagline: "اعثر على المؤسسات التي تناسب خبرتك.",
      title: "اعثر على المؤسسات التي تناسب خبرتك.",
      lead: "خبرتك تناسب بعض المؤسسات أكثر بكثير من غيرها. صِفها مرة واحدة، ويجد يولياس المؤسسات المطابقة مع الأسباب.",
      metaDescription: "يساعد يولياس المستشارين وشركات الاستشارات على إيجاد المؤسسات المطابقة لخبرتهم، مع توضيح سبب التطابق وبيانات التواصل العامة.",
      pillars: [
        { title: "خبرتك مع المؤسسات المناسبة لها", body: "صِف المؤسسات التي تناسبها خبرتك أكثر، ويجد يولياس المؤسسات المطابقة مع أسباب المطابقة." },
        { title: "بحث أقل ومحادثات أكثر", body: "وفّر ساعات البحث. راجع قائمة مبنية على معاييرك واحتفظ بالمؤسسات التي تستحق اتصالًا." },
        { title: "رسائل تشبه أسلوبك", body: "يكتب يولياس مسودة أول رسالة من ملفك ومن المعلومات المتاحة عن المؤسسة، وتراجعها ثم يرسلها من بريدك بعد موافقتك." },
      ],
      problemTitle: "المشكلة",
      problem: [
        "يبيع المستشارون خبرتهم، لذلك أفضل العملاء المحتملين هم المؤسسات التي تواجه المشكلة التي تحلها تحديدًا. وإيجادهم يعني عادةً العلاقات الشخصية والبحث اليدوي البطيء.",
        "الوقت الذي تقضيه في البحث عن العملاء وقت غير مدفوع، لذلك يجب أن يكون مركّزًا.",
      ],
      helpsTitle: "كيف يساعدك يولياس",
      helps: [
        { title: "صِف المؤسسات التي تساعدها", body: "القطاع والحجم والسوق والمشكلة التي تحلها، بلغة طبيعية." },
        { title: "قائمة مختصرة لا قاعدة بيانات", body: "يعيد يولياس المؤسسات المطابقة مع توضيح كل تطابق، لتراجع قائمة قصيرة بدل تصفية قائمة كبيرة." },
        { title: "اعرف قبل أن تتواصل", body: "ترتبط كل نتيجة بموقع الشركة وبيانات التواصل العامة للعمل التي وجدها يولياس فيه." },
        { title: "أسلوبك وحسابك", body: "اكتب مسودة تعريف قصيرة بناءً على خبرتك. لا يُرسل شيء قبل موافقتك، ويُرسل من حسابك أنت." },
      ],
      useCasesTitle: "حالات الاستخدام",
      useCases: [
        "إيجاد الشركات العائلية في قطاع تقدّم فيه استشارات الحوكمة أو النمو.",
        "إعداد قائمة بالمؤسسات التي ستعرض عليها خدمة جديدة تطلقها.",
        "التعرف على شركات سوق ما قبل التحدث في فعالية هناك.",
      ],
      icpTitle: "مثال على العميل المثالي",
      icpIntro: "مستشار عمليات قد يكتب:",
      icp: "شركات لوجستيات وتوزيع في مصر من 100 إلى 1,000 موظف تدير مستودعاتها بنفسها، وأريد الوصول إلى مدير العمليات أو الرئيس التنفيذي للعمليات.",
      stepsTitle: "كيف تستخدم يولياس",
      steps: [
        "صِف خبرتك والعملاء الذين تخدمهم في معرفة الشركة.",
        "اكتب نوع المؤسسة التي تريد العمل معها وابدأ حملة.",
        "اقرأ أسباب التطابق واحتفظ بالمؤسسات التي تستحق التواصل.",
        "جهّز تعريفًا شخصيًا لكل منها، ثم أرسله من بريدك أو حسابك على LinkedIn.",
      ],
      valueTitle: "ما الذي تتوقعه",
      value: "وقت بحث يذهب إلى المؤسسات المناسبة لخبرتك، ووقت أكبر من أسبوعك لعمل العملاء.",
    },
  },
  "recruitment-agencies": {
    en: {
      name: "Recruitment Agencies",
      tagline: "Identify companies with relevant hiring needs.",
      title: "Identify companies with relevant hiring needs.",
      lead: "Describe the companies that hire the roles you place. Yolias finds companies that match your criteria, so your business development starts from a relevant list.",
      metaDescription: "Yolias helps recruitment agencies identify companies that match the roles and markets they recruit for, with match explanations and public business contact details.",
      pillars: [
        { title: "Business development from a relevant list", body: "Describe the companies that hire the roles you place and start each week with matching companies instead of a blank search." },
        { title: "Know why each company is on the list", body: "Every company shows how it matches your industries, markets and size, so your outreach starts from a reason." },
        { title: "Your whole desk on one workspace", body: "Unlimited users share the same Prospects, campaigns and saved lists, so consultants don’t chase the same company twice." },
      ],
      problemTitle: "The problem",
      problem: [
        "Agencies win new clients by reaching companies at the moment they need to hire, in the sectors and roles the agency knows. Spotting those companies across job boards and websites takes hours every week.",
        "Without a clear target list, business development turns into cold calls to companies that don’t hire the roles you place.",
      ],
      helpsTitle: "How Yolias helps",
      helps: [
        { title: "Target the sectors and roles you know", body: "Describe the industries, company sizes and markets that hire the roles you place." },
        { title: "Matched companies", body: "Yolias finds companies that meet your criteria and explains each match. Where hiring information is available from its sources, it appears with the result." },
        { title: "Public contact details", body: "Business emails and phone numbers that companies publish on their own websites are shown with each company." },
        { title: "A tailored first message", body: "Yolias writes an introduction about the roles you fill and sends it from your own mailbox once you approve." },
      ],
      useCasesTitle: "Use cases",
      useCases: [
        "Build a list of growing tech companies in a city where you place engineers.",
        "Find healthcare providers in a region before launching a medical recruitment desk.",
        "Keep a weekly campaign running so new matching companies arrive without new searches.",
      ],
      icpTitle: "Example ideal customer",
      icpIntro: "An agency that places finance professionals might write:",
      icp: "Fintech and payments companies in Saudi Arabia and the UAE with 50 to 300 employees that are growing their finance and compliance teams, and I want to reach the HR manager or CFO.",
      stepsTitle: "How to use Yolias",
      steps: [
        "Describe the roles you place and your markets in your Company Knowledge.",
        "Write the companies you want to work with and set the campaign goal and schedule.",
        "Review matched companies and save the ones to approach this week.",
        "Prepare introductions and send them yourself, or export the list to your CRM.",
      ],
      valueTitle: "What you can expect",
      value: "A business development list built around the roles and markets you know, so consultants spend more time on calls and less on research.",
    },
    ar: {
      name: "وكالات التوظيف",
      tagline: "حدّد الشركات التي لديها احتياجات توظيف مناسبة.",
      title: "حدّد الشركات التي لديها احتياجات توظيف مناسبة.",
      lead: "صِف الشركات التي توظّف في الوظائف التي تعمل عليها. يجد يولياس الشركات المطابقة لمعاييرك، ليبدأ تطوير أعمالك من قائمة مناسبة.",
      metaDescription: "يساعد يولياس وكالات التوظيف على تحديد الشركات المطابقة للوظائف والأسواق التي توظّف لها، مع توضيح سبب التطابق وبيانات التواصل العامة للشركات.",
      pillars: [
        { title: "تطوير أعمال يبدأ من قائمة مناسبة", body: "صِف الشركات التي توظّف الأدوار التي تشغلها، وابدأ كل أسبوع بشركات مطابقة بدل بحث من الصفر." },
        { title: "اعرف لماذا كل شركة في القائمة", body: "توضح كل شركة كيف تطابق قطاعاتك وأسواقك وحجمها، فيبدأ تواصلك من سبب واضح." },
        { title: "فريقك كله في مساحة عمل واحدة", body: "مستخدمون غير محدودين يتشاركون العملاء المحتملين والحملات والمحفوظات، فلا يتواصل اثنان مع الشركة نفسها." },
      ],
      problemTitle: "المشكلة",
      problem: [
        "تكسب الوكالات عملاء جددًا بالوصول إلى الشركات في الوقت الذي تحتاج فيه إلى التوظيف، في القطاعات والوظائف التي تعرفها الوكالة. ورصد هذه الشركات بين مواقع الوظائف والمواقع الإلكترونية يستغرق ساعات كل أسبوع.",
        "دون قائمة مستهدفة واضحة، يتحول تطوير الأعمال إلى اتصالات عشوائية بشركات لا توظّف في الوظائف التي تعمل عليها.",
      ],
      helpsTitle: "كيف يساعدك يولياس",
      helps: [
        { title: "استهدف القطاعات والوظائف التي تعرفها", body: "صِف القطاعات وأحجام الشركات والأسواق التي توظّف في الوظائف التي تعمل عليها." },
        { title: "شركات مطابقة", body: "يجد يولياس الشركات التي تحقق معاييرك ويوضح كل تطابق، وعندما تتوفر معلومات التوظيف من مصادره تظهر مع النتيجة." },
        { title: "بيانات تواصل عامة", body: "يُعرض البريد والهاتف اللذان تنشرهما الشركات على مواقعها مع كل شركة." },
        { title: "رسالة أولى مخصصة", body: "اكتب مسودة تعريف بالوظائف التي توفّر لها المرشحين وأرسلها من بريدك أو حسابك على LinkedIn." },
      ],
      useCasesTitle: "حالات الاستخدام",
      useCases: [
        "بناء قائمة بشركات التقنية النامية في مدينة توظّف فيها مهندسين.",
        "إيجاد مقدمي الرعاية الصحية في منطقة قبل إطلاق قسم للتوظيف الطبي.",
        "إبقاء حملة أسبوعية تعمل لتصلك شركات مطابقة جديدة دون عمليات بحث جديدة.",
      ],
      icpTitle: "مثال على العميل المثالي",
      icpIntro: "وكالة توظّف في المجالات المالية قد تكتب:",
      icp: "شركات التقنية المالية والمدفوعات في السعودية والإمارات من 50 إلى 300 موظف توسّع فرق المالية والامتثال، وأريد الوصول إلى مدير الموارد البشرية أو المدير المالي.",
      stepsTitle: "كيف تستخدم يولياس",
      steps: [
        "صِف الوظائف التي تعمل عليها وأسواقك في معرفة الشركة.",
        "اكتب الشركات التي تريد العمل معها وحدد هدف الحملة وجدولها.",
        "راجع الشركات المطابقة واحفظ ما ستتواصل معه هذا الأسبوع.",
        "جهّز رسائل التعريف وأرسلها بنفسك، أو صدّر القائمة إلى نظام CRM.",
      ],
      valueTitle: "ما الذي تتوقعه",
      value: "قائمة لتطوير الأعمال مبنية على الوظائف والأسواق التي تعرفها، ليقضي فريقك وقتًا أكثر في الاتصالات ووقتًا أقل في البحث.",
    },
  },
  freelancers: {
    en: {
      name: "Freelancers",
      tagline: "Discover businesses that fit the services you offer.",
      title: "Discover businesses that fit the services you offer.",
      lead: "You don’t have a sales team, so every hour of prospecting counts. Describe the businesses you work best with and Yolias finds ones that match.",
      metaDescription: "Yolias helps freelancers discover businesses that fit the services they offer, with match explanations and public business contact details.",
      pillars: [
        { title: "Prospecting that fits into a busy week", body: "Describe the businesses you work best with once. Yolias finds matching ones while you work on client projects." },
        { title: "Clients who fit your services", body: "Each business comes with the reason it matched, so you only reach out where your work is relevant." },
        { title: "A first message without the blank page", body: "Yolias drafts the first email or message from your profile. You adjust it and send it from your own account." },
      ],
      problemTitle: "The problem",
      problem: [
        "Freelancers juggle client work and finding the next client. Marketplaces are crowded and price-driven, and searching for direct clients by hand takes time you don’t have.",
      ],
      helpsTitle: "How Yolias helps",
      helps: [
        { title: "Start from what you offer", body: "Describe your service and the businesses that need it, in your own words." },
        { title: "A short list of fits", body: "Yolias finds matching businesses, including local businesses in a city, and shows why each one matched." },
        { title: "Ways to reach them", body: "See the public business email or phone a company lists on its website." },
        { title: "Write less from scratch", body: "Draft a short, specific message and send it from your own account." },
      ],
      useCasesTitle: "Use cases",
      useCases: [
        "Find local businesses in your city whose website could use a redesign.",
        "Build a list of small companies in a niche where you have portfolio work.",
        "Keep a small weekly campaign running so you always have businesses to contact.",
      ],
      icpTitle: "Example ideal customer",
      icpIntro: "A freelance web designer might write:",
      icp: "Restaurants, cafés and bakeries in Dubai with a website and good customer reviews, and I want to reach the owner.",
      stepsTitle: "How to use Yolias",
      steps: [
        "Add your service and your ideal clients to your Company Knowledge.",
        "Describe the businesses you want to work with and start a campaign.",
        "Review the businesses and keep the best fits.",
        "Prepare a message for each one and send it yourself.",
      ],
      valueTitle: "What you can expect",
      value: "A steady list of relevant businesses to contact without spending your evenings searching.",
    },
    ar: {
      name: "المستقلون",
      tagline: "اكتشف الأنشطة التجارية المناسبة للخدمات التي تقدمها.",
      title: "اكتشف الأنشطة التجارية المناسبة للخدمات التي تقدمها.",
      lead: "ليس لديك فريق مبيعات، لذلك كل ساعة تقضيها في البحث عن العملاء مهمة. صِف الأنشطة التي تعمل معها بأفضل شكل، ويجد يولياس الأنشطة المطابقة.",
      metaDescription: "يساعد يولياس المستقلين على اكتشاف الأنشطة التجارية المناسبة لخدماتهم، مع توضيح سبب التطابق وبيانات التواصل العامة.",
      pillars: [
        { title: "بحث عن عملاء يناسب أسبوعك المزدحم", body: "صِف الأنشطة التي تعمل معها بأفضل شكل مرة واحدة، ويجد يولياس المطابق منها أثناء عملك على مشاريعك." },
        { title: "عملاء يناسبون خدماتك", body: "يأتي كل نشاط مع سبب مطابقته، فتتواصل فقط حيث يكون عملك مناسبًا." },
        { title: "أول رسالة بدون صفحة فارغة", body: "يكتب يولياس مسودة أول بريد أو رسالة من ملفك، وتعدّلها وترسلها من حسابك." },
      ],
      problemTitle: "المشكلة",
      problem: [
        "يوازن المستقلون بين عمل العملاء والبحث عن العميل التالي. منصات العمل الحر مزدحمة وتعتمد على السعر، والبحث اليدوي عن عملاء مباشرين يستهلك وقتًا لا تملكه.",
      ],
      helpsTitle: "كيف يساعدك يولياس",
      helps: [
        { title: "ابدأ مما تقدمه", body: "صِف خدمتك والأنشطة التي تحتاجها بكلماتك أنت." },
        { title: "قائمة قصيرة بالمناسبين", body: "يجد يولياس الأنشطة المطابقة، ومنها الأنشطة المحلية في مدينة ما، ويوضح سبب مطابقة كل منها." },
        { title: "طرق للوصول إليهم", body: "اطّلع على البريد أو الهاتف العام الذي تنشره الشركة على موقعها." },
        { title: "اكتب أقل من الصفر", body: "اكتب مسودة رسالة قصيرة ومحددة وأرسلها من حسابك." },
      ],
      useCasesTitle: "حالات الاستخدام",
      useCases: [
        "إيجاد أنشطة محلية في مدينتك تحتاج مواقعها إلى إعادة تصميم.",
        "بناء قائمة بالشركات الصغيرة في مجال لديك فيه أعمال سابقة.",
        "إبقاء حملة أسبوعية صغيرة تعمل ليكون لديك دائمًا من تتواصل معه.",
      ],
      icpTitle: "مثال على العميل المثالي",
      icpIntro: "مصمم مواقع مستقل قد يكتب:",
      icp: "مطاعم ومقاهٍ ومخابز في دبي لديها موقع إلكتروني وتقييمات جيدة من العملاء، وأريد الوصول إلى المالك.",
      stepsTitle: "كيف تستخدم يولياس",
      steps: [
        "أضف خدمتك وعملاءك المثاليين إلى معرفة الشركة.",
        "صِف الأنشطة التي تريد العمل معها وابدأ حملة.",
        "راجع الأنشطة واحتفظ بالأنسب منها.",
        "جهّز رسالة لكل منها وأرسلها بنفسك.",
      ],
      valueTitle: "ما الذي تتوقعه",
      value: "قائمة ثابتة بأنشطة مناسبة للتواصل معها، دون قضاء أمسياتك في البحث.",
    },
  },
  "real-estate": {
    en: {
      name: "Real Estate Sales",
      tagline: "Research organizations and opportunities in your target market.",
      title: "Research organizations and business opportunities relevant to your target market.",
      lead: "Commercial and corporate real estate sales start with knowing which organizations are in your market. Describe them and Yolias finds companies and local businesses that match.",
      metaDescription: "Yolias helps real estate sales professionals research organizations and local businesses in their target market, with match explanations and public business contact details.",
      pillars: [
        { title: "Know who is in your market", body: "Describe the organizations and local businesses you sell to and get a list of the ones in your target areas." },
        { title: "Prioritize with reasons, not guesses", body: "Each result shows why it matched your criteria, so your team starts with the most relevant organizations." },
        { title: "Keep your territory current", body: "Run a campaign weekly so new matching companies and businesses in your areas keep arriving." },
      ],
      problemTitle: "The problem",
      problem: [
        "Selling or leasing offices, retail space or units to companies means knowing which organizations operate in an area, how large they are and who to contact. That research is usually manual and scattered.",
      ],
      helpsTitle: "How Yolias helps",
      helps: [
        { title: "Describe the organizations in your market", body: "Industry, size and location of the companies or local businesses you want to reach." },
        { title: "Companies and local businesses", body: "Yolias can search for companies or for local businesses in a city, with their address, website and category where available." },
        { title: "Public contact details", body: "Business emails and phone numbers published on company websites appear with each result." },
        { title: "Messages you send", body: "Draft a short introduction about a property or service and send it from your own account." },
      ],
      useCasesTitle: "Use cases",
      useCases: [
        "Research companies of a certain size in a business district before marketing new office space.",
        "List clinics, gyms or restaurants in an area for a retail or mixed-use project.",
        "Prepare a list of organizations to contact about corporate housing for their staff.",
      ],
      icpTitle: "Example ideal customer",
      icpIntro: "A commercial leasing agent might write:",
      icp: "Technology and professional services companies in Riyadh with 30 to 300 employees that could need new office space, and I want to reach the CEO or operations manager.",
      stepsTitle: "How to use Yolias",
      steps: [
        "Describe the properties or services you offer in your Company Knowledge.",
        "Write the organizations you want to reach, with the city or district.",
        "Review the companies or local businesses that match and save the relevant ones.",
        "Let Yolias write introductions and send them from your own mailbox, or export to CSV.",
      ],
      valueTitle: "What you can expect",
      value: "Faster market research and a clear list of organizations to approach for each project.",
    },
    ar: {
      name: "مبيعات العقارات",
      tagline: "ابحث عن المؤسسات والفرص في سوقك المستهدف.",
      title: "ابحث عن المؤسسات والفرص التجارية المرتبطة بسوقك المستهدف.",
      lead: "تبدأ مبيعات العقارات التجارية والمؤسسية بمعرفة المؤسسات الموجودة في سوقك. صِفها ويجد يولياس الشركات والأنشطة المحلية المطابقة.",
      metaDescription: "يساعد يولياس العاملين في مبيعات العقارات على البحث عن المؤسسات والأنشطة المحلية في سوقهم المستهدف، مع توضيح سبب التطابق وبيانات التواصل العامة.",
      pillars: [
        { title: "اعرف من في سوقك", body: "صِف المؤسسات والأنشطة المحلية التي تبيع لها، واحصل على قائمة بالموجودين منها في مناطقك المستهدفة." },
        { title: "أولويات بأسباب لا بتخمين", body: "توضح كل نتيجة سبب مطابقتها لمعاييرك، فيبدأ فريقك بالمؤسسات الأكثر صلة." },
        { title: "حافظ على منطقتك محدّثة", body: "شغّل حملة أسبوعيًا لتصلك شركات وأنشطة مطابقة جديدة في مناطقك باستمرار." },
      ],
      problemTitle: "المشكلة",
      problem: [
        "بيع أو تأجير المكاتب أو المحلات أو الوحدات للشركات يتطلب معرفة المؤسسات التي تعمل في منطقة ما، وحجمها، ومن يجب التواصل معه. وهذا البحث يدوي ومتفرق عادةً.",
      ],
      helpsTitle: "كيف يساعدك يولياس",
      helps: [
        { title: "صِف مؤسسات سوقك", body: "القطاع والحجم والموقع للشركات أو الأنشطة المحلية التي تريد الوصول إليها." },
        { title: "شركات وأنشطة محلية", body: "يمكن ليولياس البحث عن الشركات أو عن الأنشطة المحلية في مدينة ما، مع العنوان والموقع والفئة عند توفرها." },
        { title: "بيانات تواصل عامة", body: "يظهر البريد والهاتف المنشوران على مواقع الشركات مع كل نتيجة." },
        { title: "رسائل من بريدك", body: "يكتب يولياس تعريفًا قصيرًا بعقار أو خدمة ويرسله من بريدك بعد موافقتك." },
      ],
      useCasesTitle: "حالات الاستخدام",
      useCases: [
        "البحث عن شركات بحجم معين في منطقة أعمال قبل تسويق مساحات مكتبية جديدة.",
        "حصر العيادات أو الصالات الرياضية أو المطاعم في منطقة لمشروع تجاري أو متعدد الاستخدامات.",
        "إعداد قائمة بالمؤسسات التي ستتواصل معها بشأن سكن الموظفين.",
      ],
      icpTitle: "مثال على العميل المثالي",
      icpIntro: "وسيط تأجير تجاري قد يكتب:",
      icp: "شركات التقنية والخدمات المهنية في الرياض من 30 إلى 300 موظف قد تحتاج مساحات مكتبية جديدة، وأريد الوصول إلى الرئيس التنفيذي أو مدير العمليات.",
      stepsTitle: "كيف تستخدم يولياس",
      steps: [
        "صِف العقارات أو الخدمات التي تقدمها في معرفة الشركة.",
        "اكتب المؤسسات التي تريد الوصول إليها مع المدينة أو الحي.",
        "راجع الشركات أو الأنشطة المحلية المطابقة واحفظ المناسب منها.",
        "جهّز رسائل التعريف وأرسلها من بريدك أو حسابك على LinkedIn، أو صدّرها إلى ملف CSV.",
      ],
      valueTitle: "ما الذي تتوقعه",
      value: "بحث أسرع في السوق، وقائمة واضحة بالمؤسسات التي ستتواصل معها لكل مشروع.",
    },
  },
  "sales-teams": {
    en: {
      name: "Businesses and Sales Teams",
      tagline: "Research target markets and identify relevant opportunities.",
      title: "Research target markets and identify relevant business opportunities.",
      lead: "Give your team one place to describe target accounts and get a reviewed list of matching companies, shared across your workspace.",
      metaDescription: "Yolias helps businesses and B2B sales teams research target markets and find companies that match their ideal customer profile, shared across the team.",
      pillars: [
        { title: "One place to define target accounts", body: "Your team describes target accounts in plain words and Yolias turns them into campaigns everyone can see." },
        { title: "A shared, reviewed list", body: "Matching companies land in one Prospects table with filters, saved lists and CSV import and export, shared across the workspace." },
        { title: "From research to outreach faster", body: "Yolias writes an email for each prospect and sends it from the rep's own mailbox once approved." },
      ],
      problemTitle: "The problem",
      problem: [
        "Sales teams lose hours building account lists in spreadsheets, and each person searches differently. Entering a new market means starting that research again from nothing.",
      ],
      helpsTitle: "How Yolias helps",
      helps: [
        { title: "One description, one search", body: "Describe the accounts you want and Yolias turns it into criteria and a search the whole team can follow." },
        { title: "Shared prospects", body: "Every plan includes unlimited users. Results land in your workspace’s Prospects, where the team can filter, save and export them." },
        { title: "Explained matches", body: "Each company shows which criteria it meets, so reps agree on why an account is on the list." },
        { title: "Analytics", body: "See companies and decision makers found, average ICP match, emails sent, replies and meetings over time." },
      ],
      useCasesTitle: "Use cases",
      useCases: [
        "Size and research a new country before deciding to expand there.",
        "Give each rep a list of matching accounts in their territory.",
        "Run continuous campaigns so new matching companies keep arriving.",
      ],
      icpTitle: "Example ideal customer",
      icpIntro: "A B2B software company might write:",
      icp: "Manufacturing companies in Egypt and Saudi Arabia with 200 to 2,000 employees that run their own production plants, and I want to reach the plant manager or head of operations.",
      stepsTitle: "How to use Yolias",
      steps: [
        "Set up your Company Knowledge with your offer, ideal customer and target markets.",
        "Describe the accounts you want and set the campaign goal, deadline and schedule.",
        "Review the companies with your team, save the right ones and remove the rest.",
        "Export to CSV for your CRM or prepare messages that each rep sends from their own account.",
      ],
      valueTitle: "What you can expect",
      value: "Account research that starts from your criteria instead of a blank spreadsheet, and one shared list for the whole team.",
    },
    ar: {
      name: "الشركات وفرق المبيعات",
      tagline: "ابحث في الأسواق المستهدفة وحدد الفرص المناسبة.",
      title: "ابحث في الأسواق المستهدفة وحدد الفرص التجارية المناسبة.",
      lead: "امنح فريقك مكانًا واحدًا لوصف الحسابات المستهدفة والحصول على قائمة مراجَعة بالشركات المطابقة، مشتركة في مساحة عملك.",
      metaDescription: "يساعد يولياس الشركات وفرق مبيعات B2B على البحث في الأسواق المستهدفة وإيجاد الشركات المطابقة لملف عميلها المثالي، مع مشاركتها مع الفريق.",
      pillars: [
        { title: "مكان واحد لتحديد الحسابات المستهدفة", body: "يصف فريقك الحسابات المستهدفة بكلمات بسيطة، ويحوّلها يولياس إلى حملات يراها الجميع." },
        { title: "قائمة مشتركة ومراجَعة", body: "تصل الشركات المطابقة إلى جدول واحد للعملاء المحتملين فيه فلاتر ومحفوظات واستيراد وتصدير CSV، مشترك في مساحة العمل." },
        { title: "من البحث إلى التواصل أسرع", body: "يجهّز فريقك رسائل البريد وLinkedIn من كل عميل محتمل ويرسلها من حساباته." },
      ],
      problemTitle: "المشكلة",
      problem: [
        "تخسر فرق المبيعات ساعات في بناء قوائم الحسابات في جداول البيانات، ويبحث كل شخص بطريقة مختلفة. ودخول سوق جديد يعني بدء هذا البحث من الصفر من جديد.",
      ],
      helpsTitle: "كيف يساعدك يولياس",
      helps: [
        { title: "وصف واحد وحملة واحدة", body: "صِف الحسابات التي تريدها، ويحوّلها يولياس إلى معايير وبحث يتابعها الفريق كله." },
        { title: "عملاء محتملون مشتركون", body: "كل الخطط تشمل عددًا غير محدود من المستخدمين. تصل النتائج إلى قسم العملاء المحتملين في مساحة عملك، حيث يمكن للفريق التصفية والحفظ والتصدير." },
        { title: "تطابق موضّح", body: "توضح كل شركة المعايير التي تحققها، ليتفق الفريق على سبب وجود الحساب في القائمة." },
        { title: "التحليلات", body: "اطّلع على الشركات المكتشفة والعملاء المحتملين ومعدل التطابق حسب السوق بمرور الوقت." },
      ],
      useCasesTitle: "حالات الاستخدام",
      useCases: [
        "تقدير حجم سوق دولة جديدة والبحث فيه قبل قرار التوسع.",
        "منح كل مندوب قائمة بالحسابات المطابقة في منطقته.",
        "تشغيل حملات مستمرة لتصل شركات مطابقة جديدة باستمرار.",
      ],
      icpTitle: "مثال على العميل المثالي",
      icpIntro: "شركة برمجيات B2B قد تكتب:",
      icp: "شركات تصنيع في مصر والسعودية من 200 إلى 2,000 موظف تدير مصانعها بنفسها، وأريد الوصول إلى مدير المصنع أو رئيس العمليات.",
      stepsTitle: "كيف تستخدم يولياس",
      steps: [
        "أعدّ معرفة الشركة بعرضك وعميلك المثالي وأسواقك المستهدفة.",
        "صِف الحسابات التي تريدها وحدد هدف الحملة وموعدها وجدولها.",
        "راجع الشركات مع فريقك، واحفظ المناسب منها واستبعد الباقي.",
        "صدّر إلى ملف CSV لنظام CRM، أو جهّز رسائل يرسلها كل مندوب من حسابه.",
      ],
      valueTitle: "ما الذي تتوقعه",
      value: "بحث في الحسابات يبدأ من معاييرك بدل جدول بيانات فارغ، وقائمة واحدة مشتركة للفريق كله.",
    },
  },
};

export function isSolutionSlug(s: string): s is SolutionSlug {
  return (solutionSlugs as readonly string[]).includes(s);
}
