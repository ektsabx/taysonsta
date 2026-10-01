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
    en: { title: "Using Yolias AI", description: "Strategies, campaign statuses and exporting results." },
    ar: { title: "استخدام يولـياس AI", description: "الاستراتيجيات وحالات الحملات وتصدير النتائج." },
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
            "Wait a minute — delivery can take a little time.",
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
        summary: "لا توجد كلمات مرور في يولـياس. إليك ما تفعله إذا لم يصلك الرابط أو لم يعد يعمل.",
        blocks: [
          { p: "أدخل بريد العمل في [صفحة تسجيل الدخول](/login) وسيرسل لك يولـياس رابطًا يُستخدم مرة واحدة. افتحه على الجهاز نفسه وستدخل مباشرة." },
          { h2: "لم يصل البريد" },
          { ol: [
            "انتظر دقيقة — قد يتأخر الإرسال قليلًا.",
            "تحقق من مجلدات الرسائل المزعجة أو العروض أو الحجر بحثًا عن بريد من يولـياس.",
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
        title: "Choosing a plan and billing period",
        summary: "All plans have the same features; they differ in how much discovery you can run each month.",
        blocks: [
          { p: "Pro, Growth and Scale include the same Yolias features and unlimited users. Pick the one whose monthly discovery credits and company lookups match the volume you expect — the [pricing page](/pricing#compare) lists the numbers." },
          { h2: "Monthly or annual" },
          { p: "Switch between **Monthly** and **Annual** above the plans. Annual billing is twelve times the monthly price, paid upfront, and your usage limits still reset every month." },
          { h2: "Not sure yet?" },
          { p: "Start with the plan closest to your current needs. You can change plan or billing period later from Settings → Billing." },
        ],
      },
      ar: {
        title: "اختيار الخطة وفترة الفوترة",
        summary: "كل الخطط تشمل الميزات نفسها، وتختلف في حجم الاكتشاف الذي يمكنك تشغيله شهريًا.",
        blocks: [
          { p: "تشمل خطط برو والنمو والتوسع ميزات يولـياس نفسها ومستخدمين غير محدودين. اختر الخطة التي يناسب رصيدها الشهري من الاكتشاف وعمليات البحث عن الشركات الحجم الذي تتوقعه — تجد الأرقام في [صفحة الأسعار](/pricing#compare)." },
          { h2: "شهري أم سنوي" },
          { p: "بدّل بين **شهري** و**سنوي** أعلى الخطط. الفوترة السنوية تساوي اثني عشر ضعف السعر الشهري وتُدفع مقدمًا، وتبقى حدود الاستخدام تتجدد كل شهر." },
          { h2: "لم تقرر بعد؟" },
          { p: "ابدأ بالخطة الأقرب لاحتياجك الحالي. يمكنك تغيير الخطة أو فترة الفوترة لاحقًا من الإعدادات ← الفوترة." },
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
        summary: "Change the interface language — and the language Yolias answers in — in one place.",
        blocks: [
          { p: "On public pages, use the language menu in the header. Inside the app, open your name at the bottom of the sidebar, choose **General**, and set **Languages**." },
          { p: "The whole interface switches direction: right-to-left for Arabic, left-to-right for English. Campaign names and summaries that Yolias writes from then on follow the same language." },
          { note: "Data that came from your sources, such as company names, stays as it was found." },
        ],
      },
      ar: {
        title: "التبديل بين العربية والإنجليزية",
        summary: "غيّر لغة الواجهة — واللغة التي يرد بها يولـياس — من مكان واحد.",
        blocks: [
          { p: "في الصفحات العامة استخدم قائمة اللغة في أعلى الصفحة. وداخل التطبيق اضغط على اسمك أسفل الشريط الجانبي، واختر **عام**، ثم اضبط **اللغة**." },
          { p: "يتغير اتجاه الواجهة كلها: من اليمين لليسار للعربية، ومن اليسار لليمين للإنجليزية. وتتبع أسماء الحملات والملخصات التي يكتبها يولـياس بعد ذلك اللغة نفسها." },
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
        title: "Why a campaign says “Awaiting data source”",
        summary: "Yolias understood your strategy, but no company data source is connected to collect results yet.",
        blocks: [
          { p: "Every strategy goes through two halves. First Yolias AI turns your request into criteria and opens the campaign — that part is complete when you see the target criteria and the decision makers to find. Then the campaign searches connected data sources for matching companies and people." },
          { p: "**Awaiting data source** means the first half finished and the second is waiting for a source to be connected to your workspace. Nothing is lost: the campaign keeps its criteria and will collect results once a source is available." },
          { p: "See [Campaigns](/docs/campaigns) for every status a campaign can have." },
        ],
      },
      ar: {
        title: "لماذا تظهر الحملة «بانتظار مصدر بيانات»",
        summary: "فهم يولـياس استراتيجيتك، لكن لا يوجد مصدر بيانات للشركات متصل بعد لجمع النتائج.",
        blocks: [
          { p: "تمر كل استراتيجية بمرحلتين. أولًا يحوّل يولـياس AI طلبك إلى معايير ويفتح الحملة — وتكتمل هذه المرحلة عندما ترى معايير الاستهداف وصنّاع القرار المطلوبين. ثم تبحث الحملة في مصادر البيانات المتصلة عن الشركات والأشخاص المطابقين." },
          { p: "**بانتظار مصدر بيانات** يعني أن المرحلة الأولى اكتملت وأن الثانية تنتظر ربط مصدر بمساحة عملك. لا يضيع شيء: تحتفظ الحملة بمعاييرها وستجمع النتائج بمجرد توفر مصدر." },
          { p: "راجع [الحملات](/docs/campaigns) لمعرفة كل الحالات الممكنة للحملة." },
        ],
      },
    },
  },
  {
    slug: "strategy-needs-attention",
    collection: "using-yolias",
    doc: {
      en: {
        title: "When a strategy needs attention",
        summary: "What the red “Strategy needs attention” card means and how to continue.",
        blocks: [
          { p: "The card appears when Yolias AI could not turn a request into criteria — for example when the AI service was busy, or the request had nothing it could interpret." },
          { ol: [
            "Read the message on the card; it says what went wrong.",
            "Press **Try again**. Your request is saved, so you don’t need to retype it.",
            "If it keeps failing, edit the request above the card to be more specific — a market, an industry and the roles you want — and send it again.",
          ] },
          { note: "Retrying re-reads the text only. If your original request relied on an attached file, attach it again in a new strategy." },
        ],
      },
      ar: {
        title: "عندما تحتاج الاستراتيجية انتباهك",
        summary: "ماذا تعني بطاقة «الاستراتيجية تحتاج انتباهك» الحمراء وكيف تكمل.",
        blocks: [
          { p: "تظهر البطاقة عندما يتعذر على يولـياس AI تحويل الطلب إلى معايير — مثلًا عندما تكون خدمة الذكاء الاصطناعي مشغولة، أو لا يحتوي الطلب على ما يمكن فهمه." },
          { ol: [
            "اقرأ الرسالة على البطاقة؛ فهي توضح ما حدث.",
            "اضغط **حاول مرة أخرى**. طلبك محفوظ ولا تحتاج لإعادة كتابته.",
            "إذا تكرر الفشل، عدّل الطلب أعلى البطاقة ليكون أوضح — سوق وقطاع والمناصب المطلوبة — ثم أرسله مجددًا.",
          ] },
          { note: "إعادة المحاولة تقرأ النص فقط. إذا كان طلبك الأصلي يعتمد على ملف مرفق فأرفقه من جديد في استراتيجية جديدة." },
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
            "On a strategy with results, press **Save to Prospects** to add its decision makers to your list.",
            "Open **Prospects**. Use **Add Search Filter** to narrow by name or title, campaign, market or minimum match.",
            "Press **Export CSV**. The file contains exactly the rows your filters show.",
          ] },
          { p: "The file opens in Excel, Numbers or Google Sheets, and column headers follow your interface language. The full column list is in [Prospects](/docs/prospects)." },
        ],
      },
      ar: {
        title: "تصدير العملاء المحتملين إلى CSV",
        summary: "نزّل العملاء المحفوظين بالفلاتر التي تحتاجها.",
        blocks: [
          { ol: [
            "في استراتيجية بها نتائج، اضغط **حفظ في العملاء المحتملين** لإضافة صنّاع القرار إلى قائمتك.",
            "افتح **العملاء المحتملون**. استخدم **إضافة فلتر بحث** للتصفية حسب الاسم أو المسمى أو الحملة أو السوق أو أدنى نسبة تطابق.",
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
        summary: "Bring colleagues into your workspace — every plan includes unlimited users.",
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
        summary: "أضف زملاءك إلى مساحة عملك — كل الخطط تشمل مستخدمين غير محدودين.",
        blocks: [
          { ol: [
            "اضغط على اسمك أسفل الشريط الجانبي واختر **الفريق**.",
            "اضغط **دعوة مستخدم**، وأدخل بريد العمل، واختر **عضو** أو **مسؤول**، ثم أرسل.",
            "يصلهم بريد إلكتروني؛ وفتحه ينشئ حسابهم داخل مساحة عملك.",
          ] },
          { p: "تبقى الدعوات المعلقة ظاهرة حتى قبولها، ويمكن للمالك أو المسؤول إلغاؤها. ولا يمكن حاليًا دعوة شخص لديه حساب يولـياس خاص به إلى مساحة عمل ثانية." },
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
        summary: "Move between Pro, Growth and Scale, or between monthly and annual billing.",
        blocks: [
          { p: "Owners and admins can change the plan. Open your name in the sidebar, choose **Billing**, then **Change plan**. Pick the plan and billing period and confirm." },
          { p: "Your new limits apply right away. Usage counters reset on the first day of each month, whatever the billing period." },
        ],
      },
      ar: {
        title: "تغيير خطتك",
        summary: "انتقل بين برو والنمو والتوسع، أو بين الفوترة الشهرية والسنوية.",
        blocks: [
          { p: "يمكن للمالك والمسؤول تغيير الخطة. اضغط على اسمك في الشريط الجانبي، واختر **الفوترة**، ثم **تغيير الخطة**. اختر الخطة وفترة الفوترة وأكّد." },
          { p: "تُطبق الحدود الجديدة فورًا. وتتجدد عدادات الاستخدام في أول يوم من كل شهر أيًا كانت فترة الفوترة." },
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
            "If you are the only member, the workspace and all its strategies, campaigns, companies and prospects are deleted too.",
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
            "إذا كنت العضو الوحيد، تُحذف مساحة العمل وكل ما فيها من استراتيجيات وحملات وشركات وعملاء محتملين.",
            "إذا كنت تملك مساحة عمل بها أعضاء آخرون، فأزلهم أولًا من **الفريق**؛ فلا يمكن للمالك ترك فريق بلا مساحة عمل.",
          ] },
          { note: "لا يمكن التراجع عن الحذف. صدّر ما تريد الاحتفاظ به قبل البدء." },
        ],
      },
    },
  },
];

export const helpHero: Localized<{ title: string; collectionsTitle: string; popularTitle: string }> = {
  en: { title: "How can we help?", collectionsTitle: "Browse by topic", popularTitle: "All articles" },
  ar: { title: "كيف يمكننا مساعدتك؟", collectionsTitle: "تصفح حسب الموضوع", popularTitle: "كل المقالات" },
};
