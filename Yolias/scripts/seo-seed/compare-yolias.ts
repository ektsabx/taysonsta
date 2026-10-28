// The Yolias column of each "Yolias vs X" table, written against that
// competitor (owner, 2026-10-28): the same facts about Yolias, said in answer
// to what X does, so no two comparison pages share the same table. Facts only:
// plain-language search in Arabic or English; companies, local businesses,
// lookalikes and decision makers where public data lists them; a match score
// with the criteria met; published contacts labelled by verification; emails
// in 15 languages sent from the member's Gmail or IMAP/SMTP mailbox after one
// approval, with an unsubscribe line; replies sorted in the Inbox; interested
// leads move to the CRM; email only; unlimited users; pay per prospect.

type L = { en: string; ar: string };
export type CompareRow = "find" | "finds" | "why" | "contacts" | "outreach" | "replies" | "channels" | "users";

export const yoliasVs: Record<string, { rows: Record<CompareRow, L>; limits: L[] }> = {
  apollo: {
    rows: {
      find: { en: "No filter panel to learn: you write who you sell to in a sentence (Arabic or English) and Yolias builds the criteria", ar: "لا لوحة فلاتر تتعلمها: تكتب لمن تبيع في جملة (بالعربية أو الإنجليزية) ويبني يولـياس المعايير" },
      finds: { en: "A list made for your request each time, including local businesses on maps that a contact database rarely holds", ar: "قائمة تُبنى لطلبك في كل مرة، ومنها أنشطة محلية على الخرائط نادرًا ما تحملها قواعد جهات الاتصال" },
      why: { en: "Each result shows its match score and which of your criteria it met, so you can see why it is on the list", ar: "كل نتيجة تعرض نسبة تطابقها والمعايير التي حققتها، فتعرف لماذا هي في القائمة" },
      contacts: { en: "No credits to reveal contacts: Yolias shows the contacts a company publishes, labelled by verification state", ar: "لا رصيد لكشف بيانات التواصل: يعرض يولـياس ما تنشره الشركة، مصنّفًا حسب حالة التحقق" },
      outreach: { en: "One approval per campaign, then emails and follow-ups go from your own mailbox at a human pace, with an unsubscribe line", ar: "موافقة واحدة لكل حملة، ثم تخرج الرسائل والمتابعات من بريدك بوتيرة بشرية مع سطر لإلغاء الاشتراك" },
      replies: { en: "Replies come back sorted with a suggested answer; interested leads move to a deals-only CRM inside Yolias", ar: "تعود الردود مصنّفة مع رد مقترح، والعملاء المهتمون ينتقلون إلى إدارة عملاء للصفقات فقط داخل يولـياس" },
      channels: { en: "Email only: no dialer, so nothing to set up for calling", ar: "البريد فقط: لا اتصال هاتفي، فلا شيء تجهزه للمكالمات" },
      users: { en: "Unlimited users; you pay for prospects found, not per seat", ar: "مستخدمون بلا حد؛ تدفع مقابل العملاء الذين يُعثر عليهم، لا لكل مقعد" },
    },
    limits: [
      { en: "It has no built-in dialer or call recording like Apollo; outreach is email.", ar: "ليس فيه اتصال هاتفي ولا تسجيل مكالمات مثل Apollo؛ التواصل بالبريد." },
      { en: "It doesn't keep a fixed database of hundreds of millions of contacts to browse; each search is built for your request.", ar: "لا يحتفظ بقاعدة ثابتة من مئات الملايين من جهات الاتصال للتصفح؛ كل بحث يُبنى لطلبك." },
      { en: "A personal email or phone for every decision maker isn't promised: what companies publish is shown, labelled.", ar: "لا يَعِد ببريد أو رقم شخصي لكل صانع قرار: يعرض ما تنشره الشركات مصنّفًا." },
    ],
  },
  clay: {
    rows: {
      find: { en: "No workflow to build: one sentence replaces the table, columns and providers you would wire together in Clay", ar: "لا سير عمل تبنيه: جملة واحدة بدل الجدول والأعمدة والمزودين الذين تربطهم في Clay" },
      finds: { en: "Matching companies, local businesses and lookalikes from the sources Yolias is connected to, without choosing vendors", ar: "شركات مطابقة وأنشطة محلية وشركات مشابهة من المصادر المتصلة بيولـياس، دون اختيار مزودين" },
      why: { en: "Scoring is done for you: a match score against your description, with the criteria each company met", ar: "التقييم جاهز: نسبة تطابق مع وصفك، مع المعايير التي حققتها كل شركة" },
      contacts: { en: "Published business contacts with their verification state, instead of a waterfall you configure and pay for per provider", ar: "بيانات تواصل منشورة بحالة تحققها، بدل سلسلة مزودين تضبطها وتدفع لكل منهم" },
      outreach: { en: "Writes and sends the emails itself, from your Gmail or company mailbox, after you approve the campaign", ar: "يكتب الرسائل ويرسلها بنفسه، من Gmail أو بريد شركتك، بعد موافقتك على الحملة" },
      replies: { en: "Replies land in Yolias, not in a separate sending tool, sorted with a suggested answer", ar: "تصل الردود إلى يولـياس، لا إلى أداة إرسال منفصلة، مصنّفة مع رد مقترح" },
      channels: { en: "Email from your own mailbox; no ad audiences", ar: "البريد من صندوقك؛ لا جماهير إعلانية" },
      users: { en: "Unlimited users, like Clay, with pricing per prospect instead of credits per action", ar: "مستخدمون بلا حد مثل Clay، والسعر لكل عميل محتمل بدل رصيد لكل إجراء" },
    },
    limits: [
      { en: "It is not a programmable workspace: you can't add your own columns, formulas or 200 data vendors.", ar: "ليس مساحة قابلة للبرمجة: لا تضيف أعمدة أو معادلات أو 200 مزود بيانات." },
      { en: "Ad audience syncs and complex enrichment recipes are Clay's territory, not Yolias'.", ar: "مزامنة الجماهير الإعلانية ووصفات الإثراء المعقدة مجال Clay، لا يولـياس." },
      { en: "Results depend on the sources connected to your market, not on the providers you choose.", ar: "النتائج تعتمد على المصادر المتصلة بسوقك، لا على مزودين تختارهم." },
    ],
  },
  zoominfo: {
    rows: {
      find: { en: "Built for a small team: write the customer you want in a sentence, with no contract or onboarding call first", ar: "مبني لفريق صغير: اكتب العميل الذي تريده في جملة، بلا عقد ولا مكالمة إعداد أولًا" },
      finds: { en: "Companies and local businesses in your target cities, including the Arab markets where global databases are thinner", ar: "شركات وأنشطة محلية في مدنك المستهدفة، ومنها الأسواق العربية حيث تكون القواعد العالمية أضعف" },
      why: { en: "A plain match score with the criteria met, rather than intent data you have to interpret", ar: "نسبة تطابق واضحة مع المعايير المحققة، بدل بيانات نية تحتاج إلى تفسير" },
      contacts: { en: "Published business contacts, labelled by verification; nothing to export with credits", ar: "بيانات تواصل منشورة مصنّفة حسب التحقق؛ لا شيء تصدّره برصيد" },
      outreach: { en: "Emails and follow-ups written and sent from your mailbox, so you don't need a second tool to reach the list", ar: "رسائل ومتابعات تُكتب وتُرسل من بريدك، فلا تحتاج أداة ثانية للوصول إلى القائمة" },
      replies: { en: "Replies and interested deals stay in Yolias; CSV export when you want them in another CRM", ar: "الردود والصفقات المهتمة تبقى في يولـياس، مع تصدير CSV متى أردتها في نظام آخر" },
      channels: { en: "Email from your own account", ar: "البريد من حسابك" },
      users: { en: "Public prices from $5, unlimited users, no sales quote", ar: "أسعار معلنة تبدأ من 5 دولارات، ومستخدمون بلا حد، بلا عرض سعر من المبيعات" },
    },
    limits: [
      { en: "It doesn't offer ZoomInfo-scale intent data or native Salesforce and Dynamics integrations.", ar: "لا يقدم بيانات نية بحجم ZoomInfo ولا تكاملات مدمجة مع Salesforce وDynamics." },
      { en: "It is not built for large enterprise data contracts across many regions at once.", ar: "ليس مبنيًا لعقود بيانات مؤسسية كبيرة عبر مناطق كثيرة في وقت واحد." },
      { en: "Direct dials and personal mobiles aren't promised; published business contacts are shown.", ar: "لا يَعِد بأرقام مباشرة أو جوالات شخصية؛ يعرض بيانات التواصل المنشورة للشركات." },
    ],
  },
  lusha: {
    rows: {
      find: { en: "No browser extension needed: you describe the customer and Yolias searches, rather than you looking people up one by one", ar: "لا تحتاج إضافة للمتصفح: تصف العميل ويبحث يولـياس، بدل أن تبحث عن الأشخاص واحدًا واحدًا" },
      finds: { en: "Whole lists of matching companies and local businesses, with their decision makers where public data lists them", ar: "قوائم كاملة من الشركات والأنشطة المحلية المطابقة، مع صنّاع القرار حيث تذكرهم البيانات العامة" },
      why: { en: "Every company comes with the reasons it fits your description, not only a score", ar: "كل شركة تأتي بأسباب مطابقتها لوصفك، لا بنسبة فقط" },
      contacts: { en: "Published business contacts with their verification state; no 1-credit email or 5-credit phone pricing", ar: "بيانات تواصل منشورة بحالة تحققها؛ لا تسعير برصيد للبريد ولا خمسة أرصدة للهاتف" },
      outreach: { en: "Goes past the contact: writes the first email and follow-ups and sends them from your mailbox after approval", ar: "يتجاوز جهة الاتصال: يكتب الرسالة الأولى والمتابعات ويرسلها من بريدك بعد الموافقة" },
      replies: { en: "An inbox for the replies to those emails, sorted, and a CRM of the leads that showed interest", ar: "صندوق وارد لردود تلك الرسائل مصنّفة، وإدارة عملاء للمهتمين منهم" },
      channels: { en: "Email", ar: "البريد" },
      users: { en: "Unlimited users on every plan, no team plan needed", ar: "مستخدمون بلا حد في كل خطة، بلا حاجة لخطة فرق" },
    },
    limits: [
      { en: "It doesn't promise verified personal emails and mobile numbers the way Lusha's database does.", ar: "لا يَعِد ببريد شخصي وأرقام جوال محققة كما تفعل قاعدة Lusha." },
      { en: "There is no browser extension for looking up a single profile on LinkedIn.", ar: "لا توجد إضافة متصفح للبحث عن ملف واحد على LinkedIn." },
      { en: "No warehouse sync or Zapier recipes; export is CSV.", ar: "لا مزامنة مع مستودع بيانات ولا وصفات Zapier؛ التصدير بملف CSV." },
    ],
  },
  cognism: {
    rows: {
      find: { en: "No filter grid of firmographics and technographics: one sentence describes the market, in English or Arabic", ar: "لا شبكة فلاتر للخصائص والتقنيات: جملة واحدة تصف السوق، بالعربية أو الإنجليزية" },
      finds: { en: "Companies and local businesses that match, and their decision makers where public sources name them", ar: "الشركات والأنشطة المحلية المطابقة، وصنّاع القرار فيها حيث تذكرهم المصادر العامة" },
      why: { en: "Fit to your own description, shown as a score with the criteria met, rather than third-party intent", ar: "التوافق مع وصفك أنت، معروضًا كنسبة مع المعايير المحققة، بدل نية من طرف ثالث" },
      contacts: { en: "Published business contacts labelled by verification; no phone-verified mobile numbers", ar: "بيانات تواصل منشورة مصنّفة حسب التحقق؛ بلا أرقام جوال محققة بالهاتف" },
      outreach: { en: "The emails are part of the product: written for each company and sent from your mailbox after one approval", ar: "الرسائل جزء من المنتج: تُكتب لكل شركة وتُرسل من بريدك بعد موافقة واحدة" },
      replies: { en: "Replies handled in Yolias, with interested leads moved to its CRM; CSV export for other tools", ar: "الردود تُدار في يولـياس، والمهتمون ينتقلون إلى إدارة العملاء فيه، مع تصدير CSV لأدوات أخرى" },
      channels: { en: "Email from your own mailbox", ar: "البريد من صندوقك" },
      users: { en: "Unlimited users and public prices, no five-seat minimum or quote", ar: "مستخدمون بلا حد وأسعار معلنة، بلا حد أدنى خمسة مقاعد ولا عرض سعر" },
    },
    limits: [
      { en: "It doesn't offer Bombora intent, job-change alerts or phone-verified mobiles like Cognism.", ar: "لا يقدم بيانات نية Bombora ولا تنبيهات تغيير الوظيفة ولا جوالات محققة مثل Cognism." },
      { en: "It is not a European compliance-first data vendor; it shows what companies publish.", ar: "ليس مزود بيانات أوروبيًا يركز على الامتثال أولًا؛ يعرض ما تنشره الشركات." },
      { en: "Results depend on the public sources available for your market.", ar: "النتائج تعتمد على المصادر العامة المتاحة لسوقك." },
    ],
  },
  instantly: {
    rows: {
      find: { en: "The list comes first: you describe the customer and Yolias finds them, instead of buying leads on a separate plan", ar: "القائمة أولًا: تصف العميل ويجده يولـياس، بدل شراء عملاء على خطة منفصلة" },
      finds: { en: "Companies chosen for your service, each explained, rather than a bulk lead export", ar: "شركات مختارة لخدمتك، كل منها مشروح، بدل تصدير جماعي للعملاء" },
      why: { en: "A match score and the criteria met, so you write to fewer, better-fitting companies", ar: "نسبة تطابق والمعايير المحققة، فتراسل شركات أقل وأنسب" },
      contacts: { en: "Published business contacts labelled by verification, included in the price per prospect", ar: "بيانات تواصل منشورة مصنّفة حسب التحقق، ضمن سعر العميل المحتمل" },
      outreach: { en: "Fewer, researched emails from your real mailbox, within daily limits, rather than volume across many warmed-up inboxes", ar: "رسائل أقل ومدروسة من بريدك الحقيقي ضمن حد يومي، بدل كميات عبر صناديق كثيرة مُدفّأة" },
      replies: { en: "A sorted inbox with suggested answers; stop requests and out-of-office replies are handled for you", ar: "صندوق وارد مصنّف مع ردود مقترحة، وطلبات التوقف وردود «خارج المكتب» تُعالج تلقائيًا" },
      channels: { en: "Email, like Instantly", ar: "البريد، مثل Instantly" },
      users: { en: "Unlimited users on every plan", ar: "مستخدمون بلا حد في كل خطة" },
    },
    limits: [
      { en: "It doesn't run warmup or rotate senders across dozens of mailboxes.", ar: "لا يدفّئ الصناديق ولا يدوّر المرسلين عبر عشرات الصناديق." },
      { en: "It is not made for very high daily volumes; it sends at a human pace from your mailbox.", ar: "ليس مصممًا لكميات يومية كبيرة جدًا؛ يرسل بوتيرة بشرية من بريدك." },
      { en: "No A/B testing across many sending accounts.", ar: "لا اختبارات A/B عبر حسابات إرسال كثيرة." },
    ],
  },
  smartlead: {
    rows: {
      find: { en: "You don't bring a list: Yolias builds it from your description, in English or Arabic", ar: "لا تحضر قائمة: يبنيها يولـياس من وصفك، بالعربية أو الإنجليزية" },
      finds: { en: "Matching companies, local businesses and lookalikes, found for your offer", ar: "شركات مطابقة وأنشطة محلية وشركات مشابهة، يُعثر عليها لعرضك" },
      why: { en: "Each company is scored against your description and shows why it fits", ar: "كل شركة تُقيّم مقابل وصفك وتوضح لماذا تناسب" },
      contacts: { en: "Published business contacts, labelled by verification, found together with the company", ar: "بيانات تواصل منشورة مصنّفة حسب التحقق، تُجمع مع الشركة نفسها" },
      outreach: { en: "Writes each email from what it learned about the company and sends from your own mailbox after one approval", ar: "يكتب كل رسالة مما عرفه عن الشركة ويرسلها من بريدك بعد موافقة واحدة" },
      replies: { en: "Replies sorted with a suggested answer; interested leads become deals in Yolias' CRM", ar: "ردود مصنّفة مع رد مقترح، والمهتمون يصبحون صفقات في إدارة العملاء في يولـياس" },
      channels: { en: "Email from your own mailbox", ar: "البريد من صندوقك" },
      users: { en: "Unlimited users; price per prospect found, sending included", ar: "مستخدمون بلا حد؛ السعر لكل عميل محتمل يُعثر عليه والإرسال مشمول" },
    },
    limits: [
      { en: "No sender rotation, warmup network or white-label client accounts like Smartlead.", ar: "لا تدوير للمرسلين ولا شبكة تدفئة ولا حسابات عملاء بعلامتك مثل Smartlead." },
      { en: "It is not built to send for many agency clients from hundreds of mailboxes.", ar: "ليس مبنيًا للإرسال لعملاء وكالة كثيرين من مئات الصناديق." },
      { en: "If you already have a clean list and only need sending infrastructure, Smartlead is the closer fit.", ar: "إن كانت لديك قائمة نظيفة وتحتاج بنية إرسال فقط، فـ Smartlead أقرب لك." },
    ],
  },
  hunter: {
    rows: {
      find: { en: "Starts from who you want to sell to, not from a domain you already know", ar: "يبدأ ممن تريد البيع لهم، لا من دومين تعرفه مسبقًا" },
      finds: { en: "The companies themselves: matching businesses you hadn't heard of, then how to reach them", ar: "الشركات نفسها: أنشطة مطابقة لم تسمع بها، ثم طريقة الوصول إليها" },
      why: { en: "A match score with the criteria each company met", ar: "نسبة تطابق مع المعايير التي حققتها كل شركة" },
      contacts: { en: "The contacts a company publishes, labelled by verification; no guessing of email patterns", ar: "بيانات التواصل التي تنشرها الشركة مصنّفة حسب التحقق؛ بلا تخمين لأنماط البريد" },
      outreach: { en: "Emails written for each company from its website, sent from your mailbox after you approve", ar: "رسائل تُكتب لكل شركة من موقعها، وتُرسل من بريدك بعد موافقتك" },
      replies: { en: "Replies sorted in Yolias, with a CRM for the interested ones", ar: "الردود مصنّفة في يولـياس، مع إدارة عملاء للمهتمين" },
      channels: { en: "Email", ar: "البريد" },
      users: { en: "Unlimited users on every plan", ar: "مستخدمون بلا حد في كل خطة" },
    },
    limits: [
      { en: "It is not an email finder for a person you already know; Hunter is better at that.", ar: "ليس أداة للعثور على بريد شخص تعرفه؛ Hunter أفضل في ذلك." },
      { en: "No public API for bulk email lookups.", ar: "لا واجهة برمجة عامة للبحث الجماعي عن البريد." },
      { en: "Personal emails aren't promised; published business contacts are shown.", ar: "لا يَعِد ببريد شخصي؛ يعرض بيانات التواصل المنشورة للشركات." },
    ],
  },
};
