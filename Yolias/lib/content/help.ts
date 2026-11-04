import type { Doc, Localized } from "./types";

// Help Center (rewritten 2026-11-03 for the campaign platform): short,
// task-focused answers about running acquisition campaigns. Reference
// material lives in /docs. Only what the product does today.

export interface HelpCollection {
  id: "getting-started" | "campaigns" | "audiences-leads" | "conversations-meetings" | "account";
  icon: "rocket" | "megaphone" | "users" | "calendar" | "card";
  text: Localized<{ title: string; description: string }>;
}

export const collections: HelpCollection[] = [
  { id: "getting-started", icon: "rocket", text: {
    en: { title: "Getting started", description: "Signing in, your mailbox, Company Knowledge and your language." },
    ar: { title: "البداية", description: "تسجيل الدخول وربط البريد ومعرفة الشركة واللغة." },
  } },
  { id: "campaigns", icon: "megaphone", text: {
    en: { title: "Campaigns", description: "Creating campaigns, objectives, budgets, results and the Yolias pixel." },
    ar: { title: "الحملات", description: "إنشاء الحملات والأهداف والميزانيات والنتائج وبيكسل يولياس." },
  } },
  { id: "audiences-leads", icon: "users", text: {
    en: { title: "Audiences & leads", description: "Targeting, saved and lookalike audiences, leads and exports." },
    ar: { title: "الجماهير والعملاء المحتملون", description: "الاستهداف والجماهير المحفوظة والمشابهة والعملاء المحتملون والتصدير." },
  } },
  { id: "conversations-meetings", icon: "calendar", text: {
    en: { title: "Conversations & meetings", description: "Replies, what needs you, your booking page and Google Calendar." },
    ar: { title: "المحادثات والاجتماعات", description: "الردود وما يحتاجك وصفحة الحجز وتقويم Google." },
  } },
  { id: "account", icon: "card", text: {
    en: { title: "Billing & account", description: "Plans, credit, your team and your account." },
    ar: { title: "الفوترة والحساب", description: "الخطط والرصيد والفريق والحساب." },
  } },
];

export interface HelpArticle {
  slug: string;
  collection: HelpCollection["id"];
  doc: Localized<Doc>;
}

export const articles: HelpArticle[] = [
  // ───────────────────────── Getting started ─────────────────────────
  {
    slug: "signing-in",
    collection: "getting-started",
    doc: {
      en: {
        title: "Signing in",
        summary: "Yolias signs you in with a one-time link sent to your email. What to do when it doesn't arrive or has expired.",
        blocks: [
          { p: "Enter your work email on the [log in page](/login) and open the link Yolias emails you, on the same device. New accounts start from [Create account](/signup)." },
          { h2: "The email didn't arrive" },
          { ol: [
            "Wait a minute, then check spam, promotions and quarantine folders.",
            "Check that the address is the one you signed up with.",
            "Request a new link. After several requests in a row, wait a minute before the next one.",
          ] },
          { h2: "The link is invalid or expired" },
          { p: "Each link works once and for one hour. Open [Can't sign in?](/recover) and request a new one." },
        ],
      },
      ar: {
        title: "تسجيل الدخول",
        summary: "يسجّل يولياس دخولك برابط لمرة واحدة يصل إلى بريدك. ماذا تفعل إذا لم يصل الرابط أو انتهت صلاحيته.",
        blocks: [
          { p: "اكتب بريد عملك في [صفحة الدخول](/login) وافتح الرابط الذي يرسله يولياس على الجهاز نفسه. والحسابات الجديدة تبدأ من [إنشاء حساب](/signup)." },
          { h2: "لم يصل البريد" },
          { ol: [
            "انتظر دقيقة، ثم راجع مجلدات الرسائل غير المرغوب فيها والعروض والحجر.",
            "تأكد أن البريد هو نفسه الذي سجّلت به.",
            "اطلب رابطًا جديدًا. وبعد عدة طلبات متتالية انتظر دقيقة قبل الطلب التالي.",
          ] },
          { h2: "الرابط غير صالح أو منتهي" },
          { p: "كل رابط يعمل مرة واحدة ولمدة ساعة. افتح [لا أستطيع الدخول؟](/recover) واطلب رابطًا جديدًا." },
        ],
      },
    },
  },
  {
    slug: "connect-gmail",
    collection: "getting-started",
    doc: {
      en: {
        title: "Connecting Gmail",
        summary: "Connect your Gmail or Google Workspace mailbox so your campaigns are sent from it and the replies come back to Yolias.",
        blocks: [
          { ol: [
            "Open **Integrations** in the sidebar.",
            "On the **Gmail** card, open the ⋯ menu and choose **Connect**.",
            "Choose your Google account and allow Yolias to send email and read the replies to the emails it sent.",
            "You come back to Yolias with the mailbox **Connected**.",
          ] },
          { p: "Yolias reads only the replies in the threads it started, never the rest of your inbox. Disconnect at any time from the same card or from your Google account's security settings." },
          { p: "Each mailbox has its own sending rules: emails per day, the gap between emails, and the days and hours it sends." },
          { note: "When the Gmail card can't connect, connect the same mailbox with IMAP/SMTP and an app password: [Connecting another mailbox](/help-center/connect-imap-smtp)." },
        ],
      },
      ar: {
        title: "ربط Gmail",
        summary: "اربط Gmail أو بريد Google Workspace لتُرسل حملاتك منه وتعود الردود إلى يولياس.",
        blocks: [
          { ol: [
            "افتح **التكاملات** من الشريط الجانبي.",
            "في كارت **Gmail** افتح قائمة ⋯ واختر **اربط**.",
            "اختر حساب Google واسمح ليولياس بإرسال البريد وقراءة الردود على الرسائل التي أرسلها.",
            "تعود إلى يولياس والبريد بحالة **متصل**.",
          ] },
          { p: "يقرأ يولياس الردود في المحادثات التي بدأها فقط، ولا يقرأ باقي بريدك. ويمكنك فصل الربط في أي وقت من الكارت نفسه أو من إعدادات الأمان في حساب Google." },
          { p: "لكل بريد قواعد إرسال خاصة به: عدد الرسائل يوميًا، والفاصل بين الرسائل، وأيام الإرسال وساعاته." },
          { note: "إذا تعذّر الربط من كارت Gmail، اربط البريد نفسه عبر IMAP/SMTP بكلمة مرور تطبيق: [ربط بريد آخر](/help-center/connect-imap-smtp)." },
        ],
      },
    },
  },
  {
    slug: "connect-imap-smtp",
    collection: "getting-started",
    doc: {
      en: {
        title: "Connecting another mailbox (IMAP/SMTP)",
        summary: "Connect Outlook, Microsoft 365, Zoho, Hostinger or any business mailbox with its IMAP and SMTP settings.",
        blocks: [
          { ol: [
            "Open **Integrations**, and on the **IMAP/SMTP mailbox** card choose **Connect** from the ⋯ menu.",
            "Enter the email address and password. Yolias fills the usual server names from your domain; change them if your provider uses others.",
            "Press **Connect**. Yolias checks the login before saving.",
          ] },
          { p: "With two-step sign-in on, most providers need an **app password** instead of your normal password. Create one in the provider's security settings." },
          { h2: "Common providers" },
          { table: {
            head: ["Provider", "IMAP (incoming)", "SMTP (outgoing)"],
            rows: [
              ["Gmail / Google Workspace", "imap.gmail.com · 993", "smtp.gmail.com · 465"],
              ["Outlook.com / Microsoft 365", "outlook.office365.com · 993", "smtp.office365.com · 587"],
              ["Zoho Mail", "imap.zoho.com · 993", "smtp.zoho.com · 465"],
              ["Hostinger", "imap.hostinger.com · 993", "smtp.hostinger.com · 465"],
              ["Yahoo Mail", "imap.mail.yahoo.com · 993", "smtp.mail.yahoo.com · 465"],
            ],
          } },
          { p: "Zoho accounts in Europe or India use zoho.eu or zoho.in instead of zoho.com." },
        ],
      },
      ar: {
        title: "ربط بريد آخر (IMAP/SMTP)",
        summary: "اربط Outlook أو Microsoft 365 أو Zoho أو Hostinger أو أي بريد عمل بإعدادات IMAP وSMTP الخاصة به.",
        blocks: [
          { ol: [
            "افتح **التكاملات**، وفي كارت **بريد IMAP/SMTP** اختر **اربط** من قائمة ⋯.",
            "اكتب البريد وكلمة المرور. يملأ يولياس أسماء الخوادم المعتادة من نطاقك، وعدّلها إذا كان مزودك يستخدم غيرها.",
            "اضغط **اربط**. يتحقق يولياس من الدخول قبل الحفظ.",
          ] },
          { p: "مع تفعيل التحقق بخطوتين، يحتاج معظم المزودين إلى **كلمة مرور تطبيق** بدل كلمة المرور العادية. أنشئها من إعدادات الأمان لدى المزود." },
          { h2: "المزودون الشائعون" },
          { table: {
            head: ["المزود", "IMAP (الوارد)", "SMTP (الصادر)"],
            rows: [
              ["Gmail / Google Workspace", "imap.gmail.com · 993", "smtp.gmail.com · 465"],
              ["Outlook.com / Microsoft 365", "outlook.office365.com · 993", "smtp.office365.com · 587"],
              ["Zoho Mail", "imap.zoho.com · 993", "smtp.zoho.com · 465"],
              ["Hostinger", "imap.hostinger.com · 993", "smtp.hostinger.com · 465"],
              ["Yahoo Mail", "imap.mail.yahoo.com · 993", "smtp.mail.yahoo.com · 465"],
            ],
          } },
          { p: "حسابات Zoho في أوروبا أو الهند تستخدم zoho.eu أو zoho.in بدل zoho.com." },
        ],
      },
    },
  },
  {
    slug: "company-knowledge",
    collection: "getting-started",
    doc: {
      en: {
        title: "Company Knowledge",
        summary: "What Yolias knows about your business, and how it shapes every message, answer and campaign.",
        blocks: [
          { p: "**Company Knowledge** holds your company profile, your offers, your competitors and the facts Yolias may use. Yolias writes it from your website when you sign up; review it and add what's missing." },
          { ul: [
            "**Profile**: what you sell, to whom and in which markets.",
            "**Offers**: each service or product with its price or terms, picked per campaign.",
            "**Competitors**: how you compare, used when someone mentions one.",
          ] },
          { p: "Every first email, follow-up and answer is written from it. A campaign shows how complete it is before you launch; the fuller it is, the more specific the messages." },
        ],
      },
      ar: {
        title: "معرفة الشركة",
        summary: "ما يعرفه يولياس عن نشاطك، وكيف يشكّل كل رسالة وإجابة وحملة.",
        blocks: [
          { p: "تحتوي **معرفة الشركة** على ملف شركتك وعروضك ومنافسيك والحقائق التي يستخدمها يولياس. يكتبها يولياس من موقعك عند التسجيل، فراجعها وأضف ما ينقص." },
          { ul: [
            "**الملف**: ماذا تبيع، ولمن، وفي أي أسواق.",
            "**العروض**: كل خدمة أو منتج بسعره أو شروطه، وتختار عرضًا لكل حملة.",
            "**المنافسون**: كيف تختلف عنهم، ويُستخدم عندما يذكر أحد منافسًا.",
          ] },
          { p: "كل رسالة أولى ومتابعة وإجابة تُكتب منها. وتعرض الحملة نسبة اكتمالها قبل الإطلاق؛ وكلما اكتملت صارت الرسائل أدق." },
        ],
      },
    },
  },
  {
    slug: "switching-language",
    collection: "getting-started",
    doc: {
      en: {
        title: "Arabic and English",
        summary: "Change the interface language and the language Yolias writes in.",
        blocks: [
          { p: "On public pages, use the language menu in the header. In the app, open your name at the bottom of the sidebar, choose **Settings → General**, and set **Language**." },
          { p: "The interface switches direction with the language. In a campaign's **Message** level you choose the email language, or each person's own language." },
        ],
      },
      ar: {
        title: "العربية والإنجليزية",
        summary: "غيّر لغة الواجهة واتجاهها، واللغة التي يكتب بها يولياس رسائل حملاتك.",
        blocks: [
          { p: "في الصفحات العامة استخدم قائمة اللغة في الأعلى. وداخل التطبيق اضغط على اسمك أسفل الشريط الجانبي واختر **الإعدادات ← عام** ثم **اللغة**." },
          { p: "يتغير اتجاه الواجهة مع اللغة. وفي مستوى **الرسالة** في الحملة تختار لغة الرسائل، أو لغة كل شخص." },
        ],
      },
    },
  },

  // ───────────────────────── Campaigns ─────────────────────────
  {
    slug: "creating-a-campaign",
    collection: "campaigns",
    doc: {
      en: {
        title: "Creating a campaign",
        summary: "Three levels like an ads manager: the campaign, its audiences and the message.",
        blocks: [
          { p: "Open **Campaigns → Create campaign**. The three levels are on the side; **Save draft** keeps your work." },
          { p: "**Build with Yolias** fills the whole campaign from your Company Knowledge: name, offer, target, budget, messages a day and audiences. Review it and launch." },
          { h2: "1. Campaign" },
          { ul: [
            "**Name** and **objective**: Meetings, Sales, Website leads or Qualified leads.",
            "**Offer**: one of your offers from Company Knowledge, or your own words.",
            "**Target** (meetings, sales or leads you want) and **messages a day**.",
            "**Budget** in US dollars, total or per day, $5 minimum. The summary shows the people it reaches, the days it takes, and the replies and meetings to expect.",
            "**Dates**, and under **Days, hours and pace**: the days and hours Yolias contacts people, a cost cap per result and open tracking.",
          ] },
          { h2: "2. Audiences" },
          { p: "One or more, like ad sets: new targeting (locations, industries, company size, job titles and more) or a saved audience. See [Audiences](/help-center/audiences)." },
          { h2: "3. Message" },
          { p: "The mailbox it sends from, the name emails are signed with, the tone, the language and notes for Yolias. Yolias shows its two openings per audience and a sample email. Then **Launch campaign**." },
          { h2: "After launch" },
          { p: "Yolias finds the people for each audience every day within the budget, writes the first email for your approval, then sends from your mailbox in your hours, follows up twice, answers and books." },
        ],
      },
      ar: {
        title: "إنشاء حملة",
        summary: "ثلاثة مستويات مثل مدير الإعلانات: الحملة وجماهيرها والرسالة.",
        blocks: [
          { p: "افتح **الحملات ← إنشاء حملة**. المستويات الثلاثة على الجانب، و**حفظ كمسودة** يحفظ عملك." },
          { p: "**أنشئها مع يولياس** يملأ الحملة كاملة من معرفة شركتك: الاسم والعرض والمستهدف والميزانية وعدد الرسائل اليومية والجماهير. راجعها وأطلقها." },
          { h2: "1. الحملة" },
          { ul: [
            "**الاسم** و**الهدف**: اجتماعات أو مبيعات أو نماذج الموقع أو عملاء مؤهلون.",
            "**العرض**: أحد عروضك من معرفة الشركة، أو بكلماتك.",
            "**المستهدف** (الاجتماعات أو المبيعات أو العملاء الذين تريدهم) و**عدد الرسائل اليومية**.",
            "**الميزانية** بالدولار، إجمالية أو يومية، وأقلها 5 دولارات. ويعرض الملخص من تصل إليهم والمدة والردود والاجتماعات المتوقعة.",
            "**التواريخ**، وفي **الأيام والساعات والوتيرة**: أيام التواصل وساعاته، وحد أقصى لتكلفة النتيجة، وتتبع الفتح.",
          ] },
          { h2: "2. الجماهير" },
          { p: "جمهور أو أكثر مثل مجموعات الإعلانات: استهداف جديد (المواقع والمجالات وحجم الشركة والمسميات وغيرها) أو جمهور محفوظ. راجع [الجماهير](/help-center/audiences)." },
          { h2: "3. الرسالة" },
          { p: "البريد الذي تُرسل منه، والاسم الذي تُوقّع به الرسائل، والأسلوب، واللغة، وملاحظات ليولياس. ويعرض يولياس افتتاحيتين لكل جمهور ورسالة نموذجية. ثم **أطلق الحملة**." },
          { h2: "بعد الإطلاق" },
          { p: "يجد يولياس الأشخاص لكل جمهور كل يوم في حدود الميزانية، ويكتب الرسالة الأولى لموافقتك، ثم يرسل من بريدك في ساعاتك، ويتابع مرتين، ويرد ويحجز." },
        ],
      },
    },
  },
  {
    slug: "campaign-objectives",
    collection: "campaigns",
    doc: {
      en: {
        title: "Campaign objectives",
        summary: "The objective tells Yolias which result to pursue and how it counts.",
        blocks: [
          { table: {
            head: ["Objective", "What Yolias does with interest", "The result"],
            rows: [
              ["Meetings", "Offers two free times and your booking page, and books", "A booked meeting"],
              ["Sales", "Sends the tracked link to your product or pricing page", "A purchase counted by the Yolias pixel"],
              ["Website leads", "Sends the tracked link to your form", "A form counted by the Yolias pixel"],
              ["Qualified leads", "Finds and saves matching companies and people, without contacting them", "A saved lead"],
            ],
          } },
          { p: "Sales and Website leads need your website link and a pixel with its conversion event. Each objective has its ready columns in the Campaigns table." },
        ],
      },
      ar: {
        title: "أهداف الحملة",
        summary: "الهدف يحدد ليولياس النتيجة التي يسعى إليها وكيف تُحسب.",
        blocks: [
          { table: {
            head: ["الهدف", "ماذا يفعل يولياس مع المهتم", "النتيجة"],
            rows: [
              ["اجتماعات", "يقترح موعدين متاحين وصفحة الحجز ويحجز", "اجتماع محجوز"],
              ["المبيعات", "يرسل الرابط المتتبَّع لصفحة المنتج أو الأسعار", "عملية شراء يحسبها بيكسل يولياس"],
              ["نماذج الموقع", "يرسل الرابط المتتبَّع لنموذجك", "نموذج يحسبه بيكسل يولياس"],
              ["عملاء مؤهلون", "يجد الشركات والأشخاص المطابقين ويحفظهم دون التواصل معهم", "عميل محتمل محفوظ"],
            ],
          } },
          { p: "المبيعات ونماذج الموقع تحتاج رابط موقعك وبيكسل بحدث التحويل. ولكل هدف أعمدته الجاهزة في جدول الحملات." },
        ],
      },
    },
  },
  {
    slug: "campaign-results",
    collection: "campaigns",
    doc: {
      en: {
        title: "Reading campaign results",
        summary: "The Campaigns table, its columns, the Breakdown and a campaign's page.",
        blocks: [
          { p: "**Campaigns** has three tabs: Campaigns, Audiences and Messages. Each row has an on/off switch, its status and channel, then your columns." },
          { ul: [
            "**Reached**: people sent at least one email, each once.",
            "**Replies**: people who replied (automatic replies don't count).",
            "**Interested**: replies that showed interest or asked for a meeting.",
            "**Meetings**: meetings booked, canceled ones excluded.",
            "**Spend** and **Cost per result**.",
          ] },
          { p: "**Columns** adds, moves and pins columns, with ready sets per objective and your own formulas. **Breakdown** splits the numbers by day, audience, message, country, industry or job title. The date range sets every number." },
          { p: "A campaign's page shows its results with the cost per result first, a chart by day, today's split of the budget between its audiences, and its activity, conversations, meetings and settings." },
        ],
      },
      ar: {
        title: "قراءة نتائج الحملات",
        summary: "جدول الحملات وأعمدته والتقسيم وصفحة الحملة، وكيف تقرأ كل رقم فيها.",
        blocks: [
          { p: "في **الحملات** ثلاثة تبويبات: الحملات والجماهير والرسائل. ولكل صف زر تشغيل وإيقاف، وحالته وقناته، ثم أعمدتك." },
          { ul: [
            "**وصلت إليهم**: أشخاص أُرسلت لهم رسالة واحدة على الأقل، وكل شخص مرة.",
            "**الردود**: أشخاص ردّوا (الردود التلقائية لا تُحسب).",
            "**المهتمون**: ردود فيها اهتمام أو طلب اجتماع.",
            "**الاجتماعات**: اجتماعات محجوزة، دون الملغاة.",
            "**الإنفاق** و**تكلفة النتيجة**.",
          ] },
          { p: "من **الأعمدة** تضيف الأعمدة وترتبها وتثبتها، مع مجموعات جاهزة لكل هدف ومعادلاتك الخاصة. و**التقسيم** يقسم الأرقام حسب اليوم أو الجمهور أو الرسالة أو البلد أو المجال أو المسمى. والفترة الزمنية تحدد كل الأرقام." },
          { p: "صفحة الحملة تعرض نتائجها مع تكلفة النتيجة أولًا، ورسمًا يوميًا، وتوزيع اليوم للميزانية بين جماهيرها، ثم نشاطها ومحادثاتها واجتماعاتها وإعداداتها." },
        ],
      },
    },
  },
  {
    slug: "budget-and-optimization",
    collection: "campaigns",
    doc: {
      en: {
        title: "Budget and optimization",
        summary: "How spend is counted and how Yolias moves the budget between audiences every day.",
        blocks: [
          { p: "Spend is the prospects a campaign uses at your rate per person. Emails, replies and meetings are never charged, and the same person is never counted twice." },
          { h2: "Today's split between audiences" },
          { p: "Once a day each audience gets a share of the campaign's budget from its results: booked meetings for Meetings, purchases or forms for Sales and Website leads, and positive replies while there are too few. New audiences get an equal share first (**Learning**). An audience that does clearly worse, or costs more than your cost cap, gets no new budget." },
          { p: "The split is on the campaign's page. Yolias never changes your targeting, writing rules or sending limits." },
          { h2: "Protection" },
          { p: "A mailbox whose emails bounce too much has its campaigns paused, with the reason on the campaign page. One person is never written to by two campaigns at once." },
        ],
      },
      ar: {
        title: "الميزانية والتحسين",
        summary: "كيف يُحسب الإنفاق، وكيف يوزّع يولياس الميزانية بين الجماهير كل يوم.",
        blocks: [
          { p: "الإنفاق هو العملاء المحتملون الذين تستخدمهم الحملة بسعرك للشخص. الرسائل والردود والاجتماعات لا تُحتسب أبدًا، ولا يُحسب الشخص نفسه مرتين." },
          { h2: "توزيع اليوم بين الجماهير" },
          { p: "مرة يوميًا يحصل كل جمهور على نصيب من ميزانية الحملة حسب نتائجه: الاجتماعات المحجوزة لهدف الاجتماعات، والشراء أو النماذج للمبيعات ونماذج الموقع، والردود الإيجابية ما دامت النتائج قليلة. والجماهير الجديدة تأخذ نصيبًا متساويًا أولًا (**مرحلة التعلم**). والجمهور الأضعف بوضوح، أو الذي تتجاوز تكلفته الحد الأقصى، لا يأخذ ميزانية جديدة." },
          { p: "يظهر التوزيع في صفحة الحملة. ولا يغيّر يولياس استهدافك أو قواعد الكتابة أو حدود الإرسال." },
          { h2: "الحماية" },
          { p: "البريد الذي ترتد رسائله بنسبة عالية تتوقف حملاته مع ذكر السبب في صفحة الحملة. ولا تراسل حملتان الشخص نفسه في الوقت نفسه." },
        ],
      },
    },
  },
  {
    slug: "pixel-and-events",
    collection: "campaigns",
    doc: {
      en: {
        title: "The Yolias pixel",
        summary: "Count sales and form leads on your website and credit them to the campaign that sent each person.",
        blocks: [
          { ol: [
            "Open **Events Manager** and create a pixel.",
            "Copy the base code into your website's <head>.",
            "Add the events you need: Purchase with its value, InitiateCheckout, Lead, CompleteRegistration or your own.",
            "Check them with a test code or the Yolias Pixel Helper for Chrome.",
          ] },
          { p: "Links Yolias sends carry who each person is, so their visits, purchases and forms count for their campaign within its attribution window (7 days by default; 1 or 28 per campaign). Allowed and blocked domains keep other sites from sending events." },
        ],
      },
      ar: {
        title: "بيكسل يولياس",
        summary: "احسب المبيعات ونماذج موقعك وانسبها للحملة التي أرسلت كل شخص.",
        blocks: [
          { ol: [
            "افتح **مدير الأحداث** وأنشئ بيكسل.",
            "انسخ الكود الأساسي إلى <head> في موقعك.",
            "أضف الأحداث التي تحتاجها: Purchase مع قيمته، وInitiateCheckout، وLead، وCompleteRegistration، أو أحداثك الخاصة.",
            "تحقق منها برمز اختبار أو بإضافة Yolias Pixel Helper في Chrome.",
          ] },
          { p: "الروابط التي يرسلها يولياس تحمل هوية كل شخص، فتُحسب زياراته ومشترياته ونماذجه لحملته خلال نافذة النسب (7 أيام افتراضيًا، أو يوم أو 28 يومًا لكل حملة). والنطاقات المسموحة والمحظورة تمنع المواقع الأخرى من إرسال أحداث." },
        ],
      },
    },
  },
  {
    slug: "yolias-ai",
    collection: "campaigns",
    doc: {
      en: {
        title: "Yolias AI",
        summary: "The engine behind every campaign, and the assistant you can ask from any screen.",
        blocks: [
          { p: "Yolias AI runs each campaign: it finds the companies and decision makers, writes each email from your Company Knowledge, follows up, answers, offers times and books." },
          { p: "Open **Yolias AI** in the sidebar, or **Ask Yolias AI** on any screen, to ask about your campaigns, replies and meetings, or describe who you want to reach and let it prepare a campaign for you to review and launch." },
        ],
      },
      ar: {
        title: "Yolias AI",
        summary: "المحرك وراء كل حملة، والمساعد الذي تسأله من أي شاشة.",
        blocks: [
          { p: "يدير Yolias AI كل حملة: يجد الشركات وصنّاع القرار، ويكتب كل رسالة من معرفة شركتك، ويتابع ويرد ويقترح المواعيد ويحجز." },
          { p: "افتح **Yolias AI** من الشريط الجانبي، أو **اسأل Yolias AI** من أي شاشة، لتسأل عن حملاتك وردودك واجتماعاتك، أو صف من تريد الوصول إليه ليجهّز لك حملة تراجعها وتطلقها." },
        ],
      },
    },
  },
  {
    slug: "awaiting-data-source",
    collection: "campaigns",
    doc: {
      en: {
        title: "A campaign waiting to start",
        summary: "What “Waiting to start” means on a campaign or search, and what happens next.",
        blocks: [
          { p: "Yolias has the targeting ready, but no data source that covers this kind of search is available for your workspace. The campaign keeps everything and starts by itself once one is." },
          { p: "To start now, change the audience to one Yolias can search (companies and people by industry, location, size and job title), or use a saved or custom audience." },
        ],
      },
      ar: {
        title: "حملة بانتظار البدء",
        summary: "ماذا تعني «بانتظار البدء» في حملة أو بحث، وماذا يحدث بعدها.",
        blocks: [
          { p: "الاستهداف جاهز لدى يولياس، لكن لا يتوفر لمساحة عملك مصدر بيانات يغطي هذا النوع من البحث. وتحتفظ الحملة بكل شيء وتبدأ وحدها عند توفره." },
          { p: "لتبدأ الآن، غيّر الجمهور إلى نوع يبحث فيه يولياس (الشركات والأشخاص حسب المجال والموقع والحجم والمسمى)، أو استخدم جمهورًا محفوظًا أو مخصصًا." },
        ],
      },
    },
  },
  {
    slug: "search-needs-attention",
    collection: "campaigns",
    doc: {
      en: {
        title: "When Yolias AI can't read a request",
        summary: "What the red “Needs attention” card means and how to continue.",
        blocks: [
          { ol: [
            "Read the card: it says what went wrong.",
            "Press **Try again**. Your request is saved.",
            "If it fails again, make the request more specific (a market, an industry and the roles you want) and send it again.",
          ] },
          { note: "Retrying reads the text only. Attach a file again in a new request if you need it." },
        ],
      },
      ar: {
        title: "عندما لا يستطيع Yolias AI قراءة الطلب",
        summary: "ماذا تعني بطاقة «يحتاج انتباهك» الحمراء وكيف تكمل.",
        blocks: [
          { ol: [
            "اقرأ البطاقة: تذكر ما الذي حدث.",
            "اضغط **حاول مجددًا**. طلبك محفوظ.",
            "إذا فشل مرة أخرى، اجعل الطلب أدق (سوق ومجال والمسميات التي تريدها) وأرسله من جديد.",
          ] },
          { note: "إعادة المحاولة تقرأ النص فقط. أرفق الملف من جديد في طلب جديد إذا احتجته." },
        ],
      },
    },
  },

  // ───────────────────────── Audiences & leads ─────────────────────────
  {
    slug: "audiences",
    collection: "audiences-leads",
    doc: {
      en: {
        title: "Audiences",
        summary: "New targeting, saved targeting, custom audiences from your lists and lookalikes of your best customers.",
        blocks: [
          { h2: "Targeting" },
          { p: "Every country, then its regions and cities, included or excluded; industries, company type and size, job titles, seniority, department, hiring, funding, technologies, keywords and companies never to contact. Yolias shows how many matching companies and people it already knows." },
          { h2: "Audiences page" },
          { ul: [
            "**Custom**: a past campaign, your customers, people who booked, interested people, or a CSV file.",
            "**Lookalike**: companies and people that share the traits of a base, at a similarity from 1 to 10, with the base size and a confidence.",
            "**Saved targeting**: targeting you reuse in any campaign.",
          ] },
          { p: "Building an audience contacts no one. A campaign contacts people only after you launch it." },
        ],
      },
      ar: {
        title: "الجماهير",
        summary: "استهداف جديد، واستهداف محفوظ، وجماهير مخصصة من قوائمك، وجماهير مشابهة لأفضل عملائك.",
        blocks: [
          { h2: "الاستهداف" },
          { p: "كل الدول، ثم مناطقها ومدنها، تضمينًا أو استبعادًا؛ والمجالات ونوع الشركة وحجمها والمسميات والمستوى والقسم والتوظيف والتمويل والتقنيات والكلمات المفتاحية والشركات التي لا تريد التواصل معها. ويعرض يولياس عدد الشركات والأشخاص المطابقين الذين يعرفهم." },
          { h2: "صفحة الجماهير" },
          { ul: [
            "**مخصص**: حملة سابقة، أو عملاؤك، أو من حجزوا، أو المهتمون، أو ملف CSV.",
            "**مشابه**: شركات وأشخاص يشتركون في صفات جمهور أساسي، بدرجة تشابه من 1 إلى 10، مع حجم الأساس ودرجة الثقة.",
            "**استهداف محفوظ**: استهداف تعيد استخدامه في أي حملة.",
          ] },
          { p: "بناء الجمهور لا يتواصل مع أحد. والحملة تتواصل مع الأشخاص بعد إطلاقها فقط." },
        ],
      },
    },
  },
  {
    slug: "prospects-workspace",
    collection: "audiences-leads",
    doc: {
      en: {
        title: "Working with leads",
        summary: "Companies and people your campaigns found, their contact details, and finding decision makers.",
        blocks: [
          { p: "**Leads** has three tabs: **Companies**, **People** and **Saved**. Filter by campaign, search, sort and select rows across pages." },
          { h2: "Contact details" },
          { p: "The business email and phone a person or company publishes show once Yolias delivers them, with their verification state. Viewing them again never uses prospects." },
          { h2: "Find decision makers" },
          { p: "On **Companies**, select companies and choose **Find decision makers**. They are saved to **People**." },
          { p: "Open a company or a person to see where they came from, the campaign that reached them and every message." },
        ],
      },
      ar: {
        title: "العمل مع العملاء المحتملين",
        summary: "الشركات والأشخاص الذين وجدتهم حملاتك، وبيانات التواصل، وإيجاد صنّاع القرار.",
        blocks: [
          { p: "في **العملاء المحتملون** ثلاثة تبويبات: **الشركات** و**الأشخاص** و**المحفوظون**. صفِّ حسب الحملة، وابحث، ورتّب، وحدد صفوفًا عبر الصفحات." },
          { h2: "بيانات التواصل" },
          { p: "يظهر البريد والهاتف المهنيان اللذان ينشرهما الشخص أو الشركة عند تسليمهما، مع حالة التحقق. وعرضهما مرة أخرى لا يستهلك عملاء محتملين." },
          { h2: "إيجاد صنّاع القرار" },
          { p: "في **الشركات** حدد الشركات واختر **إيجاد صنّاع القرار**. ويُحفظون في **الأشخاص**." },
          { p: "افتح شركة أو شخصًا لترى مصدره، والحملة التي وصلت إليه، وكل رسالة." },
        ],
      },
    },
  },
  {
    slug: "exporting-prospects",
    collection: "audiences-leads",
    doc: {
      en: {
        title: "Exporting leads and campaigns",
        summary: "Download leads, campaigns and audiences as CSV or Excel.",
        blocks: [
          { ul: [
            "**Leads**: filter the tab, then **Export**; or select rows and choose **Export selected**.",
            "**Campaigns**: **Export** downloads the table as shown, with your columns, as CSV or Excel.",
          ] },
          { p: "Column headers follow your interface language. Files open in Excel, Numbers or Google Sheets." },
        ],
      },
      ar: {
        title: "تصدير العملاء المحتملين والحملات",
        summary: "نزّل العملاء المحتملين والحملات والجماهير كملف CSV أو Excel.",
        blocks: [
          { ul: [
            "**العملاء المحتملون**: صفِّ التبويب ثم **تصدير**، أو حدد صفوفًا واختر **تصدير المحدد**.",
            "**الحملات**: **تصدير** ينزّل الجدول كما يظهر، بأعمدتك، كملف CSV أو Excel.",
          ] },
          { p: "عناوين الأعمدة بلغة الواجهة. وتفتح الملفات في Excel أو Numbers أو Google Sheets." },
        ],
      },
    },
  },

  // ───────────────────────── Conversations & meetings ─────────────────────────
  {
    slug: "conversations",
    collection: "conversations-meetings",
    doc: {
      en: {
        title: "Conversations",
        summary: "Every reply from every campaign in one place, and what Yolias hands to you.",
        blocks: [
          { p: "**Conversations** lists every thread with its person, company and campaign. Filter by campaign or type of reply." },
          { p: "Yolias answers questions and objections from your Company Knowledge, offers times and books. It hands you complaints, negotiations, requests for a person and questions it can't answer: those are under **Needs you**." },
          { p: "Reply from the thread whenever you want to take over." },
        ],
      },
      ar: {
        title: "المحادثات",
        summary: "كل رد من كل حملة في مكان واحد، وما يسلّمه يولياس لك.",
        blocks: [
          { p: "تعرض **المحادثات** كل محادثة مع الشخص والشركة والحملة. صفِّ حسب الحملة أو نوع الرد." },
          { p: "يجيب يولياس عن الأسئلة والاعتراضات من معرفة شركتك، ويقترح المواعيد ويحجز. ويسلّمك الشكاوى والتفاوض وطلبات التحدث مع شخص والأسئلة التي لا يعرف إجابتها: تجدها في **يحتاجك**." },
          { p: "رد من المحادثة نفسها متى أردت أن تتولاها." },
        ],
      },
    },
  },
  {
    slug: "deals-and-meetings",
    collection: "conversations-meetings",
    doc: {
      en: {
        title: "Meetings and your booking page",
        summary: "From a reply to a booked meeting, your booking page, Google Calendar, reminders and the outcome.",
        blocks: [
          { h2: "From a reply to a meeting" },
          { p: "When someone shows interest, Yolias replies in the same thread with two free times and your booking page. If they name a time that is free, Yolias books it, confirms and adds it to both calendars." },
          { h2: "Meetings page" },
          { ul: [
            "The top shows meetings booked in the last 30 days, the spend and the **cost per meeting**.",
            "**Link visits**: who opened your booking link, from which campaign, and who started without booking.",
            "**Bookings**: upcoming and past meetings. After a meeting, mark the outcome: became a customer, didn't buy (with a reason) or no-show.",
            "**Booking page**: yolias.com/meet/your-name with up to four meeting types and your weekly hours.",
          ] },
          { h2: "Reminders" },
          { p: "Guests get reminders a day and an hour before; you get a brief on the person before the meeting." },
        ],
      },
      ar: {
        title: "الاجتماعات وصفحة الحجز",
        summary: "من الرد إلى الاجتماع المحجوز، وصفحة الحجز، وتقويم Google، والتذكيرات، والنتيجة.",
        blocks: [
          { h2: "من الرد إلى الاجتماع" },
          { p: "عندما يُظهر شخص اهتمامًا، يرد يولياس في المحادثة نفسها بموعدين متاحين وصفحة الحجز. وإذا ذكر موعدًا متاحًا يحجزه يولياس ويؤكده ويضيفه إلى التقويم." },
          { h2: "صفحة الاجتماعات" },
          { ul: [
            "أعلى الصفحة: الاجتماعات المحجوزة في آخر 30 يومًا، والإنفاق، و**تكلفة الاجتماع**.",
            "**زيارات الرابط**: من فتح رابط الحجز، ومن أي حملة، ومن بدأ ولم يحجز.",
            "**الحجوزات**: الاجتماعات القادمة والسابقة. وبعد الاجتماع حدد نتيجته: أصبح عميلًا، أو لم يشترِ (مع السبب)، أو لم يحضر.",
            "**صفحة الحجز**: yolias.com/meet/اسمك مع حتى أربعة أنواع اجتماعات وساعاتك الأسبوعية.",
          ] },
          { h2: "التذكيرات" },
          { p: "يصل الضيف تذكير قبل الموعد بيوم وبساعة، ويصلك ملخص عن الشخص قبل الاجتماع." },
        ],
      },
    },
  },
  {
    slug: "google-calendar",
    collection: "conversations-meetings",
    doc: {
      en: {
        title: "Connecting Google Calendar",
        summary: "Bookings land on your calendar, and your busy times are never offered.",
        blocks: [
          { ol: [
            "Open **Integrations** and choose **Connect** on the **Google Calendar** card.",
            "Allow Yolias to see your free and busy times and add events.",
          ] },
          { p: "Every booking is added to your calendar with Google's invitation to the guest. Without Google Calendar, guests get an “Add to Google Calendar” link in their confirmation." },
        ],
      },
      ar: {
        title: "ربط تقويم Google",
        summary: "تصل الحجوزات إلى تقويمك، ولا تُعرض أوقات انشغالك أبدًا.",
        blocks: [
          { ol: [
            "افتح **التكاملات** واختر **اربط** في كارت **تقويم Google**.",
            "اسمح ليولياس برؤية أوقات فراغك وانشغالك وإضافة الأحداث.",
          ] },
          { p: "يُضاف كل حجز إلى تقويمك مع دعوة Google للضيف. ومن دون تقويم Google يصل الضيف رابط «أضف إلى تقويم Google» في رسالة التأكيد." },
        ],
      },
    },
  },

  // ───────────────────────── Billing & account ─────────────────────────
  {
    slug: "choosing-a-plan",
    collection: "account",
    doc: {
      en: {
        title: "Pay As You Go or a monthly plan",
        summary: "Every option has every feature and unlimited users; you pay for prospects only.",
        blocks: [
          { p: "A **prospect** is a person Yolias finds and reaches for your campaigns. It's the only unit: writing and sending emails, replies and meetings are never charged, and the same prospect is never counted twice." },
          { table: {
            head: ["Option", "Price", "How it works"],
            rows: [
              ["Pay As You Go", "From $5", "Prepaid credit ($5, $20, $50 or $100), no subscription, no expiry"],
              ["Growth", "$100 a month", "2,000 prospects a month"],
              ["Scale", "$200 a month", "4,000 prospects a month"],
            ],
          } },
          { p: "Annual billing is 20% off. Checkout shows how many prospects an amount gives before you pay. On a plan, its monthly prospects are used first, then any credit. See [pricing](/pricing)." },
        ],
      },
      ar: {
        title: "الدفع حسب الاستخدام أو خطة شهرية",
        summary: "كل خيار فيه كل المزايا ومستخدمون بلا حد، وتدفع مقابل العملاء المحتملين فقط.",
        blocks: [
          { p: "**العميل المحتمل** شخص يجده يولياس ويصل إليه لحملاتك. وهو الوحدة الوحيدة: كتابة الرسائل وإرسالها والردود والاجتماعات لا تُحتسب أبدًا، ولا يُحسب العميل نفسه مرتين." },
          { table: {
            head: ["الخيار", "السعر", "كيف يعمل"],
            rows: [
              ["الدفع حسب الاستخدام", "من 5 دولارات", "رصيد مسبق (5 أو 20 أو 50 أو 100 دولار)، بلا اشتراك وبلا انتهاء"],
              ["النمو", "100 دولار شهريًا", "2,000 عميل محتمل شهريًا"],
              ["التوسع", "200 دولار شهريًا", "4,000 عميل محتمل شهريًا"],
            ],
          } },
          { p: "الدفع السنوي بخصم 20%. وتعرض صفحة الدفع عدد العملاء الذي يعطيه المبلغ قبل الدفع. وفي الخطة تُستخدم عملاؤها الشهريون أولًا ثم الرصيد. راجع [الأسعار](/pricing)." },
        ],
      },
    },
  },
  {
    slug: "changing-plan",
    collection: "account",
    doc: {
      en: {
        title: "Changing or canceling your plan",
        summary: "Move between Pay As You Go, Growth and Scale, or cancel.",
        blocks: [
          { p: "Owners and admins open their name in the sidebar, then **Settings → Billing**. **Adjust plan** changes it; **Cancel plan** cancels at the end of the paid period, and you can resume before then." },
          { p: "A plan's prospects reset on the first day of each month. Credit you topped up stays until you use it. After a plan ends, campaigns stop reaching new people and everything stays saved." },
        ],
      },
      ar: {
        title: "تغيير الخطة أو إلغاؤها",
        summary: "انتقل بين الدفع حسب الاستخدام والنمو والتوسع، أو ألغِ.",
        blocks: [
          { p: "يفتح المالك أو المسؤول اسمه في الشريط الجانبي ثم **الإعدادات ← الفوترة**. **تعديل الخطة** يغيّرها، و**إلغاء الخطة** يلغيها في نهاية الفترة المدفوعة، ويمكنك الاستئناف قبلها." },
          { p: "يتجدد عملاء الخطة في أول يوم من كل شهر، ويبقى الرصيد المشحون حتى تستخدمه. وبعد انتهاء الخطة تتوقف الحملات عن الوصول إلى أشخاص جدد، ويبقى كل شيء محفوظًا." },
        ],
      },
    },
  },
  {
    slug: "inviting-teammates",
    collection: "account",
    doc: {
      en: {
        title: "Adding people",
        summary: "Add colleagues as Admin, Advertiser or Analyst. Unlimited users on every plan.",
        blocks: [
          { ol: [
            "Open your name at the bottom of the sidebar, choose **Settings → Team**.",
            "Press **Add people**, enter their work email and choose a role.",
            "They get an email; opening it joins them to your workspace.",
          ] },
          { table: {
            head: ["Role", "Can"],
            rows: [
              ["Admin", "Everything, including billing and the team"],
              ["Advertiser", "Create and run campaigns, audiences and conversations"],
              ["Analyst", "View campaigns and results"],
            ],
          } },
          { p: "Owners and admins can change roles and revoke pending invitations." },
        ],
      },
      ar: {
        title: "إضافة أشخاص",
        summary: "أضف زملاءك كمسؤول أو معلن أو محلل. مستخدمون بلا حد في كل خطة.",
        blocks: [
          { ol: [
            "اضغط على اسمك أسفل الشريط الجانبي واختر **الإعدادات ← الفريق**.",
            "اضغط **إضافة أشخاص**، واكتب بريد العمل، واختر الدور.",
            "يصلهم بريد، وبفتحه ينضمون إلى مساحة عملك.",
          ] },
          { table: {
            head: ["الدور", "يستطيع"],
            rows: [
              ["مسؤول", "كل شيء، بما فيه الفوترة والفريق"],
              ["معلن", "إنشاء الحملات وتشغيلها والجماهير والمحادثات"],
              ["محلل", "عرض الحملات والنتائج"],
            ],
          } },
          { p: "يستطيع المالك والمسؤول تغيير الأدوار وإلغاء الدعوات المعلقة." },
        ],
      },
    },
  },
  {
    slug: "deleting-account",
    collection: "account",
    doc: {
      en: {
        title: "Deleting your account",
        summary: "What gets removed, and what to do first if you own a team workspace.",
        blocks: [
          { p: "Open your name in the sidebar → **Settings → Account** → **Delete account**, and confirm." },
          { ul: [
            "Your profile is removed and you are signed out.",
            "If you are the only member, the workspace and its campaigns, audiences and leads are deleted too.",
            "If others are in your workspace, remove them from **Team** first.",
          ] },
          { note: "Deletion can't be undone. Export what you want to keep first." },
        ],
      },
      ar: {
        title: "حذف الحساب",
        summary: "ما الذي يُحذف، وماذا تفعل أولًا إذا كنت تملك مساحة عمل فيها فريق.",
        blocks: [
          { p: "اضغط على اسمك في الشريط الجانبي ← **الإعدادات ← الحساب** ← **حذف الحساب**، وأكّد." },
          { ul: [
            "يُحذف ملفك الشخصي ويُسجَّل خروجك.",
            "إذا كنت العضو الوحيد، تُحذف مساحة العمل وحملاتها وجماهيرها وعملاؤها المحتملون أيضًا.",
            "إذا كان معك آخرون في مساحة العمل، أزلهم من **الفريق** أولًا.",
          ] },
          { note: "لا يمكن التراجع عن الحذف. صدّر ما تريد الاحتفاظ به أولًا." },
        ],
      },
    },
  },
];

export const helpHero: Localized<{ title: string; lead: string; collectionsTitle: string; popularTitle: string }> = {
  en: { title: "How can we help?", lead: "Short answers about campaigns, audiences, leads, conversations, meetings and your account.", collectionsTitle: "Browse by topic", popularTitle: "All articles" },
  ar: { title: "كيف يمكننا مساعدتك؟", lead: "إجابات قصيرة عن الحملات والجماهير والعملاء المحتملين والمحادثات والاجتماعات وحسابك.", collectionsTitle: "تصفح حسب الموضوع", popularTitle: "كل المقالات" },
};
