import type { Localized } from "./types";

// Search intent pages (D-179): one page per question people actually type
// when they look for clients, each answered with what Yolias does today.
// The research behind each page (intent, audience, measurement) is in
// docs/20-seo-geo-aeo-ar.md. Examples are marked as examples; nothing here
// promises results, verified personal contacts or features Yolias doesn't have.

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
  limits: string[];
  faq: { q: string; a: string }[];
  /** Related solutions pages (internal links). */
  solutions: string[];
}

export const useCasesPage: Localized<{ eyebrow: string; title: string; lead: string; metaDescription: string; faqTitle: string; related: string; solutionsTitle: string; cta: { title: string; body: string; primary: string; secondary: string }; exampleLabel: string }> = {
  en: {
    eyebrow: "USE CASES",
    title: "What you can do with Yolias",
    lead: "Practical guides to finding the right companies and people to sell your services to, and how Yolias handles each step.",
    metaDescription: "How to find clients, companies that match your ideal customer profile, decision makers and local businesses with Yolias, an AI customer discovery platform.",
    faqTitle: "Questions",
    related: "More use cases",
    solutionsTitle: "Solutions for your business",
    cta: { title: "Try it on your own market.", body: "Create an account, describe who you want to reach and review the campaign Yolias builds.", primary: "Try Yolias", secondary: "See pricing" },
    exampleLabel: "Example request",
  },
  ar: {
    eyebrow: "حالات الاستخدام",
    title: "ما الذي يمكنك فعله مع يولياس",
    lead: "أدلة عملية لإيجاد الشركات والأشخاص المناسبين لبيع خدماتك، وكيف يتعامل يولياس مع كل خطوة.",
    metaDescription: "كيف تجد عملاء وشركات تطابق ملف عميلك المثالي وصنّاع قرار وأنشطة محلية مع يولياس، منصة اكتشاف العملاء بالذكاء الاصطناعي.",
    faqTitle: "أسئلة شائعة",
    related: "حالات استخدام أخرى",
    solutionsTitle: "حلول لنوع عملك",
    cta: { title: "جرّبه على سوقك.", body: "أنشئ حسابًا، وصِف من تريد الوصول إليه، وراجع الحملة التي يبنيها يولياس.", primary: "جرّب يولياس", secondary: "عرض الأسعار" },
    exampleLabel: "مثال على طلب",
  },
};

const limitsEn = {
  contacts: "Yolias shows the business contact details a company publishes. It doesn’t promise a personal email or phone number for every person.",
  coverage: "Results depend on your market and on the data sources connected to Yolias; a search that needs a source Yolias doesn’t have yet waits and says so.",
  outreach: "Yolias writes and sends a campaign from your own mailbox (Gmail or any IMAP/SMTP account) only after you approve it, and brings the replies to your Inbox.",
  guarantee: "Yolias doesn’t guarantee a number of leads, meetings or sales.",
};
const limitsAr = {
  contacts: "يعرض يولياس بيانات التواصل التي تنشرها الشركة، ولا يعد ببريد أو رقم شخصي لكل شخص.",
  coverage: "تعتمد النتائج على سوقك وعلى مصادر البيانات المتصلة بيولياس، والبحث الذي يحتاج مصدرًا غير متاح بعد ينتظر ويوضح ذلك.",
  outreach: "يكتب يولياس الحملة ويرسلها من Gmail أو بريد IMAP/SMTP الخاص بك فقط بعد موافقتك، ويعيد الردود إلى المحادثات.",
  guarantee: "لا يضمن يولياس عددًا محددًا من العملاء المحتملين أو الاجتماعات أو المبيعات.",
};

export const useCases: Record<UseCaseSlug, Localized<UseCase>> = {
  "ai-prospecting": {
    en: {
      name: "AI prospecting",
      title: "AI Prospecting for Businesses that Sell Services",
      h1: "AI prospecting for businesses that sell services",
      metaDescription: "Describe your ideal customer in a sentence. Yolias runs an AI prospecting campaign that finds matching companies and decision makers and explains every match.",
      lead: "Prospecting is the slow part of selling a service: deciding who to target, finding them and checking each one fits. Yolias does that research from a plain-language brief, so you start from a shortlist instead of a blank spreadsheet.",
      answerTitle: "What is AI prospecting?",
      answer: "AI prospecting means using an AI system to turn a description of your ideal customer into a researched list of matching companies and people. In Yolias you write the brief in English or Arabic; Yolias extracts the criteria, runs a search and returns each match with the reasons it fits.",
      forTitle: "Who it’s for",
      forWho: ["Agencies, consultants and freelancers who need a steady flow of new clients", "B2B sales teams that build target account lists by hand", "Founders doing their own sales before hiring a sales team"],
      problemTitle: "Why prospecting takes so long",
      problem: [
        "Most prospecting tools start with filter panels: industry codes, headcount bands, job title lists. Translating what you actually mean into those filters takes trial and error, and the list still needs cleaning.",
        "In markets with scattered company data, such as the Gulf and Egypt, the gap is bigger: many companies are missing from global databases or listed under the wrong category.",
      ],
      stepsTitle: "How it works in Yolias",
      steps: [
        { title: "Describe the customer", body: "Write who you want to sell to the way you would brief a colleague: market, industry, company size, signals and the roles you need to reach." },
        { title: "Confirm the campaign", body: "Yolias shows the criteria it understood and the assumptions it made from your company profile, then opens a campaign with a target number of prospects." },
        { title: "Review the matches", body: "Companies and decision makers arrive with a match score that lists what matched. Keep the good ones, remove the rest and export to CSV." },
        { title: "Prepare the first message", body: "For each prospect Yolias writes an email from your profile and the facts it found, and sends it from your own mailbox once you approve." },
      ],
      exampleTitle: "An example brief",
      exampleNote: "An illustration of how a request can be written, not a customer story:",
      example: "Find 50 logistics companies in the UAE with 100 to 500 employees that run their own fleet, and reach their operations director or COO.",
      getTitle: "What you get",
      get: ["A campaign with its criteria, target and progress log", "Matched companies with industry, size and location", "Decision makers with their role, where found", "A match explanation for every result", "CSV export and drafted first messages"],
      limitsTitle: "Limits to know",
      limits: [limitsEn.coverage, limitsEn.contacts, limitsEn.guarantee],
      faq: [
        { q: "Is AI prospecting the same as buying a lead list?", a: "No. A lead list is a fixed file someone else built. In Yolias each search is built from your own brief and business context, and every result shows why it matched." },
        { q: "Do I need to know industry codes or filters?", a: "No. You describe the customer in plain language. Yolias turns it into criteria and shows them to you before the campaign runs." },
        { q: "Does Yolias contact prospects for me?", a: "Only after you approve. You choose who to contact; Yolias writes the emails and sends them from your own connected mailbox, then brings the replies to your Inbox." },
      ],
      solutions: ["sales-teams", "marketing-agencies", "consultants"],
    },
    ar: {
      name: "البحث عن العملاء بالذكاء الاصطناعي",
      title: "البحث عن العملاء بالذكاء الاصطناعي لشركات الخدمات",
      h1: "البحث عن العملاء بالذكاء الاصطناعي للشركات التي تبيع خدمات",
      metaDescription: "صِف عميلك المثالي في جملة، ويشغّل يولياس بحث بالذكاء الاصطناعي تجد الشركات وصنّاع القرار المطابقين وتشرح سبب كل تطابق.",
      lead: "البحث عن العملاء هو الجزء البطيء في بيع أي خدمة: تحديد من تستهدف، وإيجاده، والتأكد من أنه مناسب. يقوم يولياس بهذا البحث من وصف بلغة طبيعية، فتبدأ من قائمة مختصرة بدل جدول فارغ.",
      answerTitle: "ما هو البحث عن العملاء بالذكاء الاصطناعي؟",
      answer: "يعني استخدام نظام ذكاء اصطناعي لتحويل وصف عميلك المثالي إلى قائمة مدروسة من الشركات والأشخاص المطابقين. في يولياس تكتب الوصف بالعربية أو الإنجليزية، فيستخرج المعايير ويشغّل بحث ويعيد كل نتيجة مع أسباب تطابقها.",
      forTitle: "لمن هذا",
      forWho: ["الوكالات والاستشاريون والمستقلون الذين يحتاجون عملاء جددًا باستمرار", "فرق المبيعات B2B التي تبني قوائم الحسابات المستهدفة يدويًا", "المؤسسون الذين يبيعون بأنفسهم قبل توظيف فريق مبيعات"],
      problemTitle: "لماذا يستغرق البحث عن العملاء وقتًا طويلًا",
      problem: [
        "تبدأ معظم الأدوات بلوحات فلاتر: رموز القطاعات وفئات عدد الموظفين وقوائم المسميات. وتحويل ما تقصده فعلًا إلى هذه الفلاتر يحتاج تجارب كثيرة، ثم تحتاج القائمة إلى تنظيف.",
        "وفي الأسواق التي تتفرق فيها بيانات الشركات، مثل الخليج ومصر، تكون الفجوة أكبر: شركات كثيرة غائبة عن قواعد البيانات العالمية أو مصنفة في قطاع خاطئ.",
      ],
      stepsTitle: "كيف يعمل في يولياس",
      steps: [
        { title: "صِف العميل", body: "اكتب لمن تريد أن تبيع كما تشرح المهمة لزميل: السوق والقطاع وحجم الشركة والمؤشرات والمناصب التي تريد الوصول إليها." },
        { title: "أكّد الحملة", body: "يعرض يولياس المعايير التي فهمها والافتراضات التي أخذها من ملف شركتك، ثم يفتح حملة بعدد مستهدف من العملاء المحتملين." },
        { title: "راجع النتائج", body: "تصل الشركات وصنّاع القرار مع نسبة تطابق توضّح ما تطابق. احتفظ بالمناسب واحذف الباقي وصدّر إلى CSV." },
        { title: "جهّز الرسالة الأولى", body: "لكل عميل محتمل يكتب يولياس رسالة بريد من ملفك والمعلومات التي وجدها، ويرسلها من بريدك بعد موافقتك." },
      ],
      exampleTitle: "مثال على وصف",
      exampleNote: "مثال توضيحي لطريقة كتابة الطلب، وليس قصة عميل:",
      example: "ابحث عن 50 شركة لوجستيات في الإمارات من 100 إلى 500 موظف تدير أسطولها بنفسها، وأريد الوصول إلى مدير العمليات.",
      getTitle: "ما الذي تحصل عليه",
      get: ["حملة بمعاييرها وهدفها وسجل تقدمها", "شركات مطابقة مع القطاع والحجم والموقع", "صنّاع القرار ومناصبهم عند العثور عليهم", "شرح للتطابق مع كل نتيجة", "تصدير CSV ورسائل أولى جاهزة للتعديل"],
      limitsTitle: "حدود يجب معرفتها",
      limits: [limitsAr.coverage, limitsAr.contacts, limitsAr.guarantee],
      faq: [
        { q: "هل البحث بالذكاء الاصطناعي مثل شراء قائمة عملاء؟", a: "لا. القائمة الجاهزة ملف ثابت بناه غيرك. في يولياس يُبنى كل بحث من وصفك وسياق عملك، وتوضّح كل نتيجة سبب تطابقها." },
        { q: "هل أحتاج إلى معرفة رموز القطاعات أو الفلاتر؟", a: "لا. تصف العميل بلغة طبيعية، ويحوّله يولياس إلى معايير يعرضها عليك قبل تشغيل الحملة." },
        { q: "هل يتواصل يولياس مع العملاء نيابةً عني؟", a: "لا. يبحث يولياس ويجهّز المسودات، وأنت تقرر من تتواصل معه وترسل من حساباتك." },
      ],
      solutions: ["sales-teams", "marketing-agencies", "consultants"],
    },
  },
  "find-clients": {
    en: {
      name: "Find clients for a service business",
      title: "How to Find Clients for a Service Business",
      h1: "How to find clients for a service business",
      metaDescription: "A practical way to find clients for a service business: define who you serve, build a researched shortlist and contact each company with a relevant first message.",
      lead: "Referrals are the best clients, until they slow down. This guide shows a repeatable way to find new clients for an agency, consultancy or freelance business, and where Yolias saves you the research time.",
      answerTitle: "The short answer",
      answer: "Write down the type of company you serve best, find companies that match it, check each one fits, and contact the right person with a message about their situation. Yolias handles the finding and checking from a plain-language description, and drafts the first message for you to send.",
      forTitle: "Who it’s for",
      forWho: ["Marketing, design and software agencies", "Consultants and advisory firms", "Freelancers and small studios", "Recruitment agencies looking for new client companies"],
      problemTitle: "Where most service businesses get stuck",
      problem: [
        "The work is rarely the problem. The problem is spending evenings searching directories and social media for possible clients, without a clear way to tell a good fit from a waste of time.",
        "Generic outreach to a long, unchecked list damages your reputation and rarely gets replies. A short list of companies that really match your experience works better.",
      ],
      stepsTitle: "A repeatable process",
      steps: [
        { title: "1. Define who you serve best", body: "Look at your best past clients: industry, size, location and who hired you. Write it as one sentence. In Yolias this becomes your company profile and your first search." },
        { title: "2. Build a researched shortlist", body: "Yolias finds companies that match the sentence, with industry, size and location, and explains why each one fits." },
        { title: "3. Find the right person", body: "Name the roles that buy your service. Yolias looks for people with those titles at each company, and shows the business contact details the company publishes." },
        { title: "4. Send a relevant first message", body: "Yolias writes a short email from what it found and your profile, and sends it from your own mailbox once you approve." },
        { title: "5. Keep it running", body: "A campaign can run on a schedule and keep adding new matching companies, so prospecting doesn’t stop when you get busy." },
      ],
      exampleTitle: "An example",
      exampleNote: "An illustration of a request, not a customer story:",
      example: "Private schools and training centers in Cairo and Giza with their own website and 20 to 200 staff, where I can reach the owner or marketing manager.",
      getTitle: "What you get",
      get: ["A shortlist built around your own experience", "Reasons for every match", "Public business contact details where available", "First messages ready to edit"],
      limitsTitle: "Limits to know",
      limits: [limitsEn.contacts, limitsEn.outreach, limitsEn.guarantee],
      faq: [
        { q: "What is the fastest way to find clients for a service business?", a: "Start from your best existing clients, describe what they have in common, and look for companies that share it. Contacting a short, well-matched list is faster than writing to many companies at random." },
        { q: "Should I buy a lead list?", a: "Bought lists are usually generic and out of date. A list built from your own criteria, with a reason for every company, is easier to work and better for your reputation." },
        { q: "Can I use Yolias in Arabic?", a: "Yes. You can write your brief in Arabic or English, and the whole product works in both languages." },
      ],
      solutions: ["marketing-agencies", "freelancers", "consultants"],
    },
    ar: {
      name: "إيجاد عملاء لنشاط خدمي",
      title: "كيف تجد عملاء لنشاطك الخدمي",
      h1: "كيف تجد عملاء لنشاطك الخدمي",
      metaDescription: "طريقة عملية لإيجاد عملاء لنشاط خدمي: حدّد من تخدمه، وابنِ قائمة مختصرة مدروسة، وتواصل مع كل شركة برسالة مناسبة.",
      lead: "عملاء الترشيحات هم الأفضل، حتى تتباطأ الترشيحات. يعرض هذا الدليل طريقة متكررة لإيجاد عملاء جدد لوكالة أو مكتب استشارات أو عمل حر، وأين يوفر عليك يولياس وقت البحث.",
      answerTitle: "الإجابة المختصرة",
      answer: "اكتب نوع الشركة التي تخدمها بأفضل شكل، وابحث عن الشركات المطابقة، وتحقق من مناسبة كل منها، ثم تواصل مع الشخص المناسب برسالة عن وضعه. يتولى يولياس البحث والتحقق من وصف بلغة طبيعية، ويكتب الرسالة الأولى ويرسلها من بريدك بعد موافقتك.",
      forTitle: "لمن هذا",
      forWho: ["وكالات التسويق والتصميم والبرمجيات", "الاستشاريون ومكاتب الاستشارات", "المستقلون والاستوديوهات الصغيرة", "وكالات التوظيف التي تبحث عن شركات عميلة جديدة"],
      problemTitle: "أين تتعثر معظم الأنشطة الخدمية",
      problem: [
        "نادرًا ما تكون المشكلة في العمل نفسه. المشكلة قضاء الأمسيات في البحث في الأدلة ووسائل التواصل عن عملاء محتملين دون طريقة واضحة لتمييز المناسب من مضيعة الوقت.",
        "التواصل العام مع قائمة طويلة غير مدروسة يضر بسمعتك ونادرًا ما يحصل على رد. القائمة القصيرة من الشركات المطابقة لخبرتك فعلًا أفضل.",
      ],
      stepsTitle: "طريقة يمكن تكرارها",
      steps: [
        { title: "1. حدّد من تخدمه بأفضل شكل", body: "انظر إلى أفضل عملائك السابقين: القطاع والحجم والموقع ومن تعاقد معك. اكتبه في جملة واحدة. في يولياس تصبح هذه الجملة ملف شركتك وأول بحث لك." },
        { title: "2. ابنِ قائمة مختصرة مدروسة", body: "يجد يولياس الشركات المطابقة للجملة مع القطاع والحجم والموقع، ويشرح سبب مناسبة كل منها." },
        { title: "3. اعثر على الشخص المناسب", body: "اذكر المناصب التي تشتري خدمتك، ويبحث يولياس عن أصحابها في كل شركة، ويعرض بيانات التواصل التي تنشرها الشركة." },
        { title: "4. أرسل رسالة أولى مناسبة", body: "يجهّز يولياس رسالة قصيرة مما وجده ومن ملفك. عدّلها ثم أرسلها من بريدك أو LinkedIn." },
        { title: "5. اجعله مستمرًا", body: "يمكن أن تعمل الحملة على جدول زمني وتضيف شركات مطابقة جديدة، فلا يتوقف البحث عن العملاء حين تنشغل." },
      ],
      exampleTitle: "مثال",
      exampleNote: "مثال توضيحي لطلب، وليس قصة عميل:",
      example: "مدارس خاصة ومراكز تدريب في القاهرة والجيزة لديها موقع إلكتروني ومن 20 إلى 200 موظف، وأريد الوصول إلى المالك أو مدير التسويق.",
      getTitle: "ما الذي تحصل عليه",
      get: ["قائمة مختصرة مبنية على خبرتك أنت", "أسباب كل تطابق", "بيانات التواصل العامة عند توفرها", "رسائل أولى جاهزة للتعديل"],
      limitsTitle: "حدود يجب معرفتها",
      limits: [limitsAr.contacts, limitsAr.outreach, limitsAr.guarantee],
      faq: [
        { q: "ما أسرع طريقة لإيجاد عملاء لنشاط خدمي؟", a: "ابدأ من أفضل عملائك الحاليين، وصِف ما يجمعهم، وابحث عن الشركات التي تشاركهم ذلك. التواصل مع قائمة قصيرة مطابقة أسرع من مراسلة شركات كثيرة عشوائيًا." },
        { q: "هل أشتري قائمة عملاء جاهزة؟", a: "القوائم المشتراة غالبًا عامة وقديمة. القائمة المبنية على معاييرك مع سبب لكل شركة أسهل في العمل وأفضل لسمعتك." },
        { q: "هل يمكنني استخدام يولياس بالعربية؟", a: "نعم. تكتب وصفك بالعربية أو الإنجليزية، والمنتج كله يعمل باللغتين." },
      ],
      solutions: ["marketing-agencies", "freelancers", "consultants"],
    },
  },
  "icp-company-search": {
    en: {
      name: "Ideal customer profile search",
      title: "Find Companies that Match Your Ideal Customer Profile",
      h1: "Find companies that match your ideal customer profile",
      metaDescription: "Turn your ideal customer profile into a list of matching companies. Describe industry, market, size and signals in plain language; Yolias explains every match.",
      lead: "An ideal customer profile (ICP) is only useful if you can turn it into real companies. Yolias reads your ICP as you write it and searches for the companies that fit it.",
      answerTitle: "How do you find companies that match an ICP?",
      answer: "Write the profile as concrete criteria (market, industry, company size and any signal that matters, such as hiring), search for companies that meet them, and check why each one matched. In Yolias you can write the ICP in one sentence or attach an ICP document, and every result shows which criteria it met.",
      forTitle: "Who it’s for",
      forWho: ["B2B sales and marketing teams building target account lists", "Agencies and consultancies with a clear niche", "Founders testing a new market"],
      problemTitle: "Why ICPs stay on slides",
      problem: [
        "Most teams write an ICP once, then search with filters that only approximate it. Signals like “growing its sales team” or “sells online without its own app” are hard to express as filters.",
        "The result is a list that needs manual checking company by company, which is the work the ICP was supposed to save.",
      ],
      stepsTitle: "How it works in Yolias",
      steps: [
        { title: "Write or attach your ICP", body: "Type it, or attach a PDF brief, a CSV of accounts you like or a screenshot of a company you want more of. Up to three attachments per request." },
        { title: "Check the criteria", body: "Yolias lists the criteria it extracted and anything it assumed from your company profile, so nothing is hidden." },
        { title: "Review scored companies", body: "Each company arrives with a match score and the criteria it met: market, industry, size, signals and roles." },
      ],
      exampleTitle: "An example ICP",
      exampleNote: "An illustration, not a customer story:",
      example: "B2B SaaS companies in Saudi Arabia with 20 to 200 employees that are hiring salespeople, and I want to reach the founder or CEO.",
      getTitle: "What you get",
      get: ["Structured criteria from your own words", "Assumptions listed openly", "A match score with its evidence", "Saved companies you can export to CSV"],
      limitsTitle: "Limits to know",
      limits: [limitsEn.coverage, "Signals such as hiring are used only when a connected source provides them; otherwise Yolias says it couldn’t check them.", limitsEn.guarantee],
      faq: [
        { q: "What should an ideal customer profile include?", a: "At least the market, the industry, the company size and the role you sell to. Add signals that predict a need, such as hiring, expansion or the tools a company uses, when they matter for your offer." },
        { q: "Can I use an ICP document I already have?", a: "Yes. Attach it as a PDF, a CSV or a screenshot and Yolias reads the criteria from it." },
        { q: "Why does a company match only partly?", a: "Some criteria can’t be confirmed from the available information. The match score shows which criteria matched and which couldn’t be checked." },
      ],
      solutions: ["sales-teams", "software-agencies", "consultants"],
    },
    ar: {
      name: "البحث حسب ملف العميل المثالي",
      title: "اعثر على شركات تطابق ملف عميلك المثالي",
      h1: "اعثر على شركات تطابق ملف عميلك المثالي",
      metaDescription: "حوّل ملف عميلك المثالي إلى قائمة شركات مطابقة. صِف القطاع والسوق والحجم والمؤشرات بلغة طبيعية، ويشرح يولياس كل تطابق.",
      lead: "ملف العميل المثالي (ICP) لا يفيد إلا إذا حوّلته إلى شركات حقيقية. يقرأ يولياس الملف كما تكتبه ويبحث عن الشركات المطابقة له.",
      answerTitle: "كيف تجد شركات تطابق ملف العميل المثالي؟",
      answer: "اكتب الملف كمعايير محددة (السوق والقطاع وحجم الشركة وأي مؤشر مهم مثل التوظيف)، وابحث عن الشركات المستوفية لها، وتحقق من سبب تطابق كل منها. في يولياس تكتب الملف في جملة واحدة أو ترفق مستندًا، وتوضّح كل نتيجة المعايير التي استوفتها.",
      forTitle: "لمن هذا",
      forWho: ["فرق المبيعات والتسويق B2B التي تبني قوائم الحسابات المستهدفة", "الوكالات والمكاتب الاستشارية ذات التخصص الواضح", "المؤسسون الذين يختبرون سوقًا جديدًا"],
      problemTitle: "لماذا تبقى ملفات العميل المثالي في العروض التقديمية",
      problem: [
        "تكتب معظم الفرق ملف العميل المثالي مرة واحدة، ثم تبحث بفلاتر تقاربه فقط. ومؤشرات مثل «توسّع فريق المبيعات» أو «تبيع أونلاين دون تطبيق خاص» يصعب التعبير عنها بالفلاتر.",
        "والنتيجة قائمة تحتاج إلى مراجعة يدوية شركة بشركة، وهو العمل الذي كان يفترض أن يوفره الملف.",
      ],
      stepsTitle: "كيف يعمل في يولياس",
      steps: [
        { title: "اكتب الملف أو أرفقه", body: "اكتبه، أو أرفق ملف PDF أو قائمة CSV بحسابات تعجبك أو لقطة شاشة لشركة تريد أمثالها، حتى ثلاثة مرفقات في الطلب." },
        { title: "راجع المعايير", body: "يعرض يولياس المعايير التي استخرجها وما افترضه من ملف شركتك، فلا شيء مخفي." },
        { title: "راجع الشركات المقيّمة", body: "تصل كل شركة مع نسبة تطابق والمعايير التي استوفتها: السوق والقطاع والحجم والمؤشرات والمناصب." },
      ],
      exampleTitle: "مثال على ملف عميل مثالي",
      exampleNote: "مثال توضيحي، وليس قصة عميل:",
      example: "شركات B2B SaaS في السعودية من 20 إلى 200 موظف توظّف مندوبي مبيعات، وأريد الوصول إلى المؤسس أو الرئيس التنفيذي.",
      getTitle: "ما الذي تحصل عليه",
      get: ["معايير منظمة من كلماتك أنت", "افتراضات معروضة بوضوح", "نسبة تطابق مع أدلتها", "شركات محفوظة يمكن تصديرها إلى CSV"],
      limitsTitle: "حدود يجب معرفتها",
      limits: [limitsAr.coverage, "تُستخدم مؤشرات مثل التوظيف فقط عندما يوفرها مصدر متصل، وإلا يوضح يولياس أنه لم يستطع التحقق منها.", limitsAr.guarantee],
      faq: [
        { q: "ماذا يجب أن يتضمن ملف العميل المثالي؟", a: "على الأقل السوق والقطاع وحجم الشركة والمنصب الذي تبيع له. أضف المؤشرات التي تدل على الحاجة، مثل التوظيف أو التوسع أو الأدوات المستخدمة، عندما تهم عرضك." },
        { q: "هل يمكنني استخدام ملف لديّ بالفعل؟", a: "نعم. أرفقه كملف PDF أو CSV أو لقطة شاشة، ويقرأ يولياس المعايير منه." },
        { q: "لماذا تتطابق بعض الشركات جزئيًا؟", a: "لا يمكن تأكيد بعض المعايير من المعلومات المتاحة. توضّح نسبة التطابق ما تطابق وما لم يمكن التحقق منه." },
      ],
      solutions: ["sales-teams", "software-agencies", "consultants"],
    },
  },
  "find-decision-makers": {
    en: {
      name: "Find decision makers",
      title: "Find Decision Makers at Your Target Companies",
      h1: "Find decision makers at your target companies",
      metaDescription: "Find the people who decide at the companies you target: founders, CEOs, directors and heads of department, with their role and the company’s public contact details.",
      lead: "Finding the right company is half the job; the other half is reaching the person who decides. Yolias looks for people with the roles you name at every company it finds.",
      answerTitle: "How do you find the decision maker at a company?",
      answer: "Decide which role buys what you sell, then look for the person in that role at each target company and confirm they are still there. In Yolias you name the roles in your request, for example founder, COO or head of marketing, and each matched company comes back with the people found in those roles.",
      forTitle: "Who it’s for",
      forWho: ["Service businesses selling to a specific department", "B2B sales teams doing account-based outreach", "Recruiters reaching HR and hiring managers"],
      problemTitle: "Why it’s hard",
      problem: [
        "Titles differ from company to company and from country to country. The person who buys marketing services may be the owner in a small business and a head of growth in a larger one.",
        "Contact details are often unpublished, so tools that promise an email for everyone are usually guessing.",
      ],
      stepsTitle: "How it works in Yolias",
      steps: [
        { title: "Name the roles", body: "Write the roles that decide, in your own words. Yolias understands variations such as founder, owner, managing director or CEO." },
        { title: "Yolias searches each company", body: "For every matched company, Yolias looks for people in those roles through the connected sources." },
        { title: "Review and save", body: "Each person appears with their title and company. The company’s published business email or phone appears where it exists." },
      ],
      exampleTitle: "An example",
      exampleNote: "An illustration of a request, not a customer story:",
      example: "Hotels and serviced apartments in Dubai with 50 to 300 employees, and I want to reach the general manager or director of sales.",
      getTitle: "What you get",
      get: ["People in the roles you named, where found", "Their title and company", "The company’s public business contact details", "A first message you can edit and send"],
      limitsTitle: "Limits to know",
      limits: [limitsEn.contacts, "When no one is found in the role, the company still appears so you can research it yourself.", limitsEn.coverage],
      faq: [
        { q: "Does Yolias give personal emails of decision makers?", a: "No. Yolias shows the business contact details a company publishes and labels contact channels by verification state. It doesn’t promise a personal email for every person." },
        { q: "Which roles can I search for?", a: "Any role you can describe, such as founder, CEO, COO, head of marketing, HR manager or plant manager." },
        { q: "What if Yolias can’t find the person?", a: "The company still appears with its details, and the result says that no one in that role was found." },
      ],
      solutions: ["sales-teams", "recruitment-agencies", "consultants"],
    },
    ar: {
      name: "إيجاد صنّاع القرار",
      title: "اعثر على صنّاع القرار في الشركات المستهدفة",
      h1: "اعثر على صنّاع القرار في الشركات التي تستهدفها",
      metaDescription: "اعثر على أصحاب القرار في الشركات التي تستهدفها: المؤسسون والرؤساء التنفيذيون والمديرون ورؤساء الأقسام، مع مناصبهم وبيانات التواصل العامة للشركة.",
      lead: "إيجاد الشركة المناسبة نصف المهمة، والنصف الآخر الوصول إلى من يتخذ القرار. يبحث يولياس عن أصحاب المناصب التي تذكرها في كل شركة يجدها.",
      answerTitle: "كيف تجد صانع القرار في شركة ما؟",
      answer: "حدّد المنصب الذي يشتري ما تبيعه، ثم ابحث عن صاحب هذا المنصب في كل شركة مستهدفة وتأكد من أنه ما زال فيها. في يولياس تذكر المناصب في طلبك، مثل المؤسس أو مدير العمليات أو رئيس التسويق، وتعود كل شركة مطابقة مع الأشخاص الذين وُجدوا في هذه المناصب.",
      forTitle: "لمن هذا",
      forWho: ["الأنشطة الخدمية التي تبيع لقسم محدد", "فرق المبيعات B2B التي تعمل على حسابات محددة", "مسؤولو التوظيف الذين يتواصلون مع الموارد البشرية ومديري التوظيف"],
      problemTitle: "لماذا هذا صعب",
      problem: [
        "تختلف المسميات بين الشركات والدول. من يشتري خدمات التسويق قد يكون المالك في نشاط صغير ورئيس النمو في شركة أكبر.",
        "وبيانات التواصل غالبًا غير منشورة، لذلك فالأدوات التي تعد ببريد لكل شخص تخمّن في الغالب.",
      ],
      stepsTitle: "كيف يعمل في يولياس",
      steps: [
        { title: "اذكر المناصب", body: "اكتب المناصب التي تتخذ القرار بكلماتك، ويفهم يولياس تنويعاتها مثل المؤسس والمالك والمدير العام والرئيس التنفيذي." },
        { title: "يبحث يولياس في كل شركة", body: "لكل شركة مطابقة يبحث يولياس عن أصحاب هذه المناصب عبر المصادر المتصلة." },
        { title: "راجع واحفظ", body: "يظهر كل شخص بمنصبه وشركته، ويظهر بريد الشركة أو هاتفها المنشور عند وجوده." },
      ],
      exampleTitle: "مثال",
      exampleNote: "مثال توضيحي لطلب، وليس قصة عميل:",
      example: "فنادق وشقق فندقية في دبي من 50 إلى 300 موظف، وأريد الوصول إلى المدير العام أو مدير المبيعات.",
      getTitle: "ما الذي تحصل عليه",
      get: ["أصحاب المناصب التي ذكرتها عند العثور عليهم", "مناصبهم وشركاتهم", "بيانات التواصل العامة للشركة", "رسالة أولى تعدّلها وترسلها"],
      limitsTitle: "حدود يجب معرفتها",
      limits: [limitsAr.contacts, "عندما لا يوجد أحد في المنصب تظهر الشركة مع ذلك لتبحث فيها بنفسك.", limitsAr.coverage],
      faq: [
        { q: "هل يعطي يولياس البريد الشخصي لصنّاع القرار؟", a: "لا. يعرض يولياس بيانات التواصل التي تنشرها الشركة، ويصنّف قنوات التواصل حسب حالة التحقق، ولا يعد ببريد شخصي لكل شخص." },
        { q: "ما المناصب التي يمكنني البحث عنها؟", a: "أي منصب يمكنك وصفه، مثل المؤسس أو الرئيس التنفيذي أو مدير العمليات أو رئيس التسويق أو مدير الموارد البشرية أو مدير المصنع." },
        { q: "ماذا لو لم يجد يولياس الشخص؟", a: "تظهر الشركة مع بياناتها، وتوضح النتيجة أنه لم يُعثر على أحد في هذا المنصب." },
      ],
      solutions: ["sales-teams", "recruitment-agencies", "consultants"],
    },
  },
  "local-business-leads": {
    en: {
      name: "Local business leads",
      title: "Find Local Business Leads by City and Category",
      h1: "Find local business leads by city and category",
      metaDescription: "Find local businesses by category and city, such as clinics, restaurants or salons, with their website and published contact details, then prepare a first message.",
      lead: "If you sell to clinics, restaurants, salons, gyms or shops, your clients are local businesses. Yolias finds them by category and area and shows what each business publishes about itself.",
      answerTitle: "How do you find local business leads?",
      answer: "Pick the business category and the area you serve, list the businesses there, and check which ones fit, for example those with a website or with many reviews. In Yolias you write the category and the city in one sentence and a local business search returns matching businesses with their published details.",
      forTitle: "Who it’s for",
      forWho: ["Marketing and web design agencies serving local businesses", "Freelancers offering services to shops, clinics and restaurants", "Suppliers and B2B service providers with a local territory"],
      problemTitle: "Why maps and directories aren’t enough",
      problem: [
        "Searching a map for every category and district, then copying names and numbers into a sheet, takes hours and misses businesses listed under other categories.",
        "You also need a reason to contact each one, which a plain directory doesn’t give you.",
      ],
      stepsTitle: "How it works in Yolias",
      steps: [
        { title: "Describe category and area", body: "For example: dental clinics in Jeddah, or cafés and bakeries in Dubai Marina with a website." },
        { title: "Review the businesses", body: "Each business appears with its address, website, published phone or email and, when the source provides them, its rating and number of reviews." },
        { title: "Contact them your way", body: "Yolias drafts a short email in the business’s language from its published contact details; open it in your own email and send it yourself. Its website and social pages are linked when available." },
      ],
      exampleTitle: "An example",
      exampleNote: "An illustration of a request, not a customer story:",
      example: "Beauty salons and spas in Riyadh with an Instagram account and good reviews, and I want to reach the owner.",
      getTitle: "What you get",
      get: ["Businesses by category and area", "Website, address and published contact details", "Rating and review count when available", "Drafted emails, plus links to their website and social pages"],
      limitsTitle: "Limits to know",
      limits: [limitsEn.coverage, "Ratings, reviews and social accounts appear only when the data source provides them.", limitsEn.outreach],
      faq: [
        { q: "Which local business categories can I search?", a: "Any category you can name, such as clinics, restaurants, salons, gyms, schools, real estate offices or car repair shops." },
        { q: "Can I search a neighborhood rather than a whole city?", a: "Yes. Describe the area as precisely as you need, for example a district or a well-known neighborhood." },
        { q: "Does Yolias send emails to local businesses?", a: "Yes, when the business publishes an email: Yolias writes the campaign and sends it from your own mailbox after you approve it. Businesses without a published email are left out; nothing is guessed." },
      ],
      solutions: ["marketing-agencies", "freelancers", "real-estate"],
    },
    ar: {
      name: "عملاء من الأنشطة المحلية",
      title: "اعثر على عملاء من الأنشطة المحلية حسب المدينة والنشاط",
      h1: "اعثر على عملاء من الأنشطة المحلية حسب المدينة ونوع النشاط",
      metaDescription: "اعثر على الأنشطة التجارية المحلية حسب النوع والمدينة، مثل العيادات والمطاعم والصالونات، مع موقعها وبيانات التواصل المنشورة، ثم جهّز رسالة أولى.",
      lead: "إذا كنت تبيع للعيادات أو المطاعم أو الصالونات أو الصالات الرياضية أو المتاجر، فعملاؤك أنشطة محلية. يجدها يولياس حسب النوع والمنطقة ويعرض ما ينشره كل نشاط عن نفسه.",
      answerTitle: "كيف تجد عملاء من الأنشطة المحلية؟",
      answer: "اختر نوع النشاط والمنطقة التي تخدمها، واجمع الأنشطة الموجودة فيها، وتحقق من المناسب منها، مثل التي لديها موقع إلكتروني أو مراجعات كثيرة. في يولياس تكتب النوع والمدينة في جملة واحدة، ويعيد بحث الأنشطة المحلية الأنشطة المطابقة مع بياناتها المنشورة.",
      forTitle: "لمن هذا",
      forWho: ["وكالات التسويق وتصميم المواقع التي تخدم الأنشطة المحلية", "المستقلون الذين يقدمون خدمات للمتاجر والعيادات والمطاعم", "الموردون ومقدمو الخدمات B2B في نطاق جغرافي محدد"],
      problemTitle: "لماذا لا تكفي الخرائط والأدلة",
      problem: [
        "البحث في الخريطة عن كل نوع نشاط وكل حي، ثم نسخ الأسماء والأرقام إلى جدول، يستغرق ساعات ويفوّت أنشطة مسجلة تحت أنواع أخرى.",
        "وتحتاج أيضًا إلى سبب للتواصل مع كل نشاط، وهو ما لا يعطيك إياه الدليل العادي.",
      ],
      stepsTitle: "كيف يعمل في يولياس",
      steps: [
        { title: "صِف النوع والمنطقة", body: "مثل: عيادات الأسنان في جدة، أو المقاهي والمخابز في دبي مارينا التي لديها موقع إلكتروني." },
        { title: "راجع الأنشطة", body: "يظهر كل نشاط بعنوانه وموقعه الإلكتروني وهاتفه أو بريده المنشور، ومع التقييم وعدد المراجعات عندما يوفرها المصدر." },
        { title: "تواصل بطريقتك", body: "يكتب يولياس رسالة بريد قصيرة بلغة النشاط إلى بريده المنشور، ويرسلها من بريدك بعد موافقتك. وتظهر روابط موقعه وصفحاته على مواقع التواصل عند توفرها." },
      ],
      exampleTitle: "مثال",
      exampleNote: "مثال توضيحي لطلب، وليس قصة عميل:",
      example: "صالونات تجميل وسبا في الرياض لديها حساب على إنستغرام وتقييمات جيدة، وأريد الوصول إلى المالكة.",
      getTitle: "ما الذي تحصل عليه",
      get: ["أنشطة حسب النوع والمنطقة", "الموقع الإلكتروني والعنوان وبيانات التواصل المنشورة", "التقييم وعدد المراجعات عند توفرها", "رسائل بريد جاهزة، وروابط موقعه وصفحاته على مواقع التواصل"],
      limitsTitle: "حدود يجب معرفتها",
      limits: [limitsAr.coverage, "التقييمات والمراجعات وحسابات التواصل تظهر فقط عندما يوفرها مصدر البيانات.", limitsAr.outreach],
      faq: [
        { q: "ما أنواع الأنشطة المحلية التي يمكنني البحث عنها؟", a: "أي نوع يمكنك تسميته، مثل العيادات والمطاعم والصالونات والصالات الرياضية والمدارس ومكاتب العقار وورش السيارات." },
        { q: "هل يمكنني البحث في حي بدل مدينة كاملة؟", a: "نعم. صِف المنطقة بالدقة التي تحتاجها، مثل حي معين أو منطقة معروفة." },
        { q: "هل يرسل يولياس رسائل للأنشطة المحلية؟", a: "نعم، عندما ينشر النشاط بريدًا: يكتب يولياس الحملة ويرسلها من بريدك بعد موافقتك. والأنشطة التي لا تنشر بريدًا تُستبعد، ولا يُخمَّن أي بريد." },
      ],
      solutions: ["marketing-agencies", "freelancers", "real-estate"],
    },
  },
  "similar-companies": {
    en: {
      name: "Find similar companies",
      title: "Find Companies Similar to Your Best Clients",
      h1: "Find companies similar to your best clients",
      metaDescription: "Name the companies you already work well with and Yolias looks for similar ones: same industry, size and market, each with the reasons it’s similar.",
      lead: "Your best clients are the clearest description of who to sell to next. A lookalike search starts from them and looks for companies that resemble them.",
      answerTitle: "How do you find similar companies?",
      answer: "Start from a few companies you already serve well, note what they share (industry, size, market and business model), and search for others with the same traits. In Yolias you name the companies, or attach a CSV of them, and a lookalike search returns similar companies with the reasons they match.",
      forTitle: "Who it’s for",
      forWho: ["Agencies and consultancies with a few great reference clients", "SaaS and software companies expanding within a vertical", "Sales teams turning closed deals into new target accounts"],
      problemTitle: "Why “more like this one” is hard",
      problem: [
        "Describing what makes a client great is harder than pointing at it. Filters capture industry and headcount, but miss the business model and the stage that made the client a good fit.",
      ],
      stepsTitle: "How it works in Yolias",
      steps: [
        { title: "Name your best clients", body: "Type their names or domains, or attach a CSV or a screenshot of the companies you want more of." },
        { title: "Yolias finds lookalikes", body: "When a data source that offers lookalike search is connected, Yolias finds companies that resemble them." },
        { title: "Review the similarities", body: "Each company shows what it has in common with your examples, so you can keep the right ones." },
      ],
      exampleTitle: "An example",
      exampleNote: "An illustration of a request, not a customer story:",
      example: "Find 40 companies in Saudi Arabia and the UAE similar to the three clients in the attached CSV (restaurant software companies with 50 to 300 employees), and reach their head of partnerships.",
      getTitle: "What you get",
      get: ["Companies similar to the ones you named", "The traits they share with your examples", "Decision makers in the roles you name, where found", "CSV export"],
      limitsTitle: "Limits to know",
      limits: ["Lookalike search needs a connected data source that offers it. Until one is connected, the search waits and says so.", limitsEn.coverage, limitsEn.guarantee],
      faq: [
        { q: "How many example companies should I give?", a: "Three to ten good examples work well. Examples that share an industry and size give the most focused results." },
        { q: "Can I use my CRM export as examples?", a: "Yes. Attach a CSV of the accounts you want more of, such as your closed-won customers." },
        { q: "Is a lookalike search available on every plan?", a: "All plans include the same core features; the plans differ in the number of prospects per month. Lookalike results depend on a connected data source that offers them." },
      ],
      solutions: ["software-agencies", "sales-teams", "marketing-agencies"],
    },
    ar: {
      name: "إيجاد شركات مشابهة",
      title: "اعثر على شركات تشبه أفضل عملائك",
      h1: "اعثر على شركات تشبه أفضل عملائك",
      metaDescription: "اذكر الشركات التي تعمل معها جيدًا ويبحث يولياس عن شركات مشابهة: نفس القطاع والحجم والسوق، مع أسباب التشابه لكل منها.",
      lead: "أفضل عملائك هم أوضح وصف لمن تبيع له بعد ذلك. يبدأ بحث الشركات المشابهة منهم ويبحث عن شركات تشبههم.",
      answerTitle: "كيف تجد شركات مشابهة؟",
      answer: "ابدأ من شركات قليلة تخدمها جيدًا، ولاحظ ما يجمعها (القطاع والحجم والسوق ونموذج العمل)، وابحث عن شركات أخرى بنفس الصفات. في يولياس تذكر أسماء الشركات أو ترفق قائمة CSV بها، ويعيد بحث الشركات المشابهة شركات مماثلة مع أسباب تطابقها.",
      forTitle: "لمن هذا",
      forWho: ["الوكالات والمكاتب الاستشارية التي لديها عملاء مرجعيون مميزون", "شركات SaaS والبرمجيات التي تتوسع داخل قطاع واحد", "فرق المبيعات التي تحوّل الصفقات المغلقة إلى حسابات مستهدفة جديدة"],
      problemTitle: "لماذا يصعب طلب «مزيد من أمثال هذه الشركة»",
      problem: [
        "وصف ما يجعل العميل ممتازًا أصعب من الإشارة إليه. الفلاتر تلتقط القطاع وعدد الموظفين، لكنها تفوّت نموذج العمل والمرحلة التي جعلت العميل مناسبًا.",
      ],
      stepsTitle: "كيف يعمل في يولياس",
      steps: [
        { title: "اذكر أفضل عملائك", body: "اكتب أسماءهم أو نطاقات مواقعهم، أو أرفق قائمة CSV أو لقطة شاشة للشركات التي تريد أمثالها." },
        { title: "يجد يولياس الشركات المشابهة", body: "عندما يكون مصدر بيانات يوفر البحث عن الشركات المشابهة متصلًا، يجد يولياس شركات تشبهها." },
        { title: "راجع أوجه التشابه", body: "توضّح كل شركة ما يجمعها بأمثلتك، لتحتفظ بالمناسب منها." },
      ],
      exampleTitle: "مثال",
      exampleNote: "مثال توضيحي لطلب، وليس قصة عميل:",
      example: "ابحث عن 40 شركة في السعودية والإمارات تشبه العملاء الثلاثة في ملف CSV المرفق (شركات برمجيات مطاعم من 50 إلى 300 موظف)، وأريد الوصول إلى رئيس الشراكات.",
      getTitle: "ما الذي تحصل عليه",
      get: ["شركات تشبه الشركات التي ذكرتها", "الصفات المشتركة مع أمثلتك", "صنّاع القرار في المناصب التي تذكرها عند العثور عليهم", "تصدير CSV"],
      limitsTitle: "حدود يجب معرفتها",
      limits: ["يحتاج البحث عن الشركات المشابهة إلى مصدر بيانات متصل يوفره، وحتى يتصل ينتظر البحث ويوضح ذلك.", limitsAr.coverage, limitsAr.guarantee],
      faq: [
        { q: "كم شركة يجب أن أذكر كمثال؟", a: "من ثلاث إلى عشر أمثلة جيدة. الأمثلة التي تتشارك القطاع والحجم تعطي أدق النتائج." },
        { q: "هل يمكنني استخدام تصدير CRM كأمثلة؟", a: "نعم. أرفق قائمة CSV بالحسابات التي تريد أمثالها، مثل عملائك الذين أغلقت معهم صفقات." },
        { q: "هل البحث عن الشركات المشابهة متاح في كل الخطط؟", a: "كل الخطط تشمل نفس الميزات الأساسية، وتختلف في عدد العملاء المحتملين شهريًا. ونتائج الشركات المشابهة تعتمد على مصدر بيانات متصل يوفرها." },
      ],
      solutions: ["software-agencies", "sales-teams", "marketing-agencies"],
    },
  },
};

export function isUseCaseSlug(v: string): v is UseCaseSlug {
  return (useCaseSlugs as readonly string[]).includes(v);
}
