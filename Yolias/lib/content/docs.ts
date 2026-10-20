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
        summary: "Real screens of Yolias, step by step: a search, its results, Prospects, a person, Yolias AI and outreach.",
        blocks: [
          { p: "These are real screenshots of Yolias with example data. The numbers on each picture match the list under it." },
          { h2: "1. Describe who you want to sell to" },
          { figure: { src: "/docs/shots/en-search.png", alt: "A search in Yolias AI", caption: "A search is one conversation: your request, what Yolias found, and every follow-up in the same thread.", marks: [
            { x: 76, y: 10, label: "Your request, in your own words (Arabic or English)." },
            { x: 50, y: 17, label: "The search's status and the best match score." },
            { x: 38, y: 28, label: "Who Yolias understood you want." },
            { x: 72, y: 37, label: "The best matches. Contact details stay masked until you reveal them." },
            { x: 77, y: 56, label: "Save the results to Prospects." },
            { x: 59, y: 89, label: "Ask Yolias AI about this search, right here in the same conversation." },
          ] } },
          { h2: "2. Work your results in Prospects" },
          { figure: { src: "/docs/shots/en-prospects.png", alt: "The Prospects workspace", caption: "Prospects: one tab per kind of result.", marks: [
            { x: 30, y: 14, label: "People, Companies and Local Businesses, with counts." },
            { x: 36, y: 24, label: "Search, filter by type, market and match, and sort." },
            { x: 25, y: 38, label: "Select rows, or every matching row across pages, to export, reveal contacts or prepare emails." },
            { x: 67, y: 45, label: "Email, phone and LinkedIn when they were found." },
            { x: 93, y: 6, label: "Export the tab as CSV, exactly as filtered." },
          ] } },
          { h2: "3. Open a person" },
          { figure: { src: "/docs/shots/en-person.png", alt: "A person's page", caption: "A person: who they are, their company, outreach, and where every field came from (source, date, confidence, missing data)." } },
          { h2: "4. Ask Yolias AI" },
          { p: "Every search is a conversation with Yolias AI. Ask it to refine the search, explain a result, check progress, find decision makers or write a message. The reply appears in the same thread, with what Yolias is doing while it works. Your conversations are your Recent searches in the sidebar." },
          { h2: "5. Reach out from your own mailbox" },
          { p: "Connect your mailbox (Gmail, Outlook or any IMAP/SMTP account) in Settings → Integrations. Select people in Prospects and choose Send: Yolias creates a campaign and writes a personal email for each person on the campaign page. Review them, then approve sending: Yolias sends from your mailbox and replies arrive in your Inbox. Or export to CSV." },
          { p: "To reach many people at once, select them in Prospects and choose **Send**: name the campaign and pick the channel, and Yolias creates an outreach campaign, starts it and prepares the first messages for you to review and send. You can also start a campaign in Outreach from one of your searches: its prospects join and the first messages are prepared." },
        ],
      },
      ar: {
        title: "جولة في يولـياس",
        summary: "شاشات يولـياس الحقيقية خطوة بخطوة: البحث ونتائجه والعملاء المحتملون والشخص و Yolias AI والتواصل.",
        blocks: [
          { p: "هذه صور حقيقية من يولـياس ببيانات مثال. الأرقام على كل صورة تطابق القائمة تحتها." },
          { h2: "1. صِف من تريد أن تبيع له" },
          { figure: { src: "/docs/shots/ar-search.png", alt: "بحث في Yolias AI", caption: "البحث محادثة واحدة: طلبك، وما وجده يولـياس، وكل سؤال بعده في نفس المحادثة.", marks: [
            { x: 24, y: 10, label: "طلبك بكلماتك (بالعربية أو الإنجليزية)." },
            { x: 53, y: 17, label: "حالة البحث وأعلى نسبة تطابق." },
            { x: 52, y: 28, label: "من فهم يولـياس أنك تريده." },
            { x: 28, y: 37, label: "أفضل النتائج. بيانات التواصل مخفية حتى تُظهرها." },
            { x: 25, y: 56, label: "احفظ النتائج في العملاء المحتملين." },
            { x: 41, y: 89, label: "اسأل Yolias AI عن هذا البحث هنا في نفس المحادثة." },
          ] } },
          { h2: "2. اعمل على نتائجك في العملاء المحتملين" },
          { figure: { src: "/docs/shots/ar-prospects.png", alt: "مساحة العملاء المحتملين", caption: "العملاء المحتملون: تبويب لكل نوع من النتائج.", marks: [
            { x: 30, y: 14, label: "الأشخاص والشركات والأنشطة المحلية مع أعدادها." },
            { x: 36, y: 24, label: "ابحث وصفِّ حسب النوع والسوق والتطابق ورتّب." },
            { x: 25, y: 38, label: "حدّد الصفوف، أو كل الصفوف المطابقة في كل الصفحات، للتصدير أو إظهار بيانات التواصل أو تجهيز الرسائل." },
            { x: 67, y: 45, label: "البريد والهاتف ولينكدإن عند العثور عليها." },
            { x: 93, y: 6, label: "صدّر التبويب كملف CSV كما هو مصفّى." },
          ] } },
          { h2: "3. افتح صفحة شخص" },
          { figure: { src: "/docs/shots/ar-person.png", alt: "صفحة شخص", caption: "الشخص: من هو وشركته والتواصل معه ومصدر كل حقل (المصدر والتاريخ والثقة والبيانات الناقصة)." } },
          { h2: "4. اسأل Yolias AI" },
          { p: "كل بحث محادثة مع Yolias AI. اطلب منه تعديل البحث، أو شرح نتيجة، أو متابعة التقدّم، أو إيجاد صناع القرار، أو كتابة رسالة، ويظهر الرد في نفس المحادثة مع ما يفعله يولـياس أثناء العمل. محادثاتك هي «عمليات البحث الأخيرة» في القائمة الجانبية." },
          { h2: "5. تواصل من بريدك" },
          { p: "اربط بريدك (Gmail أو Outlook أو أي بريد IMAP/SMTP) من الإعدادات ← التكاملات. حدّد الأشخاص في العملاء المحتملين واختر إرسال: ينشئ يولـياس حملة تواصل ويكتب رسالة شخصية لكل شخص في صفحة الحملة. راجعها ثم وافق على الإرسال، فيرسلها يولـياس من بريدك وتصل الردود إلى صندوق الوارد. أو صدّرهم كملف CSV." },
          { p: "للتواصل مع كثيرين مرة واحدة، حدّدهم في العملاء المحتملين واختر **إرسال**: سمِّ الحملة واختر القناة، فينشئ يولـياس حملة تواصل ويبدأها ويجهّز الرسائل الأولى لتراجعها وترسلها. ويمكنك أيضًا بدء حملة من صفحة التواصل انطلاقًا من أحد عمليات البحث: ينضم عملاؤها المحتملون وتُجهَّز الرسائل الأولى." },
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
          { p: "Yolias is an autonomous customer-discovery product for B2B teams. You describe the customers you want; Yolias turns that into structured criteria, runs a search and returns matching companies and decision makers." },
          { h2: "The flow" },
          { table: { head: ["Step", "What happens", "Where you see it"], rows: [
            ["Search", "You write a request in plain language", "Yolias AI"],
            ["Customer profile", "Yolias extracts criteria and assumptions", "The result card under the prompt"],
            ["Results", "Matching companies and decision makers, each with why it fits", "The result card in the conversation"],
            ["Prospects", "Matched decision makers you choose to keep", "Prospects"],
          ] } },
          { h2: "What Yolias does and doesn’t do" },
          { p: "Yolias finds prospects, prepares campaigns, sends them from your own mailbox (Gmail, Outlook or any IMAP/SMTP account) once you approve, reads the replies in the threads it started, sorts them and keeps your CRM up to date. It never sends without your approval, never sends from an account you didn’t connect, and never messages anyone on LinkedIn." },
          { p: "Next: [Quickstart](/docs/quickstart)." },
        ],
      },
      ar: {
        title: "مقدمة",
        summary: "ما هو يولـياس، والمسار الذي يمر به كل طلب.",
        blocks: [
          { p: "يولـياس منتج لاكتشاف العملاء بشكل مستقل لفرق B2B. تصف العملاء الذين تريدهم، فيحوّل يولـياس الوصف إلى معايير منظمة، ويشغّل بحث، ويعيد الشركات وصنّاع القرار المطابقين." },
          { h2: "المسار" },
          { table: { head: ["المرحلة", "ما يحدث", "أين تراه"], rows: [
            ["البحث", "تكتب طلبك بلغة طبيعية", "يولـياس AI"],
            ["ملف العميل المثالي", "يستخرج يولـياس المعايير والافتراضات", "بطاقة النتيجة أسفل مربع الكتابة"],
            ["النتائج", "الشركات وصنّاع القرار المطابقون مع سبب تطابق كل منهم", "بطاقة النتيجة في المحادثة"],
            ["العملاء المحتملون", "صنّاع القرار المطابقون الذين تختار الاحتفاظ بهم", "العملاء المحتملون"],
          ] } },
          { h2: "ما لا يفعله يولـياس" },
          { p: "يجد يولـياس العملاء المحتملين، ويجهّز الحملات، ويرسلها من بريدك (Gmail أو Outlook أو أي بريد IMAP/SMTP) بعد موافقتك، ويقرأ الردود في المحادثات التي بدأها ويصنّفها، ويحدّث إدارة العملاء. لا يرسل أبدًا بدون موافقتك، ولا من حساب لم تربطه، ولا يرسل رسائل على LinkedIn." },
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
        summary: "From a new account to your first search in four steps.",
        blocks: [
          { ol: [
            "**Create your account.** Enter your work email on [Create account](/signup) and open the magic link.",
            "**Choose a plan.** Pick Pro, Growth or Scale with an annual or monthly period. You pay by card through Paymob and the first period is paid up front. There is no free trial.",
            "**Tell Yolias about your business.** Onboarding asks for your name, company, website and what you sell. This becomes permanent context for every search, so be specific about the problem you solve.",
            "**Run your first search.** In Yolias AI, describe who you want to sell to and press Enter.",
          ] },
          { p: "A good first search names a market, an industry or business type, a company size and the roles you want to reach. See [Searches](/docs/searches) for examples." },
        ],
      },
      ar: {
        title: "البدء السريع",
        summary: "من حساب جديد إلى أول بحث في أربع خطوات.",
        blocks: [
          { ol: [
            "**أنشئ حسابك.** أدخل بريد العمل في [إنشاء حساب](/signup) وافتح الرابط السحري.",
            "**اختر خطة.** اختر برو أو النمو أو التوسع بفترة سنوية أو شهرية. تدفع بالبطاقة عبر Paymob وتُدفع أول فترة مقدمًا، ولا توجد تجربة مجانية.",
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
          { p: "A search is one request in Yolias AI. Each search appears in the sidebar history, where you can pin, rename or delete it." },
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
            "**Images**: PNG, JPEG, GIF or WebP, e.g. a screenshot of a company you want more of.",
            "**Files**: PDF, CSV, TXT, MD or TSV, e.g. an ICP brief or a list of current customers.",
            "Up to three attachments per search, 4 MB each. Files are read to understand the request and are not stored.",
          ] },
        ],
      },
      ar: {
        title: "عمليات البحث",
        summary: "كيف تكتب طلبات يفهمها يولـياس، وما الذي يمكنك إرفاقه.",
        blocks: [
          { p: "البحث طلب واحد في يولـياس AI. يظهر كل بحث في سجل الشريط الجانبي، حيث يمكنك تثبيته أو إعادة تسميته أو حذفه." },
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
            "**الصور**: PNG أو JPEG أو GIF أو WebP، مثل لقطة شاشة لشركة تريد أمثالها.",
            "**الملفات**: PDF أو CSV أو TXT أو MD أو TSV، مثل وصف ICP أو قائمة عملائك الحاليين.",
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
          { p: "Yolias AI reads your search together with your onboarding context and produces an ideal customer profile. The search uses it as its criteria." },
          { h2: "Fields" },
          { table: { head: ["Field", "Notes"], rows: [
            ["Search name & summary", "Written in your interface language"],
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
          { p: "يقرأ يولـياس AI بحثك مع سياق الإعداد الأولي وينتج ملف العميل المثالي. ويستخدمه البحث معاييرَ له." },
          { h2: "الحقول" },
          { table: { head: ["الحقل", "ملاحظات"], rows: [
            ["اسم البحث والملخص", "يُكتبان بلغة الواجهة"],
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
    slug: "search-status",
    group: "core",
    doc: {
      en: {
        title: "Search progress and status",
        summary: "What Yolias does while a search runs, and what each status means.",
        blocks: [
          { p: "Every search has its criteria, a target number of prospects and a log of what Yolias did. Its progress and status show on the result card in its Yolias AI conversation; its results join Prospects." },
          { h2: "Stages" },
          { ol: ["Understand the request", "Plan the search", "Find companies", "Find decision makers", "Enrich & verify contact details", "Qualify, score and deliver"] },
          { h2: "Statuses" },
          { table: { head: ["Status", "Meaning"], rows: [
            ["Active", "Queued or running. Results are being collected"],
            ["Awaiting data source", "Criteria are ready; no company data source is connected yet"],
            ["Completed", "The search finished and delivered its results"],
            ["Paused", "Stopped for now; criteria and results are kept"],
            ["Failed", "Discovery stopped with an error shown in the activity log"],
          ] } },
          { p: "The latest activity entry is shown at the bottom of the result card in Yolias AI." },
        ],
      },
      ar: {
        title: "تقدّم البحث وحالته",
        summary: "ما يفعله يولـياس أثناء البحث، ومعنى كل حالة.",
        blocks: [
          { p: "لكل بحث معاييره وعدد مستهدف من العملاء المحتملين وسجل لما فعله يولـياس. يظهر تقدّمه وحالته في بطاقة النتيجة داخل محادثته في يولـياس AI، وتنضم نتائجه إلى العملاء المحتملين." },
          { h2: "المراحل" },
          { ol: ["فهم الطلب", "تخطيط البحث", "العثور على الشركات", "العثور على صنّاع القرار", "إثراء بيانات التواصل والتحقق منها", "التأهيل والتقييم والتسليم"] },
          { h2: "الحالات" },
          { table: { head: ["الحالة", "المعنى"], rows: [
            ["نشطة", "في الانتظار أو قيد التشغيل، تُجمع النتائج"],
            ["بانتظار مصدر بيانات", "المعايير جاهزة؛ ولا يوجد مصدر بيانات للشركات متصل بعد"],
            ["مكتملة", "انتهى البحث وسلّم نتائجه"],
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
          { p: "Prospects are the companies and decision makers a search delivers. They join your **Prospects** list when you press **Save to Prospects** on the search." },
          { h2: "Match score" },
          { p: "The score (0–100%) compares a prospect and their company with the criteria you actually specified. Criteria you left open are skipped, so they never lower the score." },
          { table: { head: ["Criterion", "Weight"], rows: [
            ["Market (country)", "20"], ["Industry or keywords", "25"], ["Company size", "20"],
            ["Hiring", "10"], ["Funding stage", "5"], ["Decision-maker title or seniority", "20"],
          ] } },
          { h2: "Contact channels" },
          { p: "Email, phone and LinkedIn appear only when found. Email shows a ✓ when verified; unverified emails are labelled as such, and invalid ones are hidden." },
          { h2: "CSV columns" },
          { p: "Name, Title, Company, Employees, City, Country, Search, Email, Email status, Phone, LinkedIn, ICP match %." },
        ],
      },
      ar: {
        title: "العملاء المحتملون",
        summary: "محتوى سجل العميل المحتمل، وطريقة حساب نسبة التطابق، وصيغة التصدير.",
        blocks: [
          { p: "العملاء المحتملون هم الشركات وصنّاع القرار الذين يسلّمهم البحث. ينضمون إلى قائمة **العملاء المحتملون** عند الضغط على **حفظ في العملاء المحتملين** في البحث." },
          { h2: "نسبة التطابق" },
          { p: "تقارن النسبة (0–100%) العميل المحتمل وشركته بالمعايير التي حددتها فعلًا. المعايير التي تركتها مفتوحة لا تُحتسب، فلا تخفض النسبة أبدًا." },
          { table: { head: ["المعيار", "الوزن"], rows: [
            ["السوق (الدولة)", "20"], ["القطاع أو الكلمات المفتاحية", "25"], ["حجم الشركة", "20"],
            ["التوظيف", "10"], ["جولة التمويل", "5"], ["مسمى صانع القرار أو مستواه", "20"],
          ] } },
          { h2: "قنوات التواصل" },
          { p: "يظهر البريد والهاتف ولينكدإن فقط عند العثور عليها. يحمل البريد علامة ✓ عند التحقق منه، ويُوصف البريد غير المتحقق منه بذلك، ويُخفى البريد غير الصالح." },
          { h2: "أعمدة ملف CSV" },
          { p: "الاسم، المسمى الوظيفي، الشركة، عدد الموظفين، المدينة، الدولة، البحث، البريد، حالة البريد، الهاتف، لينكدإن، نسبة تطابق ICP." },
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
        summary: "The discovery, outreach and activity numbers for your workspace.",
        blocks: [
          { p: "Analytics covers the last 7, 30 or 90 days for the whole workspace." },
          { table: { head: ["Metric", "Definition"], rows: [
            ["Companies discovered", "Companies your searches found in the period, against the previous period"],
            ["Decision makers extracted", "People found at those companies, against the previous period"],
            ["Average ICP match", "The average match score of the prospects Yolias scored"],
            ["Email", "Prospects with a usable email, and their share of all prospects"],
          ] } },
          { p: "**Outreach and sales** counts campaigns started, messages sent, not delivered, replies, interested replies, meetings and deals won. **Decision makers** groups the people found by role, and **User activity** counts searches, qualifications, emails prepared and exports." },
        ],
      },
      ar: {
        title: "التحليلات",
        summary: "أرقام الاكتشاف والتواصل والنشاط في مساحة عملك.",
        blocks: [
          { p: "تغطي التحليلات آخر 7 أو 30 أو 90 يومًا لمساحة العمل كلها." },
          { table: { head: ["المؤشر", "التعريف"], rows: [
            ["الشركات المكتشفة", "الشركات التي وجدتها عمليات البحث في الفترة، مقارنة بالفترة السابقة"],
            ["صنّاع القرار المستخرجون", "الأشخاص الذين وُجدوا في هذه الشركات، مقارنة بالفترة السابقة"],
            ["متوسط مطابقة ICP", "متوسط نسبة تطابق العملاء المحتملين الذين قيّمهم يولـياس"],
            ["البريد", "العملاء المحتملون الذين لديهم بريد صالح ونسبتهم من الإجمالي"],
          ] } },
          { p: "يعرض قسم **التواصل والمبيعات** الحملات التي بدأت والرسائل المرسلة وغير الواصلة والردود والمهتمين والاجتماعات والصفقات الرابحة. ويجمع قسم **صنّاع القرار** الأشخاص حسب المنصب، ويعدّ **نشاط المستخدم** عمليات البحث والتأهيل والرسائل المجهزة والتصدير." },
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
            ["Run searches and view prospects", "✓", "✓", "✓"],
            ["Save and export prospects", "✓", "✓", "✓"],
            ["Invite and remove members", "✓", "✓", "-"],
            ["Choose or change the plan", "✓", "✓", "-"],
            ["Be removed by others", "-", "✓", "✓"],
          ] } },
          { p: "Every plan includes unlimited users. The person who creates the workspace is its owner." },
        ],
      },
      ar: {
        title: "الفريق والأدوار",
        summary: "من يستطيع فعل ماذا داخل مساحة العمل.",
        blocks: [
          { table: { head: ["الإجراء", "المالك", "المسؤول", "العضو"], rows: [
            ["إجراء عمليات البحث وعرض العملاء", "✓", "✓", "✓"],
            ["حفظ العملاء المحتملين وتصديرهم", "✓", "✓", "✓"],
            ["دعوة الأعضاء وإزالتهم", "✓", "✓", "-"],
            ["اختيار الخطة أو تغييرها", "✓", "✓", "-"],
            ["إمكانية إزالته من الآخرين", "-", "✓", "✓"],
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
            ["Free", "$0", "50 (to get started)"], ["Pro", "$50", "1,000"], ["Growth", "$100", "2,000"],
          ] } },
          { ul: [
            "Plans count prospects, emails opened from Yolias and contacts uploaded by CSV, each with a new allowance every month.",
            "Companies, searches and AI work are not counted.",
            "When the month’s prospects are used up, discovery pauses until the reset or an upgrade.",
            "Counters reset on the first day of every month (UTC), for monthly and annual billing alike.",
            "Annual billing saves 20%: the year costs 12 × the discounted monthly rate, paid once a year.",
          ] },
          { p: "Current usage is in Settings → Usage." },
        ],
      },
      ar: {
        title: "الخطط والاستخدام",
        summary: "الحدود الشهرية لكل خطة وطريقة احتسابها.",
        blocks: [
          { table: { head: ["الخطة", "السعر الشهري", "العملاء المحتملون شهريًا"], rows: [
            ["المجانية", "$0", "50 (للبداية)"], ["برو", "$50", "1,000"], ["النمو", "$100", "2,000"],
          ] } },
          { ul: [
            "تحسب الخطط العملاء المحتملين ورسائل البريد المفتوحة من يولـياس وجهات الاتصال المرفوعة بملفات CSV، ولكل منها رصيد جديد كل شهر.",
            "لا تُحسب الشركات أو عمليات البحث أو عمل الذكاء الاصطناعي.",
            "عند استخدام كل العملاء المحتملين للشهر، يتوقف الاكتشاف حتى التجديد أو الترقية.",
            "تتجدد العدادات في أول يوم من كل شهر (بتوقيت UTC)، للفوترة الشهرية والسنوية على حد سواء.",
            "الفوترة السنوية توفّر 20%: السنة تكلّف 12 ضعف السعر الشهري المخفّض، وتُدفع مرة واحدة في السنة.",
          ] },
          { p: "تجد استخدامك الحالي في الإعدادات ← الاستخدام." },
        ],
      },
    },
  },
];
