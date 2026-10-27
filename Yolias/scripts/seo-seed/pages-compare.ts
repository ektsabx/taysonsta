import { CTA, Y, type SeedPage } from "./types.ts";

// "Yolias vs X" (D-257). The competitor column says only what the product's
// own website says (scripts/seo-seed/competitors.ts has the sources); where
// its site says nothing, the row says so instead of guessing.

type L = { en: string; ar: string };
type Row = "find" | "finds" | "why" | "contacts" | "outreach" | "replies" | "channels" | "users";
interface Vs {
  slug: string; name: string; nameAr?: string; keyword: string; secondary: string[];
  them: Record<Row, L>;
  answer: L; lead: L;
  chooseThem: { en: string[]; ar: string[] };
  chooseYolias: { en: string[]; ar: string[] };
  together?: L;
  faq: { en: { q: string; a: string }[]; ar: { q: string; a: string }[] };
  sources: string[];
}

const labels: Record<Row, L> = {
  find: { en: "How you find prospects", ar: "كيف تبحث عن العملاء" },
  finds: { en: "What it finds", ar: "ما الذي يجده" },
  why: { en: "Why each result fits", ar: "لماذا تناسب كل نتيجة" },
  contacts: { en: "Contact data", ar: "بيانات التواصل" },
  outreach: { en: "Outreach", ar: "التواصل" },
  replies: { en: "Replies and pipeline", ar: "الردود وإدارة العملاء" },
  channels: { en: "Channels", ar: "القنوات" },
  users: { en: "Users", ar: "المستخدمون" },
};
const rows: Row[] = ["find", "finds", "why", "contacts", "outreach", "replies", "channels", "users"];
const notStated: L = { en: "Not described on its website", ar: "غير موضح في موقعه" };

function versus(v: Vs): SeedPage {
  const side = (l: "en" | "ar") => ({
    title: l === "en" ? `Yolias vs ${v.name}` : `يولـياس مقابل ${v.nameAr ?? v.name}`,
    h1: l === "en" ? `Yolias vs ${v.name}: which one fits how you find clients?` : `يولـياس أم ${v.nameAr ?? v.name}: أيهما يناسب طريقتك في إيجاد العملاء؟`,
    metaTitle: l === "en" ? `Yolias vs ${v.name}: an honest comparison` : `يولـياس مقابل ${v.nameAr ?? v.name}: مقارنة صادقة`,
    metaDescription: l === "en"
      ? `How Yolias and ${v.name} differ in finding prospects, contact data, outreach and pricing, with sources, and when each one is the better choice.`
      : `الفرق بين يولـياس و${v.nameAr ?? v.name} في البحث عن العملاء وبيانات التواصل والتواصل والأسعار، بالمصادر، ومتى يكون كل منهما الخيار الأفضل.`,
    lead: v.lead[l],
    answer: v.answer[l],
    compare: rows.map((r) => ({ label: labels[r][l], yolias: Y[l][r], them: v.them[r][l] })),
    blocks: [
      { h2: l === "en" ? `When ${v.name} is the better choice` : `متى يكون ${v.nameAr ?? v.name} الخيار الأفضل` },
      { ul: v.chooseThem[l] },
      { h2: l === "en" ? "When Yolias is the better choice" : "متى يكون يولـياس الخيار الأفضل" },
      { ul: v.chooseYolias[l] },
      ...(v.together ? [{ h2: l === "en" ? "Using both" : "استخدام الاثنين معًا" }, { p: v.together[l] }] : []),
      { h2: l === "en" ? "What Yolias doesn't do" : "ما الذي لا يفعله يولـياس" },
      { ul: l === "en"
        ? ["It doesn't promise a personal email or phone number for every decision maker: it shows what companies publish, labelled by verification state.", "It doesn't send LinkedIn messages or make calls; outreach is email from your own mailbox.", "What it finds depends on your market and the data sources connected to it."]
        : ["لا يعد ببريد أو رقم شخصي لكل صانع قرار: يعرض ما تنشره الشركات مصنّفًا حسب حالة التحقق.", "لا يرسل رسائل على LinkedIn ولا يجري اتصالات؛ التواصل بالبريد من صندوق بريدك.", "ما يجده يعتمد على سوقك وعلى مصادر البيانات المتصلة به."] },
    ],
    faq: v.faq[l],
    cta: CTA[l],
  });
  return {
    kind: "compare", slug: v.slug, format: "versus", competitor: v.slug, tools: [v.slug],
    primary_keyword: v.keyword, secondary_keywords: v.secondary,
    links: [
      { path: "/compare/best-lead-generation-tools", en: "Best lead generation tools", ar: "أفضل أدوات جذب العملاء" },
      { path: "/use-cases/ai-prospecting", en: "AI prospecting", ar: "البحث عن العملاء بالذكاء الاصطناعي" },
      { path: "/pricing", en: "Yolias pricing", ar: "أسعار يولـياس" },
    ],
    sources: v.sources,
    en: side("en"), ar: side("ar"),
  };
}

export const comparePages: SeedPage[] = [
  versus({
    slug: "apollo", name: "Apollo", nameAr: "Apollo", keyword: "yolias vs apollo", secondary: ["apollo vs yolias", "apollo.io comparison"],
    lead: {
      en: "Apollo is a sales platform built around a large contact database, sequences and calling. Yolias starts from a description of your ideal customer and turns it into a researched list and approved emails. Here is how they differ.",
      ar: "Apollo منصة مبيعات مبنية حول قاعدة جهات اتصال كبيرة وتسلسلات واتصالات. أما يولـياس فيبدأ من وصف عميلك المثالي ويحوّله إلى قائمة مدروسة ورسائل توافق عليها. هذا هو الفرق بينهما.",
    },
    answer: {
      en: "Choose Apollo if you want one large contact database with sequences and a dialer, and you are comfortable building lists with filters. Choose Yolias if you sell services, want to describe your customer in plain English or Arabic, and want each company explained and emailed from your own mailbox after you approve.",
      ar: "اختر Apollo إذا أردت قاعدة جهات اتصال كبيرة مع التسلسلات والاتصال الهاتفي، وتبني القوائم بالفلاتر بسهولة. واختر يولـياس إذا كنت تبيع خدمات، وتريد وصف عميلك بالعربية أو الإنجليزية، وتريد شرحًا لكل شركة ورسائل تُرسل من بريدك بعد موافقتك.",
    },
    them: {
      find: { en: "Filters over its own database, plus AI agents that research and build lists (its website)", ar: "فلاتر على قاعدة بياناته، ووكلاء ذكاء اصطناعي يبحثون ويبنون القوائم (من موقعه)" },
      finds: { en: "People and companies from a database it says has 240M contacts and 30M companies", ar: "أشخاص وشركات من قاعدة يقول إن فيها 240 مليون جهة اتصال و30 مليون شركة" },
      why: notStated,
      contacts: { en: "Email addresses and phone numbers revealed with credits; waterfall enrichment", ar: "عناوين بريد وأرقام هاتف تُكشف بالرصيد، مع إثراء متعدد المصادر" },
      outreach: { en: "Email sequences, and agents that write outreach and follow up", ar: "تسلسلات بريد، ووكلاء يكتبون الرسائل ويتابعون" },
      replies: { en: "Meetings and pipeline features in the platform; 200+ integrations including CRMs (its claim)", ar: "ميزات للاجتماعات والصفقات، وأكثر من 200 تكامل منها أنظمة CRM (بحسب قوله)" },
      channels: { en: "Email and phone (parallel dialer)", ar: "البريد والهاتف (اتصال متوازٍ)" },
      users: { en: "Priced per user", ar: "السعر لكل مستخدم" },
    },
    chooseThem: {
      en: ["You need phone numbers and want to call from the same tool.", "Your team already works with filters and wants the biggest possible contact pool.", "You want deep CRM integrations today."],
      ar: ["تحتاج أرقام الهاتف وتريد الاتصال من نفس الأداة.", "فريقك يعمل بالفلاتر ويريد أكبر عدد ممكن من جهات الاتصال.", "تحتاج تكاملات CRM عميقة الآن."],
    },
    chooseYolias: {
      en: ["You sell services and find it easier to describe a good client than to set twenty filters.", "You work in Arabic, or sell into the Gulf and Egypt, and want the whole product in Arabic.", "You want each company explained (why it fits) before you write to it.", "You want a whole team on one plan: every plan has unlimited users."],
      ar: ["تبيع خدمات، ووصف العميل الجيد أسهل عليك من ضبط عشرين فلترًا.", "تعمل بالعربية، أو تبيع في الخليج ومصر، وتريد المنتج كله بالعربية.", "تريد شرح سبب تطابق كل شركة قبل أن تراسلها.", "تريد فريقك كله على خطة واحدة: كل الخطط بعدد غير محدود من المستخدمين."],
    },
    faq: {
      en: [
        { q: "Is Yolias cheaper than Apollo?", a: "It depends on how you use them. Apollo is priced per user with credits; Yolias has Pay As You Go credit or a monthly plan, with unlimited users and emails that are never charged. Compare both pricing pages with your team size and the number of prospects you need." },
        { q: "Does Yolias have a contact database like Apollo?", a: "No. Yolias doesn't sell access to a contact database. It searches the data sources connected to it and public information such as company websites for each request, and shows what it found with its source." },
        { q: "Can I move from Apollo to Yolias?", a: "You can bring a list as a CSV to find similar companies or to start outreach. There is no direct import from Apollo." },
      ],
      ar: [
        { q: "هل يولـياس أرخص من Apollo؟", a: "يعتمد على طريقة استخدامك. Apollo بسعر لكل مستخدم مع رصيد، ويولـياس بالدفع حسب الاستخدام أو خطة شهرية، بعدد غير محدود من المستخدمين والبريد لا يُحسب عليك. قارن صفحتي الأسعار بحجم فريقك وعدد العملاء المحتملين الذين تحتاجهم." },
        { q: "هل لدى يولـياس قاعدة جهات اتصال مثل Apollo؟", a: "لا. يولـياس لا يبيع الوصول إلى قاعدة جهات اتصال، بل يبحث في مصادر البيانات المتصلة به وفي المعلومات العامة مثل مواقع الشركات لكل طلب، ويعرض ما وجده بمصدره." },
        { q: "هل يمكنني الانتقال من Apollo إلى يولـياس؟", a: "يمكنك رفع قائمة كملف CSV لإيجاد شركات مشابهة أو لبدء التواصل. لا يوجد استيراد مباشر من Apollo." },
      ],
    },
    sources: ["https://www.apollo.io/", "https://www.apollo.io/pricing"],
  }),
  versus({
    slug: "clay", name: "Clay", keyword: "yolias vs clay", secondary: ["clay vs yolias", "clay.com comparison"],
    lead: {
      en: "Clay is a toolkit for building your own enrichment and outbound workflows from many data providers. Yolias does the research for you from a plain description and prepares the emails. The choice is mostly about how much you want to build.",
      ar: "Clay مجموعة أدوات لبناء مسارات الإثراء والتواصل بنفسك من مزودي بيانات كثيرين. أما يولـياس فيبحث عنك انطلاقًا من وصف بسيط ويجهّز الرسائل. الاختيار يعتمد غالبًا على مقدار ما تريد بناءه بنفسك.",
    },
    answer: {
      en: "Choose Clay if you have someone who enjoys building tables, columns and waterfalls across many data vendors. Choose Yolias if you want to describe your ideal customer and get matching companies, the reason each fits and emails ready for your approval, without building a workflow.",
      ar: "اختر Clay إذا كان لديك من يحب بناء الجداول والأعمدة والمسارات عبر مزودي بيانات كثيرين. واختر يولـياس إذا أردت أن تصف عميلك المثالي وتحصل على الشركات المطابقة وسبب تطابق كل منها ورسائل جاهزة لموافقتك، دون بناء مسار.",
    },
    them: {
      find: { en: "Tables and a visual canvas where you build the workflow; AI research agents (Claygent)", ar: "جداول ولوحة مرئية تبني فيها المسار، ووكلاء بحث بالذكاء الاصطناعي (Claygent)" },
      finds: { en: "What your workflow pulls from 200+ data and AI vendors (its claim)", ar: "ما يجلبه مسارك من أكثر من 200 مزود بيانات وذكاء اصطناعي (بحسب قوله)" },
      why: { en: "Scoring you set up, using intent and engagement signals", ar: "تقييم تضبطه بنفسك باستخدام إشارات النية والتفاعل" },
      contacts: { en: "Waterfall enrichment across providers; phone enrichment on paid plans", ar: "إثراء متتابع عبر المزودين، وإثراء أرقام الهاتف في الخطط المدفوعة" },
      outreach: { en: "Writes 1:1 messages programmatically; sends through Clay Sequencer or a connected tool", ar: "يكتب رسائل فردية برمجيًا، ويرسل عبر Clay Sequencer أو أداة متصلة" },
      replies: { en: "CRM sync and enrichment; replies live in your sending tool", ar: "مزامنة وإثراء CRM، والردود في أداة الإرسال" },
      channels: { en: "Email and ad audiences through integrations", ar: "البريد وجماهير الإعلانات عبر التكاملات" },
      users: { en: "Unlimited seats on every plan", ar: "عدد غير محدود من المستخدمين في كل الخطط" },
    },
    chooseThem: {
      en: ["You have a RevOps or growth person who will build and maintain workflows.", "You want to combine many paid data providers and control every step.", "You need CRM auto-sync and custom HTTP API steps."],
      ar: ["لديك شخص في العمليات أو النمو سيبني المسارات ويحافظ عليها.", "تريد الجمع بين مزودي بيانات مدفوعين كثيرين والتحكم في كل خطوة.", "تحتاج مزامنة CRM تلقائية وخطوات HTTP مخصصة."],
    },
    chooseYolias: {
      en: ["You want results this week without learning a workflow builder.", "You'd rather describe the customer in a sentence, in English or Arabic.", "You want finding, writing, sending from your mailbox and replies in one place."],
      ar: ["تريد نتائج هذا الأسبوع دون تعلم أداة لبناء المسارات.", "تفضل وصف العميل في جملة، بالعربية أو الإنجليزية.", "تريد البحث والكتابة والإرسال من بريدك والردود في مكان واحد."],
    },
    together: {
      en: "Teams that already enrich in Clay can export a list as CSV and bring it to Yolias to find similar companies or to run the outreach and replies from their own mailbox.",
      ar: "الفرق التي تُثري بياناتها في Clay يمكنها تصدير قائمة CSV ورفعها إلى يولـياس لإيجاد شركات مشابهة أو لإدارة التواصل والردود من بريدها.",
    },
    faq: {
      en: [
        { q: "Is Yolias a Clay alternative?", a: "For teams that want the research done for them, yes. For teams that want to build custom enrichment workflows across many providers, Clay does something Yolias doesn't try to do." },
        { q: "Does Yolias use waterfall enrichment?", a: "Yolias searches the data sources connected to it and company websites, keeps the source of every record and labels contact details by verification state. It doesn't let you build your own provider waterfall." },
        { q: "Which one is easier to start with?", a: "Yolias: you write who you are looking for and review the result. Clay is more flexible and takes longer to learn." },
      ],
      ar: [
        { q: "هل يولـياس بديل لـ Clay؟", a: "للفرق التي تريد أن يتم البحث عنها، نعم. أما للفرق التي تريد بناء مسارات إثراء مخصصة عبر مزودين كثيرين، فـ Clay يقدم شيئًا لا يحاول يولـياس تقديمه." },
        { q: "هل يستخدم يولـياس الإثراء المتتابع (waterfall)؟", a: "يبحث يولـياس في مصادر البيانات المتصلة به ومواقع الشركات، ويحتفظ بمصدر كل سجل، ويصنّف بيانات التواصل حسب التحقق. لكنه لا يتيح لك بناء تسلسل مزودين خاص بك." },
        { q: "أيهما أسهل للبدء؟", a: "يولـياس: تكتب من تبحث عنه وتراجع النتيجة. أما Clay فأكثر مرونة ويحتاج وقتًا أطول للتعلم." },
      ],
    },
    sources: ["https://www.clay.com/", "https://www.clay.com/pricing"],
  }),
  versus({
    slug: "zoominfo", name: "ZoomInfo", keyword: "yolias vs zoominfo", secondary: ["zoominfo vs yolias", "zoominfo comparison small business"],
    lead: {
      en: "ZoomInfo is an enterprise data and intelligence platform bought through its sales team. Yolias is a self-serve tool for businesses that sell services and want matching companies and approved outreach without an enterprise contract.",
      ar: "ZoomInfo منصة بيانات ومعلومات للمؤسسات تُشترى عبر فريق مبيعاتها. أما يولـياس فأداة ذاتية الخدمة للشركات التي تبيع خدمات وتريد شركات مطابقة وتواصلًا توافق عليه دون عقد مؤسسي.",
    },
    answer: {
      en: "Choose ZoomInfo if you are a larger sales and marketing organisation that needs broad contact data, intent signals and CRM integrations and buys through a sales process. Choose Yolias if you want to start today with a monthly plan or Pay As You Go, describe your customer in plain language and send from your own mailbox.",
      ar: "اختر ZoomInfo إذا كنت مؤسسة مبيعات وتسويق كبيرة تحتاج بيانات واسعة وإشارات نية وتكاملات CRM وتشتري عبر فريق مبيعات. واختر يولـياس إذا أردت البدء اليوم بخطة شهرية أو بالدفع حسب الاستخدام، وتصف عميلك بلغة طبيعية، وترسل من بريدك.",
    },
    them: {
      find: { en: "Search over its data, intent insights and AI agents in its GTM Workspace", ar: "البحث في بياناته، وإشارات النية، ووكلاء ذكاء اصطناعي في GTM Workspace" },
      finds: { en: "Contacts and companies from data it says covers 500M+ contacts and 100M+ companies", ar: "جهات اتصال وشركات من بيانات يقول إنها تغطي أكثر من 500 مليون جهة اتصال و100 مليون شركة" },
      why: { en: "Intent signals and AI account intelligence", ar: "إشارات النية ومعلومات الحسابات بالذكاء الاصطناعي" },
      contacts: { en: "Contact data with credits for exports", ar: "بيانات تواصل برصيد للتصدير" },
      outreach: notStated,
      replies: { en: "Native Salesforce, HubSpot and Dynamics 365 integrations and 120+ other tools (its claim)", ar: "تكامل مباشر مع Salesforce وHubSpot وDynamics 365 وأكثر من 120 أداة (بحسب قوله)" },
      channels: notStated,
      users: { en: "Priced by package, licences and credits; quoted by sales", ar: "السعر حسب الباقة والتراخيص والرصيد، بعرض من المبيعات" },
    },
    chooseThem: {
      en: ["You have a large team and a budget for an annual enterprise contract.", "You need intent data and many integrations across sales, marketing and RevOps.", "Data coverage in North America is your top priority."],
      ar: ["لديك فريق كبير وميزانية لعقد مؤسسي سنوي.", "تحتاج بيانات النية وتكاملات كثيرة للمبيعات والتسويق والعمليات.", "تغطية البيانات في أمريكا الشمالية أولويتك الأولى."],
    },
    chooseYolias: {
      en: ["You want to see prices and start without a sales call.", "You are a small team or an agency and want every teammate on one plan.", "You prefer describing your customer to setting up a data platform."],
      ar: ["تريد رؤية الأسعار والبدء دون مكالمة مبيعات.", "أنت فريق صغير أو وكالة وتريد كل زملائك على خطة واحدة.", "تفضل وصف عميلك على إعداد منصة بيانات."],
    },
    faq: {
      en: [
        { q: "How much does ZoomInfo cost compared with Yolias?", a: "ZoomInfo doesn't publish prices; its pricing page says they depend on the package, the number of licences and credits. Yolias publishes its prices on its pricing page." },
        { q: "Does Yolias have intent data?", a: "No. Yolias doesn't sell intent data. It finds companies that match the criteria you describe and explains the match." },
        { q: "Is Yolias good for enterprise teams?", a: "Yolias is built for businesses that sell services and for smaller sales teams. Large teams with complex data needs may be better served by an enterprise data platform." },
      ],
      ar: [
        { q: "كم يكلف ZoomInfo مقارنة بيولـياس؟", a: "ZoomInfo لا ينشر أسعاره؛ وتقول صفحة أسعاره إنها تعتمد على الباقة وعدد التراخيص والرصيد. أما يولـياس فينشر أسعاره في صفحة الأسعار." },
        { q: "هل لدى يولـياس بيانات نية الشراء؟", a: "لا. يولـياس لا يبيع بيانات النية، بل يجد الشركات التي تطابق المعايير التي تصفها ويشرح سبب التطابق." },
        { q: "هل يولـياس مناسب لفرق المؤسسات الكبيرة؟", a: "يولـياس مبني للشركات التي تبيع خدمات وفرق المبيعات الأصغر. والفرق الكبيرة ذات احتياجات البيانات المعقدة قد تناسبها منصة بيانات مؤسسية أكثر." },
      ],
    },
    sources: ["https://www.zoominfo.com/", "https://www.zoominfo.com/pricing"],
  }),
  versus({
    slug: "lusha", name: "Lusha", keyword: "yolias vs lusha", secondary: ["lusha vs yolias"],
    lead: {
      en: "Lusha gives you the email and phone number of a person you already found, in the browser or the CRM. Yolias helps you find which companies and people to approach in the first place, and prepares the emails.",
      ar: "Lusha يعطيك البريد ورقم الهاتف لشخص وجدته بالفعل، في المتصفح أو CRM. أما يولـياس فيساعدك أولًا في إيجاد الشركات والأشخاص الذين تتواصل معهم، ويجهّز الرسائل.",
    },
    answer: {
      en: "Choose Lusha if you already know who you want and need verified emails and phone numbers for them. Choose Yolias if your problem is finding the right companies for your services and writing to them from your own mailbox.",
      ar: "اختر Lusha إذا كنت تعرف من تريد وتحتاج بريده ورقم هاتفه موثقين. واختر يولـياس إذا كانت مشكلتك إيجاد الشركات المناسبة لخدماتك ومراسلتها من بريدك.",
    },
    them: {
      find: { en: "A browser extension, a workspace with filters and signals, an API and MCP", ar: "إضافة للمتصفح، ومساحة عمل بفلاتر وإشارات، وواجهة برمجة وMCP" },
      finds: { en: "People and companies from data it says has 515M+ verified contacts and 29M+ companies", ar: "أشخاص وشركات من بيانات يقول إن فيها أكثر من 515 مليون جهة اتصال موثقة و29 مليون شركة" },
      why: { en: "Predictive and signal scoring, lookalikes and buying committees matched to your ICP (its claim)", ar: "تقييم تنبؤي وبالإشارات، وشركات مشابهة، ولجان شراء مطابقة لعميلك المثالي (بحسب قوله)" },
      contacts: { en: "Verified emails (1 credit) and phone numbers (5 credits)", ar: "بريد موثق (رصيد واحد) وأرقام هاتف (خمسة أرصدة)" },
      outreach: notStated,
      replies: { en: "Salesforce, HubSpot and warehouse integrations, plus n8n, Make and Zapier", ar: "تكامل مع Salesforce وHubSpot ومستودعات البيانات، وn8n وMake وZapier" },
      channels: notStated,
      users: { en: "Per plan; a Scale plan for teams of 5+", ar: "حسب الخطة، وخطة Scale للفرق من خمسة أشخاص فأكثر" },
    },
    chooseThem: {
      en: ["You call prospects and need direct phone numbers.", "You prospect on LinkedIn or company sites and want contact details in one click.", "You need certified compliance (SOC 2, ISO) for contact data."],
      ar: ["تتصل بالعملاء وتحتاج أرقامًا مباشرة.", "تبحث على LinkedIn أو مواقع الشركات وتريد بيانات التواصل بنقرة.", "تحتاج امتثالًا موثقًا (SOC 2 وISO) لبيانات التواصل."],
    },
    chooseYolias: {
      en: ["You don't have a list yet and need to find who to approach.", "You sell services and want each company explained against your offer.", "You want the emails written and sent from your mailbox, with replies sorted."],
      ar: ["ليست لديك قائمة بعد وتحتاج إيجاد من تتواصل معه.", "تبيع خدمات وتريد شرح كل شركة مقابل عرضك.", "تريد كتابة الرسائل وإرسالها من بريدك مع تصنيف الردود."],
    },
    faq: {
      en: [
        { q: "Does Yolias give phone numbers like Lusha?", a: "Yolias shows the business phone numbers and emails that companies publish, labelled by verification state. It doesn't promise a direct phone number for each person." },
        { q: "Can I use Lusha and Yolias together?", a: "Yes. Find and qualify companies in Yolias, export them as CSV, and look up direct contacts in a contact data tool if you need phone numbers." },
      ],
      ar: [
        { q: "هل يعطي يولـياس أرقام هاتف مثل Lusha؟", a: "يعرض يولـياس أرقام الهاتف والبريد التي تنشرها الشركات، مصنّفة حسب التحقق، ولا يعد برقم مباشر لكل شخص." },
        { q: "هل يمكنني استخدام Lusha ويولـياس معًا؟", a: "نعم. ابحث عن الشركات وقيّمها في يولـياس، وصدّرها كملف CSV، ثم ابحث عن جهات الاتصال المباشرة في أداة بيانات تواصل إن احتجت أرقام الهاتف." },
      ],
    },
    sources: ["https://www.lusha.com/", "https://www.lusha.com/pricing/"],
  }),
  versus({
    slug: "cognism", name: "Cognism", keyword: "yolias vs cognism", secondary: ["cognism vs yolias"],
    lead: {
      en: "Cognism is a contact data provider known for phone-verified mobile numbers in Europe. Yolias finds companies that fit a service you sell, explains the fit and handles the email outreach from your own mailbox.",
      ar: "Cognism مزود بيانات تواصل معروف بأرقام الجوال المتحقق منها هاتفيًا في أوروبا. أما يولـياس فيجد الشركات المناسبة لخدمة تبيعها، ويشرح سبب التطابق، ويدير التواصل بالبريد من بريدك.",
    },
    answer: {
      en: "Choose Cognism if your team calls decision makers, especially in Europe, and needs verified mobiles and compliance features. Choose Yolias if you want to find the right companies from a plain description and reach them by email after your approval.",
      ar: "اختر Cognism إذا كان فريقك يتصل بصنّاع القرار، خاصة في أوروبا، ويحتاج أرقام جوال موثقة وميزات امتثال. واختر يولـياس إذا أردت إيجاد الشركات المناسبة من وصف بسيط ومراسلتها بالبريد بعد موافقتك.",
    },
    them: {
      find: { en: "Search with firmographic and technographic filters; MCP and API access", ar: "بحث بفلاتر بيانات الشركات والتقنيات، ووصول عبر MCP وواجهة برمجة" },
      finds: { en: "Decision makers, with data it says is refreshed every 30 days", ar: "صنّاع قرار، ببيانات يقول إنها تتجدد كل 30 يومًا" },
      why: { en: "Intent (Bombora), hiring, job change and funding signals", ar: "إشارات النية (Bombora) والتوظيف وتغيير الوظيفة والتمويل" },
      contacts: { en: "Phone-verified mobile numbers and emails; one credit per revealed contact", ar: "أرقام جوال متحقق منها هاتفيًا وبريد، ورصيد واحد لكل جهة اتصال" },
      outreach: notStated,
      replies: { en: "Exports to Salesforce, HubSpot, Pipedrive and more", ar: "تصدير إلى Salesforce وHubSpot وPipedrive وغيرها" },
      channels: notStated,
      users: { en: "Plans include 5 seats; prices by quote", ar: "الخطط تشمل خمسة مستخدمين، والسعر بعرض" },
    },
    chooseThem: {
      en: ["Your team sells by phone and needs verified mobiles.", "Europe is your main market and Do-Not-Call coverage matters.", "You want intent data from the same provider."],
      ar: ["فريقك يبيع بالهاتف ويحتاج أرقام جوال موثقة.", "أوروبا سوقك الأساسي ويهمك الالتزام بقوائم عدم الاتصال.", "تريد بيانات النية من نفس المزود."],
    },
    chooseYolias: {
      en: ["You sell services by email and want to start without a quote.", "Your market is the Gulf, Egypt or wherever companies publish their own contacts.", "You want the research, the emails and the replies in one product."],
      ar: ["تبيع خدمات بالبريد وتريد البدء دون عرض سعر.", "سوقك الخليج أو مصر أو أي مكان تنشر فيه الشركات بيانات تواصلها.", "تريد البحث والرسائل والردود في منتج واحد."],
    },
    faq: {
      en: [
        { q: "Does Yolias have phone-verified mobile numbers?", a: "No. Yolias shows the business contact details companies publish and labels them by verification state." },
        { q: "Is Cognism priced per seat?", a: "Its pricing page lists Standard and Pro plans with 5 seats included and asks you to contact sales for a price." },
      ],
      ar: [
        { q: "هل لدى يولـياس أرقام جوال متحقق منها هاتفيًا؟", a: "لا. يعرض يولـياس بيانات التواصل التي تنشرها الشركات ويصنّفها حسب حالة التحقق." },
        { q: "هل يُسعّر Cognism لكل مستخدم؟", a: "صفحة أسعاره تعرض خطتي Standard وPro بخمسة مستخدمين، وتطلب التواصل مع المبيعات لمعرفة السعر." },
      ],
    },
    sources: ["https://www.cognism.com/", "https://www.cognism.com/pricing"],
  }),
  versus({
    slug: "instantly", name: "Instantly", keyword: "yolias vs instantly", secondary: ["instantly vs yolias", "instantly.ai comparison"],
    lead: {
      en: "Instantly is built to send cold email at volume across many mailboxes, with warmup and deliverability tools. Yolias is built to find the right companies for your services and send fewer, researched emails from your own mailbox.",
      ar: "Instantly مبني لإرسال البريد البارد بكميات كبيرة عبر صناديق بريد كثيرة، مع التدفئة وأدوات وصول الرسائل. أما يولـياس فمبني لإيجاد الشركات المناسبة لخدماتك وإرسال رسائل أقل ومدروسة من بريدك.",
    },
    answer: {
      en: "Choose Instantly if you run high-volume campaigns across many mailboxes and need warmup and deliverability tooling. Choose Yolias if you want help deciding who to write to, with each company explained, and a personal email from your own Gmail or Outlook after you approve it.",
      ar: "اختر Instantly إذا كنت تدير حملات بكميات كبيرة عبر صناديق بريد كثيرة وتحتاج أدوات التدفئة ووصول الرسائل. واختر يولـياس إذا أردت مساعدة في تحديد من تراسل، مع شرح لكل شركة، ورسالة شخصية من Gmail أو Outlook الخاص بك بعد موافقتك.",
    },
    them: {
      find: { en: "A B2B lead database with filters, on separate credit plans", ar: "قاعدة عملاء B2B بفلاتر، بخطط رصيد منفصلة" },
      finds: { en: "Leads from its database", ar: "عملاء من قاعدة بياناته" },
      why: notStated,
      contacts: { en: "Email enrichment on its lead plans", ar: "إثراء البريد في خطط العملاء" },
      outreach: { en: "Campaigns across unlimited email accounts with warmup; AI writes and personalises", ar: "حملات عبر حسابات بريد غير محدودة مع التدفئة، والذكاء الاصطناعي يكتب ويخصص" },
      replies: { en: "Unibox replies, an AI reply agent and an AI-powered CRM", ar: "صندوق ردود موحد، ووكيل رد بالذكاء الاصطناعي، وCRM" },
      channels: { en: "Email", ar: "البريد" },
      users: notStated,
    },
    chooseThem: {
      en: ["You send thousands of cold emails a month across many domains.", "Warmup and inbox placement are your main problems.", "You are an agency running outbound for many clients."],
      ar: ["ترسل آلاف الرسائل الباردة شهريًا عبر نطاقات كثيرة.", "التدفئة ووصول الرسائل إلى الوارد مشكلتك الأساسية.", "أنت وكالة تدير التواصل لعملاء كثيرين."],
    },
    chooseYolias: {
      en: ["You'd rather send fewer, better emails from your real mailbox.", "Your problem is finding who to write to, not sending more.", "You want the emails written from your Company Knowledge and approved by you first."],
      ar: ["تفضل إرسال رسائل أقل وأفضل من بريدك الحقيقي.", "مشكلتك إيجاد من تراسل، لا إرسال المزيد.", "تريد رسائل مكتوبة من معرفة شركتك وتوافق عليها أولًا."],
    },
    faq: {
      en: [
        { q: "Does Yolias warm up email accounts?", a: "No. Yolias sends from the mailbox you connect, within a daily limit, a random gap between emails and the sending days and hours you set for each mailbox." },
        { q: "Can I send high volumes with Yolias?", a: "Yolias is built for researched outreach from your own mailbox, not for volume sending across many domains." },
      ],
      ar: [
        { q: "هل يقوم يولـياس بتدفئة حسابات البريد؟", a: "لا. يرسل يولـياس من صندوق البريد الذي تربطه، ضمن حد يومي وفاصل عشوائي بين الرسائل وأيام وساعات الإرسال التي تحددها لكل صندوق." },
        { q: "هل يمكنني الإرسال بكميات كبيرة مع يولـياس؟", a: "يولـياس مبني لتواصل مدروس من بريدك، وليس للإرسال بكميات كبيرة عبر نطاقات كثيرة." },
      ],
    },
    sources: ["https://instantly.ai/", "https://instantly.ai/pricing"],
  }),
  versus({
    slug: "smartlead", name: "Smartlead", keyword: "yolias vs smartlead", secondary: ["smartlead vs yolias"],
    lead: {
      en: "Smartlead is a cold email sending platform with unlimited mailboxes, warmup and white label for agencies. Yolias finds the companies first and sends researched emails from one or a few mailboxes you connect.",
      ar: "Smartlead منصة لإرسال البريد البارد بصناديق بريد غير محدودة وتدفئة وعلامة بيضاء للوكالات. أما يولـياس فيجد الشركات أولًا ويرسل رسائل مدروسة من صندوق بريد أو أكثر تربطه.",
    },
    answer: {
      en: "Choose Smartlead if you are a lead generation agency sending for many clients and need unlimited mailboxes, sender rotation, an API and white label. Choose Yolias if you need the list itself: companies that fit your service, explained, with emails ready for your approval.",
      ar: "اختر Smartlead إذا كنت وكالة جذب عملاء ترسل لعملاء كثيرين وتحتاج صناديق بريد غير محدودة وتدوير المرسلين وواجهة برمجة وعلامة بيضاء. واختر يولـياس إذا كنت تحتاج القائمة نفسها: شركات تناسب خدمتك، مشروحة، مع رسائل جاهزة لموافقتك.",
    },
    them: {
      find: { en: "You bring your leads; email verification is included in each plan", ar: "تجلب عملاءك بنفسك، والتحقق من البريد ضمن كل خطة" },
      finds: notStated,
      why: notStated,
      contacts: { en: "Verified emails per month by plan", ar: "عدد رسائل متحقق منها شهريًا حسب الخطة" },
      outreach: { en: "Campaigns across unlimited mailboxes with warmup and sender rotation", ar: "حملات عبر صناديق غير محدودة مع التدفئة وتدوير المرسلين" },
      replies: { en: "A unified inbox (unibox) and CRM access", ar: "صندوق وارد موحد (unibox) ووصول إلى CRM" },
      channels: { en: "Email", ar: "البريد" },
      users: notStated,
    },
    chooseThem: {
      en: ["You already have lists and need to send at scale.", "You run outreach for clients and want white label and an API.", "You manage dozens of mailboxes."],
      ar: ["لديك قوائم بالفعل وتحتاج الإرسال على نطاق واسع.", "تدير التواصل لعملاء وتريد علامة بيضاء وواجهة برمجة.", "تدير عشرات صناديق البريد."],
    },
    chooseYolias: {
      en: ["You don't have the list yet.", "You want each company checked against your offer before you write.", "You want writing, sending from your mailbox and replies in one place."],
      ar: ["ليست لديك القائمة بعد.", "تريد فحص كل شركة مقابل عرضك قبل أن تكتب.", "تريد الكتابة والإرسال من بريدك والردود في مكان واحد."],
    },
    together: {
      en: "Agencies can find and qualify companies in Yolias, export them as CSV and send at volume from a sending platform.",
      ar: "يمكن للوكالات إيجاد الشركات وتقييمها في يولـياس، وتصديرها كملف CSV، ثم الإرسال بكميات كبيرة من منصة إرسال.",
    },
    faq: {
      en: [
        { q: "Does Yolias offer white label for agencies?", a: "No. Yolias works in your own workspace, with unlimited users on every plan." },
        { q: "Does Yolias rotate senders across mailboxes?", a: "Yolias sends from the mailboxes you connect, each with its own daily limit, gap between emails and sending hours. It doesn't provide mailboxes or warmup." },
      ],
      ar: [
        { q: "هل يقدم يولـياس علامة بيضاء للوكالات؟", a: "لا. يعمل يولـياس داخل مساحة عملك، بعدد غير محدود من المستخدمين في كل الخطط." },
        { q: "هل يدوّر يولـياس المرسلين بين صناديق البريد؟", a: "يرسل يولـياس من صناديق البريد التي تربطها، لكل منها حد يومي وفاصل بين الرسائل وساعات إرسال. ولا يوفر صناديق بريد أو تدفئة." },
      ],
    },
    sources: ["https://www.smartlead.ai/", "https://www.smartlead.ai/pricing"],
  }),
  versus({
    slug: "hunter", name: "Hunter", keyword: "yolias vs hunter", secondary: ["hunter.io vs yolias", "hunter io comparison"],
    lead: {
      en: "Hunter is best known for finding and verifying email addresses at a company. Yolias starts one step earlier: it finds which companies fit the service you sell, explains why, and writes the first email.",
      ar: "Hunter معروف أكثر بإيجاد عناوين البريد في شركة والتحقق منها. أما يولـياس فيبدأ قبلها بخطوة: يجد الشركات التي تناسب الخدمة التي تبيعها، ويشرح السبب، ويكتب الرسالة الأولى.",
    },
    answer: {
      en: "Choose Hunter if you know the companies and need verified email addresses for people there. Choose Yolias if you need to find the companies that fit your offer and want the outreach prepared and sent from your mailbox after you approve.",
      ar: "اختر Hunter إذا كنت تعرف الشركات وتحتاج عناوين بريد موثقة لأشخاص فيها. واختر يولـياس إذا كنت تحتاج إيجاد الشركات المناسبة لعرضك وتريد تجهيز التواصل وإرساله من بريدك بعد موافقتك.",
    },
    them: {
      find: { en: "Domain search, email finder and Discover filters for B2B leads", ar: "البحث بالنطاق، والعثور على البريد، وفلاتر Discover لعملاء B2B" },
      finds: { en: "Email addresses at a company or for a person; leads in Discover", ar: "عناوين بريد في شركة أو لشخص، وعملاء في Discover" },
      why: notStated,
      contacts: { en: "Email addresses with verification", ar: "عناوين بريد مع التحقق" },
      outreach: { en: "Cold email sequences from connected email accounts (number by plan)", ar: "تسلسلات بريد بارد من حسابات بريد متصلة (عددها حسب الخطة)" },
      replies: notStated,
      channels: { en: "Email", ar: "البريد" },
      users: notStated,
    },
    chooseThem: {
      en: ["You have a list of target companies and need email addresses.", "You need to verify a list you already have.", "You want a simple API for email finding."],
      ar: ["لديك قائمة شركات مستهدفة وتحتاج عناوين البريد.", "تحتاج التحقق من قائمة لديك.", "تريد واجهة برمجة بسيطة لإيجاد البريد."],
    },
    chooseYolias: {
      en: ["You don't know yet which companies to target.", "You want each company explained against your offer.", "You want replies sorted and leads tracked in a pipeline."],
      ar: ["لا تعرف بعد أي الشركات تستهدف.", "تريد شرح كل شركة مقابل عرضك.", "تريد تصنيف الردود ومتابعة العملاء في إدارة العملاء."],
    },
    faq: {
      en: [
        { q: "Does Yolias verify emails like Hunter?", a: "Yolias labels contact details by verification state and can verify emails when a verification provider is connected to it. It doesn't promise a verified personal email for every person." },
        { q: "Is there a free plan?", a: "Hunter has a free plan with 50 credits a month (its pricing page). Yolias has Pay As You Go credit from $5 and monthly plans; see its pricing page." },
      ],
      ar: [
        { q: "هل يتحقق يولـياس من البريد مثل Hunter؟", a: "يصنّف يولـياس بيانات التواصل حسب حالة التحقق، ويمكنه التحقق من البريد عند ربط مزود تحقق به. ولا يعد ببريد شخصي موثق لكل شخص." },
        { q: "هل توجد خطة مجانية؟", a: "لدى Hunter خطة مجانية بخمسين رصيدًا شهريًا (من صفحة أسعاره). أما يولـياس فلديه الدفع حسب الاستخدام من 5 دولارات وخطط شهرية؛ راجع صفحة الأسعار." },
      ],
    },
    sources: ["https://hunter.io/", "https://hunter.io/pricing"],
  }),
];
