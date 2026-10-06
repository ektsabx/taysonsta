import type { Doc, Localized } from "./types";

// Documentation: reference for how Yolias works. Task-style answers live in
// the Help Center. Numbers here mirror the code (lib/discovery/match.ts,
// lib/attachments.ts, lib/plans.ts).

export interface DocGroup {
  id: "start" | "core" | "workspace";
  title: Localized<string>;
}

export const docGroups: DocGroup[] = [
  { id: "start", title: { en: "Get started", ar: "البداية" } },
  { id: "core", title: { en: "Core concepts", ar: "المفاهيم الأساسية" } },
  { id: "workspace", title: { en: "Workspace", ar: "مساحة العمل" } },
];

export interface DocPage {
  slug: string;
  group: DocGroup["id"];
  doc: Localized<Doc>;
}

export const docs: DocPage[] = [
  {
    slug: "tour",
    group: "start",
    doc: {
      en: {
        title: "A tour of Yolias",
        summary: "Real screens of Yolias, step by step: a search, its results, Prospects, a person, campaigns, Yolias AI and outreach.",
        blocks: [
          { p: "These are real screenshots of Yolias with example data. The numbers on each picture match the list under it." },
          { h2: "1. Describe who you want to sell to" },
          { figure: { src: "/docs/shots/en-search.png", alt: "A search and its result card", caption: "A search: what you asked for, and what Yolias found.", marks: [
            { x: 55, y: 30, label: "Your request, in your own words (Arabic or English)." },
            { x: 42, y: 57, label: "The campaign's status and the best match score." },
            { x: 31, y: 68, label: "The best matching company." },
            { x: 74, y: 70, label: "Its decision makers. Contact details stay masked until you reveal them." },
            { x: 81, y: 88, label: "Save the results to Prospects." },
          ] } },
          { h2: "2. Work your results in Prospects" },
          { figure: { src: "/docs/shots/en-prospects.png", alt: "The Prospects workspace", caption: "Prospects: one tab per kind of result.", marks: [
            { x: 30, y: 14, label: "People, Companies, Local Businesses and Jobs, with counts." },
            { x: 36, y: 24, label: "Search, filter by campaign, market and match, and sort." },
            { x: 25, y: 38, label: "Select rows — or every matching row across pages — to export, reveal contacts or prepare emails." },
            { x: 67, y: 45, label: "Email, phone and LinkedIn when they were found." },
            { x: 93, y: 6, label: "Export the tab as CSV, exactly as filtered." },
          ] } },
          { h2: "3. Open a person" },
          { figure: { src: "/docs/shots/en-person.png", alt: "A person's page", caption: "A person: who they are, their company, outreach, and where every field came from (source, date, confidence, missing data)." } },
          { h2: "4. Keep a campaign running" },
          { figure: { src: "/docs/shots/en-campaign.png", alt: "A campaign dashboard", caption: "A campaign: progress toward its goal, schedule and every run.", marks: [
            { x: 83, y: 6, label: "Run now, pause, stop, or change the goal, deadline and schedule." },
            { x: 37, y: 20, label: "Overview, results, runs, activity and the campaign's chat." },
            { x: 37, y: 27, label: "Progress toward the goal and the prospects used." },
            { x: 97, y: 24, label: "The deadline and the days left." },
            { x: 25, y: 70, label: "What each day delivered." },
          ] } },
          { h2: "5. Ask Yolias AI" },
          { figure: { src: "/docs/shots/en-chat.png", alt: "A new chat with Yolias AI", caption: "Chats: private or shared with your workspace. Yolias AI answers from your real data and shows what it's doing while it works." } },
          { h2: "6. Reach out from your own mailbox" },
          { figure: { src: "/docs/shots/en-outreach.png", alt: "The Outreach page", caption: "Outreach: connect Gmail or Outlook, then review each email Yolias prepared before it's sent from your mailbox." } },
        ],
      },
      ar: {
        title: "جولة في يولـياس",
        summary: "شاشات يولـياس الحقيقية خطوة بخطوة: البحث ونتائجه والعملاء المحتملون والشخص والحملات و Yolias AI والتواصل.",
        blocks: [
          { p: "هذه صور حقيقية من يولـياس ببيانات مثال. الأرقام على كل صورة تطابق القائمة تحتها." },
          { h2: "1. صِف من تريد أن تبيع له" },
          { figure: { src: "/docs/shots/ar-search.png", alt: "بحث وبطاقة نتيجته", caption: "البحث: ما طلبته وما وجده يولـياس.", marks: [
            { x: 55, y: 30, label: "طلبك بكلماتك (بالعربية أو الإنجليزية)." },
            { x: 42, y: 57, label: "حالة الحملة وأعلى نسبة تطابق." },
            { x: 31, y: 68, label: "الشركة الأكثر تطابقًا." },
            { x: 74, y: 70, label: "صناع القرار فيها. بيانات التواصل مخفية حتى تُظهرها." },
            { x: 81, y: 88, label: "احفظ النتائج في العملاء المحتملين." },
          ] } },
          { h2: "2. اعمل على نتائجك في العملاء المحتملين" },
          { figure: { src: "/docs/shots/ar-prospects.png", alt: "مساحة العملاء المحتملين", caption: "العملاء المحتملون: تبويب لكل نوع من النتائج.", marks: [
            { x: 30, y: 14, label: "الأشخاص والشركات والأنشطة المحلية والوظائف مع أعدادها." },
            { x: 36, y: 24, label: "ابحث وصفِّ حسب الحملة والسوق والتطابق ورتّب." },
            { x: 25, y: 38, label: "حدّد الصفوف — أو كل الصفوف المطابقة في كل الصفحات — للتصدير أو إظهار بيانات التواصل أو تجهيز الرسائل." },
            { x: 67, y: 45, label: "البريد والهاتف ولينكدإن عند العثور عليها." },
            { x: 93, y: 6, label: "صدّر التبويب كملف CSV كما هو مصفّى." },
          ] } },
          { h2: "3. افتح صفحة شخص" },
          { figure: { src: "/docs/shots/ar-person.png", alt: "صفحة شخص", caption: "الشخص: من هو وشركته والتواصل معه ومصدر كل حقل (المصدر والتاريخ والثقة والبيانات الناقصة)." } },
          { h2: "4. حملة تعمل باستمرار" },
          { figure: { src: "/docs/shots/ar-campaign.png", alt: "لوحة حملة", caption: "الحملة: التقدم نحو الهدف والجدولة وكل تشغيل.", marks: [
            { x: 83, y: 6, label: "شغّل الآن أو أوقف مؤقتًا أو أنهِ، أو غيّر الهدف والموعد والجدولة." },
            { x: 37, y: 20, label: "نظرة عامة والنتائج والتشغيلات والنشاط ومحادثة الحملة." },
            { x: 37, y: 27, label: "التقدم نحو الهدف والعملاء المحتملون المستخدمون." },
            { x: 97, y: 24, label: "الموعد النهائي والأيام المتبقية." },
            { x: 25, y: 70, label: "ما تم تسليمه كل يوم." },
          ] } },
          { h2: "5. اسأل Yolias AI" },
          { figure: { src: "/docs/shots/ar-chat.png", alt: "محادثة جديدة مع Yolias AI", caption: "المحادثات: خاصة أو مشتركة مع مساحة العمل. يجيب Yolias AI من بياناتك الحقيقية ويُظهر ما يفعله أثناء العمل." } },
          { h2: "6. تواصل من بريدك أنت" },
          { figure: { src: "/docs/shots/ar-outreach.png", alt: "صفحة التواصل", caption: "التواصل: اربط Gmail أو Outlook، وراجع كل رسالة جهّزها يولـياس قبل إرسالها من بريدك." } },
        ],
      },
    },
  },
  {
    slug: "introduction",
    group: "start",
    doc: {
      en: {
        title: "Introduction",
        summary: "What Yolias is, and the path every request takes through it.",
        blocks: [
          { p: "Yolias is an autonomous customer-discovery product for B2B teams. You describe the customers you want; Yolias turns that into structured criteria, runs a discovery campaign and returns matching companies and decision makers." },
          { h2: "The flow" },
          { table: { head: ["Step", "What happens", "Where you see it"], rows: [
            ["Search", "You write a request in plain language", "Yolias AI"],
            ["Customer profile", "Yolias extracts criteria and assumptions", "The result card under the prompt"],
            ["Campaign", "A discovery mission with a target and activity log", "Campaigns"],
            ["Prospects", "Matched decision makers you choose to keep", "Prospects"],
          ] } },
          { h2: "What Yolias does not do" },
          { p: "Yolias stops at discovery. It doesn’t send emails or messages, run sequences, or act as a CRM — you take the prospects into the tools you already use." },
          { p: "Next: [Quickstart](/docs/quickstart)." },
        ],
      },
      ar: {
        title: "مقدمة",
        summary: "ما هو يولـياس، والمسار الذي يمر به كل طلب.",
        blocks: [
          { p: "يولـياس منتج لاكتشاف العملاء بشكل مستقل لفرق B2B. تصف العملاء الذين تريدهم، فيحوّل يولـياس الوصف إلى معايير منظمة، ويشغّل حملة اكتشاف، ويعيد الشركات وصنّاع القرار المطابقين." },
          { h2: "المسار" },
          { table: { head: ["المرحلة", "ما يحدث", "أين تراه"], rows: [
            ["البحث", "تكتب طلبك بلغة طبيعية", "يولـياس AI"],
            ["ملف العميل المثالي", "يستخرج يولـياس المعايير والافتراضات", "بطاقة النتيجة أسفل مربع الكتابة"],
            ["الحملة", "مهمة اكتشاف لها هدف وسجل نشاط", "الحملات"],
            ["العملاء المحتملون", "صنّاع القرار المطابقون الذين تختار الاحتفاظ بهم", "العملاء المحتملون"],
          ] } },
          { h2: "ما لا يفعله يولـياس" },
          { p: "يتوقف يولـياس عند الاكتشاف. لا يرسل بريدًا أو رسائل، ولا يدير حملات تواصل، وليس نظام CRM — أنت من ينقل العملاء المحتملين إلى أدواتك الحالية." },
          { p: "التالي: [البدء السريع](/docs/quickstart)." },
        ],
      },
    },
  },
  {
    slug: "quickstart",
    group: "start",
    doc: {
      en: {
        title: "Quickstart",
        summary: "From a new account to your first campaign in four steps.",
        blocks: [
          { ol: [
            "**Create your account.** Enter your work email on [Create account](/signup) and open the magic link.",
            "**Choose a plan.** Start on Free, or pick Pro or Growth with a monthly or annual period.",
            "**Tell Yolias about your business.** Onboarding asks for your name, company, website and what you sell. This becomes permanent context for every search, so be specific about the problem you solve.",
            "**Run your first search.** In Yolias AI, describe who you want to sell to and press Enter.",
          ] },
          { p: "A good first search names a market, an industry or business type, a company size and the roles you want to reach. See [Searches](/docs/searches) for examples." },
        ],
      },
      ar: {
        title: "البدء السريع",
        summary: "من حساب جديد إلى أول حملة في أربع خطوات.",
        blocks: [
          { ol: [
            "**أنشئ حسابك.** أدخل بريد العمل في [إنشاء حساب](/signup) وافتح الرابط السحري.",
            "**اختر خطة.** ابدأ بالخطة المجانية، أو اختر برو أو النمو بفترة شهرية أو سنوية.",
            "**عرّف يولـياس بعملك.** يطلب الإعداد الأولي اسمك وشركتك وموقعك وما تبيعه. يصبح ذلك سياقًا دائمًا لكل بحث، فكن محددًا في وصف المشكلة التي تحلها.",
            "**ابدأ أول بحث.** في يولـياس AI صِف لمن تريد أن تبيع واضغط Enter.",
          ] },
          { p: "البحث الأول الجيد يحدد سوقًا وقطاعًا أو نوع نشاط وحجم شركة والمناصب التي تريد الوصول إليها. راجع [عمليات البحث](/docs/searches) للأمثلة." },
        ],
      },
    },
  },
  {
    slug: "searches",
    group: "core",
    doc: {
      en: {
        title: "Searches",
        summary: "How to write requests Yolias understands, and what you can attach.",
        blocks: [
          { p: "A search is one request in Yolias AI. Each search creates one campaign and appears in the sidebar history, where you can pin, rename or delete it." },
          { h2: "What to include" },
          { table: { head: ["Detail", "Example"], rows: [
            ["How many", "“Find 80 companies…”"],
            ["Market", "“…in Saudi Arabia and the UAE…”"],
            ["Industry or type", "“…B2B SaaS and fintech…”"],
            ["Size", "“…with 20–200 employees…”"],
            ["Signals", "“…that are hiring sales roles or raised a Series A…”"],
            ["People", "“…and reach founders or heads of sales.”"],
          ] } },
          { p: "Write in Arabic or English, or mix both. Press **Enter** to send and **Shift + Enter** for a new line. Requests can be up to 4,000 characters." },
          { h2: "Files and images" },
          { ul: [
            "**Images** — PNG, JPEG, GIF or WebP, e.g. a screenshot of a company you want more of.",
            "**Files** — PDF, CSV, TXT, MD or TSV, e.g. an ICP brief or a list of current customers.",
            "Up to three attachments per search, 4 MB each. Files are read to understand the request and are not stored.",
          ] },
        ],
      },
      ar: {
        title: "عمليات البحث",
        summary: "كيف تكتب طلبات يفهمها يولـياس، وما الذي يمكنك إرفاقه.",
        blocks: [
          { p: "البحث طلب واحد في يولـياس AI. ينشئ كل بحث حملة واحدة ويظهر في سجل الشريط الجانبي، حيث يمكنك تثبيته أو إعادة تسميته أو حذفه." },
          { h2: "ما الذي تكتبه" },
          { table: { head: ["التفصيل", "مثال"], rows: [
            ["العدد", "«ابحث عن 80 شركة…»"],
            ["السوق", "«…في السعودية والإمارات…»"],
            ["القطاع أو النوع", "«…B2B SaaS وتقنية مالية…»"],
            ["الحجم", "«…بها 20–200 موظف…»"],
            ["المؤشرات", "«…توظّف في المبيعات أو أغلقت جولة Series A…»"],
            ["الأشخاص", "«…وأريد الوصول إلى المؤسسين أو رؤساء المبيعات.»"],
          ] } },
          { p: "اكتب بالعربية أو الإنجليزية أو امزج بينهما. اضغط **Enter** للإرسال و**Shift + Enter** لسطر جديد. الحد الأقصى للطلب 4,000 حرف." },
          { h2: "الملفات والصور" },
          { ul: [
            "**الصور** — PNG أو JPEG أو GIF أو WebP، مثل لقطة شاشة لشركة تريد أمثالها.",
            "**الملفات** — PDF أو CSV أو TXT أو MD أو TSV، مثل وصف ICP أو قائمة عملائك الحاليين.",
            "حتى ثلاثة مرفقات لكل بحث، 4 ميجابايت لكل منها. تُقرأ الملفات لفهم الطلب ولا تُخزن.",
          ] },
        ],
      },
    },
  },
  {
    slug: "customer-profile",
    group: "core",
    doc: {
      en: {
        title: "Customer profile (ICP)",
        summary: "The criteria Yolias extracts from a search, and how it fills gaps.",
        blocks: [
          { p: "Yolias AI reads your search together with your onboarding context and produces an ideal customer profile. The campaign uses it as its criteria." },
          { h2: "Fields" },
          { table: { head: ["Field", "Notes"], rows: [
            ["Campaign name & summary", "Written in your interface language"],
            ["Target", "A number of companies or prospects; 100 when not stated"],
            ["Countries & cities", "Countries default to your Settings country when not stated"],
            ["Industries & keywords", "What matching companies do"],
            ["Company size", "Minimum and/or maximum employees"],
            ["Job titles & seniority", "Founder, C-level, VP, director, head, manager"],
            ["Signals", "Hiring (and for which roles), funding stages, technologies"],
            ["Exclusions", "Companies or traits to leave out"],
            ["Assumptions", "Every default Yolias chose because the request didn’t say"],
          ] } },
          { p: "If no titles are given, Yolias infers relevant decision makers from what you sell. To change any criterion, start a new search that states it explicitly." },
        ],
      },
      ar: {
        title: "ملف العميل المثالي (ICP)",
        summary: "المعايير التي يستخرجها يولـياس من البحث، وكيف يكمل الناقص.",
        blocks: [
          { p: "يقرأ يولـياس AI بحثك مع سياق الإعداد الأولي وينتج ملف العميل المثالي. وتستخدمه الحملة معاييرَ لها." },
          { h2: "الحقول" },
          { table: { head: ["الحقل", "ملاحظات"], rows: [
            ["اسم الحملة والملخص", "يُكتبان بلغة الواجهة"],
            ["الهدف", "عدد شركات أو عملاء محتملين؛ 100 إذا لم يُحدد"],
            ["الدول والمدن", "الدولة الافتراضية هي دولة الإعدادات إذا لم تُحدد"],
            ["القطاعات والكلمات المفتاحية", "ما تعمل فيه الشركات المطابقة"],
            ["حجم الشركة", "الحد الأدنى و/أو الأقصى للموظفين"],
            ["المسميات والمستوى الوظيفي", "مؤسس، إدارة تنفيذية، نائب رئيس، مدير، رئيس قسم، مدير فريق"],
            ["المؤشرات", "التوظيف (ولأي أدوار)، جولات التمويل، التقنيات"],
            ["الاستثناءات", "شركات أو صفات يجب استبعادها"],
            ["الافتراضات", "كل قيمة افتراضية اختارها يولـياس لأن الطلب لم يذكرها"],
          ] } },
          { p: "إذا لم تُذكر مسميات، يستنتج يولـياس صنّاع القرار المناسبين مما تبيعه. لتغيير أي معيار أرسل بحث جديد تذكره صراحة." },
        ],
      },
    },
  },
  {
    slug: "campaigns",
    group: "core",
    doc: {
      en: {
        title: "Campaigns",
        summary: "Discovery missions: their stages, statuses and activity log.",
        blocks: [
          { p: "A campaign is the mission created from a search: the criteria, a target quota, the results and a log of what Yolias did. Open **Campaigns** to see them all; selecting one opens its search." },
          { h2: "Stages" },
          { ol: ["Understand the request", "Plan the mission", "Find companies", "Find decision makers", "Enrich & verify contact details", "Qualify, score and deliver"] },
          { h2: "Statuses" },
          { table: { head: ["Status", "Meaning"], rows: [
            ["Active", "Queued or running — results are being collected"],
            ["Awaiting data source", "Criteria are ready; no company data source is connected yet"],
            ["Completed", "The mission finished and delivered its results"],
            ["Paused", "Stopped for now; criteria and results are kept"],
            ["Failed", "Discovery stopped with an error shown in the activity log"],
          ] } },
          { p: "The latest activity entry is shown at the bottom of the result card in Yolias AI." },
        ],
      },
      ar: {
        title: "الحملات",
        summary: "مهام الاكتشاف: مراحلها وحالاتها وسجل نشاطها.",
        blocks: [
          { p: "الحملة هي المهمة التي تُنشأ من البحث: المعايير وحصة مستهدفة والنتائج وسجل لما فعله يولـياس. افتح **الحملات** لرؤيتها كلها؛ واختيار إحداها يفتح استراتيجيتها." },
          { h2: "المراحل" },
          { ol: ["فهم الطلب", "تخطيط المهمة", "العثور على الشركات", "العثور على صنّاع القرار", "إثراء بيانات التواصل والتحقق منها", "التأهيل والتقييم والتسليم"] },
          { h2: "الحالات" },
          { table: { head: ["الحالة", "المعنى"], rows: [
            ["نشطة", "في الانتظار أو قيد التشغيل — تُجمع النتائج"],
            ["بانتظار مصدر بيانات", "المعايير جاهزة؛ ولا يوجد مصدر بيانات للشركات متصل بعد"],
            ["مكتملة", "انتهت المهمة وسلّمت نتائجها"],
            ["متوقفة مؤقتًا", "متوقفة حاليًا؛ مع الاحتفاظ بالمعايير والنتائج"],
            ["فشلت", "توقف الاكتشاف بخطأ يظهر في سجل النشاط"],
          ] } },
          { p: "يظهر آخر نشاط أسفل بطاقة النتيجة في يولـياس AI." },
        ],
      },
    },
  },
  {
    slug: "prospects",
    group: "core",
    doc: {
      en: {
        title: "Prospects",
        summary: "What a prospect record contains, how the match score works, and the export format.",
        blocks: [
          { p: "Prospects are the decision makers a campaign delivers. They join your **Prospects** list when you press **Save to Prospects** on the search." },
          { h2: "Match score" },
          { p: "The score (0–100%) compares a prospect and their company with the criteria you actually specified. Criteria you left open are skipped, so they never lower the score." },
          { table: { head: ["Criterion", "Weight"], rows: [
            ["Market (country)", "20"], ["Industry or keywords", "25"], ["Company size", "20"],
            ["Hiring", "10"], ["Funding stage", "5"], ["Decision-maker title or seniority", "20"],
          ] } },
          { h2: "Contact channels" },
          { p: "Email, phone and LinkedIn appear only when found. Email shows a ✓ when verified; unverified emails are labelled as such, and invalid ones are hidden." },
          { h2: "CSV columns" },
          { p: "Name, Title, Company, Employees, City, Country, Campaign, Email, Email status, Phone, LinkedIn, ICP match %." },
        ],
      },
      ar: {
        title: "العملاء المحتملون",
        summary: "محتوى سجل العميل المحتمل، وطريقة حساب نسبة التطابق، وصيغة التصدير.",
        blocks: [
          { p: "العملاء المحتملون هم صنّاع القرار الذين تسلّمهم الحملة. ينضمون إلى قائمة **العملاء المحتملون** عند الضغط على **حفظ في العملاء المحتملين** في البحث." },
          { h2: "نسبة التطابق" },
          { p: "تقارن النسبة (0–100%) العميل المحتمل وشركته بالمعايير التي حددتها فعلًا. المعايير التي تركتها مفتوحة لا تُحتسب، فلا تخفض النسبة أبدًا." },
          { table: { head: ["المعيار", "الوزن"], rows: [
            ["السوق (الدولة)", "20"], ["القطاع أو الكلمات المفتاحية", "25"], ["حجم الشركة", "20"],
            ["التوظيف", "10"], ["جولة التمويل", "5"], ["مسمى صانع القرار أو مستواه", "20"],
          ] } },
          { h2: "قنوات التواصل" },
          { p: "يظهر البريد والهاتف ولينكدإن فقط عند العثور عليها. يحمل البريد علامة ✓ عند التحقق منه، ويُوصف البريد غير المتحقق منه بذلك، ويُخفى البريد غير الصالح." },
          { h2: "أعمدة ملف CSV" },
          { p: "الاسم، المسمى الوظيفي، الشركة، عدد الموظفين، المدينة، الدولة، الحملة، البريد، حالة البريد، الهاتف، لينكدإن، نسبة تطابق ICP." },
        ],
      },
    },
  },
  {
    slug: "analytics",
    group: "workspace",
    doc: {
      en: {
        title: "Analytics",
        summary: "The four discovery metrics and the market breakdown.",
        blocks: [
          { p: "Analytics covers the last 7, 30 or 90 days for the whole workspace." },
          { table: { head: ["Metric", "Definition"], rows: [
            ["Prospects found", "Prospects discovered in the period, with the share whose email is verified"],
            ["Companies discovered", "Companies added to campaigns in the period"],
            ["Decision makers extracted", "Prospects at founder, C-level, VP, director or head level"],
            ["Qualified fit rate", "Share of scored prospects with a match of 70% or more"],
          ] } },
          { p: "**Discovery volume by market** groups prospects by country, largest first." },
        ],
      },
      ar: {
        title: "التحليلات",
        summary: "مؤشرات الاكتشاف الأربعة وتوزيع الأسواق.",
        blocks: [
          { p: "تغطي التحليلات آخر 7 أو 30 أو 90 يومًا لمساحة العمل كلها." },
          { table: { head: ["المؤشر", "التعريف"], rows: [
            ["العملاء المحتملون", "العملاء المكتشفون في الفترة، مع نسبة من تم التحقق من بريدهم"],
            ["الشركات المكتشفة", "الشركات المضافة إلى الحملات في الفترة"],
            ["صنّاع القرار المستخرجون", "العملاء بمستوى مؤسس أو إدارة تنفيذية أو نائب رئيس أو مدير أو رئيس قسم"],
            ["معدل التطابق المؤهل", "نسبة العملاء المقيّمين الذين بلغ تطابقهم 70% أو أكثر"],
          ] } },
          { p: "**حجم الاكتشاف حسب السوق** يجمع العملاء المحتملين حسب الدولة، من الأكبر إلى الأصغر." },
        ],
      },
    },
  },
  {
    slug: "team-and-roles",
    group: "workspace",
    doc: {
      en: {
        title: "Team and roles",
        summary: "Who can do what inside a workspace.",
        blocks: [
          { table: { head: ["Action", "Owner", "Admin", "Member"], rows: [
            ["Run searches, view campaigns and prospects", "✓", "✓", "✓"],
            ["Save and export prospects", "✓", "✓", "✓"],
            ["Invite and remove members", "✓", "✓", "—"],
            ["Choose or change the plan", "✓", "✓", "—"],
            ["Be removed by others", "—", "✓", "✓"],
          ] } },
          { p: "Every plan includes unlimited users. The person who creates the workspace is its owner." },
        ],
      },
      ar: {
        title: "الفريق والأدوار",
        summary: "من يستطيع فعل ماذا داخل مساحة العمل.",
        blocks: [
          { table: { head: ["الإجراء", "المالك", "المسؤول", "العضو"], rows: [
            ["إجراء عمليات البحث وعرض الحملات والعملاء", "✓", "✓", "✓"],
            ["حفظ العملاء المحتملين وتصديرهم", "✓", "✓", "✓"],
            ["دعوة الأعضاء وإزالتهم", "✓", "✓", "—"],
            ["اختيار الخطة أو تغييرها", "✓", "✓", "—"],
            ["إمكانية إزالته من الآخرين", "—", "✓", "✓"],
          ] } },
          { p: "كل الخطط تشمل مستخدمين غير محدودين. ومن ينشئ مساحة العمل هو مالكها." },
        ],
      },
    },
  },
  {
    slug: "plans-and-usage",
    group: "workspace",
    doc: {
      en: {
        title: "Plans and usage",
        summary: "Monthly limits per plan and how they are counted.",
        blocks: [
          { table: { head: ["Plan", "Monthly price", "Prospects / month"], rows: [
            ["Free", "$0", "50"], ["Pro", "$20", "1,000"], ["Growth", "$50", "3,000"],
          ] } },
          { ul: [
            "Plans count prospects only. One prospect is one target decision maker delivered with a verified email and company data, plus a phone number when available.",
            "Companies, searches and AI work are not counted.",
            "When the month’s prospects are used up, discovery pauses until the reset or an upgrade.",
            "Counters reset on the first day of every month (UTC), for monthly and annual billing alike.",
            "Annual billing costs twelve times the monthly price.",
          ] },
          { p: "Current usage is in Settings → Usage." },
        ],
      },
      ar: {
        title: "الخطط والاستخدام",
        summary: "الحدود الشهرية لكل خطة وطريقة احتسابها.",
        blocks: [
          { table: { head: ["الخطة", "السعر الشهري", "العملاء المحتملون شهريًا"], rows: [
            ["المجانية", "$0", "50"], ["برو", "$20", "1,000"], ["النمو", "$50", "3,000"],
          ] } },
          { ul: [
            "تُحسب الخطط بالعملاء المحتملين فقط. العميل المحتمل هو صانع قرار مستهدف واحد يُسلَّم مع بريد موثّق وبيانات الشركة، ورقم هاتف عند توفره.",
            "لا تُحسب الشركات أو عمليات البحث أو عمل الذكاء الاصطناعي.",
            "عند استخدام كل العملاء المحتملين للشهر، يتوقف الاكتشاف حتى التجديد أو الترقية.",
            "تتجدد العدادات في أول يوم من كل شهر (بتوقيت UTC)، للفوترة الشهرية والسنوية على حد سواء.",
            "الفوترة السنوية تساوي اثني عشر ضعف السعر الشهري.",
          ] },
          { p: "تجد استخدامك الحالي في الإعدادات ← الاستخدام." },
        ],
      },
    },
  },
];
