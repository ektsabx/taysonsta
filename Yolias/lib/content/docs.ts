import type { Doc, Localized } from "./types";

// Documentation (rewritten for the AI advertising platform, owner 2026-11-03,
// D-276): how Yolias works, page by page. Task-style answers live in the Help
// Center. Numbers mirror the code (lib/campaigns/*, lib/pixel.ts,
// lib/plans.ts). The old slugs stay (searches, search-status, prospects,
// analytics) so links keep working; their pages now describe Yolias AI,
// campaign status and learning, Leads and Results.

export interface DocGroup {
  id: "start" | "core" | "workspace";
  title: Localized<string>;
}

export const docGroups: DocGroup[] = [
  { id: "start", title: { en: "Get started", ar: "البداية" } },
  { id: "core", title: { en: "Campaigns", ar: "الحملات" } },
  { id: "workspace", title: { en: "Account", ar: "الحساب" } },
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
        summary: "The dashboard, campaigns, audiences, the Inbox, meetings and Events Manager, in one tour.",
        blocks: [
          { h2: "Dashboard" },
          { p: "What Yolias is doing now, your next step, the account balance and every number that matters for the period you pick: people found and reached, replies, meetings, spend and cost per meeting." },
          { figure: { src: "/screens/dashboard-en-light.jpg", alt: "The Yolias dashboard", caption: "The dashboard, with the demo account's sample data." } },
          { h2: "Campaigns" },
          { p: "Campaigns, audiences and messages in one table, like an ads manager: an on/off switch per row, a date range, the columns you choose and totals. Open a campaign for its results, chart, audiences, conversations and meetings." },
          { figure: { src: "/screens/campaigns-en-light.jpg", alt: "The Campaigns table", caption: "Campaigns, with the demo account's sample data." } },
          { h2: "Inbox and meetings" },
          { p: "Every conversation Yolias started, with a marker on the ones that need you. Every booking lands in Meetings, on your booking page and in Google Calendar with a Meet link." },
          { h2: "Events Manager" },
          { p: "Your pixels, their events and test events. Purchases and leads on your website are credited to the campaign that brought each person." },
        ],
      },
      ar: {
        title: "جولة في يولياس",
        summary: "لوحة التحكم والحملات والجماهير والمحادثات والاجتماعات ومدير الأحداث في جولة واحدة.",
        blocks: [
          { h2: "لوحة التحكم" },
          { p: "ما يفعله يولياس الآن، وخطوتك التالية، ورصيد الحساب، وكل رقم مهم للفترة التي تختارها: من وُجد ومن تُواصل معهم، والردود، والاجتماعات، والإنفاق وتكلفة الاجتماع." },
          { figure: { src: "/screens/dashboard-ar-light.jpg", alt: "لوحة تحكم يولياس", caption: "لوحة التحكم ببيانات حساب العرض التوضيحية." } },
          { h2: "الحملات" },
          { p: "الحملات والجماهير والرسائل في جدول واحد مثل مدير الإعلانات: زر تشغيل وإيقاف لكل صف، وفترة زمنية، والأعمدة التي تختارها، والإجماليات. افتح الحملة لترى نتائجها ورسمها البياني وجماهيرها ومحادثاتها واجتماعاتها." },
          { figure: { src: "/screens/campaigns-ar-light.jpg", alt: "جدول الحملات", caption: "الحملات ببيانات حساب العرض التوضيحية." } },
          { h2: "المحادثات والاجتماعات" },
          { p: "كل محادثة بدأها يولياس، مع علامة على ما يحتاجك. وكل حجز يصل إلى الاجتماعات وصفحة الحجز وتقويم Google برابط Meet." },
          { h2: "مدير الأحداث" },
          { p: "البيكسلات وأحداثها واختبار الأحداث. وتُنسب المشتريات والعملاء المحتملون على موقعك إلى الحملة التي جاءت بكل شخص." },
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
        summary: "Yolias is an AI advertising platform for customer acquisition.",
        blocks: [
          { p: "Yolias is an AI advertising platform for customer acquisition. Instead of paying for reach and views, you define the customers you want; Yolias's AI campaigns find the matching decision makers, contact each one, answer the replies and bring back meetings, leads and sales." },
          { h2: "How it fits together" },
          { table: { head: ["Part", "What it does"], rows: [
            ["Campaigns", "A goal, a budget, audiences and a message, like an ads manager"],
            ["Audiences", "Who to reach: places, industries, company size, job titles, custom and lookalike audiences"],
            ["AI Sales Agent", "Writes to each person, follows up, answers and books meetings"],
            ["Meetings", "Your booking page and Google Calendar"],
            ["Pixel", "Purchases and leads on your website, credited to campaigns"],
            ["Results", "Every result and its cost, per campaign, audience and message"],
            ["Learning", "What brings results decides who is contacted first"],
          ] } },
        ],
      },
      ar: {
        title: "مقدمة",
        summary: "يولياس منصة إعلانات بالذكاء الاصطناعي لاكتساب العملاء.",
        blocks: [
          { p: "يولياس منصة إعلانات بالذكاء الاصطناعي لاكتساب العملاء. بدل أن تدفع مقابل الوصول والمشاهدات، تحدد العملاء الذين تريدهم، فتجد حملات يولياس الذكية صنّاع القرار المطابقين، وتتواصل مع كل منهم، وترد على الردود، وتأتيك باجتماعات وعملاء ومبيعات." },
          { h2: "كيف تتكامل الأجزاء" },
          { table: { head: ["الجزء", "ما يفعله"], rows: [
            ["الحملات", "هدف وميزانية وجماهير ورسالة، مثل مدير الإعلانات"],
            ["الجماهير", "من تصل إليه: الأماكن والمجالات وحجم الشركة والمسميات الوظيفية والجماهير المخصصة والمشابهة"],
            ["وكيل المبيعات الذكي", "يكتب لكل شخص ويتابع ويرد ويحجز الاجتماعات"],
            ["الاجتماعات", "صفحة الحجز وتقويم Google"],
            ["البيكسل", "المشتريات والعملاء المحتملون على موقعك، منسوبة إلى الحملات"],
            ["النتائج", "كل نتيجة وتكلفتها، لكل حملة وجمهور ورسالة"],
            ["التعلم", "ما يجلب النتائج يحدد من يُتواصل معه أولًا"],
          ] } },
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
        summary: "From a new account to a running campaign in four steps.",
        blocks: [
          { ol: [
            "**Create your account** with your work email on [Create account](/signup).",
            "**Set up your company.** Add your website and Yolias reads it, or fill in your company yourself.",
            "**Choose how to pay:** Pay As You Go from $5, or the Growth or Scale plan, monthly or annual (20% off).",
            "**Launch your first campaign** from Campaigns → Create campaign: the goal, the audiences and the message. Connect your mailbox in Integrations first.",
          ] },
        ],
      },
      ar: {
        title: "البدء السريع",
        summary: "من حساب جديد إلى حملة تعمل في أربع خطوات.",
        blocks: [
          { ol: [
            "**أنشئ حسابك** ببريد العمل من [إنشاء حساب](/signup).",
            "**جهّز شركتك.** أضف موقعك فيقرؤه يولياس، أو املأ بيانات شركتك بنفسك.",
            "**اختر طريقة الدفع:** الدفع حسب الاستخدام من 5 دولارات، أو خطة النمو أو التوسع شهريًا أو سنويًا (بخصم 20%).",
            "**أطلق حملتك الأولى** من الحملات ← إنشاء حملة: الهدف والجماهير والرسالة. واربط بريدك من التكاملات أولًا.",
          ] },
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
        summary: "Goals, the three levels of a campaign, launching, sending and replies.",
        blocks: [
          { h2: "Goals" },
          { table: { head: ["Goal", "The result"], rows: [
            ["Meetings", "A booked meeting"],
            ["Website purchases", "A purchase the Yolias pixel counts on your site"],
            ["Website leads", "A form or registration the pixel counts"],
            ["Qualified leads", "A matching company and person saved to Leads (no outreach)"],
          ] } },
          { h2: "Three levels" },
          { p: "**Campaign**: the goal, your offer, the budget in US dollars (total or daily), dates, days and hours. **Audiences**: who to reach. **Message**: the mailbox, tone, language and notes, with a preview." },
          { h2: "Launching" },
          { p: "Launching is the go-ahead: Yolias finds the people, emails them from your mailbox and answers their replies. Before launch it checks your sending domain (SPF, DKIM, DMARC)." },
          { h2: "Sending" },
          { table: { head: ["Rule", "What it does"], rows: [
            ["Your mailbox", "Emails go out from the Gmail or IMAP/SMTP mailbox you connected"],
            ["Pace", "The campaign's daily limit within the mailbox's sending rules"],
            ["Follow-ups", "Two, 3 and 7 days apart, in the same thread"],
            ["Unsubscribe", "In every email, one click"],
            ["Bounces", "5% or more of 20+ emails pauses the campaign"],
          ] } },
          { h2: "Replies" },
          { p: "The AI Sales Agent answers questions and objections from your Company Knowledge, sends interested people two free times and your booking page, and books the time they pick. Anything that needs you is marked in the Inbox." },
          { h2: "Budget and optimization" },
          { p: "Once a day each audience gets a share of the budget from its results. A new audience gets a fair try first; one that does clearly worse, or costs more than your cost cap, gets no new budget." },
        ],
      },
      ar: {
        title: "الحملات",
        summary: "الأهداف ومستويات الحملة الثلاثة والإطلاق والإرسال والردود.",
        blocks: [
          { h2: "الأهداف" },
          { table: { head: ["الهدف", "النتيجة"], rows: [
            ["الاجتماعات", "اجتماع محجوز"],
            ["المشتريات من الموقع", "شراء يحسبه بيكسل يولياس على موقعك"],
            ["العملاء المحتملون من الموقع", "نموذج أو تسجيل يحسبه البيكسل"],
            ["العملاء المحتملون المؤهلون", "شركة وشخص مطابقان يُحفظان في العملاء المحتملين (بدون تواصل)"],
          ] } },
          { h2: "ثلاثة مستويات" },
          { p: "**الحملة**: الهدف وعرضك والميزانية بالدولار (إجمالية أو يومية) والتواريخ والأيام والساعات. **الجماهير**: من تصل إليه. **الرسالة**: البريد والأسلوب واللغة والملاحظات، مع معاينة." },
          { h2: "الإطلاق" },
          { p: "الإطلاق هو الموافقة: يجد يولياس الأشخاص، ويراسلهم من بريدك، ويرد على ردودهم. وقبل الإطلاق يفحص نطاق الإرسال (SPF وDKIM وDMARC)." },
          { h2: "الإرسال" },
          { table: { head: ["القاعدة", "ما تفعله"], rows: [
            ["بريدك", "تُرسل الرسائل من Gmail أو بريد IMAP/SMTP الذي ربطته"],
            ["الوتيرة", "الحد اليومي للحملة داخل قواعد إرسال البريد"],
            ["المتابعات", "متابعتان بعد 3 ثم 7 أيام في المحادثة نفسها"],
            ["إلغاء الاشتراك", "في كل رسالة بضغطة واحدة"],
            ["الارتداد", "5% أو أكثر من 20 رسالة أو أكثر يوقف الحملة"],
          ] } },
          { h2: "الردود" },
          { p: "يجيب وكيل المبيعات الذكي عن الأسئلة والاعتراضات من معرفة شركتك، ويرسل للمهتمين موعدين متاحين وصفحة الحجز، ويحجز الموعد الذي يختارونه. وما يحتاجك يظهر بعلامة في المحادثات." },
          { h2: "الميزانية والتحسين" },
          { p: "مرة يوميًا يحصل كل جمهور على نصيب من الميزانية حسب نتائجه. والجمهور الجديد يحصل على فرصة عادلة أولًا، والأضعف بوضوح أو الأغلى من الحد الأقصى للتكلفة لا يحصل على ميزانية جديدة." },
        ],
      },
    },
  },
  {
    slug: "audiences",
    group: "core",
    doc: {
      en: {
        title: "Audiences",
        summary: "Targeting, saved audiences, custom audiences and lookalikes.",
        blocks: [
          { h2: "Targeting" },
          { p: "Every country, its regions and cities, included or excluded; industries, company type and size, job titles, seniority, departments, signals such as hiring and funding, and companies never to contact." },
          { h2: "Custom audiences" },
          { p: "From your customers, people who booked a meeting, interested people, a past campaign or a CSV file." },
          { h2: "Lookalikes" },
          { p: "Companies that share the traits of a base, at a similarity from 1 to 10. Confidence: low under 5 people, medium 5 to 19, high 20 or more. With three meetings, Yolias keeps a lookalike of the people who booked." },
        ],
      },
      ar: {
        title: "الجماهير",
        summary: "الاستهداف والجماهير المحفوظة والمخصصة والمشابهة.",
        blocks: [
          { h2: "الاستهداف" },
          { p: "كل الدول ومناطقها ومدنها تضمينًا أو استبعادًا، والمجالات، ونوع الشركة وحجمها، والمسميات الوظيفية، والمستوى، والإدارات، والإشارات مثل التوظيف والتمويل، والشركات التي لا يُتواصل معها." },
          { h2: "الجماهير المخصصة" },
          { p: "من عملائك، أو من حجزوا اجتماعًا، أو المهتمين، أو حملة سابقة، أو ملف CSV." },
          { h2: "الجماهير المشابهة" },
          { p: "شركات تشترك في صفات قاعدة ما، بدرجة تشابه من 1 إلى 10. والثقة: منخفضة لأقل من 5 أشخاص، ومتوسطة من 5 إلى 19، وعالية لـ 20 أو أكثر. وبعد ثلاثة اجتماعات يحتفظ يولياس بجمهور مشابه لمن حجزوا." },
        ],
      },
    },
  },
  {
    slug: "customer-profile",
    group: "core",
    doc: {
      en: {
        title: "Company Knowledge",
        summary: "What Yolias knows about your company and uses in every message and answer.",
        blocks: [
          { p: "Company Knowledge is what you sell, to whom, your offers, prices, competitors, answers to common questions and your customer profiles. Yolias reads your website to fill it, and you can edit every part." },
          { h2: "Where it's used" },
          { ul: ["Every first email and follow-up", "Every answer to a question or objection", "Yolias AI's suggestions and campaign drafts"] },
        ],
      },
      ar: {
        title: "معرفة الشركة",
        summary: "ما يعرفه يولياس عن شركتك ويستخدمه في كل رسالة وإجابة.",
        blocks: [
          { p: "معرفة الشركة هي ما تبيعه، ولمن، وعروضك، وأسعارك، ومنافسوك، وإجابات الأسئلة الشائعة، وملفات عملائك. يقرأ يولياس موقعك ليملأها، ويمكنك تعديل كل جزء منها." },
          { h2: "أين تُستخدم" },
          { ul: ["كل رسالة أولى ومتابعة", "كل إجابة عن سؤال أو اعتراض", "اقتراحات يولياس AI ومسودات الحملات"] },
        ],
      },
    },
  },
  {
    slug: "searches",
    group: "core",
    doc: {
      en: {
        title: "Yolias AI",
        summary: "Ask about your campaigns and results, or have Yolias AI prepare a campaign.",
        blocks: [
          { p: "Yolias AI answers from your account: campaigns, replies, meetings, leads and usage. Describe who you want to reach and it prepares a campaign draft for you to launch." },
          { h2: "Examples" },
          { ul: ["Which campaign has the lowest cost per meeting this month?", "Show me the replies that need me", "Prepare a campaign for dental clinics in Riyadh, owners, meetings"] },
        ],
      },
      ar: {
        title: "يولياس AI",
        summary: "اسأل عن حملاتك ونتائجك، أو دع يولياس AI يجهز حملة.",
        blocks: [
          { p: "يجيب يولياس AI من حسابك: الحملات والردود والاجتماعات والعملاء المحتملون والاستخدام. وصِف من تريد الوصول إليه فيجهز لك مسودة حملة لتطلقها." },
          { h2: "أمثلة" },
          { ul: ["أي حملة لها أقل تكلفة اجتماع هذا الشهر؟", "اعرض الردود التي تحتاجني", "جهّز حملة لعيادات الأسنان في الرياض، الملاك، اجتماعات"] },
        ],
      },
    },
  },
  {
    slug: "search-status",
    group: "core",
    doc: {
      en: {
        title: "Campaign status and learning",
        summary: "What each status means, and how Yolias learns from every result.",
        blocks: [
          { table: { head: ["Status", "Meaning"], rows: [
            ["Draft", "Saved, not launched"], ["Scheduled", "Starts on its start date"], ["Active", "Finding, sending and answering"],
            ["Learning", "A new audience getting its fair try"], ["Paused", "Stopped by you or by a guard (bounces, budget)"], ["Completed", "Reached its end date or target"],
          ] } },
          { h2: "Learning" },
          { p: "Every day Yolias reads each campaign's results: meetings booked and held, deals won, purchases and leads from the pixel. Industries, job titles, company sizes, countries and openings that bring results move people like them to the front of the queue, and the writer uses what worked. Each campaign shows what Yolias learned." },
        ],
      },
      ar: {
        title: "حالة الحملة والتعلم",
        summary: "معنى كل حالة، وكيف يتعلم يولياس من كل نتيجة.",
        blocks: [
          { table: { head: ["الحالة", "المعنى"], rows: [
            ["مسودة", "محفوظة ولم تُطلق"], ["مجدولة", "تبدأ في تاريخ بدايتها"], ["نشطة", "تجد وترسل وترد"],
            ["تتعلم", "جمهور جديد يحصل على فرصته العادلة"], ["متوقفة", "أوقفتها أنت أو أوقفها حد أمان (الارتداد أو الميزانية)"], ["مكتملة", "وصلت إلى تاريخ نهايتها أو هدفها"],
          ] } },
          { h2: "التعلم" },
          { p: "كل يوم يقرأ يولياس نتائج كل حملة: الاجتماعات المحجوزة والمنعقدة، والصفقات المكسوبة، والمشتريات والعملاء المحتملين من البيكسل. والمجالات والمسميات وأحجام الشركات والدول والافتتاحيات التي تجلب نتائج تقدّم من يشبهونها في الدور، ويكتب الكاتب بما نجح. وتعرض كل حملة ما تعلّمه يولياس." },
        ],
      },
    },
  },
  {
    slug: "prospects",
    group: "core",
    doc: {
      en: {
        title: "Leads",
        summary: "The companies and people your campaigns find, and how a match is scored.",
        blocks: [
          { p: "Leads holds every company and person your campaigns found, with their role, company, contact details and the campaign that found them. Export any view as CSV or Excel." },
          { h2: "Match score" },
          { table: { head: ["Criterion", "Weight"], rows: [
            ["Market (country)", "20"], ["Industry or keywords", "25"], ["Company size", "20"],
            ["Hiring", "10"], ["Funding stage", "5"], ["Job title or seniority", "20"],
          ] } },
        ],
      },
      ar: {
        title: "العملاء المحتملون",
        summary: "الشركات والأشخاص الذين تجدهم حملاتك، وكيف تُحسب نسبة التطابق.",
        blocks: [
          { p: "يضم العملاء المحتملون كل شركة وشخص وجدتهم حملاتك، مع المنصب والشركة وبيانات التواصل والحملة التي وجدتهم. صدّر أي عرض كملف CSV أو Excel." },
          { h2: "نسبة التطابق" },
          { table: { head: ["المعيار", "الوزن"], rows: [
            ["السوق (الدولة)", "20"], ["المجال أو الكلمات", "25"], ["حجم الشركة", "20"],
            ["التوظيف", "10"], ["مرحلة التمويل", "5"], ["المسمى الوظيفي أو المستوى", "20"],
          ] } },
        ],
      },
    },
  },
  {
    slug: "meetings",
    group: "core",
    doc: {
      en: {
        title: "Meetings and booking page",
        summary: "Your booking page, Google Calendar and how meetings count.",
        blocks: [
          { p: "Your booking page shows only your free times from Google Calendar. Every booking gets a Google Meet link and an invitation, and lands in Meetings." },
          { table: { head: ["Meeting", "Counts as"], rows: [["Booked", "The result of a Meetings campaign"], ["Held", "Marked after it takes place"], ["Won", "A deal, with its value, for the campaign's return"]] } },
        ],
      },
      ar: {
        title: "الاجتماعات وصفحة الحجز",
        summary: "صفحة الحجز وتقويم Google وكيف تُحسب الاجتماعات.",
        blocks: [
          { p: "تعرض صفحة الحجز أوقات فراغك فقط من تقويم Google. وكل حجز يحصل على رابط Google Meet ودعوة، ويصل إلى الاجتماعات." },
          { table: { head: ["الاجتماع", "يُحسب"], rows: [["محجوز", "نتيجة حملة الاجتماعات"], ["منعقد", "يُعلَّم بعد حدوثه"], ["مكسوب", "صفقة بقيمتها، لعائد الحملة"]] } },
        ],
      },
    },
  },
  {
    slug: "pixel",
    group: "core",
    doc: {
      en: {
        title: "Pixel and Events Manager",
        summary: "Measure purchases and leads on your website and credit them to campaigns.",
        blocks: [
          { p: "Add the base code to every page of your site, then the standard events where they happen: Purchase with its value, Lead, CompleteRegistration and the rest." },
          { table: { head: ["Setting", "What it does"], rows: [
            ["Attribution window", "7 days by default; 1 or 28 per campaign"],
            ["Click attribution", "Links Yolias sends carry who each person is"],
            ["Advanced matching", "The customer's email, hashed in the browser, credits a result without a click"],
            ["Domains", "Allowed and blocked websites"],
            ["Test events", "Open your site with a test code and watch events arrive"],
          ] } },
          { p: "The Yolias Pixel Helper for Chrome shows the pixel and its events on any page." },
        ],
      },
      ar: {
        title: "البيكسل ومدير الأحداث",
        summary: "قِس المشتريات والعملاء المحتملين على موقعك وانسبها إلى الحملات.",
        blocks: [
          { p: "أضف الكود الأساسي إلى كل صفحات موقعك، ثم الأحداث القياسية حيث تحدث: Purchase بقيمته، وLead، وCompleteRegistration وغيرها." },
          { table: { head: ["الإعداد", "ما يفعله"], rows: [
            ["نافذة الاحتساب", "7 أيام افتراضيًا، أو يوم أو 28 يومًا لكل حملة"],
            ["الاحتساب بالنقرة", "الروابط التي يرسلها يولياس تحمل هوية كل شخص"],
            ["المطابقة المتقدمة", "بريد العميل مشفّرًا في المتصفح يحتسب النتيجة بدون نقرة"],
            ["النطاقات", "المواقع المسموحة والمحظورة"],
            ["اختبار الأحداث", "افتح موقعك بكود اختبار وتابع وصول الأحداث"],
          ] } },
          { p: "وتعرض إضافة Yolias Pixel Helper لمتصفح Chrome البيكسل وأحداثه على أي صفحة." },
        ],
      },
    },
  },
  {
    slug: "analytics",
    group: "workspace",
    doc: {
      en: {
        title: "Results and metrics",
        summary: "What every number on the dashboard and in Campaigns means.",
        blocks: [
          { table: { head: ["Metric", "Definition"], rows: [
            ["Results", "What the campaign's goal counts: meetings, purchases, website leads or qualified leads"],
            ["Cost per result", "Spend ÷ results"],
            ["Found", "Companies and people the campaign found"],
            ["Sent", "First emails sent"],
            ["Open rate", "Opened ÷ sent (approximate: mail apps hide some opens)"],
            ["Reply rate", "People who replied ÷ people reached"],
            ["Positive replies", "Interested replies and meeting requests"],
            ["Conversions and revenue", "Purchases and leads from the pixel, and their value"],
            ["ROAS", "Revenue ÷ spend"],
            ["Spend", "People reached × your price per person"],
          ] } },
          { p: "A number that can't be worked out yet shows a dash." },
        ],
      },
      ar: {
        title: "النتائج والمقاييس",
        summary: "معنى كل رقم في لوحة التحكم والحملات.",
        blocks: [
          { table: { head: ["المقياس", "التعريف"], rows: [
            ["النتائج", "ما يحسبه هدف الحملة: اجتماعات أو مشتريات أو عملاء محتملون من الموقع أو عملاء محتملون مؤهلون"],
            ["تكلفة النتيجة", "الإنفاق ÷ النتائج"],
            ["المكتشَفون", "الشركات والأشخاص الذين وجدتهم الحملة"],
            ["المُرسل", "الرسائل الأولى المرسلة"],
            ["نسبة الفتح", "المفتوح ÷ المُرسل (تقريبية: تطبيقات البريد تخفي بعض الفتح)"],
            ["نسبة الرد", "من ردّوا ÷ من تم التواصل معهم"],
            ["الردود الإيجابية", "الردود المهتمة وطلبات الاجتماع"],
            ["التحويلات والإيرادات", "المشتريات والعملاء المحتملون من البيكسل وقيمتها"],
            ["العائد على الإنفاق", "الإيرادات ÷ الإنفاق"],
            ["الإنفاق", "الأشخاص الذين تم التواصل معهم × سعرك للشخص"],
          ] } },
          { p: "الرقم الذي لا يمكن حسابه بعد يظهر شرطة." },
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
        summary: "Admin, Advertiser and Analyst, like an ad account.",
        blocks: [
          { table: { head: ["Action", "Admin", "Advertiser", "Analyst"], rows: [
            ["See campaigns, results and reports", "✓", "✓", "✓"],
            ["Create and run campaigns, audiences and messages", "✓", "✓", "-"],
            ["Answer conversations and manage meetings", "✓", "✓", "-"],
            ["Connect mailboxes and the calendar", "✓", "✓", "-"],
            ["Billing, plan and team", "✓", "-", "-"],
          ] } },
          { p: "Unlimited users on every plan. Add people from Settings → Team." },
        ],
      },
      ar: {
        title: "الفريق والأدوار",
        summary: "مسؤول ومعلن ومحلل، مثل حساب الإعلانات.",
        blocks: [
          { table: { head: ["الإجراء", "مسؤول", "معلن", "محلل"], rows: [
            ["رؤية الحملات والنتائج والتقارير", "✓", "✓", "✓"],
            ["إنشاء الحملات والجماهير والرسائل وتشغيلها", "✓", "✓", "-"],
            ["الرد على المحادثات وإدارة الاجتماعات", "✓", "✓", "-"],
            ["ربط البريد والتقويم", "✓", "✓", "-"],
            ["الفوترة والخطة والفريق", "✓", "-", "-"],
          ] } },
          { p: "مستخدمون بلا حد في كل خطة. أضف الأشخاص من الإعدادات ← الفريق." },
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
        summary: "Pay As You Go, the plans (monthly or annual), and how prospects are counted.",
        blocks: [
          { table: { head: ["Option", "Price", "Prospects"], rows: [
            ["Pay As You Go", "$5 / $20 / $50 / $100 top-up", "50 / 200 / 500 / 1,000, no expiry (10 cents each; a plan is half the price per prospect)"], ["Growth", "$100 / month, or $80 / month billed annually", "2,000 / month"], ["Scale", "$200 / month, or $160 / month billed annually", "4,000 / month"],
          ] } },
          { ul: [
            "The prospect is the only unit. Writing and sending emails is never charged or limited, uploaded contacts are unlimited, and viewing your prospects again is free.",
            "The same prospect is never counted twice: a company or person already in your workspace is skipped, not charged.",
            "Companies, searches and AI work are not counted.",
            "On a plan, its monthly prospects are used first, then any credit you topped up. Plan prospects reset on the first day of every month (UTC); credit doesn’t expire.",
            "When no prospects are left, discovery pauses until you top up or the plan renews.",
            "Plans are billed monthly, or annually at 20% off. There is no free trial.",
          ] },
          { p: "Current usage is in Settings → Usage." },
        ],
      },
      ar: {
        title: "الخطط والاستخدام",
        summary: "الدفع حسب الاستخدام والخطط (شهرية أو سنوية) وطريقة احتساب العملاء المحتملين.",
        blocks: [
          { table: { head: ["الخيار", "السعر", "العملاء المحتملون"], rows: [
            ["الدفع حسب الاستخدام", "شحن $5 / $20 / $50 / $100", "50 / 200 / 500 / 1,000 بدون انتهاء (10 سنت للعميل؛ الخطة بنصف السعر للعميل)"], ["النمو", "$100 شهريًا، أو $80 شهريًا بالدفع السنوي", "2,000 شهريًا"], ["التوسع", "$200 شهريًا، أو $160 شهريًا بالدفع السنوي", "4,000 شهريًا"],
          ] } },
          { ul: [
            "العميل المحتمل هو الوحدة الوحيدة. كتابة الرسائل وإرسالها بدون رسوم وبدون حد، وجهات الاتصال المرفوعة غير محدودة، وعرض عملائك مرة أخرى مجاني.",
            "لا يُحسب العميل نفسه مرتين: الشركة أو الشخص الموجود في مساحة عملك يُتخطى ولا يُحسب.",
            "لا تُحسب الشركات أو عمليات البحث أو عمل الذكاء الاصطناعي.",
            "مع الخطة تُستخدم عملاؤها الشهريون أولًا ثم الرصيد الذي شحنته. يتجدد عملاء الخطة في أول كل شهر (بتوقيت UTC)، والرصيد لا تنتهي صلاحيته.",
            "عندما لا يتبقى عملاء محتملون، يتوقف الاكتشاف حتى تشحن رصيدك أو تتجدد الخطة.",
            "تُدفع الخطط شهريًا، أو سنويًا بخصم 20%. ولا توجد تجربة مجانية.",
          ] },
          { p: "تجد استخدامك الحالي في الإعدادات ← الاستخدام." },
        ],
      },
    },
  },
];
