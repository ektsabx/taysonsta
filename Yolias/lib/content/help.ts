import type { Doc, Localized } from "./types";

// Help Center: short, task-focused answers. Reference material lives in /docs.

export interface HelpCollection {
  id: "getting-started" | "using-yolias" | "account";
  icon: "rocket" | "sparkles" | "users";
  text: Localized<{ title: string; description: string }>;
}

export const collections: HelpCollection[] = [
  { id: "getting-started", icon: "rocket", text: {
    en: { title: "Getting started", description: "Signing in, choosing a plan and setting your language." },
    ar: { title: "البداية", description: "تسجيل الدخول واختيار الخطة وضبط اللغة." },
  } },
  { id: "using-yolias", icon: "sparkles", text: {
    en: { title: "Using Yolias AI", description: "Searches, their statuses and exporting results." },
    ar: { title: "استخدام يولياس AI", description: "عمليات البحث وحالاتها وتصدير النتائج." },
  } },
  { id: "account", icon: "users", text: {
    en: { title: "Account & team", description: "Teammates, plan changes and deleting your account." },
    ar: { title: "الحساب والفريق", description: "أعضاء الفريق وتغيير الخطة وحذف الحساب." },
  } },
];

export interface HelpArticle {
  slug: string;
  collection: HelpCollection["id"];
  doc: Localized<Doc>;
}

export const articles: HelpArticle[] = [
  {
    slug: "prospects-workspace",
    collection: "using-yolias",
    doc: {
      en: {
        title: "Working with Prospects",
        summary: "Tabs, filters, selecting across pages, contact details, exporting and finding decision makers.",
        blocks: [
          { figure: { src: "/docs/shots/en-prospects.png", alt: "The Prospects workspace", caption: "Example data.", marks: [
            { x: 30, y: 14, label: "Tabs: People, Companies, Local Businesses." },
            { x: 25, y: 38, label: "Tick rows, or tick the header and then “Select all matching” to act on every page." },
            { x: 93, y: 6, label: "Export CSV." },
          ] } },
          { h2: "Contact details" },
          { p: "The email and phone a person or company publishes show as soon as Yolias delivers them, labelled by verification state. Seeing them never uses extra prospects: the person was counted when Yolias delivered them." },
          { h2: "Find decision makers at a company" },
          { p: "On the Companies or Local Businesses tab, select companies and choose **Find decision makers**. They come with the company at no extra prospects and are saved straight to People." },
          { h2: "Export" },
          { p: "**Export CSV** downloads the tab as filtered; **Export selected** downloads only the rows you picked." },
        ],
      },
      ar: {
        title: "العمل في العملاء المحتملين",
        summary: "التبويبات والتصفية والتحديد عبر الصفحات وبيانات التواصل والتصدير وإيجاد صناع القرار.",
        blocks: [
          { figure: { src: "/docs/shots/ar-prospects.png", alt: "مساحة العملاء المحتملين", caption: "بيانات مثال.", marks: [
            { x: 30, y: 14, label: "التبويبات: الأشخاص والشركات والأنشطة المحلية." },
            { x: 25, y: 38, label: "حدّد الصفوف، أو حدّد العنوان ثم «تحديد كل المطابقة» للعمل على كل الصفحات." },
            { x: 93, y: 6, label: "تصدير CSV." },
          ] } },
          { h2: "بيانات التواصل" },
          { p: "يظهر البريد والهاتف اللذان ينشرهما الشخص أو الشركة فور تسليم يولياس لهما، مصنّفين حسب حالة التحقق. ورؤيتهما لا تستهلك عملاء محتملين إضافيين: تم احتساب الشخص عند تسليمه." },
          { h2: "إيجاد صناع القرار في شركة" },
          { p: "في تبويب الشركات أو الأنشطة المحلية حدّد الشركات واختر **إيجاد صناع القرار**. يأتي صنّاع القرار مع الشركة دون استهلاك عملاء محتملين إضافيين، ويُحفظون مباشرة في الأشخاص." },
          { h2: "التصدير" },
          { p: "**تصدير CSV** ينزّل التبويب كما هو مصفّى، و**تصدير المحدد** ينزّل الصفوف التي اخترتها فقط." },
        ],
      },
    },
  },
  {
    slug: "deals-and-meetings",
    collection: "using-yolias",
    doc: {
      en: {
        title: "From reply to meeting",
        summary: "From a reply to a booked meeting, your booking page, Google Calendar and Meet, reminders, the outcome after the meeting and the morning summary.",
        blocks: [
          { h2: "From a reply to a meeting" },
          { p: "A meeting campaign asks for a short call; from the first follow-up its emails carry your booking page. When someone asks for a meeting, Yolias replies in the same thread with two free times and the page (when auto-reply is on for the campaign; otherwise it tells you to send it). Their conversation stays in **Conversations**, and the booking appears in **Meetings**." },
          { h2: "After the meeting" },
          { p: "In **Meetings**, a past meeting asks what came of it: **Became a customer**, or **Didn't buy** with a reason (price, timing, no need, chose a competitor, stopped replying or another reason), or **No-show**. For a purchase campaign with no meeting, the same choice is in the conversation's details. Those outcomes feed Analytics and your next searches." },
          { h2: "Meetings" },
          { p: "**Meetings → Booking page** is your own page at yolias.com/meet/your-name: the meeting's name, place, length, break, notice, how far ahead and your weekly hours. When a lead asks for a meeting, Yolias replies in the same thread with two free times and the page. Every booking lands in **Meetings → Bookings** and you get an email." },
          { p: "Connect **Google Calendar** on the same page and every booking is added to a calendar Yolias creates in your Google Calendar, with a Google Meet link; Google sends the invitation to your guest. Yolias only touches that calendar. Yolias emails you an hour before each meeting, and after it asks how it went so you can move the deal on." },
          { h2: "Morning summary" },
          { p: "Each morning around 8:00 in your time zone, Yolias emails what needs you: new replies, today's meetings and deals quiet for a week. It's the **Today** card at the top of Analytics. Turn it off in **Settings → Notifications → Morning summary and meetings**." },
          { h2: "What wins and what loses" },
          { p: "Analytics shows your won deals by industry and why deals were lost. New searches read the same summary: when your request leaves the industry, size or city open, Yolias leans toward what won. What you write in the request always comes first." },
        ],
      },
      ar: {
        title: "من الرد إلى الاجتماع",
        summary: "من الرد إلى الاجتماع المحجوز، وصفحة الحجز، وتقويم Google و Meet، والتذكيرات، والنتيجة بعد الاجتماع، وملخص الصباح.",
        blocks: [
          { h2: "من الرد إلى الاجتماع" },
          { p: "حملة الاجتماعات تطلب مكالمة قصيرة، ومن أول متابعة تحمل رسائلها صفحة الحجز الخاصة بك. وعندما يطلب أحدهم اجتماعًا، يرد يولياس في نفس المحادثة بموعدين متاحين والصفحة (إذا كان الرد التلقائي مفعّلًا في الحملة، وإلا يخبرك لترسلها). تبقى المحادثة في **المحادثات**، ويظهر الحجز في **الاجتماعات**." },
          { h2: "بعد الاجتماع" },
          { p: "في **الاجتماعات** يسألك الاجتماع السابق عن النتيجة: **صار عميلًا**، أو **لم يشترِ** مع السبب (السعر، أو التوقيت، أو لا يحتاجه، أو اختار منافسًا، أو توقف عن الرد، أو سبب آخر)، أو **لم يحضر**. ولحملة الشراء بلا اجتماع تجد نفس الاختيار في تفاصيل المحادثة. وهذه النتائج تغذي التحليلات وعمليات البحث القادمة." },
          { h2: "الاجتماعات" },
          { p: "**الاجتماعات ← صفحة الحجز** هي صفحتك الخاصة على yolias.com/meet/اسمك: اسم الاجتماع ومكانه ومدته والاستراحة وأقل مهلة وإلى متى يُتاح الحجز وساعات أسبوعك. عندما يطلب العميل اجتماعًا، يرد يولياس في نفس المحادثة بموعدين متاحين ورابط الصفحة. وكل حجز يظهر في **الاجتماعات ← الحجوزات** ويصلك بريد به." },
          { p: "اربط **تقويم Google** من نفس الصفحة، فيُضاف كل حجز إلى تقويم ينشئه يولياس داخل تقويم Google برابط Google Meet، وترسل Google الدعوة إلى ضيفك. لا يتعامل يولياس إلا مع هذا التقويم. ويرسل لك يولياس بريدًا قبل كل اجتماع بساعة، وبعده يسألك كيف كان لتحدّث الصفقة." },
          { h2: "ملخص الصباح" },
          { p: "كل صباح نحو الساعة 8:00 بتوقيتك، يرسل لك يولياس ما يحتاجك: الردود الجديدة واجتماعات اليوم والصفقات المتوقفة منذ أسبوع. هو نفسه كارت **اليوم** أعلى صفحة التحليلات. أوقفه من **الإعدادات ← الإشعارات ← ملخص الصباح والاجتماعات**." },
          { h2: "ما الذي يكسب وما الذي يخسر" },
          { p: "تعرض التحليلات الصفقات المكسوبة حسب المجال وأسباب الخسارة. وتقرأ عمليات البحث الجديدة نفس الملخص: عندما يترك طلبك المجال أو الحجم أو المدينة مفتوحًا، يميل يولياس إلى ما كسبته. وما تكتبه في الطلب يأتي أولًا دائمًا." },
        ],
      },
    },
  },
  {
    slug: "signing-in",
    collection: "getting-started",
    doc: {
      en: {
        title: "Signing in with a magic link",
        summary: "Yolias has no passwords. Here is what to do when a link doesn’t arrive or no longer works.",
        blocks: [
          { p: "Enter your work email on the [log in page](/login) and Yolias emails you a one-time link. Open it on the same device and you are in." },
          { h2: "The email didn’t arrive" },
          { ol: [
            "Wait a minute. Delivery can take a little time.",
            "Check spam, promotions or quarantine folders for an email from Yolias.",
            "Make sure you typed the address you signed up with. Log in only works for existing accounts; new users start from [Create account](/signup).",
            "Request a new link. If you request several in a row, you may need to wait a minute before the next one.",
          ] },
          { h2: "The link says it is invalid or expired" },
          { p: "Each link works once and expires after one hour. Open [Can’t sign in?](/recover) and request a fresh one." },
        ],
      },
      ar: {
        title: "تسجيل الدخول برابط سحري",
        summary: "لا توجد كلمات مرور في يولياس. إليك ما تفعله إذا لم يصلك الرابط أو لم يعد يعمل.",
        blocks: [
          { p: "أدخل بريد العمل في [صفحة تسجيل الدخول](/login) وسيرسل لك يولياس رابطًا يُستخدم مرة واحدة. افتحه على الجهاز نفسه وستدخل مباشرة." },
          { h2: "لم يصل البريد" },
          { ol: [
            "انتظر دقيقة، قد يتأخر الإرسال قليلًا.",
            "تحقق من مجلدات الرسائل المزعجة أو العروض أو الحجر بحثًا عن بريد من يولياس.",
            "تأكد من كتابة البريد الذي سجّلت به. تسجيل الدخول يعمل للحسابات الموجودة فقط؛ المستخدمون الجدد يبدؤون من [إنشاء حساب](/signup).",
            "اطلب رابطًا جديدًا. إذا طلبت عدة روابط متتالية فقد تحتاج للانتظار دقيقة قبل الطلب التالي.",
          ] },
          { h2: "الرابط غير صالح أو منتهي الصلاحية" },
          { p: "يعمل كل رابط مرة واحدة وتنتهي صلاحيته بعد ساعة. افتح [لا تستطيع الدخول؟](/recover) واطلب رابطًا جديدًا." },
        ],
      },
    },
  },
  {
    slug: "choosing-a-plan",
    collection: "getting-started",
    doc: {
      en: {
        title: "Pay As You Go or a monthly plan",
        summary: "Every option has the same features; you pay for prospects only.",
        blocks: [
          { p: "Yolias has three options with the same features and unlimited users: **Pay As You Go**, **Pro** and **Growth**. The prospect is the only unit: writing and sending emails is never charged, uploaded contacts are unlimited, and the same prospect is never counted twice. There is no free trial and no free credit. The [pricing page](/pricing#compare) lists the numbers." },
          { h2: "Pay As You Go" },
          { p: "Prepaid credit with no subscription and no renewal. In Checkout, choose **Pay As You Go**, then the amount: $5, $20, $50 or $100. Checkout shows exactly how many prospects the amount gives before you pay. The credit is added once the payment is confirmed and doesn’t expire. Top up again whenever you like." },
          { h2: "Monthly plans" },
          { p: "Pro and Growth are billed monthly by card through Paymob, with a set number of prospects every month. There is no annual billing. Cancel any time from Settings → Billing." },
          { h2: "Switching" },
          { p: "You can move between Pay As You Go and a monthly plan at any time. Remaining credit stays in your account: on a plan, its monthly prospects are used first, then your credit." },
        ],
      },
      ar: {
        title: "الدفع حسب الاستخدام أو خطة شهرية",
        summary: "كل الخيارات فيها الميزات نفسها، وتدفع مقابل العملاء المحتملين فقط.",
        blocks: [
          { p: "في يولياس ثلاثة خيارات بالميزات نفسها ومستخدمين غير محدودين: **الدفع حسب الاستخدام** و**برو** و**النمو**. العميل المحتمل هو الوحدة الوحيدة: كتابة الرسائل وإرسالها بدون رسوم، وجهات الاتصال المرفوعة غير محدودة، ولا يُحسب العميل نفسه مرتين. لا توجد تجربة مجانية ولا رصيد مجاني. الأرقام في [صفحة الأسعار](/pricing#compare)." },
          { h2: "الدفع حسب الاستخدام" },
          { p: "رصيد مسبق الدفع بدون اشتراك وبدون تجديد. في صفحة الدفع اختر **الدفع حسب الاستخدام** ثم المبلغ: 5 أو 20 أو 50 أو 100 دولار. تعرض صفحة الدفع عدد العملاء المحتملين بالضبط قبل الدفع. يُضاف الرصيد بعد تأكيد الدفع ولا تنتهي صلاحيته، ويمكنك الشحن مرة أخرى في أي وقت." },
          { h2: "الخطط الشهرية" },
          { p: "برو والنمو تُدفعان شهريًا بالبطاقة عبر Paymob، بعدد ثابت من العملاء المحتملين كل شهر. لا توجد فوترة سنوية. يمكنك الإلغاء في أي وقت من الإعدادات ← الفوترة." },
          { h2: "التبديل" },
          { p: "يمكنك الانتقال بين الدفع حسب الاستخدام والخطة الشهرية في أي وقت. الرصيد المتبقي يبقى في حسابك: مع الخطة تُستخدم عملاؤها الشهريون أولًا ثم رصيدك." },
        ],
      },
    },
  },
  {
    slug: "switching-language",
    collection: "getting-started",
    doc: {
      en: {
        title: "Switching between Arabic and English",
        summary: "Change the interface language, and the language Yolias answers in, in one place.",
        blocks: [
          { p: "On public pages, use the language menu in the header. Inside the app, open your name at the bottom of the sidebar, choose **General**, and set **Languages**." },
          { p: "The whole interface switches direction: right-to-left for Arabic, left-to-right for English. Search names and summaries that Yolias writes from then on follow the same language." },
          { note: "Data that came from your sources, such as company names, stays as it was found." },
        ],
      },
      ar: {
        title: "التبديل بين العربية والإنجليزية",
        summary: "غيّر لغة الواجهة، واللغة التي يرد بها يولياس، من مكان واحد.",
        blocks: [
          { p: "في الصفحات العامة استخدم قائمة اللغة في أعلى الصفحة. وداخل التطبيق اضغط على اسمك أسفل الشريط الجانبي، واختر **عام**، ثم اضبط **اللغة**." },
          { p: "يتغير اتجاه الواجهة كلها: من اليمين لليسار للعربية، ومن اليسار لليمين للإنجليزية. وتتبع أسماء عمليات البحث والملخصات التي يكتبها يولياس بعد ذلك اللغة نفسها." },
          { note: "البيانات القادمة من المصادر، مثل أسماء الشركات، تبقى كما وُجدت." },
        ],
      },
    },
  },
  {
    slug: "awaiting-data-source",
    collection: "using-yolias",
    doc: {
      en: {
        title: "Why a search says “Awaiting data source”",
        summary: "Yolias understood your search, but no company data source is connected to collect results yet.",
        blocks: [
          { p: "Every search goes through two halves. First Yolias AI turns your request into criteria and sets up the search. That part is complete when you see the target criteria and the decision makers to find. Then the search looks through connected data sources for matching companies and people." },
          { p: "**Awaiting data source** means the first half finished and the second is waiting for a source to be connected to your workspace. Nothing is lost: the search keeps its criteria and will collect results once a source is available." },
          { p: "See [Search progress and status](/docs/search-status) for every status a search can have." },
        ],
      },
      ar: {
        title: "لماذا يظهر البحث «بانتظار مصدر بيانات»",
        summary: "فهم يولياس بحثك، لكن لا يوجد مصدر بيانات للشركات متصل بعد لجمع النتائج.",
        blocks: [
          { p: "يمر كل بحث بمرحلتين. أولًا يحوّل يولياس AI طلبك إلى معايير ويجهّز البحث، وتكتمل هذه المرحلة عندما ترى معايير الاستهداف وصنّاع القرار المطلوبين. ثم يبحث البحث في مصادر البيانات المتصلة عن الشركات والأشخاص المطابقين." },
          { p: "**بانتظار مصدر بيانات** يعني أن المرحلة الأولى اكتملت وأن الثانية تنتظر ربط مصدر بمساحة عملك. لا يضيع شيء: يحتفظ البحث بمعاييره وسيجمع النتائج بمجرد توفر مصدر." },
          { p: "راجع [تقدّم البحث وحالته](/docs/search-status) لمعرفة كل الحالات الممكنة للبحث." },
        ],
      },
    },
  },
  {
    slug: "search-needs-attention",
    collection: "using-yolias",
    doc: {
      en: {
        title: "When a search needs attention",
        summary: "What the red “Search needs attention” card means and how to continue.",
        blocks: [
          { p: "The card appears when Yolias AI could not turn a request into criteria, for example when the AI service was busy, or the request had nothing it could interpret." },
          { ol: [
            "Read the message on the card; it says what went wrong.",
            "Press **Try again**. Your request is saved, so you don’t need to retype it.",
            "If it keeps failing, edit the request above the card to be more specific (a market, an industry and the roles you want) and send it again.",
          ] },
          { note: "Retrying re-reads the text only. If your original request relied on an attached file, attach it again in a new search." },
        ],
      },
      ar: {
        title: "عندما يحتاج البحث انتباهك",
        summary: "ماذا تعني بطاقة «البحث يحتاج انتباهك» الحمراء وكيف تكمل.",
        blocks: [
          { p: "تظهر البطاقة عندما يتعذر على يولياس AI تحويل الطلب إلى معايير، مثلًا عندما تكون خدمة الذكاء الاصطناعي مشغولة، أو لا يحتوي الطلب على ما يمكن فهمه." },
          { ol: [
            "اقرأ الرسالة على البطاقة؛ فهي توضح ما حدث.",
            "اضغط **حاول مرة أخرى**. طلبك محفوظ ولا تحتاج لإعادة كتابته.",
            "إذا تكرر الفشل، عدّل الطلب أعلى البطاقة ليكون أوضح، سوق وقطاع والمناصب المطلوبة، ثم أرسله مجددًا.",
          ] },
          { note: "إعادة المحاولة تقرأ النص فقط. إذا كان طلبك الأصلي يعتمد على ملف مرفق فأرفقه من جديد في بحث جديد." },
        ],
      },
    },
  },
  {
    slug: "exporting-prospects",
    collection: "using-yolias",
    doc: {
      en: {
        title: "Exporting prospects to CSV",
        summary: "Download saved prospects, filtered the way you need them.",
        blocks: [
          { ol: [
            "On a search with results, press **Save to Prospects** to add its decision makers to your list.",
            "Open **Prospects**. Use **Filters** to narrow by name or title, type, market or minimum match.",
            "Press **Export CSV**. The file contains exactly the rows your filters show.",
          ] },
          { p: "The file opens in Excel, Numbers or Google Sheets, and column headers follow your interface language. The full column list is in [Prospects](/docs/prospects)." },
        ],
      },
      ar: {
        title: "تصدير العملاء المحتملين إلى CSV",
        summary: "نزّل العملاء المحتملين المحفوظين في ملف CSV بالفلاتر التي تحتاجها، أو الصفوف التي حددتها فقط.",
        blocks: [
          { ol: [
            "في بحث به نتائج، اضغط **حفظ في العملاء المحتملين** لإضافة صنّاع القرار إلى قائمتك.",
            "افتح **العملاء المحتملون**. استخدم **الفلاتر** للتصفية حسب الاسم أو المسمى أو النوع أو السوق أو أدنى نسبة تطابق.",
            "اضغط **تصدير CSV**. يحتوي الملف بالضبط على الصفوف التي تظهرها الفلاتر.",
          ] },
          { p: "يفتح الملف في Excel أو Numbers أو Google Sheets، وتتبع عناوين الأعمدة لغة الواجهة. تجد قائمة الأعمدة كاملة في [العملاء المحتملون](/docs/prospects)." },
        ],
      },
    },
  },
  {
    slug: "inviting-teammates",
    collection: "account",
    doc: {
      en: {
        title: "Inviting teammates",
        summary: "Bring colleagues into your workspace. Every plan includes unlimited users.",
        blocks: [
          { ol: [
            "Open your name at the bottom of the sidebar and choose **Team**.",
            "Press **Invite User**, enter their work email, choose **Member** or **Admin**, and send.",
            "They receive an email; opening it creates their account inside your workspace.",
          ] },
          { p: "Pending invitations stay listed until accepted, and owners or admins can revoke them. Someone who already has their own Yolias account can’t be invited to a second workspace yet." },
        ],
      },
      ar: {
        title: "دعوة أعضاء الفريق",
        summary: "أضف زملاءك إلى مساحة عملك، كل الخطط تشمل مستخدمين غير محدودين.",
        blocks: [
          { ol: [
            "اضغط على اسمك أسفل الشريط الجانبي واختر **الفريق**.",
            "اضغط **دعوة مستخدم**، وأدخل بريد العمل، واختر **عضو** أو **مسؤول**، ثم أرسل.",
            "يصلهم بريد إلكتروني؛ وفتحه ينشئ حسابهم داخل مساحة عملك.",
          ] },
          { p: "تبقى الدعوات المعلقة ظاهرة حتى قبولها، ويمكن للمالك أو المسؤول إلغاؤها. ولا يمكن حاليًا دعوة شخص لديه حساب يولياس خاص به إلى مساحة عمل ثانية." },
        ],
      },
    },
  },
  {
    slug: "changing-plan",
    collection: "account",
    doc: {
      en: {
        title: "Changing your plan",
        summary: "Move between Pay As You Go, Pro and Growth, or cancel.",
        blocks: [
          { p: "Owners and admins can change the plan. Open your name in the sidebar, choose **Billing**, then **Adjust plan**. Pick the plan and confirm. To top up credit instead, choose **Pay As You Go** in Checkout." },
          { p: "To cancel, use **Cancel plan** under Cancellation. The plan stays active until the end of the paid period; after that new searches stop until you subscribe again, and everything stays saved. You can resume before then." },
          { p: "Your new limits apply right away. A plan’s prospects reset on the first day of each month; credit you topped up stays until you use it." },
        ],
      },
      ar: {
        title: "تغيير خطتك",
        summary: "انتقل بين الدفع حسب الاستخدام وبرو والنمو، أو ألغِ الاشتراك.",
        blocks: [
          { p: "يمكن للمالك والمسؤول تغيير الخطة. اضغط على اسمك في الشريط الجانبي، واختر **الفوترة**، ثم **تعديل الخطة**. اختر الخطة وأكّد. ولشحن الرصيد بدلًا من ذلك، اختر **الدفع حسب الاستخدام** في صفحة الدفع." },
          { p: "للإلغاء، استخدم **إلغاء الخطة** في قسم الإلغاء. تبقى الخطة فعالة حتى نهاية الفترة المدفوعة، وبعدها تتوقف عمليات البحث الجديدة حتى تشترك من جديد مع حفظ كل شيء. ويمكنك الاستئناف قبل ذلك." },
          { p: "تُطبق الحدود الجديدة فورًا. يتجدد عملاء الخطة في أول يوم من كل شهر، ويبقى الرصيد الذي شحنته حتى تستخدمه." },
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
          { p: "Open your name in the sidebar → **Account** → **Delete account**, and confirm." },
          { ul: [
            "Your profile is removed and you are signed out.",
            "If you are the only member, the workspace and all its searches, campaigns, companies and prospects are deleted too.",
            "If you own a workspace with other members, remove them first from **Team**; an owner can’t leave a team without a workspace.",
          ] },
          { note: "Deletion can’t be undone. Export anything you want to keep before you start." },
        ],
      },
      ar: {
        title: "حذف حسابك",
        summary: "ما الذي يُحذف، وما الذي تفعله أولًا إذا كنت تملك مساحة عمل لفريق.",
        blocks: [
          { p: "اضغط على اسمك في الشريط الجانبي ← **الحساب** ← **حذف الحساب**، ثم أكّد." },
          { ul: [
            "يُحذف ملفك الشخصي ويتم تسجيل خروجك.",
            "إذا كنت العضو الوحيد، تُحذف مساحة العمل وكل ما فيها من عمليات بحث وحملات وشركات وعملاء محتملين.",
            "إذا كنت تملك مساحة عمل بها أعضاء آخرون، فأزلهم أولًا من **الفريق**؛ فلا يمكن للمالك ترك فريق بلا مساحة عمل.",
          ] },
          { note: "لا يمكن التراجع عن الحذف. صدّر ما تريد الاحتفاظ به قبل البدء." },
        ],
      },
    },
  },
  // How to connect a mailbox (owner, 2026-10-28): "How to connect" on each Settings → Integrations card opens these.
  {
    slug: "connect-gmail",
    collection: "using-yolias",
    doc: {
      en: {
        title: "Connecting Gmail",
        summary: "Connect your Gmail or Google Workspace mailbox so Yolias sends your campaigns from it and reads the replies.",
        blocks: [
          { ol: [
            "Open your name at the bottom of the sidebar, choose **Settings**, then **Integrations**.",
            "On the **Gmail** card, open the ⋯ menu and choose **Connect** (or open the card and press **Add mailbox**).",
            "Choose your Google account and allow Yolias to send email and read the replies to the emails it sent.",
            "You come back to Yolias with the mailbox listed as **Connected**.",
          ] },
          { p: "Yolias reads only the replies in the threads it started; it never reads the rest of your inbox. You can disconnect at any time from the same card, or from your Google account's security settings." },
          { note: "If the Google button isn't available yet, connect the same Gmail mailbox with IMAP/SMTP and an app password: see [Connecting another mailbox (IMAP/SMTP)](/help-center/connect-imap-smtp)." },
          { h2: "Official Google help" },
          { ul: [
            "[Sign in with app passwords](https://support.google.com/accounts/answer/185833)",
            "[Add Gmail to another email client (IMAP)](https://support.google.com/mail/answer/7126229)",
          ] },
        ],
      },
      ar: {
        title: "ربط Gmail",
        summary: "اربط Gmail أو بريد Google Workspace ليرسل يولياس حملاتك منه ويقرأ الردود.",
        blocks: [
          { ol: [
            "اضغط على اسمك أسفل الشريط الجانبي، واختر **الإعدادات** ثم **التكاملات**.",
            "في كارت **Gmail** افتح قائمة ⋯ واختر **اربط** (أو افتح الكارت واضغط **إضافة صندوق بريد**).",
            "اختر حساب Google واسمح ليولياس بإرسال البريد وقراءة الردود على الرسائل التي أرسلها.",
            "تعود إلى يولياس وصندوق البريد ظاهر بحالة **متصل**.",
          ] },
          { p: "يقرأ يولياس الردود في المحادثات التي بدأها فقط، ولا يقرأ باقي بريدك. يمكنك فصل الربط في أي وقت من نفس الكارت، أو من إعدادات الأمان في حساب Google." },
          { note: "إن لم يكن زر Google متاحًا بعد، اربط نفس بريد Gmail عبر IMAP/SMTP بكلمة مرور تطبيق: راجع [ربط بريد آخر (IMAP/SMTP)](/help-center/connect-imap-smtp)." },
          { h2: "مساعدة Google الرسمية" },
          { ul: [
            "[تسجيل الدخول بكلمات مرور التطبيقات](https://support.google.com/accounts/answer/185833?hl=ar)",
            "[إضافة Gmail إلى برنامج بريد آخر (IMAP)](https://support.google.com/mail/answer/7126229?hl=ar)",
          ] },
        ],
      },
    },
  },
  {
    slug: "connect-imap-smtp",
    collection: "using-yolias",
    doc: {
      en: {
        title: "Connecting another mailbox (IMAP/SMTP)",
        summary: "Connect any mailbox, such as Zoho, Hostinger, Outlook or your company mail, with its IMAP and SMTP settings.",
        blocks: [
          { ol: [
            "Open **Settings → Integrations**, and on the **IMAP/SMTP mailbox** card choose **Connect** from the ⋯ menu.",
            "Enter your email address and password. Yolias fills the usual server names from your domain; change them if your provider uses others.",
            "Press **Connect**. Yolias checks the login and a test connection before saving.",
          ] },
          { p: "Many providers need an **app password** instead of your normal password when two-step sign-in is on. Create one in your provider's security settings and paste it in the password field." },
          { h2: "Settings of common providers" },
          { table: {
            head: ["Provider", "IMAP (incoming)", "SMTP (outgoing)"],
            rows: [
              ["Gmail / Google Workspace", "imap.gmail.com · 993", "smtp.gmail.com · 465"],
              ["Zoho Mail", "imap.zoho.com · 993", "smtp.zoho.com · 465"],
              ["Outlook.com / Microsoft 365", "outlook.office365.com · 993", "smtp.office365.com · 587"],
              ["Hostinger", "imap.hostinger.com · 993", "smtp.hostinger.com · 465"],
              ["Yahoo Mail", "imap.mail.yahoo.com · 993", "smtp.mail.yahoo.com · 465"],
            ],
          } },
          { p: "Zoho accounts in Europe or India use zoho.eu or zoho.in instead of zoho.com. For any other provider, look for “IMAP settings” in its help." },
          { h2: "Official help from each provider" },
          { ul: [
            "[Google: app passwords](https://support.google.com/accounts/answer/185833)",
            "[Zoho Mail: IMAP access](https://www.zoho.com/mail/help/imap-access.html)",
            "[Microsoft: POP, IMAP and SMTP settings for Outlook.com](https://support.microsoft.com/en-us/office/pop-imap-and-smtp-settings-for-outlook-com-d088b986-291d-42b8-9564-9c414e2aa040)",
            "[Yahoo: generate an app password](https://help.yahoo.com/kb/SLN15241.html)",
          ] },
          { note: "After connecting, Settings → Integrations shows whether your domain has SPF, DKIM and DMARC. Without them, campaign emails often land in spam." },
        ],
      },
      ar: {
        title: "ربط بريد آخر (IMAP/SMTP)",
        summary: "اربط أي بريد، مثل Zoho أو Hostinger أو Outlook أو بريد شركتك، بإعدادات IMAP وSMTP.",
        blocks: [
          { ol: [
            "افتح **الإعدادات ← التكاملات**، وفي كارت **بريد IMAP/SMTP** اختر **اربط** من قائمة ⋯.",
            "أدخل بريدك وكلمة المرور. يملأ يولياس أسماء الخوادم المعتادة من دومينك؛ غيّرها إن كان مزودك يستخدم غيرها.",
            "اضغط **ربط**. يتحقق يولياس من الدخول ومن اتصال تجريبي قبل الحفظ.",
          ] },
          { p: "كثير من المزودين يطلبون **كلمة مرور تطبيق** بدل كلمة مرورك العادية عند تفعيل التحقق بخطوتين. أنشئها من إعدادات الأمان عند مزودك والصقها في خانة كلمة المرور." },
          { h2: "إعدادات أشهر المزودين" },
          { table: {
            head: ["المزود", "IMAP (الوارد)", "SMTP (الصادر)"],
            rows: [
              ["Gmail / Google Workspace", "imap.gmail.com · 993", "smtp.gmail.com · 465"],
              ["Zoho Mail", "imap.zoho.com · 993", "smtp.zoho.com · 465"],
              ["Outlook.com / Microsoft 365", "outlook.office365.com · 993", "smtp.office365.com · 587"],
              ["Hostinger", "imap.hostinger.com · 993", "smtp.hostinger.com · 465"],
              ["Yahoo Mail", "imap.mail.yahoo.com · 993", "smtp.mail.yahoo.com · 465"],
            ],
          } },
          { p: "حسابات Zoho في أوروبا أو الهند تستخدم zoho.eu أو zoho.in بدل zoho.com. لأي مزود آخر ابحث عن «IMAP settings» في صفحات مساعدته." },
          { h2: "المساعدة الرسمية من كل مزود" },
          { ul: [
            "[Google: كلمات مرور التطبيقات](https://support.google.com/accounts/answer/185833?hl=ar)",
            "[Zoho Mail: الوصول عبر IMAP](https://www.zoho.com/mail/help/imap-access.html)",
            "[Microsoft: إعدادات POP وIMAP وSMTP لـ Outlook.com](https://support.microsoft.com/ar-sa/office/pop-imap-and-smtp-settings-for-outlook-com-d088b986-291d-42b8-9564-9c414e2aa040)",
            "[Yahoo: إنشاء كلمة مرور تطبيق](https://help.yahoo.com/kb/SLN15241.html)",
          ] },
          { note: "بعد الربط، تعرض الإعدادات ← التكاملات هل في دومينك سجلات SPF وDKIM وDMARC. بدونها تذهب رسائل الحملات غالبًا إلى Spam." },
        ],
      },
    },
  },
];

export const helpHero: Localized<{ title: string; lead: string; collectionsTitle: string; popularTitle: string }> = {
  en: { title: "How can we help?", lead: "Short answers about signing in, plans, searches, outreach, prospects and your team.", collectionsTitle: "Browse by topic", popularTitle: "All articles" },
  ar: { title: "كيف يمكننا مساعدتك؟", lead: "إجابات قصيرة عن تسجيل الدخول والخطط وعمليات البحث والتواصل والعملاء المحتملين وفريقك.", collectionsTitle: "تصفح حسب الموضوع", popularTitle: "كل المقالات" },
};
