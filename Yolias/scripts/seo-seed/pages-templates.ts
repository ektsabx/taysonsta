import { type SeedPage, type Side } from "./types.ts";

// Prospecting templates (D-257): a method someone can use with or without
// Yolias, then a request that opens in Yolias AI ("Open this template", via
// /start). Market pages add what is specific to that market (business week,
// where companies are registered, language); they never claim how many
// companies Yolias has there.

const links = [
  { path: "/templates", en: "All templates", ar: "كل القوالب" },
  { path: "/use-cases/icp-company-search", en: "Companies that match your ICP", ar: "شركات تطابق عميلك المثالي" },
  { path: "/use-cases/find-decision-makers", en: "Find decision makers", ar: "إيجاد صنّاع القرار" },
];
const cta = {
  en: { title: "Open the template and make it yours.", body: "The request opens in Yolias AI. Change it to fit your offer and market, review the criteria, then run the search.", label: "Open this template in Yolias" },
  ar: { title: "افتح القالب واجعله مناسبًا لك.", body: "يفتح الطلب في Yolias AI. عدّله ليناسب عرضك وسوقك، وراجع المعايير، ثم شغّل البحث.", label: "افتح القالب في يولـياس" },
};
const tpl = (slug: string, keyword: string, secondary: string[], en: Omit<Side, "cta">, ar: Omit<Side, "cta">, extra: { path: string; en: string; ar: string }[] = []): SeedPage => ({
  kind: "template", slug, primary_keyword: keyword, secondary_keywords: secondary, links: [...extra, ...links], sources: [],
  en: { ...en, cta: cta.en }, ar: { ...ar, cta: cta.ar },
});

export const templatePages: SeedPage[] = [
  tpl("companies-by-industry", "find companies by industry", ["list of companies by industry", "how to find companies in a specific industry", "industry company list"], {
    title: "Find companies by industry", h1: "How to find companies in a specific industry",
    metaTitle: "Find companies by industry: a prospecting template",
    metaDescription: "A step-by-step template to build a list of companies in one industry: define it precisely, add size and area, check each company, then reach the right person.",
    lead: "\"Companies in healthcare\" is too broad to sell to. This template narrows an industry into a list you can actually contact.",
    answer: "Name the industry the way companies describe themselves (\"dental clinics\", not \"healthcare\"), add a location and a size range, then check each company's own website for what it does. Yolias does this from one sentence and shows which criteria each company met.",
    audience: ["Agencies and consultants who specialise in one industry", "Sales teams entering a new vertical"],
    criteria: ["The industry in the words companies use on their own sites", "Sub-segments to include and exclude", "Location and size", "One sign that they need what you sell"],
    steps: [
      { title: "Name the niche", body: "Write the industry as narrowly as your case studies are: \"specialty coffee roasters\" rather than \"food\"." },
      { title: "Add limits", body: "City or country, employee range, and anything to exclude (chains, franchises, government)." },
      { title: "Add one need signal", body: "What tells you they need you now: new branches, no online ordering, hiring for a role you replace." },
      { title: "Check the first ten", body: "Open the first results yourself. If they're wrong, change the wording, not the whole search." },
    ],
    prompt: "Find specialty coffee roasters and cafe chains in Riyadh and Dubai with 10 to 100 employees that sell online or wholesale. I sell packaging design. Show me why each one matches.",
    blocks: [
      { h2: "Industry names that work better" },
      { table: { head: ["Too broad", "Searchable"], rows: [["Healthcare", "Dental clinics, physiotherapy centres, medical labs"], ["Retail", "Furniture stores, optical shops, pet stores"], ["Technology", "Software houses, IT support companies, cybersecurity firms"], ["Hospitality", "Boutique hotels, restaurant groups, event venues"]] } },
    ],
    faq: [
      { q: "Where can I get a list of companies by industry?", a: "Business directories, chambers of commerce, company registers and the companies' own websites. Directories usually forbid copying their lists; registers and company sites are better starting points. Yolias searches the data sources connected to it and public company information." },
      { q: "How specific should the industry be?", a: "As specific as your best case study. If you can't name a past client in that niche, the niche is probably too broad." },
    ],
  }, {
    title: "البحث عن الشركات حسب القطاع", h1: "كيف تجد شركات في قطاع محدد",
    metaTitle: "البحث عن الشركات حسب القطاع: قالب عملي",
    metaDescription: "قالب خطوة بخطوة لبناء قائمة شركات في قطاع واحد: حدده بدقة، وأضف الحجم والمنطقة، وافحص كل شركة، ثم تواصل مع الشخص المناسب.",
    lead: "«شركات في القطاع الصحي» واسعة جدًا للبيع. هذا القالب يضيّق القطاع إلى قائمة تستطيع التواصل معها فعلًا.",
    answer: "سمِّ القطاع كما تصف الشركات نفسها («عيادات أسنان» لا «الرعاية الصحية»)، وأضف موقعًا ونطاق حجم، ثم راجع موقع كل شركة لترى ما تفعله. يفعل يولـياس ذلك من جملة واحدة ويوضح المعايير التي حققتها كل شركة.",
    audience: ["الوكالات والاستشاريون المتخصصون في قطاع واحد", "فرق المبيعات التي تدخل قطاعًا جديدًا"],
    criteria: ["القطاع بالكلمات التي تستخدمها الشركات في مواقعها", "الفئات الفرعية المشمولة والمستبعدة", "الموقع والحجم", "إشارة واحدة على حاجتهم لما تبيعه"],
    steps: [
      { title: "سمِّ التخصص", body: "اكتب القطاع بنفس دقة أعمالك السابقة: «محامص قهوة مختصة» لا «أغذية»." },
      { title: "أضف الحدود", body: "المدينة أو الدولة، ونطاق عدد الموظفين، وما تستبعده (السلاسل، والامتيازات، والجهات الحكومية)." },
      { title: "أضف إشارة حاجة", body: "ما يخبرك أنهم يحتاجونك الآن: فروع جديدة، أو لا طلب إلكتروني، أو توظيف لدور تقوم به أنت." },
      { title: "افحص أول عشر نتائج", body: "افتح النتائج الأولى بنفسك. إن كانت خاطئة فغيّر الصياغة لا البحث كله." },
    ],
    prompt: "اعثر على محامص قهوة مختصة وسلاسل مقاهٍ في الرياض ودبي من 10 إلى 100 موظف تبيع أونلاين أو بالجملة. أبيع تصميم التغليف. وضّح لي سبب تطابق كل واحدة.",
    blocks: [
      { h2: "أسماء قطاعات تعمل أفضل" },
      { table: { head: ["واسع جدًا", "قابل للبحث"], rows: [["الرعاية الصحية", "عيادات أسنان، مراكز علاج طبيعي، معامل تحاليل"], ["التجزئة", "معارض أثاث، محلات بصريات، متاجر حيوانات أليفة"], ["التقنية", "شركات برمجيات، شركات دعم فني، شركات أمن سيبراني"], ["الضيافة", "فنادق بوتيك، مجموعات مطاعم، قاعات مناسبات"]] } },
    ],
    faq: [
      { q: "أين أجد قائمة شركات حسب القطاع؟", a: "أدلة الأعمال، والغرف التجارية، وسجلات الشركات، ومواقع الشركات نفسها. الأدلة تمنع غالبًا نسخ قوائمها؛ والسجلات ومواقع الشركات نقطة بداية أفضل. ويبحث يولـياس في مصادر البيانات المتصلة به وفي معلومات الشركات العامة." },
      { q: "إلى أي مدى أحدد القطاع؟", a: "بقدر أفضل عمل سابق لديك. إذا لم تستطع تسمية عميل سابق في هذا التخصص، فالتخصص غالبًا واسع جدًا." },
    ],
  }),
  tpl("companies-by-location", "find companies by location", ["find businesses in a city", "list of companies in my area", "local companies list"], {
    title: "Find companies by location", h1: "How to find companies in a city or area",
    metaTitle: "Find companies by location: a city prospecting template",
    metaDescription: "Build a list of companies or local businesses in one city or district: choose the area, the type of business and a signal of need, then check and contact them.",
    lead: "Location matters when you meet clients in person, serve one city, or sell to local businesses. This template builds a list for one area at a time.",
    answer: "Pick one city or district, one type of business and one sign of need, then search businesses on the map and companies with an address there. Yolias searches local businesses by category and area as well as companies, and shows the contact details each one publishes.",
    audience: ["Agencies that serve one city", "Service businesses that visit clients", "Anyone selling to local businesses"],
    criteria: ["A city or district, not a whole country", "The type of business as people search it", "Whether you want local businesses (shops, clinics) or companies with offices", "A sign of need"],
    steps: [
      { title: "Pick the area", body: "Start with one district you know. Expand only once the first list works." },
      { title: "Pick the business type", body: "Local businesses are found by category; offices by industry." },
      { title: "Add a reason", body: "New opening, no website, many branches, or a service you know they lack." },
      { title: "Visit or write", body: "Short local emails that mention the area get read; offer to drop by if that's how you work." },
    ],
    prompt: "Find gyms and fitness studios in New Cairo and Sheikh Zayed that have a website or Instagram page. I offer social media management for gyms.",
    blocks: [
      { h2: "Local businesses or companies?" },
      { p: "Shops, clinics, restaurants and gyms are local businesses: they are found by category on the map. Agencies, factories and offices are companies: they are found by industry and address. Say which one you want; Yolias can search both." },
    ],
    faq: [
      { q: "How do I find all businesses in my area?", a: "Map data and business directories list them by category. Pick one category at a time; a list of every business in an area is too broad to contact well." },
      { q: "Does Yolias use Google Maps?", a: "Yolias searches the data sources connected to it, including open map data, and companies' own websites. Coverage differs by city." },
    ],
  }, {
    title: "البحث عن الشركات حسب الموقع", h1: "كيف تجد شركات في مدينة أو منطقة",
    metaTitle: "البحث عن الشركات حسب الموقع: قالب للمدن",
    metaDescription: "ابنِ قائمة شركات أو أنشطة محلية في مدينة أو حي واحد: اختر المنطقة ونوع النشاط وإشارة حاجة، ثم راجعها وتواصل معها.",
    lead: "الموقع مهم عندما تقابل العملاء شخصيًا، أو تخدم مدينة واحدة، أو تبيع لأنشطة محلية. هذا القالب يبني قائمة لمنطقة واحدة في كل مرة.",
    answer: "اختر مدينة أو حيًا واحدًا، ونوع نشاط واحدًا، وإشارة حاجة واحدة، ثم ابحث عن الأنشطة على الخريطة والشركات التي لها عنوان هناك. يبحث يولـياس عن الأنشطة المحلية حسب النوع والمنطقة وعن الشركات أيضًا، ويعرض بيانات التواصل التي تنشرها كل منها.",
    audience: ["الوكالات التي تخدم مدينة واحدة", "الأنشطة الخدمية التي تزور عملاءها", "كل من يبيع للأنشطة المحلية"],
    criteria: ["مدينة أو حي، لا دولة كاملة", "نوع النشاط كما يبحث عنه الناس", "هل تريد أنشطة محلية (محلات وعيادات) أم شركات بمكاتب", "إشارة حاجة"],
    steps: [
      { title: "اختر المنطقة", body: "ابدأ بحي تعرفه، ووسّع فقط بعد أن تنجح القائمة الأولى." },
      { title: "اختر نوع النشاط", body: "الأنشطة المحلية تُبحث بالفئة، والمكاتب بالقطاع." },
      { title: "أضف سببًا", body: "افتتاح جديد، أو لا موقع، أو فروع كثيرة، أو خدمة تعرف أنها تنقصهم." },
      { title: "زُر أو اكتب", body: "الرسائل المحلية القصيرة التي تذكر المنطقة تُقرأ؛ واعرض الزيارة إن كانت هذه طريقتك." },
    ],
    prompt: "اعثر على صالات رياضية واستوديوهات لياقة في التجمع الخامس والشيخ زايد لها موقع أو صفحة إنستغرام. أقدم إدارة السوشيال ميديا للصالات الرياضية.",
    blocks: [
      { h2: "أنشطة محلية أم شركات؟" },
      { p: "المحلات والعيادات والمطاعم والصالات أنشطة محلية تُبحث بالفئة على الخريطة. أما الوكالات والمصانع والمكاتب فشركات تُبحث بالقطاع والعنوان. حدد ما تريد، ويستطيع يولـياس البحث عن الاثنين." },
    ],
    faq: [
      { q: "كيف أجد كل الأنشطة في منطقتي؟", a: "بيانات الخرائط وأدلة الأعمال تعرضها حسب الفئة. اختر فئة واحدة في كل مرة؛ قائمة بكل الأنشطة في منطقة أوسع من أن تتواصل معها جيدًا." },
      { q: "هل يستخدم يولـياس خرائط Google؟", a: "يبحث يولـياس في مصادر البيانات المتصلة به، ومنها بيانات خرائط مفتوحة، وفي مواقع الشركات نفسها. والتغطية تختلف من مدينة لأخرى." },
    ],
  }, [{ path: "/use-cases/local-business-leads", en: "Local business leads", ar: "عملاء من الأنشطة المحلية" }]),
  tpl("companies-by-size", "find companies by size", ["find companies by number of employees", "find small businesses", "find mid-size companies"], {
    title: "Find companies by size", h1: "How to find companies of the right size for your offer",
    metaTitle: "Find companies by size: match your offer to company size",
    metaDescription: "A template to choose the company size your offer fits, by employees or branches, and find companies in that range, with the role that decides at each size.",
    lead: "The same service sells differently to a 10-person company and a 500-person one. This template picks the size that fits your price and finds companies in it.",
    answer: "Work backwards from your price: who can pay it every month and still needs outside help? Express that as an employee range or number of branches, add industry and area, and remember the decision maker changes with size. Yolias takes the range in your description and matches it where the data sources publish company size.",
    audience: ["Agencies with a clear minimum budget", "B2B services priced per seat or per site"],
    criteria: ["An employee range or number of branches", "Who decides at that size", "Industry and area"],
    steps: [
      { title: "Set the range from your price", body: "If your retainer is high, very small companies can't pay; very large ones have teams in-house." },
      { title: "Use a proxy when headcount is unknown", body: "Branches, locations, or listed job openings often say more about size than a headcount field." },
      { title: "Name the role for that size", body: "Owner or general manager under 50 people; department heads above." },
    ],
    prompt: "Find private schools and training centres in Saudi Arabia with 50 to 300 employees or at least two branches. I sell a learning management system. Find the general manager or academic director.",
    blocks: [
      { h2: "Who decides, by size" },
      { table: { head: ["Size", "Usually decides"], rows: [["1 to 20", "The owner"], ["20 to 100", "General manager, sometimes operations"], ["100 to 500", "The head of the department that uses the service"], ["500+", "A department head with procurement involved"]] } },
      { note: "Company size isn't published for every company. When it is missing, Yolias says so instead of guessing." },
    ],
    faq: [
      { q: "How do I find small businesses to sell to?", a: "Search by type and area (local businesses), not by headcount: small businesses rarely publish employee numbers." },
      { q: "Is employee count reliable?", a: "It varies by source and is often a range. Use it as a filter, then check the company's site." },
    ],
  }, {
    title: "البحث عن الشركات حسب الحجم", h1: "كيف تجد شركات بالحجم المناسب لعرضك",
    metaTitle: "البحث عن الشركات حسب الحجم: طابق عرضك مع حجم الشركة",
    metaDescription: "قالب لاختيار حجم الشركة الذي يناسب عرضك، بعدد الموظفين أو الفروع، وإيجاد شركات ضمنه، مع صاحب القرار في كل حجم.",
    lead: "نفس الخدمة تُباع بشكل مختلف لشركة من 10 أشخاص وأخرى من 500. هذا القالب يختار الحجم المناسب لسعرك ويجد شركات ضمنه.",
    answer: "ابدأ من سعرك: من يستطيع دفعه شهريًا ويحتاج مساعدة خارجية؟ عبّر عن ذلك بنطاق موظفين أو عدد فروع، وأضف القطاع والمنطقة، وتذكّر أن صاحب القرار يتغير مع الحجم. يأخذ يولـياس النطاق من وصفك ويطابقه حيث تنشر مصادر البيانات حجم الشركة.",
    audience: ["الوكالات التي لديها حد أدنى واضح للميزانية", "خدمات B2B المسعّرة لكل مستخدم أو لكل فرع"],
    criteria: ["نطاق موظفين أو عدد فروع", "من يقرر عند هذا الحجم", "القطاع والمنطقة"],
    steps: [
      { title: "حدد النطاق من سعرك", body: "إن كان اشتراكك مرتفعًا فالشركات الصغيرة جدًا لا تستطيع الدفع، والكبيرة جدًا لديها فرق داخلية." },
      { title: "استخدم بديلًا عندما لا يُعرف عدد الموظفين", body: "الفروع أو المواقع أو الوظائف المعلنة تقول غالبًا عن الحجم أكثر من رقم الموظفين." },
      { title: "سمِّ المنصب لهذا الحجم", body: "المالك أو المدير العام تحت 50 شخصًا، ورؤساء الأقسام فوق ذلك." },
    ],
    prompt: "اعثر على مدارس خاصة ومراكز تدريب في السعودية من 50 إلى 300 موظف أو لها فرعان على الأقل. أبيع نظام إدارة تعلّم. اعثر على المدير العام أو المدير الأكاديمي.",
    blocks: [
      { h2: "من يقرر حسب الحجم" },
      { table: { head: ["الحجم", "يقرر غالبًا"], rows: [["من 1 إلى 20", "المالك"], ["من 20 إلى 100", "المدير العام، وأحيانًا العمليات"], ["من 100 إلى 500", "رئيس القسم الذي يستخدم الخدمة"], ["أكثر من 500", "رئيس قسم مع مشاركة المشتريات"]] } },
      { note: "حجم الشركة غير منشور لكل الشركات. وعندما يغيب يخبرك يولـياس بذلك بدل التخمين." },
    ],
    faq: [
      { q: "كيف أجد أنشطة صغيرة أبيع لها؟", a: "ابحث بالنوع والمنطقة (الأنشطة المحلية) لا بعدد الموظفين، فالأنشطة الصغيرة نادرًا ما تنشر عدد موظفيها." },
      { q: "هل عدد الموظفين موثوق؟", a: "يختلف حسب المصدر وغالبًا يكون نطاقًا. استخدمه كفلتر ثم راجع موقع الشركة." },
    ],
  }),
  tpl("leads-by-job-title", "find leads by job title", ["find people by job title", "find marketing managers at companies", "job title prospecting"], {
    title: "Find leads by job title", h1: "How to find the right job titles at your target companies",
    metaTitle: "Find leads by job title: titles by department",
    metaDescription: "Which job titles to look for when you sell marketing, IT, HR or finance services, how titles differ by company size and language, and how to find them.",
    lead: "The person who needs your service and the person who signs aren't always the same, and titles differ across companies and languages. This template lists the titles to look for by what you sell.",
    answer: "List two or three titles for the person who owns the problem and one for who signs, include the Arabic and English versions used in your market, and search for them at companies that already match your criteria. Yolias looks for the roles you name at each matching company.",
    audience: ["Anyone selling to a department rather than to the owner", "Teams selling into Arabic- and English-speaking markets"],
    criteria: ["Owner of the problem", "Who signs at that company size", "Title variants in both languages"],
    steps: [
      { title: "Choose companies first", body: "Titles only make sense inside the right companies; build the company list first." },
      { title: "List title variants", body: "Marketing Manager, Head of Marketing, CMO, مدير التسويق: one role, many titles." },
      { title: "Add the signer", body: "For smaller companies, add the general manager or owner." },
    ],
    prompt: "At logistics and e-commerce companies in the UAE with 50 to 500 employees, find the Head of Marketing, Marketing Manager or CMO. I run performance marketing campaigns.",
    blocks: [
      { h2: "Titles by what you sell" },
      { table: { head: ["You sell", "Look for"], rows: [
        ["Marketing, content, SEO", "Marketing Manager, Head of Marketing, CMO, Brand Manager"],
        ["IT, cloud, security", "IT Manager, Head of IT, CTO; operations or finance manager in smaller companies"],
        ["Recruitment, HR services", "HR Manager, Head of People, Talent Acquisition Manager"],
        ["Finance and accounting services", "Finance Manager, CFO, Financial Controller"],
        ["Software for sales teams", "Head of Sales, Sales Director, Commercial Manager"],
      ] } },
      { note: "Yolias shows the contact details a company publishes and doesn't promise a personal email for each person. Where only a general address exists, write to it and name the role you want to reach." },
    ],
    faq: [
      { q: "How do I find people by job title at a company?", a: "Look at the company's team page, its posts and professional profiles. Yolias searches for the roles you name at companies that match your criteria." },
      { q: "Should I write to the CEO?", a: "At small companies, yes. At larger ones, write to the head of the department that owns the problem." },
    ],
  }, {
    title: "البحث عن العملاء حسب المسمى الوظيفي", h1: "كيف تجد المسميات الوظيفية المناسبة في الشركات المستهدفة",
    metaTitle: "البحث عن العملاء حسب المسمى الوظيفي لكل قسم",
    metaDescription: "أي المسميات تبحث عنها عندما تبيع خدمات تسويق أو تقنية أو موارد بشرية أو مالية، وكيف تختلف المسميات حسب حجم الشركة واللغة، وكيف تجدها.",
    lead: "من يحتاج خدمتك ومن يوقّع ليسا دائمًا نفس الشخص، والمسميات تختلف بين الشركات واللغات. هذا القالب يعرض المسميات التي تبحث عنها حسب ما تبيعه.",
    answer: "اكتب مسميين أو ثلاثة لصاحب المشكلة وواحدًا لمن يوقّع، مع الصيغ العربية والإنجليزية المستخدمة في سوقك، وابحث عنها في شركات تطابق معاييرك بالفعل. يبحث يولـياس عن المناصب التي تذكرها في كل شركة مطابقة.",
    audience: ["كل من يبيع لقسم لا للمالك", "الفرق التي تبيع في أسواق عربية وإنجليزية"],
    criteria: ["صاحب المشكلة", "من يوقّع عند هذا الحجم", "صيغ المسمى باللغتين"],
    steps: [
      { title: "اختر الشركات أولًا", body: "المسميات لها معنى داخل الشركات المناسبة فقط؛ ابنِ قائمة الشركات أولًا." },
      { title: "اكتب صيغ المسمى", body: "مدير التسويق، رئيس التسويق، CMO، Marketing Manager: دور واحد بمسميات كثيرة." },
      { title: "أضف من يوقّع", body: "في الشركات الأصغر، أضف المدير العام أو المالك." },
    ],
    prompt: "في شركات النقل والتجارة الإلكترونية في الإمارات من 50 إلى 500 موظف، اعثر على رئيس التسويق أو مدير التسويق أو CMO. أدير حملات تسويق بالأداء.",
    blocks: [
      { h2: "المسميات حسب ما تبيعه" },
      { table: { head: ["تبيع", "ابحث عن"], rows: [
        ["التسويق والمحتوى وSEO", "مدير التسويق، رئيس التسويق، CMO، مدير العلامة التجارية"],
        ["التقنية والسحابة والأمن", "مدير تقنية المعلومات، رئيس IT، CTO، ومدير العمليات أو المالية في الشركات الأصغر"],
        ["التوظيف وخدمات الموارد البشرية", "مدير الموارد البشرية، رئيس شؤون الموظفين، مدير استقطاب المواهب"],
        ["الخدمات المالية والمحاسبية", "المدير المالي، CFO، المراقب المالي"],
        ["برمجيات لفرق المبيعات", "رئيس المبيعات، مدير المبيعات، المدير التجاري"],
      ] } },
      { note: "يعرض يولـياس بيانات التواصل التي تنشرها الشركة ولا يعد ببريد شخصي لكل شخص. وحيث يوجد عنوان عام فقط، اكتب إليه واذكر الدور الذي تريد الوصول إليه." },
    ],
    faq: [
      { q: "كيف أجد أشخاصًا حسب المسمى الوظيفي في شركة؟", a: "راجع صفحة الفريق في موقع الشركة ومنشوراتها والملفات المهنية. ويبحث يولـياس عن المناصب التي تذكرها في الشركات التي تطابق معاييرك." },
      { q: "هل أكتب للرئيس التنفيذي؟", a: "في الشركات الصغيرة نعم. وفي الأكبر اكتب لرئيس القسم صاحب المشكلة." },
    ],
  }),
  tpl("companies-in-saudi-arabia", "find companies in saudi arabia", ["b2b leads saudi arabia", "list of companies in riyadh", "saudi companies list", "prospecting in saudi arabia"], {
    title: "Find companies in Saudi Arabia", h1: "How to find B2B clients in Saudi Arabia",
    metaTitle: "Find companies in Saudi Arabia: a B2B template",
    metaDescription: "Prospecting in Saudi Arabia: which cities, the Sunday to Thursday week, Arabic and English outreach, company registration, and a ready request to open in Yolias.",
    lead: "Selling into Saudi Arabia works best with a narrow list, outreach in the language your buyer uses, and timing that fits the local week. This template sets that up.",
    answer: "Pick one city (Riyadh, Jeddah or the Eastern Province), one industry and a size range; write in Arabic or in both languages; send on working days, Sunday to Thursday. Yolias searches Saudi companies from a plain description in Arabic or English and sends from your mailbox on the days and hours you set.",
    audience: ["Agencies and service firms from the region or abroad selling into Saudi Arabia", "SaaS companies entering the Saudi market"],
    criteria: ["City or region: Riyadh, Jeddah, Makkah, Madinah, Dammam and the Eastern Province", "Industry and size", "Language of outreach: Arabic, English or both", "Whether you need a local presence for the deal"],
    steps: [
      { title: "Choose one city first", body: "Riyadh, Jeddah and the Eastern Province behave like different markets; start with one." },
      { title: "Describe the client", body: "In Arabic or English; Yolias understands both and can write the email in either." },
      { title: "Set the sending days", body: "In Yolias, set your mailbox to send Sunday to Thursday in Riyadh time." },
      { title: "Follow up politely", body: "Short follow-ups after a few days; offer a call or a visit." },
    ],
    prompt: "Find construction and real estate development companies in Riyadh with 50 to 500 employees. I offer 3D visualisation and marketing videos for projects. Write the first email in Arabic.",
    blocks: [
      { h2: "Facts to plan around" },
      { ul: ["The working week is Sunday to Thursday; the weekend is Friday and Saturday.", "Companies are registered with a Commercial Registration (CR) from the Ministry of Commerce.", "Arabic is the official language; English is widely used in business, especially in larger companies.", "Many decisions involve the owner or general manager, even in mid-size companies."] },
      { note: "Coverage of Saudi companies depends on the data sources connected to Yolias and on what companies publish. Check the first results before you send." },
    ],
    faq: [
      { q: "Should I write to Saudi companies in Arabic or English?", a: "Arabic is a safe default for owner-led and mid-size companies; English often works in larger and international companies. Yolias can write the email in either language." },
      { q: "When is the best time to send B2B emails in Saudi Arabia?", a: "On working days, Sunday to Thursday, during business hours in Riyadh time. Set these as the sending days and hours of your mailbox in Yolias." },
    ],
  }, {
    title: "البحث عن الشركات في السعودية", h1: "كيف تجد عملاء B2B في السعودية",
    metaTitle: "البحث عن الشركات في السعودية: قالب لعملاء B2B",
    metaDescription: "قالب عملي للبحث عن العملاء في السعودية: المدن، وأسبوع العمل من الأحد إلى الخميس، والتواصل بالعربية والإنجليزية، وتسجيل الشركات، وطلب تفتحه في يولـياس.",
    lead: "البيع في السعودية ينجح أكثر بقائمة محددة، وتواصل باللغة التي يستخدمها المشتري، وتوقيت يناسب أسبوع العمل المحلي. هذا القالب يجهّز ذلك.",
    answer: "اختر مدينة واحدة (الرياض أو جدة أو المنطقة الشرقية)، وقطاعًا واحدًا، ونطاق حجم؛ واكتب بالعربية أو باللغتين؛ وأرسل في أيام العمل من الأحد إلى الخميس. يبحث يولـياس عن الشركات السعودية من وصف بسيط بالعربية أو الإنجليزية، ويرسل من بريدك في الأيام والساعات التي تحددها.",
    audience: ["الوكالات وشركات الخدمات من المنطقة أو خارجها التي تبيع في السعودية", "شركات SaaS التي تدخل السوق السعودي"],
    criteria: ["المدينة أو المنطقة: الرياض، جدة، مكة، المدينة، الدمام والمنطقة الشرقية", "القطاع والحجم", "لغة التواصل: العربية أو الإنجليزية أو الاثنتان", "هل تحتاج وجودًا محليًا لإتمام الصفقة"],
    steps: [
      { title: "اختر مدينة واحدة أولًا", body: "الرياض وجدة والمنطقة الشرقية تتصرف كأسواق مختلفة؛ ابدأ بواحدة." },
      { title: "صِف العميل", body: "بالعربية أو الإنجليزية؛ يفهم يولـياس الاثنتين ويستطيع كتابة الرسالة بأي منهما." },
      { title: "حدد أيام الإرسال", body: "في يولـياس، اضبط صندوق بريدك ليرسل من الأحد إلى الخميس بتوقيت الرياض." },
      { title: "تابع بلطف", body: "متابعات قصيرة بعد أيام قليلة، واعرض مكالمة أو زيارة." },
    ],
    prompt: "اعثر على شركات المقاولات والتطوير العقاري في الرياض من 50 إلى 500 موظف. أقدم تصميمًا ثلاثي الأبعاد وفيديوهات تسويقية للمشاريع. اكتب الرسالة الأولى بالعربية.",
    blocks: [
      { h2: "حقائق تخطط حولها" },
      { ul: ["أسبوع العمل من الأحد إلى الخميس، والعطلة الجمعة والسبت.", "تُسجَّل الشركات بسجل تجاري من وزارة التجارة.", "العربية هي اللغة الرسمية، والإنجليزية منتشرة في الأعمال خاصة في الشركات الأكبر.", "كثير من القرارات يشارك فيها المالك أو المدير العام حتى في الشركات المتوسطة."] },
      { note: "تغطية الشركات السعودية تعتمد على مصادر البيانات المتصلة بيولـياس وعلى ما تنشره الشركات. راجع النتائج الأولى قبل الإرسال." },
    ],
    faq: [
      { q: "هل أكتب للشركات السعودية بالعربية أم بالإنجليزية؟", a: "العربية اختيار آمن للشركات التي يديرها مالكها والشركات المتوسطة، والإنجليزية تنجح غالبًا في الشركات الأكبر والدولية. ويستطيع يولـياس كتابة الرسالة بأي من اللغتين." },
      { q: "ما أفضل وقت لإرسال رسائل B2B في السعودية؟", a: "في أيام العمل من الأحد إلى الخميس، خلال ساعات العمل بتوقيت الرياض. اضبطها كأيام وساعات الإرسال لصندوق بريدك في يولـياس." },
    ],
  }),
  tpl("companies-in-uae", "find companies in the uae", ["b2b leads uae", "list of companies in dubai", "uae companies list", "prospecting in dubai"], {
    title: "Find companies in the UAE", h1: "How to find B2B clients in the UAE",
    metaTitle: "Find companies in the UAE: a B2B prospecting template",
    metaDescription: "A practical template for prospecting in the UAE: emirates and free zones, the Monday to Friday week, English and Arabic outreach, and a request to open in Yolias.",
    lead: "The UAE mixes local companies, regional headquarters and free zone businesses, mostly working in English. This template narrows that mix to a list you can contact.",
    answer: "Pick one emirate (usually Dubai or Abu Dhabi), decide whether you want mainland companies, free zone companies or both, add an industry and a size, and write in English unless your buyer prefers Arabic. Yolias searches from a plain description and sends from your mailbox within the sending days you set.",
    audience: ["Agencies and consultancies selling into Dubai and Abu Dhabi", "Companies using the UAE as a regional base"],
    criteria: ["Emirate: Dubai, Abu Dhabi, Sharjah or another", "Mainland or free zone (for example DMCC, Dubai Internet City, ADGM)", "Industry and size", "Regional headquarters versus local companies"],
    steps: [
      { title: "Pick the emirate", body: "Dubai and Abu Dhabi differ in industries and buyers; start with one." },
      { title: "Say mainland or free zone", body: "Free zone companies often serve the region; mainland companies often serve the UAE market." },
      { title: "Set the week", body: "Most private companies work Monday to Friday; set your mailbox's sending days to match." },
    ],
    prompt: "Find fintech and payments companies in Dubai, including DIFC and Dubai Internet City, with 20 to 300 employees. I offer compliance training. Find the head of compliance or operations.",
    blocks: [
      { h2: "Facts to plan around" },
      { ul: ["Since 2022 government offices work Monday to Friday, with a half day on Friday; many private companies follow the same week, so check your buyers.", "Companies register with the economic department of their emirate or with a free zone authority.", "English is the main business language; Arabic is the official language.", "Many companies are regional offices: the decision may sit in another country."] },
      { note: "Coverage depends on the data sources connected to Yolias and on what companies publish. Check a sample before you send." },
    ],
    faq: [
      { q: "Is it better to target free zone or mainland companies?", a: "It depends on your service. Free zone companies often sell across the region; mainland companies more often serve the local market. You can ask Yolias for either or both." },
      { q: "Should I write in English or Arabic in the UAE?", a: "English is the default in most companies; Arabic can help with local family businesses and government-related entities." },
    ],
  }, {
    title: "البحث عن الشركات في الإمارات", h1: "كيف تجد عملاء B2B في الإمارات",
    metaTitle: "البحث عن الشركات في الإمارات: قالب لعملاء B2B",
    metaDescription: "قالب عملي للبحث عن العملاء في الإمارات: الإمارات والمناطق الحرة، وأسبوع العمل من الاثنين إلى الجمعة، والتواصل بالإنجليزية والعربية، وطلب تفتحه في يولـياس.",
    lead: "تجمع الإمارات بين شركات محلية ومقار إقليمية وشركات في المناطق الحرة، يعمل معظمها بالإنجليزية. هذا القالب يضيّق هذا المزيج إلى قائمة تستطيع التواصل معها.",
    answer: "اختر إمارة واحدة (غالبًا دبي أو أبوظبي)، وحدد هل تريد شركات البر الرئيسي أم المناطق الحرة أم الاثنين، وأضف قطاعًا وحجمًا، واكتب بالإنجليزية إلا إذا كان المشتري يفضل العربية. يبحث يولـياس من وصف بسيط ويرسل من بريدك في أيام الإرسال التي تحددها.",
    audience: ["الوكالات والاستشاريون الذين يبيعون في دبي وأبوظبي", "الشركات التي تستخدم الإمارات قاعدة إقليمية"],
    criteria: ["الإمارة: دبي أو أبوظبي أو الشارقة أو غيرها", "البر الرئيسي أو المنطقة الحرة (مثل DMCC ومدينة دبي للإنترنت وADGM)", "القطاع والحجم", "مقار إقليمية أم شركات محلية"],
    steps: [
      { title: "اختر الإمارة", body: "دبي وأبوظبي تختلفان في القطاعات والمشترين؛ ابدأ بواحدة." },
      { title: "حدد البر الرئيسي أو المنطقة الحرة", body: "شركات المناطق الحرة تخدم المنطقة غالبًا، وشركات البر الرئيسي تخدم السوق الإماراتي غالبًا." },
      { title: "حدد الأسبوع", body: "معظم الشركات الخاصة تعمل من الاثنين إلى الجمعة؛ اضبط أيام إرسال صندوق بريدك على ذلك." },
    ],
    prompt: "اعثر على شركات التقنية المالية والمدفوعات في دبي، ومنها مركز دبي المالي العالمي ومدينة دبي للإنترنت، من 20 إلى 300 موظف. أقدم تدريبًا على الامتثال. اعثر على رئيس الامتثال أو العمليات.",
    blocks: [
      { h2: "حقائق تخطط حولها" },
      { ul: ["منذ 2022 تعمل الجهات الحكومية من الاثنين إلى الجمعة مع نصف يوم يوم الجمعة، وتتبع كثير من الشركات الخاصة نفس الأسبوع، فتحقق من عملائك.", "تُسجَّل الشركات لدى الدائرة الاقتصادية في إمارتها أو لدى سلطة منطقة حرة.", "الإنجليزية لغة الأعمال الأساسية، والعربية هي اللغة الرسمية.", "كثير من الشركات مكاتب إقليمية: قد يكون القرار في بلد آخر."] },
      { note: "التغطية تعتمد على مصادر البيانات المتصلة بيولـياس وعلى ما تنشره الشركات. راجع عيّنة قبل الإرسال." },
    ],
    faq: [
      { q: "هل الأفضل استهداف شركات المناطق الحرة أم البر الرئيسي؟", a: "يعتمد على خدمتك. شركات المناطق الحرة تبيع غالبًا في المنطقة كلها، وشركات البر الرئيسي تخدم السوق المحلي أكثر. ويمكنك طلب أي منهما أو الاثنين من يولـياس." },
      { q: "هل أكتب بالإنجليزية أم بالعربية في الإمارات؟", a: "الإنجليزية هي الأساس في معظم الشركات، والعربية قد تساعد مع الشركات العائلية المحلية والجهات المرتبطة بالحكومة." },
    ],
  }),
  tpl("businesses-in-egypt", "find businesses in egypt", ["list of companies in egypt", "b2b leads egypt", "companies in cairo", "prospecting in egypt"], {
    title: "Find businesses in Egypt", h1: "How to find B2B clients and local businesses in Egypt",
    metaTitle: "Find businesses in Egypt: a B2B prospecting template",
    metaDescription: "Prospecting in Egypt: Cairo, Giza, Alexandria and the new cities, the Sunday to Thursday week, Arabic outreach and published business contacts, with a ready request.",
    lead: "Many Egyptian businesses publish a phone number or a social page before an email address, and many decisions sit with the owner. This template accounts for both.",
    answer: "Pick one area (for example New Cairo, Sheikh Zayed, Nasr City or Alexandria), one type of business, and write in Egyptian-friendly Arabic or in English for larger companies; send Sunday to Thursday. Yolias searches companies and local businesses from a plain description and shows the contact details each one publishes, which in Egypt are often a phone or a social page.",
    audience: ["Agencies, studios and freelancers in Egypt", "Regional companies selling into Egypt"],
    criteria: ["Area: Cairo, Giza, Alexandria, the new cities such as New Cairo, 6th of October and Sheikh Zayed", "Type of business and size", "Arabic or English outreach", "Which contact channel the business actually publishes"],
    steps: [
      { title: "Start with one area", body: "Cairo's districts behave like separate markets; a focused list gets better replies." },
      { title: "Expect owners", body: "In small and mid-size businesses, write to the owner or general manager." },
      { title: "Use the published channel", body: "Email where an address exists; for businesses that only publish a phone or a social page, contact them there yourself." },
      { title: "Set the week", body: "Send Sunday to Thursday in Cairo time." },
    ],
    prompt: "Find private clinics and medical centres in New Cairo and Nasr City that have a website or a Facebook page. I offer patient booking and WhatsApp follow-up systems. Write the first email in Arabic.",
    blocks: [
      { h2: "Facts to plan around" },
      { ul: ["The working week is usually Sunday to Thursday; Friday is the weekend, and many companies also take Saturday off.", "Companies are registered in the commercial registry; the General Authority for Investment and Free Zones (GAFI) handles investment companies.", "Arabic is the language of most small and mid-size businesses; English is common in larger and multinational companies.", "Many small businesses publish a mobile number or a social page instead of an email."] },
      { note: "Yolias sends email only. When a business publishes no email, Yolias shows the phone or page it publishes and you contact it yourself. Coverage depends on the data sources connected to Yolias." },
    ],
    faq: [
      { q: "How do I find companies in Egypt?", a: "Company websites, map data, chambers of commerce and industry directories. Directories usually forbid copying; a focused search by area and type, then checking each business, works better." },
      { q: "Is email effective in Egypt?", a: "With larger companies and B2B services, yes. Many small businesses answer phone and social messages faster, so use the channel each one publishes." },
    ],
  }, {
    title: "البحث عن الأنشطة في مصر", h1: "كيف تجد عملاء B2B وأنشطة محلية في مصر",
    metaTitle: "البحث عن الشركات في مصر: قالب لعملاء B2B",
    metaDescription: "البحث عن العملاء في مصر: القاهرة والجيزة والإسكندرية والمدن الجديدة، وأسبوع العمل من الأحد إلى الخميس، والتواصل بالعربية، وبيانات التواصل المنشورة، مع طلب جاهز.",
    lead: "كثير من الأنشطة في مصر تنشر رقم هاتف أو صفحة تواصل قبل البريد، وكثير من القرارات بيد المالك. هذا القالب يراعي الأمرين.",
    answer: "اختر منطقة واحدة (مثل التجمع الخامس أو الشيخ زايد أو مدينة نصر أو الإسكندرية)، ونوع نشاط واحدًا، واكتب بعربية قريبة من المصريين أو بالإنجليزية للشركات الأكبر، وأرسل من الأحد إلى الخميس. يبحث يولـياس عن الشركات والأنشطة المحلية من وصف بسيط ويعرض بيانات التواصل التي تنشرها كل منها، وهي في مصر غالبًا رقم هاتف أو صفحة تواصل.",
    audience: ["الوكالات والاستوديوهات والمستقلون في مصر", "الشركات الإقليمية التي تبيع في مصر"],
    criteria: ["المنطقة: القاهرة، الجيزة، الإسكندرية، والمدن الجديدة مثل التجمع الخامس و6 أكتوبر والشيخ زايد", "نوع النشاط والحجم", "التواصل بالعربية أو الإنجليزية", "قناة التواصل التي ينشرها النشاط فعلًا"],
    steps: [
      { title: "ابدأ بمنطقة واحدة", body: "أحياء القاهرة تتصرف كأسواق منفصلة؛ القائمة المركّزة تحصل على ردود أفضل." },
      { title: "توقّع المالك", body: "في الأنشطة الصغيرة والمتوسطة، اكتب للمالك أو المدير العام." },
      { title: "استخدم القناة المنشورة", body: "البريد حيث يوجد عنوان؛ والأنشطة التي تنشر هاتفًا أو صفحة فقط تواصل معها هناك بنفسك." },
      { title: "حدد الأسبوع", body: "أرسل من الأحد إلى الخميس بتوقيت القاهرة." },
    ],
    prompt: "اعثر على العيادات الخاصة والمراكز الطبية في التجمع الخامس ومدينة نصر التي لها موقع أو صفحة فيسبوك. أقدم أنظمة حجز ومتابعة المرضى على واتساب. اكتب الرسالة الأولى بالعربية.",
    blocks: [
      { h2: "حقائق تخطط حولها" },
      { ul: ["أسبوع العمل عادة من الأحد إلى الخميس؛ الجمعة عطلة، وكثير من الشركات تعطل السبت أيضًا.", "تُسجَّل الشركات في السجل التجاري، والهيئة العامة للاستثمار والمناطق الحرة تتولى شركات الاستثمار.", "العربية لغة معظم الأنشطة الصغيرة والمتوسطة، والإنجليزية شائعة في الشركات الكبرى والدولية.", "كثير من الأنشطة الصغيرة تنشر رقم جوال أو صفحة تواصل بدل البريد."] },
      { note: "يرسل يولـياس البريد فقط. وعندما لا ينشر النشاط بريدًا، يعرض يولـياس الهاتف أو الصفحة التي ينشرها وتتواصل معه بنفسك. والتغطية تعتمد على مصادر البيانات المتصلة بيولـياس." },
    ],
    faq: [
      { q: "كيف أجد شركات في مصر؟", a: "مواقع الشركات، وبيانات الخرائط، والغرف التجارية، وأدلة القطاعات. الأدلة تمنع غالبًا النسخ؛ والبحث المركّز حسب المنطقة والنوع ثم مراجعة كل نشاط يعمل أفضل." },
      { q: "هل البريد الإلكتروني فعّال في مصر؟", a: "مع الشركات الأكبر وخدمات B2B نعم. وكثير من الأنشطة الصغيرة ترد على الهاتف ورسائل التواصل أسرع، فاستخدم القناة التي ينشرها كل نشاط." },
    ],
  }),
];
