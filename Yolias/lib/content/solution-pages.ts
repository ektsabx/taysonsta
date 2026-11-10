import type { Localized } from "./types";

// A full page for each solution (owner, 2026-11-05): written for that business,
// its buyers, its objections and its first month. The emails are examples of
// what Yolias writes, not results; no numbers beyond Yolias's own prices.
export interface SolutionPage {
  who: string;
  pains: { t: string; b: string }[];
  audiences: { name: string; target: string }[];
  email: { subject: string; body: string };
  plan: [string, string][];
  watch: string[];
  faq: [string, string][];
}

export const solutionPageLabels: Localized<{ who: string; pains: string; audiences: string; audiencesLead: string; email: string; emailLead: string; plan: string; watch: string; cost: string; costLead: string; costRows: string[][]; costNote: string; faq: string; start: string; cases: string }> = {
  en: { who: "Who this is for", pains: "What gets in the way", audiences: "Audiences to start with", audiencesLead: "Each one runs as its own audience in the campaign, with its own results.", email: "An example first email", emailLead: "Yolias writes a different email to each person from your Company Knowledge. This is what one can look like.", plan: "Your first 30 days", watch: "What to watch", cost: "What it costs", costLead: "Signing up and building your campaign are free. You pay when you launch, for the people Yolias finds. Emails, replies and meetings are never charged.", costRows: [["$20", "200 people", "A first test"], ["$50", "500 people", "A full campaign with two or three audiences"], ["$100 a month", "2,000 people a month", "Growth plan, at half the price per person"]], costNote: "Every option has every feature and unlimited users.", faq: "Common questions", start: "Start free", cases: "See a step-by-step use case" },
  ar: { who: "لمن هذا", pains: "ما الذي يعيقك", audiences: "جماهير تبدأ بها", audiencesLead: "يعمل كل منها كجمهور مستقل في الحملة بنتائجه الخاصة.", email: "مثال على أول رسالة", emailLead: "يكتب يولياس رسالة مختلفة لكل شخص من معرفة شركتك. وهكذا قد تبدو إحداها.", plan: "أول 30 يومًا", watch: "ما تراقبه", cost: "التكلفة", costLead: "التسجيل وبناء الحملة مجانًا. وتدفع عند التشغيل مقابل من يجدهم يولياس، ولا تُحسب تكلفة على الرسائل والردود والاجتماعات.", costRows: [["20 دولارًا", "200 شخص", "تجربة أولى"], ["50 دولارًا", "500 شخص", "حملة كاملة بجمهورين أو ثلاثة"], ["100 دولار شهريًا", "2,000 شخص شهريًا", "خطة النمو بنصف سعر الشخص"]], costNote: "كل الخيارات بكل الميزات ومستخدمين بلا حد.", faq: "أسئلة شائعة", start: "ابدأ مجانًا", cases: "شاهد حالة استخدام خطوة بخطوة" },
};

export const solutionPages: Record<string, Localized<SolutionPage>> = {
  "marketing-agencies": {
    en: {
      who: "Marketing agencies of any size that sell retainers or campaigns, and want new clients each month without depending on referrals. It fits agencies with a clear service and at least one kind of client they serve well.",
      pains: [{ t: "Referrals decide your month", b: "Good months come from people you can't schedule. When two clients leave, there's nothing in the pipeline behind them." }, { t: "Outreach stops when work starts", b: "The team sells when it's quiet and stops when it's busy, so new business always arrives late." }, { t: "You sell ads but can't measure your own sales", b: "You report cost per lead to clients, but you can't say what your own new client cost." }],
      audiences: [{ name: "Owners of clinics and local chains", target: "Clinics and multi-branch businesses in your cities, 5 to 200 employees, owner or general manager" }, { name: "E-commerce founders", target: "Online stores in your markets, founder or head of marketing" }, { name: "Marketing managers at growing companies", target: "Companies hiring in marketing, marketing manager or head of growth" }],
      email: { subject: "Your Riyadh branches on Google", body: "Hi Khalid,\n\nI saw you opened two new branches this year. We run ads for clinic groups in Saudi Arabia, and new branches are usually where the cost per booking is highest in the first months.\n\nWorth a short call to compare what you're paying now?\n\nSara" },
      plan: [["Day 1", "Write your services and your best client type in Company Knowledge, and connect your mailbox."], ["Day 2", "Launch a meetings campaign with the three audiences above, from $20."], ["Weeks 1 to 2", "Read replies in Conversations. Yolias answers pricing questions from your offers and hands you negotiations."], ["Weeks 3 to 4", "Compare cost per meeting by audience. Keep the winner and add a new city."]],
      watch: ["Cost per meeting by audience", "Replies by job title: who actually answers", "Which industry turns meetings into clients"],
      faq: [["Can I run this for my clients too?", "Yes. Each client can have its own Yolias account, with its own mailbox and Company Knowledge."], ["Will emails sound like templates?", "Each email is written for one person from your knowledge and what Yolias found about them."], ["What if someone asks for our prices?", "Yolias answers from the offers you wrote. If you left prices out, it hands the question to you."], ["Can several people on my team use it?", "Yes, with unlimited users, and each can connect their own mailboxes."]],
    },
    ar: {
      who: "وكالات التسويق بأي حجم التي تبيع عقودًا شهرية أو حملات، وتريد عملاء جددًا كل شهر دون الاعتماد على الترشيحات. ويناسب الوكالات ذات الخدمة الواضحة ونوع عميل تخدمه جيدًا.",
      pains: [{ t: "الترشيحات تحدد شهرك", b: "الأشهر الجيدة تأتي من أشخاص لا تستطيع جدولتهم. وعندما يغادر عميلان لا تجد شيئًا خلفهما." }, { t: "يتوقف التواصل عند بدء العمل", b: "يبيع الفريق وقت الهدوء ويتوقف وقت الانشغال، فيصل العمل الجديد متأخرًا دائمًا." }, { t: "تبيع الإعلانات ولا تقيس مبيعاتك", b: "تقدم لعملائك تكلفة العميل، ولا تعرف كم كلفك عميلك الجديد." }],
      audiences: [{ name: "ملاك العيادات والسلاسل المحلية", target: "عيادات وأعمال متعددة الفروع في مدنك، من 5 إلى 200 موظف، المالك أو المدير العام" }, { name: "مؤسسو المتاجر الإلكترونية", target: "متاجر إلكترونية في أسواقك، المؤسس أو مدير التسويق" }, { name: "مديرو التسويق في الشركات النامية", target: "شركات توظف في التسويق، مدير التسويق أو مدير النمو" }],
      email: { subject: "فروعكم في الرياض على Google", body: "أهلًا خالد،\n\nلاحظت أنكم افتتحتم فرعين جديدين هذا العام. ندير إعلانات لمجموعات عيادات في السعودية، والفروع الجديدة عادة تكون تكلفة الحجز فيها الأعلى في الأشهر الأولى.\n\nهل تناسبك مكالمة قصيرة لمقارنة ما تدفعونه الآن؟\n\nسارة" },
      plan: [["اليوم 1", "اكتب خدماتك وأفضل نوع عميل في معرفة الشركة، واربط بريدك."], ["اليوم 2", "شغّل حملة اجتماعات بالجماهير الثلاثة أعلاه، من 20 دولارًا."], ["الأسبوع 1 و2", "اقرأ الردود في المحادثات. يجيب يولياس عن الأسعار من عروضك ويسلمك التفاوض."], ["الأسبوع 3 و4", "قارن تكلفة الاجتماع لكل جمهور، وأبقِ الأفضل وأضف مدينة جديدة."]],
      watch: ["تكلفة الاجتماع لكل جمهور", "الردود حسب المسمى: من يرد فعلًا", "أي مجال يحوّل الاجتماعات إلى عملاء"],
      faq: [["هل أستطيع تشغيله لعملائي أيضًا؟", "نعم. يمكن أن يكون لكل عميل حساب يولياس ببريده ومعرفة شركته."], ["هل ستبدو الرسائل كقوالب؟", "تُكتب كل رسالة لشخص واحد من معرفتك وما وجده يولياس عنه."], ["ماذا لو سأل أحدهم عن أسعارنا؟", "يجيب يولياس من العروض التي كتبتها، وإذا لم تذكر الأسعار يسلمك السؤال."], ["هل يستخدمه أكثر من شخص في فريقي؟", "نعم، بمستخدمين بلا حد، ويربط كل منهم برائده."]],
    },
  },
  "software-agencies": {
    en: {
      who: "Software houses and development teams that build apps, websites or internal systems for clients, and sell projects worth a real conversation.",
      pains: [{ t: "Long gaps between projects", b: "When a big project ends, the team is paid but idle, and new work takes weeks to start." }, { t: "Marketplaces push you to compete on price", b: "Bidding sites bring buyers who compare hourly rates, not outcomes." }, { t: "The people who buy are hard to reach", b: "A CTO or founder doesn't read general inboxes, and cold calling rarely gets through." }],
      audiences: [{ name: "Founders at funded startups", target: "Startups with a recent funding stage, founder or CTO" }, { name: "Operations leaders at traditional companies", target: "Logistics, healthcare or real estate companies, operations or IT manager" }, { name: "Companies hiring developers", target: "Companies with Hiring now on, CTO or head of engineering" }],
      email: { subject: "Your open developer roles", body: "Hi Lina,\n\nI noticed you're hiring two mobile developers. While you search, we can take the next release: our team has shipped delivery and booking apps in the region, and we can start within two weeks.\n\nWould a 20-minute call this week help?\n\nOmar" },
      plan: [["Day 1", "Add your projects and technologies to Company Knowledge, and connect your mailbox."], ["Day 2", "Launch with Hiring now and funding signals in two audiences."], ["Weeks 1 to 2", "Yolias answers questions about your stack and timelines from what you wrote."], ["Weeks 3 to 4", "Keep the signal that brings meetings, and add technologies you specialize in."]],
      watch: ["Which signal brings meetings: hiring or funding", "Replies by industry", "Cost per meeting against your project size"],
      faq: [["Can I target by technology?", "Yes. The Signals section has Technologies they use."], ["Is it worth it for large projects?", "One project usually covers many campaigns, and you pay only for people reached."], ["Can Yolias quote a project?", "No. It offers a meeting. Questions it can't answer are handed to you."], ["Can I use my own domain?", "Yes. Emails go out from your own mailbox."]],
    },
    ar: {
      who: "شركات البرمجة وفرق التطوير التي تبني التطبيقات والمواقع والأنظمة الداخلية لعملائها، وتبيع مشاريع تستحق محادثة حقيقية.",
      pains: [{ t: "فجوات طويلة بين المشاريع", b: "عندما ينتهي مشروع كبير يبقى الفريق بلا عمل ويأخذ الجديد أسابيع ليبدأ." }, { t: "المنصات تدفعك إلى المنافسة بالسعر", b: "مواقع العروض تأتي بمشترين يقارنون سعر الساعة لا النتيجة." }, { t: "يصعب الوصول إلى من يشتري", b: "المدير التقني أو المؤسس لا يقرأ البريد العام، والاتصال البارد نادرًا ما يصل." }],
      audiences: [{ name: "مؤسسو الشركات الناشئة الممولة", target: "شركات ناشئة بمرحلة تمويل حديثة، المؤسس أو المدير التقني" }, { name: "قادة التشغيل في الشركات التقليدية", target: "شركات لوجستية أو صحية أو عقارية، مدير التشغيل أو تقنية المعلومات" }, { name: "شركات توظف مطورين", target: "شركات مفعّل فيها توظّف الآن، المدير التقني أو رئيس الهندسة" }],
      email: { subject: "وظائف المطورين المفتوحة لديكم", body: "أهلًا لينا،\n\nلاحظت أنكم توظفون مطوري تطبيقات. وأثناء بحثكم يمكننا تولي الإصدار القادم: أطلق فريقنا تطبيقات توصيل وحجز في المنطقة، ونستطيع البدء خلال أسبوعين.\n\nهل تفيدك مكالمة 20 دقيقة هذا الأسبوع؟\n\nعمر" },
      plan: [["اليوم 1", "أضف مشاريعك وتقنياتك إلى معرفة الشركة، واربط بريدك."], ["اليوم 2", "شغّل الحملة بإشارتي التوظيف والتمويل في جمهورين."], ["الأسبوع 1 و2", "يجيب يولياس عن تقنياتك ومواعيدك مما كتبته."], ["الأسبوع 3 و4", "أبقِ الإشارة التي تأتي بالاجتماعات، وأضف التقنيات التي تتخصص فيها."]],
      watch: ["أي إشارة تأتي بالاجتماعات: التوظيف أم التمويل", "الردود حسب المجال", "تكلفة الاجتماع مقارنة بحجم مشروعك"],
      faq: [["هل أستهدف حسب التقنية؟", "نعم. في الإشارات يوجد التقنيات التي يستخدمونها."], ["هل يستحق للمشاريع الكبيرة؟", "مشروع واحد يغطي عادة حملات كثيرة، وتدفع فقط لمن تصل إليهم."], ["هل يسعّر يولياس المشروع؟", "لا. يعرض اجتماعًا، وما لا يستطيع إجابته يُسلَّم لك."], ["هل أستخدم نطاقي؟", "نعم. تخرج الرسائل من بريدك."]],
    },
  },
  consultants: {
    en: {
      who: "Independent consultants and small firms who sell expertise: strategy, finance, HR, operations or legal advice. You win on trust, and most of your work comes from a conversation.",
      pains: [{ t: "You are both the seller and the service", b: "Hours spent on delivery are hours not spent finding the next client." }, { t: "Your network runs out", b: "The people you know have already heard your offer." }, { t: "Selling yourself feels awkward", b: "Writing to strangers takes time and rarely gets done." }],
      audiences: [{ name: "Owners of mid-sized family businesses", target: "Companies of 20 to 200 employees in your country, owner or CEO" }, { name: "Heads of a function", target: "HR, finance or operations managers in your target industry" }, { name: "Growing companies", target: "Companies with Hiring now on, CEO or COO" }],
      email: { subject: "Your new branches and HR", body: "Hi Ahmed,\n\nCompanies at your size often reach a point where HR built for 30 people no longer fits 100. I help family businesses in Egypt fix that in a few weeks.\n\nCan I send you the short checklist I use, and take 15 minutes to go through it?\n\nMona" },
      plan: [["Day 1", "Write your method and who you've helped in Company Knowledge."], ["Day 2", "Set your booking page hours, then launch from $20 to one audience."], ["Weeks 1 to 2", "Reply yourself to the conversations that matter."], ["Weeks 3 to 4", "Add a second audience, and compare replies by job title."]],
      watch: ["Meetings held, not only booked", "Which title replies", "Conversations that need you"],
      faq: [["Will it sound like me?", "Set the tone and add notes. Yolias writes from your words, and you can read a sample first."], ["I only want a few clients. Is it for me?", "Yes. A small budget and a small audience work, and you control messages a day."], ["Can I approve replies?", "Replies that need you stop and wait. You can reply from any conversation."], ["Does it work in Arabic?", "Yes, in Arabic and English."]],
    },
    ar: {
      who: "الاستشاريون المستقلون والمكاتب الصغيرة التي تبيع الخبرة: الاستراتيجية أو المالية أو الموارد البشرية أو التشغيل أو القانون. تكسب بالثقة، ومعظم عملك يبدأ بمحادثة.",
      pains: [{ t: "أنت البائع والخدمة معًا", b: "ساعات التنفيذ تأتي على حساب إيجاد العميل التالي." }, { t: "شبكتك تنتهي", b: "من تعرفهم سمعوا عرضك بالفعل." }, { t: "تسويق نفسك صعب", b: "الكتابة لغرباء تأخذ وقتًا ونادرًا ما تتم." }],
      audiences: [{ name: "ملاك الشركات العائلية المتوسطة", target: "شركات من 20 إلى 200 موظف في بلدك، المالك أو الرئيس التنفيذي" }, { name: "قادة الأقسام", target: "مديرو الموارد البشرية أو المالية أو التشغيل في مجالك المستهدف" }, { name: "الشركات النامية", target: "شركات مفعّل فيها توظّف الآن، الرئيس التنفيذي أو مدير التشغيل" }],
      email: { subject: "فروعكم الجديدة والموارد البشرية", body: "أهلًا أحمد،\n\nالشركات في حجمكم تصل غالبًا إلى نقطة لا تناسب فيها إدارة 30 موظفًا عدد 100. أساعد الشركات العائلية في مصر على ضبط ذلك خلال أسابيع.\n\nهل أرسل لك القائمة القصيرة التي أستخدمها ونراجعها في 15 دقيقة؟\n\nمنى" },
      plan: [["اليوم 1", "اكتب منهجك ومن ساعدتهم في معرفة الشركة."], ["اليوم 2", "اضبط ساعات صفحة الحجز، وشغّل من 20 دولارًا لجمهور واحد."], ["الأسبوع 1 و2", "رد بنفسك على المحادثات المهمة."], ["الأسبوع 3 و4", "أضف جمهورًا ثانيًا، وقارن الردود حسب المسمى."]],
      watch: ["الاجتماعات المنعقدة لا المحجوزة فقط", "أي مسمى يرد", "المحادثات التي تحتاجك"],
      faq: [["هل سيبدو مثلي؟", "حدد الأسلوب وأضف ملاحظات. يكتب يولياس من كلماتك، وتقرأ رسالة تجريبية أولًا."], ["أريد عملاء قليلين. هل يناسبني؟", "نعم. تعمل ميزانية صغيرة وجمهور صغير، وتتحكم في عدد الرسائل."], ["هل أوافق على الردود؟", "الردود التي تحتاجك تتوقف وتنتظرك، ويمكنك الرد من أي محادثة."], ["هل يعمل بالعربية؟", "نعم، بالعربية والإنجليزية."]],
    },
  },
  "recruitment-agencies": {
    en: {
      who: "Recruitment and staffing agencies that place people in companies and need a steady flow of employers with open roles.",
      pains: [{ t: "Open roles go stale fast", b: "By the time you hear of a vacancy, three agencies have already called." }, { t: "HR inboxes are crowded", b: "Generic messages about your candidates get ignored." }, { t: "Business development gets dropped", b: "Recruiters are busy filling roles, so finding new clients waits." }],
      audiences: [{ name: "Companies hiring now", target: "Hiring now on, your cities, HR manager or head of talent" }, { name: "Fast growers", target: "A recent funding stage, founder or COO" }, { name: "A sector you know", target: "One industry you place for, hiring manager titles" }],
      email: { subject: "Your sales manager role", body: "Hi Reem,\n\nI saw the sales manager role you opened in Dubai. We place commercial leaders in the UAE, and have people available this month.\n\nWould it help if I sent two profiles? We only charge when you hire.\n\nTarek" },
      plan: [["Day 1", "Write the roles you fill and your terms in Company Knowledge."], ["Day 2", "Launch with Hiring now and the titles of those who decide."], ["Weeks 1 to 2", "Read replies daily: open roles move quickly."], ["Weeks 3 to 4", "Compare sectors and add the next city."]],
      watch: ["Replies from companies hiring now", "Meetings by sector", "Conversations that ask for profiles"],
      faq: [["How does Yolias know who is hiring?", "Hiring now in Signals targets companies with open roles, where the data shows them."], ["Can it send CVs?", "You can attach files when you reply in Conversations."], ["Can I exclude my current clients?", "Yes, with Companies never to contact."], ["Does it reach candidates too?", "Yolias is set up to reach the employers who hire you."]],
    },
    ar: {
      who: "وكالات التوظيف التي تضع الأشخاص في الشركات وتحتاج تدفقًا ثابتًا من أصحاب العمل الذين لديهم وظائف مفتوحة.",
      pains: [{ t: "تتقادم الوظائف بسرعة", b: "عندما تسمع عن وظيفة تكون ثلاث وكالات قد اتصلت بالفعل." }, { t: "بريد الموارد البشرية مزدحم", b: "الرسائل العامة عن مرشحيك تُتجاهل." }, { t: "يتأخر تطوير الأعمال", b: "ينشغل مسؤولو التوظيف بملء الوظائف فينتظر إيجاد عملاء جدد." }],
      audiences: [{ name: "شركات توظف الآن", target: "توظّف الآن مفعّل، مدنك، مدير الموارد البشرية أو مدير المواهب" }, { name: "الشركات سريعة النمو", target: "مرحلة تمويل حديثة، المؤسس أو مدير التشغيل" }, { name: "قطاع تعرفه", target: "مجال توظف له، مسميات مديري التوظيف" }],
      email: { subject: "وظيفة مدير المبيعات لديكم", body: "أهلًا ريم،\n\nرأيت وظيفة مدير المبيعات التي فتحتموها في دبي. نوظف قادة تجاريين في الإمارات ولدينا مرشحون متاحون هذا الشهر.\n\nهل يفيدك أن أرسل ملفين؟ لا نتقاضى إلا عند التعيين.\n\nطارق" },
      plan: [["اليوم 1", "اكتب الوظائف التي تملؤها وشروطك في معرفة الشركة."], ["اليوم 2", "شغّل الحملة بإشارة توظّف الآن ومسميات أصحاب القرار."], ["الأسبوع 1 و2", "اقرأ الردود يوميًا: الوظائف المفتوحة تتحرك بسرعة."], ["الأسبوع 3 و4", "قارن القطاعات وأضف المدينة التالية."]],
      watch: ["ردود الشركات الموظِّفة الآن", "الاجتماعات حسب القطاع", "المحادثات التي تطلب ملفات"],
      faq: [["كيف يعرف يولياس من يوظف؟", "يستهدف توظّف الآن في الإشارات الشركات ذات الوظائف المفتوحة حيث تظهرها البيانات."], ["هل يرسل السير الذاتية؟", "يمكنك إرفاق الملفات عند الرد في المحادثات."], ["هل أستبعد عملائي الحاليين؟", "نعم، من الشركات التي لا تريد التواصل معها."], ["هل يصل إلى المرشحين؟", "يولياس مهيأ للوصول إلى أصحاب العمل الذين يوظفونك."]],
    },
  },
  freelancers: {
    en: {
      who: "Freelancers in design, writing, video, development or marketing who want direct clients and more control than marketplaces give.",
      pains: [{ t: "Feast and famine", b: "One busy month, then nothing, because nobody finds clients while working for clients." }, { t: "Marketplaces take a cut and race on price", b: "You compete with hundreds of bids for one job." }, { t: "You have no sales team", b: "Writing to strangers after a day's work rarely happens." }],
      audiences: [{ name: "Small business owners", target: "Local companies of 1 to 50 employees, owner" }, { name: "Agencies that outsource", target: "Agencies in your field, founder or creative director" }, { name: "Startups without your skill", target: "Early startups, founder" }],
      email: { subject: "Your product page", body: "Hi Dina,\n\nI write product pages for online shops in Egypt. I read yours and I'd start with the first screen: it doesn't say who the product is for.\n\nWant me to send a short rewrite of that section, no charge?\n\nHana" },
      plan: [["Day 1", "Add your services, prices and two pieces of work to Company Knowledge."], ["Day 2", "Connect your mailbox and launch from $20."], ["Weeks 1 to 2", "Answer interested people quickly: small clients decide fast."], ["Weeks 3 to 4", "Top up only if the first test brought conversations."]],
      watch: ["Cost per reply on a small budget", "Which offer gets answers", "Spend against one project's value"],
      faq: [["Is $20 enough?", "It reaches 200 people, enough to test an offer and an audience."], ["Do I need a company?", "No. Anyone with a business can use Yolias, including one person."], ["Do I need my own domain?", "It's better for delivery, but Gmail works."], ["Can I stop any time?", "Yes. There's no subscription on Pay As You Go."]],
    },
    ar: {
      who: "المستقلون في التصميم والكتابة والفيديو والبرمجة والتسويق الذين يريدون عملاء مباشرين وتحكمًا أكبر مما تعطيه المنصات.",
      pains: [{ t: "شهر مزدحم ثم لا شيء", b: "لأن لا أحد يجد عملاء وهو يعمل لعملائه." }, { t: "المنصات تأخذ نسبة وتضغط السعر", b: "تنافس مئات العروض على عمل واحد." }, { t: "ليس لديك فريق مبيعات", b: "الكتابة لغرباء بعد يوم عمل نادرًا ما تحدث." }],
      audiences: [{ name: "أصحاب الأعمال الصغيرة", target: "شركات محلية من 1 إلى 50 موظفًا، المالك" }, { name: "وكالات تسند العمل", target: "وكالات في مجالك، المؤسس أو المدير الإبداعي" }, { name: "شركات ناشئة تنقصها مهارتك", target: "شركات ناشئة، المؤسس" }],
      email: { subject: "صفحة منتجكم", body: "أهلًا دينا،\n\nأكتب صفحات المنتجات للمتاجر في مصر. قرأت صفحتكم وأبدأ بالشاشة الأولى: لا توضح لمن المنتج.\n\nهل أرسل إعادة كتابة قصيرة لهذا الجزء بدون مقابل؟\n\nهناء" },
      plan: [["اليوم 1", "أضف خدماتك وأسعارك وعملين إلى معرفة الشركة."], ["اليوم 2", "اربط بريدك وشغّل من 20 دولارًا."], ["الأسبوع 1 و2", "رد على المهتمين بسرعة: العميل الصغير يقرر بسرعة."], ["الأسبوع 3 و4", "اشحن فقط إذا جاءت التجربة الأولى بمحادثات."]],
      watch: ["تكلفة الرد بميزانية صغيرة", "أي عرض يحصل على إجابات", "الإنفاق مقارنة بقيمة مشروع واحد"],
      faq: [["هل 20 دولارًا تكفي؟", "تصل إلى 200 شخص، وهذا يكفي لتجربة عرض وجمهور."], ["هل أحتاج شركة؟", "لا. يستخدم يولياس أي شخص لديه نشاط، حتى شخص واحد."], ["هل أحتاج نطاقي؟", "أفضل للوصول، لكن Gmail يعمل."], ["هل أتوقف في أي وقت؟", "نعم. لا يوجد اشتراك في الدفع حسب الاستخدام."]],
    },
  },
  "real-estate": {
    en: {
      who: "Real estate brokers, developers and commercial agents who sell or lease to companies and investors, and work with high-value deals.",
      pains: [{ t: "Portals send everyone the same leads", b: "Every agent calls the same person within minutes." }, { t: "Ads reach people who can't buy", b: "A property ad shows to thousands who were never in the market." }, { t: "Companies aren't on portals", b: "A business that needs an office isn't searching listings today." }],
      audiences: [{ name: "Companies opening offices", target: "Companies hiring in your city, CEO or operations manager" }, { name: "Family offices and investors", target: "Investment titles in your markets" }, { name: "Retail chains expanding", target: "Retail and restaurant groups, expansion or real estate manager" }],
      email: { subject: "Office space in New Cairo", body: "Hi Mahmoud,\n\nI saw your team is growing in Cairo. We lease fitted offices in New Cairo, with short terms for companies that aren't sure of their final size.\n\nWould a 15-minute viewing next week work?\n\nYara" },
      plan: [["Day 1", "Add your listings and terms to Company Knowledge."], ["Day 2", "Launch by city and by company size."], ["Weeks 1 to 2", "Set your booking page for viewings or calls."], ["Weeks 3 to 4", "Keep the audience that books viewings."]],
      watch: ["Meetings by city", "Replies by company size", "Cost per meeting against one commission"],
      faq: [["Does it work for homes too?", "It reaches companies and professionals, so it fits commercial best."], ["Can I target one area?", "Yes: countries, regions and cities, included or excluded."], ["Can it send listing PDFs?", "You can attach files when you reply."], ["What language does it use?", "Arabic, English, or each person's language."]],
    },
    ar: {
      who: "وسطاء العقارات والمطورون والوكلاء التجاريون الذين يبيعون أو يؤجرون لشركات ومستثمرين ويعملون بصفقات عالية القيمة.",
      pains: [{ t: "البوابات ترسل الجميع إلى العميل نفسه", b: "كل وكيل يتصل بالشخص نفسه خلال دقائق." }, { t: "الإعلانات تصل إلى من لا يشتري", b: "يظهر إعلان العقار لآلاف لم يكونوا في السوق." }, { t: "الشركات ليست على البوابات", b: "الشركة التي تحتاج مكتبًا لا تبحث في القوائم اليوم." }],
      audiences: [{ name: "شركات تفتتح مكاتب", target: "شركات توظف في مدينتك، الرئيس التنفيذي أو مدير التشغيل" }, { name: "المكاتب العائلية والمستثمرون", target: "مسميات الاستثمار في أسواقك" }, { name: "سلاسل تتوسع", target: "مجموعات التجزئة والمطاعم، مدير التوسع أو العقارات" }],
      email: { subject: "مساحة مكتبية في القاهرة الجديدة", body: "أهلًا محمود،\n\nرأيت أن فريقكم ينمو في القاهرة. نؤجر مكاتب مجهزة في القاهرة الجديدة بمدد قصيرة للشركات التي لم تحدد حجمها النهائي.\n\nهل تناسبك معاينة 15 دقيقة الأسبوع القادم؟\n\nيارا" },
      plan: [["اليوم 1", "أضف وحداتك وشروطك إلى معرفة الشركة."], ["اليوم 2", "شغّل الحملة حسب المدينة وحجم الشركة."], ["الأسبوع 1 و2", "اضبط صفحة الحجز للمعاينات أو المكالمات."], ["الأسبوع 3 و4", "أبقِ الجمهور الذي يحجز المعاينات."]],
      watch: ["الاجتماعات حسب المدينة", "الردود حسب حجم الشركة", "تكلفة الاجتماع مقارنة بعمولة واحدة"],
      faq: [["هل يعمل للمنازل؟", "يصل إلى الشركات والمهنيين، فهو أنسب للتجاري."], ["هل أستهدف منطقة واحدة؟", "نعم: الدول والمناطق والمدن تضمينًا أو استبعادًا."], ["هل يرسل ملفات الوحدات؟", "يمكنك إرفاق الملفات عند الرد."], ["بأي لغة يكتب؟", "العربية أو الإنجليزية أو لغة كل شخص."]],
    },
  },
  "sales-teams": {
    en: {
      who: "Sales teams that need more meetings for their closers, without adding people to research and write all day.",
      pains: [{ t: "Reps spend the day on lists", b: "Time goes on research and writing instead of selling." }, { t: "Follow-up depends on memory", b: "Most deals need several touches, and busy reps forget." }, { t: "Managers can't compare sources", b: "Nobody knows which market or title gives the cheapest meeting." }],
      audiences: [{ name: "Your best-fit accounts", target: "Your industry, size and country, the buyer's title" }, { name: "A lookalike of your customers", target: "A lookalike from your won customers" }, { name: "A new market test", target: "One new country with the same titles" }],
      email: { subject: "Your Q1 expansion in KSA", body: "Hi Faisal,\n\nI saw you're adding sales roles in Riyadh. We help teams like yours cut the time from first meeting to signed contract.\n\nWorth comparing notes for 20 minutes next week?\n\nNour" },
      plan: [["Day 1", "Invite your team and let each rep connect a mailbox."], ["Day 2", "Create one campaign per rep, each with its audiences."], ["Weeks 1 to 2", "Reps take the conversations that need them."], ["Weeks 3 to 4", "Read cost per meeting by owner and by audience."]],
      watch: ["Meetings by owner", "Cost per meeting by market", "Show rate"],
      faq: [["Can each rep use their own mailbox?", "Yes, and the Owner column shows who created each campaign."], ["Do two reps contact one person?", "No. One person is never written to by two campaigns at once."], ["Can we export results?", "Yes, as CSV or Excel."], ["Who sees what?", "Admin, Advertiser and Analyst roles decide it."]],
    },
    ar: {
      who: "فرق المبيعات التي تحتاج اجتماعات أكثر لمغلقيها، دون إضافة أشخاص للبحث والكتابة طوال اليوم.",
      pains: [{ t: "يقضي المندوب يومه في القوائم", b: "يذهب الوقت في البحث والكتابة بدل البيع." }, { t: "المتابعة تعتمد على الذاكرة", b: "معظم الصفقات تحتاج عدة تواصلات، والمندوب المشغول ينسى." }, { t: "المدير لا يقارن المصادر", b: "لا أحد يعرف أي سوق أو مسمى يعطي أرخص اجتماع." }],
      audiences: [{ name: "حساباتك الأنسب", target: "مجالك وحجمك وبلدك، مسمى المشتري" }, { name: "مشابه لعملائك", target: "جمهور مشابه من عملائك المكسوبين" }, { name: "تجربة سوق جديد", target: "بلد جديد بالمسميات نفسها" }],
      email: { subject: "توسعكم في السعودية", body: "أهلًا فيصل،\n\nرأيت أنكم تضيفون وظائف مبيعات في الرياض. نساعد فرقًا مثلكم على تقليل الوقت من أول اجتماع إلى العقد.\n\nهل نتبادل الآراء 20 دقيقة الأسبوع القادم؟\n\nنور" },
      plan: [["اليوم 1", "ادعُ فريقك ودع كل مندوب يربط بريده."], ["اليوم 2", "أنشئ حملة لكل مندوب بجماهيرها."], ["الأسبوع 1 و2", "يتولى المندوبون المحادثات التي تحتاجهم."], ["الأسبوع 3 و4", "اقرأ تكلفة الاجتماع حسب المالك والجمهور."]],
      watch: ["الاجتماعات حسب المالك", "تكلفة الاجتماع حسب السوق", "نسبة الحضور"],
      faq: [["هل يستخدم كل مندوب بريده؟", "نعم، ويعرض عمود المالك من أنشأ كل حملة."], ["هل يتواصل مندوبان مع شخص واحد؟", "لا. لا يكتب لشخص واحد حملتان في وقت واحد."], ["هل نصدر النتائج؟", "نعم، CSV أو Excel."], ["من يرى ماذا؟", "تحدد ذلك أدوار المدير والمعلن والمحلل."]],
    },
  },
  "web-design-agencies": {
    en: {
      who: "Web design studios and freelancers who build sites for businesses and want clients who need a site now, not someday.",
      pains: [{ t: "Clients don't know they need you", b: "An outdated site doesn't hurt until someone points it out." }, { t: "Price shopping", b: "Buyers compare you with cheap templates." }, { t: "Work comes in waves", b: "A busy launch month is followed by an empty one." }],
      audiences: [{ name: "Local businesses with old sites", target: "Clinics, restaurants and shops in your city, owner" }, { name: "Companies using a platform you know", target: "Technologies they use, marketing manager" }, { name: "New companies", target: "Young companies in your market, founder" }],
      email: { subject: "Booking on your site", body: "Hi Sami,\n\nI tried to book at your clinic from my phone and couldn't find the button on the first screen. We build sites for clinics that make booking the first thing people see.\n\nWant a short video of what I'd change?\n\nLaila" },
      plan: [["Day 1", "Add your work and starting prices to Company Knowledge."], ["Day 2", "Launch one audience per city."], ["Weeks 1 to 2", "Reply with examples from your portfolio."], ["Weeks 3 to 4", "Keep the business type that books meetings."]],
      watch: ["Replies by business type", "Meetings by city", "Which offer gets answers"],
      faq: [["Can I mention their website?", "Yes. Yolias writes from what it finds about each person and company."], ["Can I send my portfolio?", "Attach files when you reply, or add its link to Company Knowledge."], ["Is it for small studios?", "Yes. You can start from $20."], ["Can I choose the cities?", "Yes, by country, region and city."]],
    },
    ar: {
      who: "استوديوهات تصميم المواقع والمستقلون الذين يبنون مواقع للأعمال ويريدون عملاء يحتاجون موقعًا الآن.",
      pains: [{ t: "العميل لا يعرف أنه يحتاجك", b: "الموقع القديم لا يؤلم حتى يخبره أحد." }, { t: "المقارنة بالسعر", b: "يقارنك المشترون بقوالب رخيصة." }, { t: "العمل يأتي موجات", b: "يتبع شهر الإطلاق المزدحم شهر فارغ." }],
      audiences: [{ name: "أعمال محلية بمواقع قديمة", target: "عيادات ومطاعم ومحلات في مدينتك، المالك" }, { name: "شركات على منصة تعرفها", target: "التقنيات التي يستخدمونها، مدير التسويق" }, { name: "شركات جديدة", target: "شركات حديثة في سوقك، المؤسس" }],
      email: { subject: "الحجز في موقعكم", body: "أهلًا سامي،\n\nحاولت الحجز في عيادتكم من الهاتف ولم أجد الزر في الشاشة الأولى. نبني مواقع للعيادات تجعل الحجز أول ما يراه الناس.\n\nهل أرسل فيديو قصيرًا بما سأغيره؟\n\nليلى" },
      plan: [["اليوم 1", "أضف أعمالك وأسعارك الأولى إلى معرفة الشركة."], ["اليوم 2", "شغّل جمهورًا لكل مدينة."], ["الأسبوع 1 و2", "رد بأمثلة من أعمالك."], ["الأسبوع 3 و4", "أبقِ نوع النشاط الذي يحجز اجتماعات."]],
      watch: ["الردود حسب نوع النشاط", "الاجتماعات حسب المدينة", "أي عرض يحصل على إجابات"],
      faq: [["هل أذكر موقعهم؟", "نعم. يكتب يولياس مما يجده عن كل شخص وشركة."], ["هل أرسل أعمالي؟", "أرفق الملفات عند الرد، أو أضف رابطها إلى معرفة الشركة."], ["هل يناسب الاستوديوهات الصغيرة؟", "نعم. تبدأ من 20 دولارًا."], ["هل أختار المدن؟", "نعم، حسب الدولة والمنطقة والمدينة."]],
    },
  },
  "seo-agencies": {
    en: {
      who: "SEO agencies and consultants who sell monthly retainers and need businesses that already understand search brings customers.",
      pains: [{ t: "SEO is hard to sell cold", b: "Results take months, so trust has to come first." }, { t: "Everyone promises page one", b: "Owners have heard it, and stopped listening." }, { t: "Clients leave quietly", b: "A retainer ends and there's no pipeline behind it." }],
      audiences: [{ name: "E-commerce stores", target: "Online stores in your markets, founder or head of marketing" }, { name: "Clinics and local services", target: "Multi-branch services in your cities, owner" }, { name: "Marketing managers", target: "Companies hiring in marketing, marketing manager" }],
      email: { subject: "Your clinic pages in Jeddah", body: "Hi Hala,\n\nI searched for dental implants in Jeddah. Your competitors show first and your implant page doesn't appear. It's usually a fixable page structure issue.\n\nWant the three changes I'd start with?\n\nYoussef" },
      plan: [["Day 1", "Describe your method in Company Knowledge, without promises you can't keep."], ["Day 2", "Launch two audiences by business type."], ["Weeks 1 to 2", "Reply with a short audit when someone's interested."], ["Weeks 3 to 4", "Keep what books calls, and add a new vertical."]],
      watch: ["Replies by vertical", "Cost per meeting", "Interested replies that ask for an audit"],
      faq: [["Can Yolias run an audit?", "No. It starts the conversation; you do the audit."], ["Can it target businesses using a technology?", "Yes, under Technologies they use."], ["Will it make ranking promises?", "It says only what's in your Company Knowledge."], ["How long until results?", "You can read replies within the first weeks. The result depends on your market and offer."]],
    },
    ar: {
      who: "وكالات ومستشارو SEO الذين يبيعون عقودًا شهرية ويحتاجون أعمالًا تفهم أن البحث يأتي بالعملاء.",
      pains: [{ t: "يصعب بيع SEO باردًا", b: "النتائج تأخذ أشهرًا، فالثقة تأتي أولًا." }, { t: "الجميع يعد بالصفحة الأولى", b: "سمعها الملاك وتوقفوا عن الإصغاء." }, { t: "يغادر العملاء بهدوء", b: "ينتهي العقد ولا شيء خلفه." }],
      audiences: [{ name: "المتاجر الإلكترونية", target: "متاجر في أسواقك، المؤسس أو مدير التسويق" }, { name: "العيادات والخدمات المحلية", target: "خدمات متعددة الفروع في مدنك، المالك" }, { name: "مديرو التسويق", target: "شركات توظف في التسويق، مدير التسويق" }],
      email: { subject: "صفحات عيادتكم في جدة", body: "أهلًا هالة،\n\nبحثت عن زراعة الأسنان في جدة. يظهر منافسوكم أولًا ولا تظهر صفحتكم، وهذه عادة مشكلة هيكل صفحة يمكن إصلاحها.\n\nهل تريدين التغييرات الثلاثة التي أبدأ بها؟\n\nيوسف" },
      plan: [["اليوم 1", "صف منهجك في معرفة الشركة دون وعود لا تضمنها."], ["اليوم 2", "شغّل جمهورين حسب نوع النشاط."], ["الأسبوع 1 و2", "رد بتحليل قصير عند اهتمام أحدهم."], ["الأسبوع 3 و4", "أبقِ ما يحجز مكالمات، وأضف مجالًا جديدًا."]],
      watch: ["الردود حسب المجال", "تكلفة الاجتماع", "الردود التي تطلب تحليلًا"],
      faq: [["هل يجري يولياس التحليل؟", "لا. يبدأ المحادثة وأنت تجري التحليل."], ["هل يستهدف حسب التقنية؟", "نعم، في التقنيات التي يستخدمونها."], ["هل يعد بترتيب؟", "يقول فقط ما في معرفة شركتك."], ["متى تظهر النتائج؟", "تقرأ الردود في الأسابيع الأولى، وتعتمد النتيجة على سوقك وعرضك."]],
    },
  },
  "it-services": {
    en: {
      who: "IT service providers and managed service companies that sell support, security or cloud contracts to businesses.",
      pains: [{ t: "Buyers call only when something breaks", b: "Until then, IT isn't a priority." }, { t: "Long contracts, slow decisions", b: "One deal takes many touches." }, { t: "Technical offers are hard to explain", b: "Owners don't buy firewalls, they buy no downtime." }],
      audiences: [{ name: "Companies without an IT team", target: "20 to 200 employees, owner or operations manager" }, { name: "IT managers", target: "IT manager titles in your target industries" }, { name: "Regulated sectors", target: "Healthcare or finance companies, compliance or IT manager" }],
      email: { subject: "When your server goes down", body: "Hi Nader,\n\nFor a company your size, one day of downtime usually costs more than a year of support. We run IT for companies in Cairo with a fixed monthly price.\n\nWould a 15-minute review of your setup be useful?\n\nKarim" },
      plan: [["Day 1", "Translate your services into outcomes in Company Knowledge."], ["Day 2", "Launch to companies without an IT team."], ["Weeks 1 to 2", "Let Yolias follow up: these deals need patience."], ["Weeks 3 to 4", "Compare owners against IT managers."]],
      watch: ["Replies by title", "Meetings by sector", "Show rate"],
      faq: [["Can I target by technology?", "Yes, under Technologies they use."], ["Does it follow up?", "Twice if there's no reply, in your hours."], ["Can I exclude existing clients?", "Yes, with Companies never to contact."], ["Can it book assessments?", "Set one as a meeting type on your booking page."]],
    },
    ar: {
      who: "مزودو خدمات تقنية المعلومات والخدمات المدارة الذين يبيعون عقود الدعم أو الأمن أو السحابة للشركات.",
      pains: [{ t: "يتصل المشتري فقط عند العطل", b: "حتى ذلك الوقت لا تكون التقنية أولوية." }, { t: "عقود طويلة وقرارات بطيئة", b: "تحتاج الصفقة تواصلات كثيرة." }, { t: "يصعب شرح العروض التقنية", b: "المالك لا يشتري جدارًا ناريًا، يشتري عدم التوقف." }],
      audiences: [{ name: "شركات بلا فريق تقني", target: "من 20 إلى 200 موظف، المالك أو مدير التشغيل" }, { name: "مديرو تقنية المعلومات", target: "مسميات مدير تقنية المعلومات في مجالاتك" }, { name: "قطاعات منظمة", target: "شركات صحية أو مالية، مدير الامتثال أو التقنية" }],
      email: { subject: "عندما يتوقف الخادم", body: "أهلًا نادر،\n\nفي شركة بحجمكم يكلف يوم توقف واحد عادة أكثر من عام دعم. ندير تقنية الشركات في القاهرة بسعر شهري ثابت.\n\nهل تفيدك مراجعة 15 دقيقة لوضعكم؟\n\nكريم" },
      plan: [["اليوم 1", "حوّل خدماتك إلى نتائج في معرفة الشركة."], ["اليوم 2", "شغّل الحملة للشركات بلا فريق تقني."], ["الأسبوع 1 و2", "دع يولياس يتابع: هذه الصفقات تحتاج صبرًا."], ["الأسبوع 3 و4", "قارن الملاك بمديري التقنية."]],
      watch: ["الردود حسب المسمى", "الاجتماعات حسب القطاع", "نسبة الحضور"],
      faq: [["هل أستهدف حسب التقنية؟", "نعم، في التقنيات التي يستخدمونها."], ["هل يتابع؟", "مرتين إذا لم يصل رد، في ساعاتك."], ["هل أستبعد عملائي؟", "نعم، من الشركات التي لا تريد التواصل معها."], ["هل يحجز التقييمات؟", "اجعلها نوع اجتماع في صفحة الحجز."]],
    },
  },
  saas: {
    en: {
      who: "SaaS companies at an early or growing stage, where founders still sell, or a small team needs demos.",
      pains: [{ t: "Founders run sales alone", b: "Building and selling compete for the same hours." }, { t: "Ads are expensive early", b: "Without volume, paid clicks burn budget before you learn anything." }, { t: "You don't know your best segment yet", b: "Every market feels possible." }],
      audiences: [{ name: "Your first segment", target: "One industry and size, the user's manager" }, { name: "A second segment", target: "Another industry, same titles" }, { name: "Users of a competitor", target: "Technologies they use, head of the team" }],
      email: { subject: "Your team's weekly report", body: "Hi Rania,\n\nOperations teams your size often spend half a day building one report. Our product builds it from your data every Monday.\n\nOpen to a 15-minute demo?\n\nAdam" },
      plan: [["Day 1", "Add your product, pricing and customers to Company Knowledge."], ["Day 2", "Launch two segments, with your demo as the meeting."], ["Weeks 1 to 2", "Read how people describe the problem."], ["Weeks 3 to 4", "Pick the segment with the cheapest demo."]],
      watch: ["Cost per demo by segment", "Objections in replies", "Signups and Checkout from the pixel"],
      faq: [["Can I measure trial signups?", "Yes. Install the pixel and send CompleteRegistration and Activated."], ["Meetings or signups?", "Use Meetings for demos and Sales for self-serve."], ["Can I target a competitor's users?", "Use Technologies they use where the data shows them."], ["Is it good for founders?", "Yes. Build with Yolias fills a campaign from your knowledge."]],
    },
    ar: {
      who: "شركات SaaS في مرحلة مبكرة أو نامية، حيث يبيع المؤسسون بأنفسهم أو يحتاج فريق صغير إلى عروض توضيحية.",
      pains: [{ t: "المؤسس يبيع وحده", b: "البناء والبيع يتنافسان على الساعات نفسها." }, { t: "الإعلانات مكلفة مبكرًا", b: "من دون حجم تحرق النقرات الميزانية قبل أن تتعلم." }, { t: "لا تعرف أفضل شريحة بعد", b: "كل سوق يبدو ممكنًا." }],
      audiences: [{ name: "شريحتك الأولى", target: "مجال وحجم واحد، مدير المستخدم" }, { name: "شريحة ثانية", target: "مجال آخر بالمسميات نفسها" }, { name: "مستخدمو منافس", target: "التقنيات التي يستخدمونها، رئيس الفريق" }],
      email: { subject: "تقرير فريقكم الأسبوعي", body: "أهلًا رانيا،\n\nتقضي فرق التشغيل في حجمكم نصف يوم في بناء تقرير واحد. يبنيه منتجنا من بياناتكم كل اثنين.\n\nهل يناسبك عرض 15 دقيقة؟\n\nآدم" },
      plan: [["اليوم 1", "أضف منتجك وأسعارك وعملاءك إلى معرفة الشركة."], ["اليوم 2", "شغّل شريحتين، والاجتماع هو العرض التوضيحي."], ["الأسبوع 1 و2", "اقرأ كيف يصف الناس المشكلة."], ["الأسبوع 3 و4", "اختر الشريحة بأرخص عرض."]],
      watch: ["تكلفة العرض لكل شريحة", "الاعتراضات في الردود", "التسجيلات وبدء الدفع من البيكسل"],
      faq: [["هل أقيس تسجيلات التجربة؟", "نعم. ثبّت البيكسل وأرسل CompleteRegistration وActivated."], ["اجتماعات أم تسجيلات؟", "استخدم الاجتماعات للعروض والمبيعات للتسجيل الذاتي."], ["هل أستهدف مستخدمي منافس؟", "استخدم التقنيات التي يستخدمونها حيث تظهرها البيانات."], ["هل يناسب المؤسسين؟", "نعم. يملأ أنشئ مع يولياس حملة من معرفتك."]],
    },
  },
  founders: {
    en: {
      who: "Founders who sell by themselves in the early days and need their first customers without hiring a sales team.",
      pains: [{ t: "Sales waits until the product is ready", b: "It's never fully ready, so nobody hears about it." }, { t: "No team, no budget for a tool stack", b: "Five subscriptions cost more than your first customer pays." }, { t: "You don't know who buys", b: "You need answers from real people, fast." }],
      audiences: [{ name: "Your first guess", target: "The clearest buyer you can describe" }, { name: "A second guess", target: "A different title in the same market" }, { name: "Your network's lookalike", target: "A lookalike from your first customers" }],
      email: { subject: "A quick question about your invoices", body: "Hi Salma,\n\nI'm building a tool for clinics that lose time on insurance claims. Before I go further: is it a real problem for you?\n\nA two-line answer would help a lot.\n\nMazen" },
      plan: [["Day 1", "Let Yolias read your site, and correct Company Knowledge."], ["Day 2", "Choose Build with Yolias and launch from $20."], ["Weeks 1 to 2", "Read every reply yourself: this is your market research."], ["Weeks 3 to 4", "Rewrite your offer from their words and test again."]],
      watch: ["Replies, more than meetings at first", "The words people use", "Which title answers"],
      faq: [["I have no customers yet. Can I use it?", "Yes. Describe who you want to reach, and Yolias starts from there."], ["How much do I need?", "$20 is enough for a first test."], ["Can I do this alone?", "Yes. Yolias handles the routine and hands you what needs you."], ["Do I need a website?", "It helps Yolias learn your business, and you can also write it yourself."]],
    },
    ar: {
      who: "المؤسسون الذين يبيعون بأنفسهم في البداية ويحتاجون أول عملائهم دون توظيف فريق مبيعات.",
      pains: [{ t: "البيع ينتظر اكتمال المنتج", b: "لا يكتمل أبدًا، فلا يسمع عنه أحد." }, { t: "لا فريق ولا ميزانية أدوات", b: "خمسة اشتراكات تكلف أكثر مما يدفعه عميلك الأول." }, { t: "لا تعرف من يشتري", b: "تحتاج إجابات من أشخاص حقيقيين بسرعة." }],
      audiences: [{ name: "تخمينك الأول", target: "أوضح مشترٍ تستطيع وصفه" }, { name: "تخمين ثانٍ", target: "مسمى مختلف في السوق نفسه" }, { name: "مشابه لعملائك الأوائل", target: "جمهور مشابه من أول عملائك" }],
      email: { subject: "سؤال سريع عن فواتيركم", body: "أهلًا سلمى،\n\nأبني أداة للعيادات التي تضيع وقتها في مطالبات التأمين. قبل أن أكمل: هل هذه مشكلة حقيقية لديكم؟\n\nإجابة من سطرين تفيدني كثيرًا.\n\nمازن" },
      plan: [["اليوم 1", "دع يولياس يقرأ موقعك وصحح معرفة الشركة."], ["اليوم 2", "اختر أنشئ مع يولياس وشغّل من 20 دولارًا."], ["الأسبوع 1 و2", "اقرأ كل رد بنفسك: هذا بحث سوقك."], ["الأسبوع 3 و4", "أعد كتابة عرضك من كلماتهم وجرّب مجددًا."]],
      watch: ["الردود قبل الاجتماعات في البداية", "الكلمات التي يستخدمها الناس", "أي مسمى يرد"],
      faq: [["ليس لدي عملاء بعد. هل أستخدمه؟", "نعم. صف من تريد الوصول إليهم ويبدأ يولياس من هناك."], ["كم أحتاج؟", "20 دولارًا تكفي لتجربة أولى."], ["هل أعمل وحدي؟", "نعم. يتولى يولياس المعتاد ويسلمك ما يحتاجك."], ["هل أحتاج موقعًا؟", "يساعد يولياس على فهم نشاطك، ويمكنك الكتابة بنفسك."]],
    },
  },
  "service-providers": {
    en: {
      who: "Service businesses such as accountants, trainers, cleaners, photographers, lawyers and contractors that serve other businesses.",
      pains: [{ t: "Word of mouth has a ceiling", b: "It brings what it brings, and you can't turn it up." }, { t: "Ads bring the wrong calls", b: "Price shoppers fill the phone." }, { t: "No time to sell", b: "You're on site all day." }],
      audiences: [{ name: "Local companies", target: "Your cities, 10 to 200 employees, owner or office manager" }, { name: "A sector you serve well", target: "One industry, the manager who buys your service" }, { name: "New businesses", target: "Young companies in your area, founder" }],
      email: { subject: "Your VAT filing", body: "Hi Basma,\n\nWe handle accounts and VAT for small companies in Riyadh, at a fixed monthly fee, so you never chase a deadline.\n\nCan I send a one-page summary of what's included?\n\nAli" },
      plan: [["Day 1", "Write your service, area and prices in Company Knowledge."], ["Day 2", "Launch to your city from $20."], ["Weeks 1 to 2", "Yolias answers the usual questions."], ["Weeks 3 to 4", "Add the next area."]],
      watch: ["Meetings by area", "Replies that ask for prices", "Cost per meeting"],
      faq: [["I serve one city. Is it enough?", "Yes. Choose that city, and Yolias reaches only there."], ["Can customers book a visit?", "Yes, through your booking page."], ["Do I need technical skills?", "No. Build with Yolias fills the campaign."], ["Can I pause during busy months?", "Yes, with the on/off switch."]],
    },
    ar: {
      who: "أعمال الخدمات مثل المحاسبين والمدربين وشركات النظافة والمصورين والمحامين والمقاولين التي تخدم أعمالًا أخرى.",
      pains: [{ t: "للتوصيات سقف", b: "تأتي بما تأتي به ولا تستطيع زيادتها." }, { t: "الإعلانات تأتي بمكالمات خاطئة", b: "الباحثون عن السعر يملؤون الهاتف." }, { t: "لا وقت للبيع", b: "أنت في الموقع طوال اليوم." }],
      audiences: [{ name: "شركات محلية", target: "مدنك، من 10 إلى 200 موظف، المالك أو مدير المكتب" }, { name: "قطاع تخدمه جيدًا", target: "مجال واحد، المدير الذي يشتري خدمتك" }, { name: "أعمال جديدة", target: "شركات حديثة في منطقتك، المؤسس" }],
      email: { subject: "إقرار الضريبة لديكم", body: "أهلًا بسمة،\n\nنتولى الحسابات والضريبة للشركات الصغيرة في الرياض بأتعاب شهرية ثابتة، فلا تطاردين أي موعد.\n\nهل أرسل صفحة واحدة بما تشمله الخدمة؟\n\nعلي" },
      plan: [["اليوم 1", "اكتب خدمتك ومنطقتك وأسعارك في معرفة الشركة."], ["اليوم 2", "شغّل لمدينتك من 20 دولارًا."], ["الأسبوع 1 و2", "يجيب يولياس عن الأسئلة المعتادة."], ["الأسبوع 3 و4", "أضف المنطقة التالية."]],
      watch: ["الاجتماعات حسب المنطقة", "الردود التي تسأل عن السعر", "تكلفة الاجتماع"],
      faq: [["أخدم مدينة واحدة. هل يكفي؟", "نعم. اختر المدينة ويصل يولياس إليها فقط."], ["هل يحجز العميل زيارة؟", "نعم، من صفحة الحجز."], ["هل أحتاج مهارة تقنية؟", "لا. يملأ أنشئ مع يولياس الحملة."], ["هل أوقف في الأشهر المزدحمة؟", "نعم، بمفتاح التشغيل."]],
    },
  },
  "sales-meeting-booking": {
    en: {
      who: "Teams that want interested people to move to a booked meeting without the back-and-forth over times.",
      pains: [{ t: "Interest cools in hours", b: "A slow reply loses the moment." }, { t: "Scheduling takes several emails", b: "Each one is a chance to drop off." }, { t: "No-shows waste the day", b: "A meeting booked weeks away is easily forgotten." }],
      audiences: [{ name: "People who replied before", target: "A custom audience of interested people" }, { name: "Your usual buyers", target: "Your target titles and markets" }, { name: "Visitors who didn't book", target: "A custom audience from a past campaign" }],
      email: { subject: "Tuesday or Wednesday?", body: "Hi Yasmin,\n\nGlad it's useful. I have Tuesday at 11:00 or Wednesday at 14:00 Riyadh time. If neither works, pick any time here: {your booking link}\n\nOmar" },
      plan: [["Day 1", "Set your hours, meeting types and location, and connect Google Calendar."], ["Day 2", "Launch a Meetings campaign."], ["Weeks 1 to 2", "Watch Link visits: who opened and who didn't book."], ["Weeks 3 to 4", "Write to those who started and stopped."]],
      watch: ["Visit-to-booking rate", "Show rate", "Started, didn't book"],
      faq: [["Does it book by itself?", "If someone names a free time, Yolias books and confirms."], ["Does it avoid my busy times?", "Yes, with Google Calendar connected."], ["Are there reminders?", "Guests get one a day and one an hour before."], ["Does it create a video link?", "You set the place or link on your booking page."]],
    },
    ar: {
      who: "الفرق التي تريد انتقال المهتمين إلى اجتماع محجوز دون ذهاب وعودة حول المواعيد.",
      pains: [{ t: "يبرد الاهتمام خلال ساعات", b: "الرد البطيء يضيع اللحظة." }, { t: "الجدولة تأخذ رسائل كثيرة", b: "وكل رسالة فرصة للتوقف." }, { t: "عدم الحضور يضيع اليوم", b: "الموعد البعيد يُنسى بسهولة." }],
      audiences: [{ name: "من ردوا سابقًا", target: "جمهور مخصص من المهتمين" }, { name: "مشتروك المعتادون", target: "مسمياتك وأسواقك المستهدفة" }, { name: "زوار لم يحجزوا", target: "جمهور مخصص من حملة سابقة" }],
      email: { subject: "الثلاثاء أم الأربعاء؟", body: "أهلًا ياسمين،\n\nسعيد أنه مفيد. لدي الثلاثاء 11:00 أو الأربعاء 14:00 بتوقيت الرياض. وإذا لم يناسبك اختاري أي وقت من هنا: {رابط الحجز}\n\nعمر" },
      plan: [["اليوم 1", "اضبط ساعاتك وأنواع الاجتماعات والمكان، واربط تقويم Google."], ["اليوم 2", "شغّل حملة اجتماعات."], ["الأسبوع 1 و2", "راقب زيارات الرابط: من فتح ومن لم يحجز."], ["الأسبوع 3 و4", "اكتب لمن بدأوا ولم يكملوا."]],
      watch: ["نسبة الحجز من الزيارات", "نسبة الحضور", "بدأوا ولم يكملوا"],
      faq: [["هل يحجز وحده؟", "إذا ذكر الشخص وقتًا متاحًا يحجزه يولياس ويؤكده."], ["هل يتجنب أوقات انشغالي؟", "نعم، مع ربط تقويم Google."], ["هل توجد تذكيرات؟", "يستلم الضيف تذكيرًا قبل يوم وقبل ساعة."], ["هل ينشئ رابط فيديو؟", "أنت تحدد المكان أو الرابط في صفحة الحجز."]],
    },
  },
  "booking-page": {
    en: {
      who: "Anyone who takes meetings with customers and wants a booking page connected to their campaigns and results.",
      pains: [{ t: "A booking tool knows nothing about the campaign", b: "You can't tell which campaign brought the meeting." }, { t: "Another subscription", b: "Booking is one more tool to pay for and connect." }, { t: "Started, never finished", b: "People open the page and leave, and nobody follows up." }],
      audiences: [{ name: "Anyone interested", target: "Yolias shares your page with people who show interest" }, { name: "Your website visitors", target: "Put your link on your site" }, { name: "Your signature", target: "Add it to your email signature" }],
      email: { subject: "Pick a time", body: "Hi Noor,\n\nHappy to walk you through it. Pick any time that suits you here: {your booking link}\n\nThe page shows your time zone.\n\nHady" },
      plan: [["Day 1", "Open Meetings, set your address, up to four meeting types and weekly hours."], ["Day 2", "Set the location and connect Google Calendar."], ["Weeks 1 to 2", "Share your link and watch Link visits."], ["Weeks 3 to 4", "Mark outcomes after each meeting."]],
      watch: ["Link visits", "Booked from the link", "Cost per meeting"],
      faq: [["Is it included?", "Yes, in every option."], ["Can guests book in their time zone?", "Yes. The page uses their time zone."], ["Can I have several meeting types?", "Up to four."], ["Can I use it without a campaign?", "Yes. Share the link anywhere."]],
    },
    ar: {
      who: "كل من يعقد اجتماعات مع العملاء ويريد صفحة حجز مرتبطة بحملاته ونتائجه.",
      pains: [{ t: "أداة الحجز لا تعرف شيئًا عن الحملة", b: "لا تعرف أي حملة جاءت بالاجتماع." }, { t: "اشتراك إضافي", b: "الحجز أداة أخرى تدفع لها وتربطها." }, { t: "بدأ ولم يكمل", b: "يفتح الناس الصفحة ويغادرون ولا يتابعهم أحد." }],
      audiences: [{ name: "كل مهتم", target: "يشارك يولياس صفحتك مع من يبدون اهتمامًا" }, { name: "زوار موقعك", target: "ضع رابطك في موقعك" }, { name: "توقيعك", target: "أضفه إلى توقيع بريدك" }],
      email: { subject: "اختر وقتًا", body: "أهلًا نور،\n\nيسعدني شرحه لك. اختر أي وقت يناسبك من هنا: {رابط الحجز}\n\nتعرض الصفحة منطقتك الزمنية.\n\nهادي" },
      plan: [["اليوم 1", "افتح الاجتماعات، وحدد عنوانك وحتى أربعة أنواع اجتماعات وساعاتك."], ["اليوم 2", "حدد المكان واربط تقويم Google."], ["الأسبوع 1 و2", "شارك رابطك وراقب زيارات الرابط."], ["الأسبوع 3 و4", "سجّل نتيجة كل اجتماع."]],
      watch: ["زيارات الرابط", "حجزوا من الرابط", "تكلفة الاجتماع"],
      faq: [["هل هي مشمولة؟", "نعم، في كل خيار."], ["هل يحجز الضيف بتوقيته؟", "نعم. تستخدم الصفحة منطقته الزمنية."], ["هل أضع أنواع اجتماعات؟", "حتى أربعة."], ["هل أستخدمها بلا حملة؟", "نعم. شارك الرابط في أي مكان."]],
    },
  },
};
