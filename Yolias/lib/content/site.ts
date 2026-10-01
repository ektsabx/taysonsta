import type { Localized } from "./types";

// Copy for the public website pages. Written around what Yolias does today:
// understand a strategy, run a discovery campaign, deliver prospects.

export const home: Localized<{
  eyebrow: string; title: string; lead: string; primary: string; secondary: string;
  preview: { prompt: string; status: string; chips: string[]; note: string };
  how: { eyebrow: string; title: string; steps: { title: string; body: string }[] };
  features: { eyebrow: string; title: string; tiles: { title: string; body: string }[] };
  statement: { text: string; small: string };
  cta: { title: string; body: string; primary: string; secondary: string };
}> = {
  en: {
    eyebrow: "AUTONOMOUS CUSTOMER DISCOVERY",
    title: "Tell Yolias who you want to sell to.",
    lead: "Describe your ideal customers in a sentence — market, industry, company size, the roles you need to reach. Yolias turns it into a discovery campaign and returns the decision makers that match.",
    primary: "Try Yolias",
    secondary: "See the product",
    preview: {
      prompt: "Find 60 B2B SaaS companies in Saudi Arabia with 20–200 employees that are hiring, and reach their founders.",
      status: "Campaign ready",
      chips: ["B2B SaaS", "Saudi Arabia", "20–200 employees", "Hiring", "Founders · CEOs"],
      note: "Target: 60 companies",
    },
    how: {
      eyebrow: "HOW IT WORKS",
      title: "From one sentence to a list you can act on.",
      steps: [
        { title: "Describe the customer", body: "Write it the way you would brief a colleague, in Arabic or English. Add a voice note, a screenshot or an ICP document if that is easier." },
        { title: "Yolias builds the mission", body: "It extracts market, industry, size, signals and job titles, fills sensible defaults, and opens a discovery campaign you can follow." },
        { title: "Review your prospects", body: "Matched companies and decision makers arrive with a match score and the contact channels found. Keep the ones you want and export them." },
      ],
    },
    features: {
      eyebrow: "WHAT YOU GET",
      title: "Built for the part before outreach.",
      tiles: [
        { title: "Strategies in plain language", body: "No filter panels to configure. Yolias reads your request and only assumes what your business context already tells it." },
        { title: "Campaigns as missions", body: "Every strategy becomes a campaign with a target, its criteria and a progress log, so you always know what Yolias is working on." },
        { title: "Scores you can read", body: "Each prospect shows why it matched — market, industry, size, hiring, role — instead of an unexplained number." },
        { title: "Arabic and English, end to end", body: "The whole product works right-to-left and left-to-right, and Yolias answers in the language you choose." },
      ],
    },
    statement: {
      text: "Yolias finds and qualifies the people worth talking to. How you reach them stays your decision.",
      small: "Discovery first — Yolias never sends messages on your behalf.",
    },
    cta: {
      title: "Start with one strategy.",
      body: "Pick a plan, describe your first customer profile and see the campaign Yolias builds from it.",
      primary: "Create account",
      secondary: "See pricing",
    },
  },
  ar: {
    eyebrow: "اكتشاف العملاء بشكل مستقل",
    title: "أخبر يولـياس لمن تريد أن تبيع.",
    lead: "صِف عملاءك المثاليين في جملة واحدة — السوق والقطاع وحجم الشركة والمناصب التي تريد الوصول إليها. يحوّل يولـياس وصفك إلى حملة اكتشاف ويعيد لك صنّاع القرار المطابقين.",
    primary: "جرّب يولـياس",
    secondary: "تعرّف على المنتج",
    preview: {
      prompt: "ابحث عن 60 شركة B2B SaaS في السعودية بها 20–200 موظف وتوظّف حاليًا، وأريد الوصول إلى مؤسسيها.",
      status: "الحملة جاهزة",
      chips: ["B2B SaaS", "السعودية", "20–200 موظف", "يوظّف حاليًا", "المؤسسون · الرؤساء التنفيذيون"],
      note: "الهدف: 60 شركة",
    },
    how: {
      eyebrow: "كيف يعمل",
      title: "من جملة واحدة إلى قائمة يمكنك العمل عليها.",
      steps: [
        { title: "صِف العميل", body: "اكتبه كما تشرح المهمة لزميل، بالعربية أو الإنجليزية. أضف ملاحظة صوتية أو لقطة شاشة أو مستند ICP إن كان ذلك أسهل." },
        { title: "يبني يولـياس المهمة", body: "يستخرج السوق والقطاع والحجم والمؤشرات والمسميات الوظيفية، ويكمل الناقص بافتراضات منطقية، ثم يفتح حملة اكتشاف يمكنك متابعتها." },
        { title: "راجع عملاءك المحتملين", body: "تصلك الشركات وصنّاع القرار المطابقون مع نسبة التطابق وقنوات التواصل التي عُثر عليها. احتفظ بمن تريد وصدّرهم." },
      ],
    },
    features: {
      eyebrow: "ما الذي تحصل عليه",
      title: "مصمم للمرحلة التي تسبق التواصل.",
      tiles: [
        { title: "استراتيجيات بلغة طبيعية", body: "لا توجد لوحات فلاتر لضبطها. يقرأ يولـياس طلبك ولا يفترض إلا ما يخبره به سياق عملك." },
        { title: "الحملات كمهام", body: "تتحول كل استراتيجية إلى حملة لها هدف ومعايير وسجل تقدّم، لتعرف دائمًا ما الذي يعمل عليه يولـياس." },
        { title: "نسب تطابق مفهومة", body: "يوضّح كل عميل محتمل سبب تطابقه — السوق والقطاع والحجم والتوظيف والمنصب — بدل رقم بلا تفسير." },
        { title: "العربية والإنجليزية بالكامل", body: "يعمل المنتج كله من اليمين لليسار ومن اليسار لليمين، ويرد يولـياس باللغة التي تختارها." },
      ],
    },
    statement: {
      text: "يجد يولـياس الأشخاص الذين يستحقون التواصل ويؤهلهم. أما طريقة الوصول إليهم فتبقى قرارك.",
      small: "الاكتشاف أولًا — لا يرسل يولـياس أي رسائل نيابةً عنك.",
    },
    cta: {
      title: "ابدأ باستراتيجية واحدة.",
      body: "اختر خطة، وصِف أول ملف لعملائك، وشاهد الحملة التي يبنيها يولـياس منه.",
      primary: "إنشاء حساب",
      secondary: "عرض الأسعار",
    },
  },
};

export const product: Localized<{
  eyebrow: string; title: string; lead: string; primary: string; secondary: string;
  sections: { title: string; body: string; points?: string[] }[];
  icp: { label: string; value: string }[];
  stages: string[];
  prospects: { name: string; role: string; company: string; match: string }[];
  more: { eyebrow: string; title: string; tiles: { title: string; body: string }[] };
  cta: { title: string; body: string; primary: string };
}> = {
  en: {
    eyebrow: "YOLIAS AI",
    title: "A discovery assistant that understands who you sell to.",
    lead: "Yolias AI is the whole product: one place to describe a market, watch a campaign take shape and collect the decision makers that fit.",
    primary: "Try Yolias",
    secondary: "Read the docs",
    sections: [
      {
        title: "Write a strategy",
        body: "Start from the prompt box. Type, speak or attach a file — a CSV of accounts you like, a PDF brief, or a screenshot of a company you want more of.",
        points: ["Voice input in Arabic or English", "Up to three attachments per request", "Quick-start examples for common markets"],
      },
      {
        title: "Yolias reads the ICP",
        body: "Your request becomes structured criteria. Anything you left open is filled from what you told Yolias about your business, and listed as an assumption so you can see it.",
      },
      {
        title: "A campaign runs the mission",
        body: "Each strategy opens a campaign with a target quota. Its activity log follows every stage, from planning to delivery, and the campaign status tells you where it stands.",
      },
      {
        title: "Prospects with their evidence",
        body: "Results show the company, headcount, location and the person’s role. Contact channels are labelled by verification state, and every record keeps the source it came from.",
      },
    ],
    icp: [
      { label: "Market", value: "Saudi Arabia" },
      { label: "Industry", value: "B2B SaaS" },
      { label: "Company size", value: "20–200 employees" },
      { label: "Signals", value: "Hiring: sales, engineering" },
      { label: "Decision makers", value: "Founder, CEO, CTO" },
      { label: "Assumed", value: "Target of 100 companies" },
    ],
    stages: ["Understand the request", "Plan the mission", "Find companies", "Find decision makers", "Enrich & verify", "Qualify and deliver"],
    prospects: [
      { name: "Founder & CEO", role: "Cloud payments", company: "120 employees · Riyadh", match: "96%" },
      { name: "VP Engineering", role: "Logistics software", company: "85 employees · Jeddah", match: "91%" },
      { name: "Head of Sales", role: "HR platform", company: "160 employees · Riyadh", match: "88%" },
    ],
    more: {
      eyebrow: "AROUND THE CORE",
      title: "Everything else you need to work the list.",
      tiles: [
        { title: "Analytics", body: "Prospects found, companies discovered, decision makers and fit rate — by market, over 7, 30 or 90 days." },
        { title: "Export", body: "Filter saved prospects by campaign, market or match score and download them as CSV for your own tools." },
        { title: "Team", body: "Unlimited users on every plan, with owner, admin and member roles for each workspace." },
        { title: "History", body: "Pin the strategies you return to, rename them, or remove the ones you no longer need." },
      ],
    },
    cta: { title: "See it on your own market.", body: "The fastest way to understand Yolias is to give it a real target.", primary: "Create account" },
  },
  ar: {
    eyebrow: "يولـياس AI",
    title: "مساعد اكتشاف يفهم لمن تبيع.",
    lead: "يولـياس AI هو المنتج كله: مكان واحد لتصف فيه السوق، وتتابع الحملة وهي تتشكّل، وتجمع صنّاع القرار المناسبين.",
    primary: "جرّب يولـياس",
    secondary: "اقرأ التوثيق",
    sections: [
      {
        title: "اكتب استراتيجية",
        body: "ابدأ من مربع الكتابة. اكتب أو تحدّث أو أرفق ملفًا — قائمة CSV بحسابات تعجبك، أو ملف PDF، أو لقطة شاشة لشركة تريد أمثالها.",
        points: ["إدخال صوتي بالعربية أو الإنجليزية", "حتى ثلاثة مرفقات في كل طلب", "أمثلة جاهزة لأسواق شائعة"],
      },
      {
        title: "يقرأ يولـياس ملف العميل المثالي",
        body: "يتحول طلبك إلى معايير منظمة. وما تركته مفتوحًا يُكمل مما أخبرت به يولـياس عن عملك، ويظهر كافتراض حتى تراه بوضوح.",
      },
      {
        title: "حملة تنفّذ المهمة",
        body: "تفتح كل استراتيجية حملة لها حصة مستهدفة. يتابع سجل النشاط كل مرحلة من التخطيط حتى التسليم، وتخبرك حالة الحملة أين وصلت.",
      },
      {
        title: "عملاء محتملون مع أدلتهم",
        body: "تعرض النتائج الشركة وعدد موظفيها وموقعها ومنصب الشخص. تُصنَّف قنوات التواصل حسب حالة التحقق، ويحتفظ كل سجل بالمصدر الذي جاء منه.",
      },
    ],
    icp: [
      { label: "السوق", value: "السعودية" },
      { label: "القطاع", value: "B2B SaaS" },
      { label: "حجم الشركة", value: "20–200 موظف" },
      { label: "المؤشرات", value: "توظيف: مبيعات، هندسة" },
      { label: "صنّاع القرار", value: "المؤسس، CEO، CTO" },
      { label: "افتراض", value: "هدف 100 شركة" },
    ],
    stages: ["فهم الطلب", "تخطيط المهمة", "العثور على الشركات", "العثور على صنّاع القرار", "الإثراء والتحقق", "التأهيل والتسليم"],
    prospects: [
      { name: "المؤسس والرئيس التنفيذي", role: "مدفوعات سحابية", company: "120 موظفًا · الرياض", match: "96%" },
      { name: "نائب الرئيس للهندسة", role: "برمجيات لوجستية", company: "85 موظفًا · جدة", match: "91%" },
      { name: "رئيس المبيعات", role: "منصة موارد بشرية", company: "160 موظفًا · الرياض", match: "88%" },
    ],
    more: {
      eyebrow: "حول المنتج الأساسي",
      title: "كل ما تحتاجه للعمل على القائمة.",
      tiles: [
        { title: "التحليلات", body: "العملاء المحتملون والشركات المكتشفة وصنّاع القرار ومعدل التطابق — حسب السوق، لآخر 7 أو 30 أو 90 يومًا." },
        { title: "التصدير", body: "فلتر العملاء المحفوظين حسب الحملة أو السوق أو نسبة التطابق، ونزّلهم كملف CSV لأدواتك." },
        { title: "الفريق", body: "مستخدمون غير محدودين في كل خطة، مع أدوار المالك والمسؤول والعضو لكل مساحة عمل." },
        { title: "السجل", body: "ثبّت الاستراتيجيات التي تعود إليها، وأعد تسميتها، أو احذف ما لم تعد تحتاجه." },
      ],
    },
    cta: { title: "جرّبه على سوقك أنت.", body: "أسرع طريقة لفهم يولـياس أن تعطيه هدفًا حقيقيًا.", primary: "إنشاء حساب" },
  },
};

export const about: Localized<{
  eyebrow: string; title: string; lead: string;
  storyTitle: string; story: string[];
  principlesEyebrow: string; principlesTitle: string; principles: { title: string; body: string }[];
  makerTitle: string; maker: string; makerLink: string;
  cta: { title: string; body: string; primary: string };
}> = {
  en: {
    eyebrow: "ABOUT YOLIAS",
    title: "Customer discovery should take minutes, not weeks.",
    lead: "Most B2B teams spend more time building lists than talking to customers. Yolias exists to reverse that ratio.",
    storyTitle: "Why we built it",
    story: [
      "Finding the right companies is slow work: searching directories, checking headcounts, guessing who decides, copying details into a sheet. By the time the list is ready, the market has moved and the team is tired of it.",
      "In the Gulf and the wider region the problem is sharper. Company data is scattered across sources, and most prospecting tools treat Arabic as an afterthought. We wanted a tool that understands a brief written the way founders and sales leads actually write — in either language — and does the research part properly.",
    ],
    principlesEyebrow: "WHAT WE BELIEVE",
    principlesTitle: "Four rules the product follows.",
    principles: [
      { title: "Discovery before outreach", body: "Yolias finds and qualifies. It does not send messages, run sequences or contact anyone in your name." },
      { title: "Fewer, better-matched prospects", body: "A short list with clear reasons beats a long one you have to clean. Match scores always show their evidence." },
      { title: "Arabic is a first language", body: "Every screen, email and answer works in Arabic and English, right-to-left and left-to-right." },
      { title: "Your data stays yours", body: "Workspaces are isolated, exports are yours, and deleting your account removes your discovered data." },
    ],
    makerTitle: "Built by Taysonsta",
    maker: "Yolias is a product of Taysonsta. The same team designs, builds and supports it.",
    makerLink: "Visit Taysonsta",
    cta: { title: "Questions about Yolias?", body: "Tell us what you are trying to sell and to whom — we read every message.", primary: "Contact us" },
  },
  ar: {
    eyebrow: "عن يولـياس",
    title: "اكتشاف العملاء يجب أن يستغرق دقائق، لا أسابيع.",
    lead: "تقضي معظم فرق B2B وقتًا في بناء القوائم أكثر مما تقضيه في التحدث مع العملاء. وُجد يولـياس ليعكس هذه المعادلة.",
    storyTitle: "لماذا بنيناه",
    story: [
      "العثور على الشركات المناسبة عمل بطيء: بحث في الأدلة، والتحقق من أعداد الموظفين، وتخمين من يملك القرار، ونسخ التفاصيل إلى جدول. وحين تجهز القائمة يكون السوق قد تغيّر والفريق قد ملّ منها.",
      "وفي الخليج والمنطقة تكون المشكلة أوضح. بيانات الشركات موزعة على مصادر كثيرة، ومعظم أدوات البحث عن العملاء تتعامل مع العربية كأمر ثانوي. أردنا أداة تفهم الطلب كما يكتبه المؤسسون ومديرو المبيعات فعلًا — بأي من اللغتين — وتنجز جزء البحث كما يجب.",
    ],
    principlesEyebrow: "ما نؤمن به",
    principlesTitle: "أربع قواعد يلتزم بها المنتج.",
    principles: [
      { title: "الاكتشاف قبل التواصل", body: "يجد يولـياس العملاء ويؤهلهم. لا يرسل رسائل ولا يدير حملات بريدية ولا يتواصل مع أحد باسمك." },
      { title: "عدد أقل ومطابقة أدق", body: "قائمة قصيرة بأسباب واضحة أفضل من قائمة طويلة تحتاج إلى تنظيف. نسب التطابق تعرض أدلتها دائمًا." },
      { title: "العربية لغة أولى", body: "كل شاشة وبريد وإجابة تعمل بالعربية والإنجليزية، من اليمين لليسار ومن اليسار لليمين." },
      { title: "بياناتك تبقى لك", body: "مساحات العمل معزولة، والتصدير ملكك، وحذف حسابك يحذف البيانات التي اكتشفتها." },
    ],
    makerTitle: "من تطوير Taysonsta",
    maker: "يولـياس منتج من Taysonsta. الفريق نفسه يصممه ويبنيه ويدعمه.",
    makerLink: "زيارة Taysonsta",
    cta: { title: "لديك أسئلة عن يولـياس؟", body: "أخبرنا ماذا تبيع ولمن — نقرأ كل رسالة.", primary: "تواصل معنا" },
  },
};

export const contactPage: Localized<{
  eyebrow: string; title: string; lead: string;
  ways: { title: string; body: string; link?: { label: string; href: string } }[];
  formTitle: string;
}> = {
  en: {
    eyebrow: "CONTACT",
    title: "Talk to the Yolias team.",
    lead: "Questions about plans, a problem in your workspace or an idea for a partnership — send it here and a person will reply.",
    ways: [
      { title: "Sales & plans", body: "Choosing between plans or monthly and annual billing.", link: { label: "Compare plans", href: "/pricing" } },
      { title: "Product support", body: "Most answers are already written up step by step.", link: { label: "Open the Help Center", href: "/help-center" } },
      { title: "Partnerships & press", body: "Data providers, agencies and media — pick the matching topic in the form." },
    ],
    formTitle: "Send us a message",
  },
  ar: {
    eyebrow: "تواصل",
    title: "تحدّث مع فريق يولـياس.",
    lead: "سؤال عن الخطط، أو مشكلة في مساحة عملك، أو فكرة شراكة — أرسلها هنا وسيرد عليك شخص من الفريق.",
    ways: [
      { title: "المبيعات والخطط", body: "للمساعدة في الاختيار بين الخطط أو بين الفوترة الشهرية والسنوية.", link: { label: "قارن الخطط", href: "/pricing" } },
      { title: "دعم المنتج", body: "معظم الإجابات مكتوبة بالفعل خطوة بخطوة.", link: { label: "افتح مركز المساعدة", href: "/help-center" } },
      { title: "الشراكات والإعلام", body: "مزودو البيانات والوكالات ووسائل الإعلام — اختر الموضوع المناسب في النموذج." },
    ],
    formTitle: "أرسل لنا رسالة",
  },
};
