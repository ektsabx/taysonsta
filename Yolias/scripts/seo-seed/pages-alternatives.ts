import { CTA, type SeedPage } from "./types.ts";

// "Best X tools" and "X alternatives" (D-257). The tool cards come from
// Admin → SEO → Competitors (sourced, reviewed there); each page adds its own
// selection criteria and when each option fits, so no two pages are the same
// text with another name.

const compareLinks = (skip: string) => [
  { path: "/compare/apollo", en: "Yolias vs Apollo", ar: "يولياس مقابل Apollo" },
  { path: "/compare/clay", en: "Yolias vs Clay", ar: "يولياس مقابل Clay" },
  { path: "/compare/zoominfo", en: "Yolias vs ZoomInfo", ar: "يولياس مقابل ZoomInfo" },
  { path: "/compare/instantly", en: "Yolias vs Instantly", ar: "يولياس مقابل Instantly" },
].filter((l) => !l.path.endsWith(skip));

export const listPages: SeedPage[] = [
  {
    kind: "compare", slug: "best-lead-generation-tools", format: "list",
    tools: ["apollo", "zoominfo", "clay", "lusha", "cognism", "hunter", "instantly", "smartlead"],
    primary_keyword: "best lead generation tools", secondary_keywords: ["best b2b prospecting tools", "b2b lead generation tools", "lead generation software", "lead generation tools for agencies"],
    links: [...compareLinks(""), { path: "/use-cases/find-clients", en: "How to find clients for a service business", ar: "كيف تجد عملاء لنشاط خدمي" }],
    sources: ["https://www.apollo.io/", "https://www.zoominfo.com/", "https://www.clay.com/", "https://www.lusha.com/", "https://www.cognism.com/", "https://hunter.io/", "https://instantly.ai/", "https://www.smartlead.ai/"],
    en: {
      title: "Best lead generation tools", h1: "The best B2B lead generation tools, by what you need",
      metaTitle: "Best B2B lead generation tools, compared by job",
      metaDescription: "Lead generation tools do four jobs: contact data, enrichment, email finding and sending. How to choose, and what Apollo, Clay, Hunter, Yolias and others are for.",
      lead: "\"Lead generation tool\" covers four different jobs. Most teams need two or three of them, and the best tool depends on which job is your bottleneck.",
      answer: "There is no single best lead generation tool. Contact databases (Apollo, ZoomInfo, Lusha, Cognism) give you people and their details; workflow tools (Clay) let you build enrichment yourself; email finders (Hunter) get addresses for companies you chose; senders (Instantly, Smartlead) deliver volume. Yolias covers finding the right companies from a plain description and the outreach from your own mailbox.",
      criteria: [
        "**Your bottleneck:** not knowing who to target, missing contact details, or sending enough.",
        "**How you search:** filters over a database, a workflow you build, or a plain description of your customer.",
        "**Contact data you need:** published business contacts, verified emails, or direct mobile numbers.",
        "**How you reach people:** email from your own mailbox, high-volume sending, or phone.",
        "**Price model:** per user, per credit, per contact revealed, or by quote.",
        "**Your market and language:** coverage differs a lot by country.",
      ],
      blocks: [
        { h2: "The four jobs" },
        { table: { head: ["Job", "Tools in this list", "Good when"], rows: [
          ["Contact database", "Apollo, ZoomInfo, Lusha, Cognism", "You know the titles you want and need emails or phones fast"],
          ["Build your own enrichment", "Clay", "Someone on the team will design and maintain workflows"],
          ["Find and verify emails", "Hunter", "You already chose the companies"],
          ["Send at volume", "Instantly, Smartlead", "You have lists and many mailboxes"],
        ] } },
        { h2: "Where Yolias fits" },
        { p: "Yolias is for businesses that sell services. You describe the client you want, in English or Arabic, and Yolias finds matching companies, local businesses and decision makers, explains why each one fits, writes the first emails and sends them from your own mailbox after you approve. It shows the contact details companies publish and doesn't promise a personal email or phone for everyone, and its outreach is email only." },
        { h2: "A common combination" },
        { p: "Many teams use one tool to find and qualify companies and another for direct contacts or volume sending. Yolias exports any list as CSV, so it works alongside the others." },
      ],
      faq: [
        { q: "Which lead generation tool is best for a small agency?", a: "It depends on the bottleneck. If you don't know who to approach, start with a tool that finds and explains matching companies. If you have the companies, an email finder is enough. If you send a lot, add a sending platform." },
        { q: "Are these tools priced the same way?", a: "No. Some charge per user, some per credit or per revealed contact, and some only by quote. Check each pricing page with your team size and monthly volume." },
        { q: "How did you choose and describe these tools?", a: "From each product's own website, read on the date shown on this page. We don't rank them by a score; we describe what each one is for." },
      ],
      cta: CTA.en,
    },
    ar: {
      title: "أفضل أدوات جذب العملاء", h1: "أفضل أدوات جذب عملاء B2B حسب ما تحتاجه",
      metaTitle: "أفضل أدوات جذب عملاء B2B مقارنة حسب المهمة",
      metaDescription: "أدوات جذب العملاء تؤدي أربع مهام مختلفة: بيانات التواصل، والإثراء، وإيجاد البريد، والإرسال. كيف تختار، ولماذا يصلح كل من Apollo وClay وHunter ويولياس وغيرها.",
      lead: "«أداة جذب العملاء» تشمل أربع مهام مختلفة. معظم الفرق تحتاج اثنتين أو ثلاثًا منها، وأفضل أداة تعتمد على المهمة التي تعطلك.",
      answer: "لا توجد أداة واحدة هي الأفضل. قواعد جهات الاتصال (Apollo وZoomInfo وLusha وCognism) تعطيك الأشخاص وبياناتهم، وأدوات المسارات (Clay) تتيح لك بناء الإثراء بنفسك، وأدوات إيجاد البريد (Hunter) تجلب العناوين لشركات اخترتها، وأدوات الإرسال (Instantly وSmartlead) للكميات الكبيرة. أما يولياس فيغطي إيجاد الشركات المناسبة من وصف بسيط والتواصل من بريدك.",
      criteria: [
        "**ما يعطلك:** لا تعرف من تستهدف، أو تنقصك بيانات التواصل، أو لا ترسل بما يكفي.",
        "**طريقة البحث:** فلاتر على قاعدة بيانات، أو مسار تبنيه، أو وصف بسيط لعميلك.",
        "**بيانات التواصل التي تحتاجها:** بيانات الشركة المنشورة، أو بريد موثق، أو أرقام جوال مباشرة.",
        "**طريقة الوصول:** البريد من صندوقك، أو الإرسال بكميات، أو الهاتف.",
        "**نموذج السعر:** لكل مستخدم، أو بالرصيد، أو لكل جهة اتصال، أو بعرض سعر.",
        "**سوقك ولغتك:** التغطية تختلف كثيرًا من بلد لآخر.",
      ],
      blocks: [
        { h2: "المهام الأربع" },
        { table: { head: ["المهمة", "الأدوات في هذه القائمة", "مناسبة عندما"], rows: [
          ["قاعدة جهات اتصال", "Apollo وZoomInfo وLusha وCognism", "تعرف المناصب التي تريدها وتحتاج البريد أو الهاتف بسرعة"],
          ["بناء الإثراء بنفسك", "Clay", "شخص في الفريق سيصمم المسارات ويحافظ عليها"],
          ["إيجاد البريد والتحقق منه", "Hunter", "اخترت الشركات بالفعل"],
          ["الإرسال بكميات كبيرة", "Instantly وSmartlead", "لديك قوائم وصناديق بريد كثيرة"],
        ] } },
        { h2: "أين يقع يولياس" },
        { p: "يولياس للشركات التي تبيع خدمات. تصف العميل الذي تريده، بالعربية أو الإنجليزية، فيجد يولياس الشركات والأنشطة المحلية وصنّاع القرار المطابقين، ويشرح سبب تطابق كل منهم، ويكتب الرسائل الأولى ويرسلها من بريدك بعد موافقتك. يعرض بيانات التواصل التي تنشرها الشركات ولا يعد ببريد أو رقم شخصي للجميع، وتواصله بالبريد فقط." },
        { h2: "تركيبة شائعة" },
        { p: "كثير من الفرق تستخدم أداة لإيجاد الشركات وتقييمها وأخرى لبيانات التواصل المباشرة أو الإرسال بكميات. ويصدّر يولياس أي قائمة كملف CSV، فيعمل بجانب الأدوات الأخرى." },
      ],
      faq: [
        { q: "ما أفضل أداة لجذب العملاء لوكالة صغيرة؟", a: "يعتمد على ما يعطلك. إذا كنت لا تعرف من تستهدف، ابدأ بأداة تجد الشركات المطابقة وتشرحها. وإذا كانت لديك الشركات، تكفيك أداة لإيجاد البريد. وإذا كنت ترسل كثيرًا، أضف منصة إرسال." },
        { q: "هل تُسعّر هذه الأدوات بنفس الطريقة؟", a: "لا. بعضها لكل مستخدم، وبعضها بالرصيد أو لكل جهة اتصال، وبعضها بعرض سعر فقط. راجع صفحة أسعار كل أداة بحجم فريقك وحجمك الشهري." },
        { q: "كيف اخترتم هذه الأدوات ووصفتموها؟", a: "من الموقع الرسمي لكل منتج، بالتاريخ الموضح في هذه الصفحة. لا نرتبها بدرجات، بل نصف لماذا تصلح كل أداة." },
      ],
      cta: CTA.ar,
    },
  },
];

export const alternativesPages: SeedPage[] = [
  {
    kind: "alternatives", slug: "apollo", competitor: "apollo", tools: ["zoominfo", "lusha", "cognism", "clay", "hunter"],
    primary_keyword: "apollo alternatives", secondary_keywords: ["apollo.io alternatives", "apollo io competitors", "alternatives to apollo io", "cheaper apollo alternative"],
    links: [{ path: "/compare/apollo", en: "Yolias vs Apollo", ar: "يولياس مقابل Apollo" }, ...compareLinks("apollo").slice(0, 2), { path: "/compare/best-lead-generation-tools", en: "Best lead generation tools", ar: "أفضل أدوات جذب العملاء" }],
    sources: ["https://www.apollo.io/", "https://www.apollo.io/pricing"],
    en: {
      title: "Apollo alternatives", h1: "Apollo alternatives: what to switch to, depending on why you're leaving",
      metaTitle: "Apollo.io alternatives for 2026, by reason to switch",
      metaDescription: "Leaving Apollo because of credits, data in your market or how you build lists? The alternatives that fit each reason, with sources, and when Yolias is the right one.",
      lead: "People look for an Apollo alternative for different reasons: credits running out, contact data that is thin in their country, phone numbers, or a team that finds filters slow. The right alternative depends on the reason.",
      answer: "If you need more or better phone numbers, look at Cognism or Lusha. If you need a bigger enterprise dataset with intent, look at ZoomInfo. If you want to build your own enrichment across providers, look at Clay. If you only need emails for companies you chose, Hunter. If you sell services and want to describe your client and get matching companies with emails ready to approve, try Yolias.",
      criteria: [
        "**Why you're leaving Apollo:** price and credits, data quality in your market, phone coverage, or the way you build lists.",
        "**What you'll keep from Apollo:** many teams keep sequences in one tool and change only the data source.",
        "**Per-user or per-usage pricing:** matters most for teams of five or more.",
        "**Your country:** check coverage on a sample list before you commit.",
      ],
      blocks: [
        { h2: "By reason to switch" },
        { table: { head: ["If you're leaving because…", "Look at", "Why"], rows: [
          ["Credits and per-user pricing", "Yolias, Hunter", "Yolias has unlimited users and never charges for emails; Hunter charges per email found"],
          ["Phone numbers", "Cognism, Lusha", "Phone-verified mobiles (Cognism); 5 credits per phone (Lusha)"],
          ["You need enterprise data and intent", "ZoomInfo", "Broad data, intent and integrations, priced by quote"],
          ["You want to build your own enrichment", "Clay", "Waterfalls across many providers"],
          ["Filters don't describe your client", "Yolias", "Describe the client in plain English or Arabic"],
        ] } },
        { h2: "How to test an alternative in an afternoon" },
        { ol: ["Write down ten companies you'd love as clients.", "Ask each tool for companies like them in your market.", "Count how many results you would actually contact, and how many have a usable contact.", "Compare what that costs for your team for a month."] },
      ],
      faq: [
        { q: "What is the cheapest Apollo alternative?", a: "It depends on your volume and team size. Per-user tools get expensive as the team grows; Yolias has unlimited users on every plan and charges for prospects only, while Hunter charges per email found. Price your real monthly usage on each pricing page." },
        { q: "Is Yolias an Apollo alternative for agencies?", a: "Yes, for agencies that sell services and want matching companies explained and emailed from their own mailbox. Agencies that need large phone-number lists will want a contact data provider as well." },
      ],
      cta: CTA.en,
    },
    ar: {
      title: "بدائل Apollo", h1: "بدائل Apollo: إلى ماذا تنتقل حسب سبب تركك له",
      metaTitle: "بدائل Apollo.io في 2026 حسب سبب الانتقال",
      metaDescription: "تترك Apollo بسبب الرصيد، أو ضعف البيانات في سوقك، أو طريقة بناء القوائم؟ البدائل المناسبة لكل سبب، بالمصادر، ومتى يكون يولياس هو الخيار المناسب.",
      lead: "يبحث الناس عن بديل لـ Apollo لأسباب مختلفة: نفاد الرصيد، أو بيانات تواصل ضعيفة في بلدهم، أو أرقام الهاتف، أو فريق يرى الفلاتر بطيئة. البديل المناسب يعتمد على السبب.",
      answer: "إذا كنت تحتاج أرقام هاتف أكثر أو أدق، فانظر إلى Cognism أو Lusha. وإذا كنت تحتاج بيانات مؤسسية أوسع مع إشارات النية، فـ ZoomInfo. وإذا أردت بناء الإثراء بنفسك عبر مزودين، فـ Clay. وإذا كنت تحتاج البريد فقط لشركات اخترتها، فـ Hunter. وإذا كنت تبيع خدمات وتريد وصف عميلك والحصول على شركات مطابقة مع رسائل جاهزة لموافقتك، فجرّب يولياس.",
      criteria: [
        "**سبب تركك لـ Apollo:** السعر والرصيد، أو جودة البيانات في سوقك، أو تغطية الهاتف، أو طريقة بناء القوائم.",
        "**ما ستحتفظ به:** كثير من الفرق تبقي التسلسلات في أداة وتغيّر مصدر البيانات فقط.",
        "**السعر لكل مستخدم أم حسب الاستخدام:** يهم أكثر للفرق من خمسة أشخاص فأكثر.",
        "**بلدك:** جرّب التغطية على قائمة عيّنة قبل الالتزام.",
      ],
      blocks: [
        { h2: "حسب سبب الانتقال" },
        { table: { head: ["إذا كنت تتركه لأن…", "انظر إلى", "السبب"], rows: [
          ["الرصيد والسعر لكل مستخدم", "يولياس، Hunter", "يولياس بعدد غير محدود من المستخدمين ولا يحسب البريد؛ وHunter يحسب لكل بريد يجده"],
          ["أرقام الهاتف", "Cognism، Lusha", "أرقام جوال متحقق منها هاتفيًا (Cognism)؛ وخمسة أرصدة للرقم (Lusha)"],
          ["تحتاج بيانات مؤسسية ونية شراء", "ZoomInfo", "بيانات واسعة ونية وتكاملات، بعرض سعر"],
          ["تريد بناء الإثراء بنفسك", "Clay", "تسلسل عبر مزودين كثيرين"],
          ["الفلاتر لا تصف عميلك", "يولياس", "صِف العميل بالعربية أو الإنجليزية"],
        ] } },
        { h2: "كيف تجرّب بديلًا في نصف يوم" },
        { ol: ["اكتب عشر شركات تتمنى أن تكون عملاءك.", "اطلب من كل أداة شركات تشبهها في سوقك.", "احسب كم نتيجة ستتواصل معها فعلًا، وكم منها لها بيانات تواصل صالحة.", "قارن تكلفة ذلك لفريقك لمدة شهر."] },
      ],
      faq: [
        { q: "ما أرخص بديل لـ Apollo؟", a: "يعتمد على حجمك وحجم فريقك. الأدوات التي تُسعّر لكل مستخدم تغلو مع نمو الفريق؛ ويولياس بعدد غير محدود من المستخدمين في كل الخطط ويحسب العملاء المحتملين فقط، وHunter يحسب لكل بريد يجده. احسب استخدامك الشهري الحقيقي على صفحة أسعار كل أداة." },
        { q: "هل يولياس بديل لـ Apollo للوكالات؟", a: "نعم، للوكالات التي تبيع خدمات وتريد شركات مطابقة مشروحة ومراسلة من بريدها. أما الوكالات التي تحتاج قوائم أرقام هاتف كبيرة فستحتاج مزود بيانات تواصل أيضًا." },
      ],
      cta: CTA.ar,
    },
  },
  {
    kind: "alternatives", slug: "clay", competitor: "clay", tools: ["apollo", "zoominfo", "lusha", "hunter"],
    primary_keyword: "clay alternatives", secondary_keywords: ["clay.com alternatives", "clay competitors", "clay alternative for agencies", "easier alternative to clay"],
    links: [{ path: "/compare/clay", en: "Yolias vs Clay", ar: "يولياس مقابل Clay" }, { path: "/compare/apollo", en: "Yolias vs Apollo", ar: "يولياس مقابل Apollo" }, { path: "/compare/best-lead-generation-tools", en: "Best lead generation tools", ar: "أفضل أدوات جذب العملاء" }],
    sources: ["https://www.clay.com/", "https://www.clay.com/pricing"],
    en: {
      title: "Clay alternatives", h1: "Clay alternatives for teams that want results, not workflows",
      metaTitle: "Clay alternatives: simpler ways to find and enrich leads",
      metaDescription: "Clay is powerful but you build everything yourself. Alternatives for teams that want a database, an email finder or research done for them, and when Yolias fits.",
      lead: "Clay is a builder: tables, columns, waterfalls and agents you set up. Teams usually look for an alternative when the building takes longer than the selling, or when usage credits are hard to predict.",
      answer: "If you want a ready contact database instead of building enrichment, look at Apollo, ZoomInfo or Lusha. If you only need emails for companies you picked, Hunter. If you want the research itself done from a plain description of your client, with emails prepared for your approval, try Yolias.",
      criteria: [
        "**Who will run it:** a dedicated RevOps person, or the person who also sells.",
        "**What you used Clay for:** finding companies, enriching contacts, scoring, or writing personalised lines.",
        "**Predictable cost:** actions and credits versus per-user or per-prospect pricing.",
      ],
      blocks: [
        { h2: "What you lose and keep when you leave Clay" },
        { p: "You lose the freedom to chain any provider and any step. You keep the outcome you care about if the alternative covers your main job: a database covers contacts, an email finder covers addresses, and Yolias covers finding and qualifying companies and writing the first email." },
        { h2: "By what you used Clay for" },
        { table: { head: ["You used Clay to…", "Simpler option"], rows: [
          ["Find companies that match your ICP", "Yolias (describe the ICP in plain language)"],
          ["Enrich contacts with emails and phones", "Apollo, Lusha, ZoomInfo"],
          ["Find emails for a list of domains", "Hunter"],
          ["Write a personalised first line per prospect", "Yolias (writes the whole first email from your Company Knowledge)"],
        ] } },
      ],
      faq: [
        { q: "Is there an easier alternative to Clay?", a: "If your main use was finding and qualifying companies and writing first emails, Yolias does that from a plain description without a workflow to build. If you used Clay mainly for contact enrichment, a contact database is simpler." },
        { q: "Can I keep Clay and add Yolias?", a: "Yes. Export a list from either one as CSV and import it into the other." },
      ],
      cta: CTA.en,
    },
    ar: {
      title: "بدائل Clay", h1: "بدائل Clay للفرق التي تريد نتائج لا مسارات",
      metaTitle: "بدائل Clay: طرق أبسط لإيجاد العملاء وإثراء بياناتهم",
      metaDescription: "Clay قوي لكنك تبني كل شيء بنفسك. بدائل للفرق التي تريد قاعدة بيانات أو أداة لإيجاد البريد أو بحثًا يُنجز عنها، ومتى يناسب يولياس.",
      lead: "Clay أداة بناء: جداول وأعمدة وتسلسلات ووكلاء تضبطهم بنفسك. وتبحث الفرق عادة عن بديل عندما يأخذ البناء وقتًا أطول من البيع، أو عندما يصعب توقع استهلاك الرصيد.",
      answer: "إذا أردت قاعدة جهات اتصال جاهزة بدل بناء الإثراء، فانظر إلى Apollo أو ZoomInfo أو Lusha. وإذا كنت تحتاج البريد فقط لشركات اخترتها، فـ Hunter. وإذا أردت أن يتم البحث نفسه من وصف بسيط لعميلك، مع رسائل جاهزة لموافقتك، فجرّب يولياس.",
      criteria: [
        "**من سيشغّل الأداة:** شخص متفرغ للعمليات، أم الشخص الذي يبيع أيضًا.",
        "**لماذا كنت تستخدم Clay:** إيجاد الشركات، أو إثراء جهات الاتصال، أو التقييم، أو كتابة سطور مخصصة.",
        "**تكلفة متوقعة:** الإجراءات والرصيد مقابل السعر لكل مستخدم أو لكل عميل محتمل.",
      ],
      blocks: [
        { h2: "ما الذي تخسره وتحتفظ به عند ترك Clay" },
        { p: "تخسر حرية ربط أي مزود وأي خطوة. وتحتفظ بالنتيجة التي تهمك إذا غطى البديل مهمتك الأساسية: قاعدة البيانات تغطي جهات الاتصال، وأداة إيجاد البريد تغطي العناوين، ويولياس يغطي إيجاد الشركات وتقييمها وكتابة الرسالة الأولى." },
        { h2: "حسب ما كنت تستخدم Clay له" },
        { table: { head: ["كنت تستخدم Clay لـ…", "خيار أبسط"], rows: [
          ["إيجاد شركات تطابق عميلك المثالي", "يولياس (صِف العميل بلغة طبيعية)"],
          ["إثراء جهات الاتصال بالبريد والهاتف", "Apollo وLusha وZoomInfo"],
          ["إيجاد البريد لقائمة نطاقات", "Hunter"],
          ["كتابة سطر أول مخصص لكل عميل", "يولياس (يكتب الرسالة الأولى كاملة من معرفة شركتك)"],
        ] } },
      ],
      faq: [
        { q: "هل يوجد بديل أسهل من Clay؟", a: "إذا كان استخدامك الأساسي إيجاد الشركات وتقييمها وكتابة الرسائل الأولى، فيولياس يفعل ذلك من وصف بسيط دون مسار تبنيه. وإذا كنت تستخدم Clay أساسًا لإثراء جهات الاتصال، فقاعدة جهات اتصال أبسط." },
        { q: "هل يمكنني الإبقاء على Clay وإضافة يولياس؟", a: "نعم. صدّر قائمة من أي منهما كملف CSV واستوردها في الآخر." },
      ],
      cta: CTA.ar,
    },
  },
  {
    kind: "alternatives", slug: "zoominfo", competitor: "zoominfo", tools: ["apollo", "cognism", "lusha", "clay"],
    primary_keyword: "zoominfo alternatives", secondary_keywords: ["zoominfo competitors", "cheaper zoominfo alternative", "zoominfo alternative for small business"],
    links: [{ path: "/compare/zoominfo", en: "Yolias vs ZoomInfo", ar: "يولياس مقابل ZoomInfo" }, { path: "/compare/apollo", en: "Yolias vs Apollo", ar: "يولياس مقابل Apollo" }, { path: "/compare/best-lead-generation-tools", en: "Best lead generation tools", ar: "أفضل أدوات جذب العملاء" }],
    sources: ["https://www.zoominfo.com/", "https://www.zoominfo.com/pricing"],
    en: {
      title: "ZoomInfo alternatives", h1: "ZoomInfo alternatives for smaller teams and other markets",
      metaTitle: "ZoomInfo alternatives with public pricing",
      metaDescription: "ZoomInfo is built and priced for large teams. Alternatives with public pricing or self-serve plans, for smaller teams, agencies and markets outside North America.",
      lead: "ZoomInfo doesn't publish prices and sells through its sales team, which suits large organisations. Smaller teams usually want to see a price, start the same day and pay for what they use.",
      answer: "For a self-serve contact database, look at Apollo or Lusha. For phone-verified mobiles in Europe, Cognism (priced by quote). For building your own enrichment, Clay. For businesses that sell services and want matching companies found and emailed from their own mailbox, Yolias.",
      criteria: [
        "**Public pricing and self-serve:** can you start without a sales call?",
        "**Team size:** per-seat plans versus unlimited users.",
        "**Your market:** coverage outside North America varies; test a sample.",
        "**Which ZoomInfo features you actually use:** contacts only, intent, or integrations.",
      ],
      blocks: [
        { h2: "Check what you use before you switch" },
        { p: "If your team mostly exports contacts, a self-serve database will cover it. If you rely on intent data and many integrations, few alternatives match ZoomInfo, and the switch is a bigger project." },
        { h2: "When Yolias fits" },
        { p: "Yolias is not a data platform. It fits when your goal is new clients for a service business: you describe them, Yolias finds and explains matching companies, writes the first emails and sends them from your mailbox after you approve, and keeps replies and leads in one place." },
      ],
      faq: [
        { q: "Is there a cheaper alternative to ZoomInfo?", a: "Several alternatives publish their prices and have self-serve plans, including Apollo, Lusha and Yolias. Whether they are cheaper depends on your team size and usage." },
        { q: "Does Yolias replace ZoomInfo for an enterprise?", a: "Usually not. Yolias is built for businesses that sell services and smaller sales teams, not as an enterprise data platform with intent data." },
      ],
      cta: CTA.en,
    },
    ar: {
      title: "بدائل ZoomInfo", h1: "بدائل ZoomInfo للفرق الأصغر والأسواق الأخرى",
      metaTitle: "بدائل ZoomInfo بأسعار منشورة",
      metaDescription: "ZoomInfo مبني ومُسعّر للفرق الكبيرة. بدائل بأسعار منشورة أو خطط ذاتية الخدمة، للفرق الأصغر والوكالات والأسواق خارج أمريكا الشمالية.",
      lead: "ZoomInfo لا ينشر أسعاره ويبيع عبر فريق مبيعاته، وهذا يناسب المؤسسات الكبيرة. أما الفرق الأصغر فتريد عادة أن ترى السعر وتبدأ في نفس اليوم وتدفع حسب استخدامها.",
      answer: "لقاعدة جهات اتصال ذاتية الخدمة، انظر إلى Apollo أو Lusha. ولأرقام جوال متحقق منها في أوروبا، Cognism (بعرض سعر). ولبناء الإثراء بنفسك، Clay. وللشركات التي تبيع خدمات وتريد إيجاد الشركات المطابقة ومراسلتها من بريدها، يولياس.",
      criteria: [
        "**أسعار منشورة وخدمة ذاتية:** هل يمكنك البدء دون مكالمة مبيعات؟",
        "**حجم الفريق:** خطط لكل مستخدم مقابل عدد غير محدود.",
        "**سوقك:** التغطية خارج أمريكا الشمالية تختلف؛ جرّب عيّنة.",
        "**ما تستخدمه فعلًا من ZoomInfo:** جهات الاتصال فقط، أو النية، أو التكاملات.",
      ],
      blocks: [
        { h2: "راجع ما تستخدمه قبل الانتقال" },
        { p: "إذا كان فريقك يصدّر جهات الاتصال غالبًا، فقاعدة بيانات ذاتية الخدمة تكفي. وإذا كنت تعتمد على بيانات النية وتكاملات كثيرة، فقليل من البدائل يضاهي ZoomInfo، والانتقال مشروع أكبر." },
        { h2: "متى يناسب يولياس" },
        { p: "يولياس ليس منصة بيانات. يناسب عندما يكون هدفك عملاء جددًا لنشاط خدمي: تصفهم، فيجد يولياس الشركات المطابقة ويشرحها، ويكتب الرسائل الأولى ويرسلها من بريدك بعد موافقتك، ويحفظ الردود والعملاء في مكان واحد." },
      ],
      faq: [
        { q: "هل يوجد بديل أرخص من ZoomInfo؟", a: "عدة بدائل تنشر أسعارها ولديها خطط ذاتية الخدمة، منها Apollo وLusha ويولياس. وكونها أرخص يعتمد على حجم فريقك واستخدامك." },
        { q: "هل يحل يولياس محل ZoomInfo لمؤسسة كبيرة؟", a: "غالبًا لا. يولياس مبني للشركات التي تبيع خدمات وفرق المبيعات الأصغر، وليس منصة بيانات مؤسسية ببيانات النية." },
      ],
      cta: CTA.ar,
    },
  },
];
