import type { Localized } from "@/lib/content/types";

// The home page (owner brief, 2026-11-03): Yolias as an advertising platform
// for customer acquisition campaigns. Every claim matches what the product
// does today (checked against the code): email is the live channel, budgets
// and the daily split between audiences are real (lib/agent-core/optimizer),
// meetings are booked on the member's Yolias booking page and Google
// Calendar, results are counted from real rows. Product visuals marked
// "Example" are illustrations with sample data.

export interface Landing {
  hero: { eyebrow: string; title: string; lead: string; lead2: string; primary: string; secondary: string; under: string; shotAlt: string };
  intro: { eyebrow: string; title: string; body: string[]; shotAlt: string };
  capabilities: { eyebrow: string; title: string; cards: { title: string; body: string }[] };
  manager: { eyebrow: string; title: string; body: string[]; actions: string[]; message: string; columns: string[]; rows: { name: string; status: "on" | "off"; channel: string; audience: string; contacted: number; replies: number; interested: number; meetings: number; spend: number }[] };
  audience: { eyebrow: string; title: string; body: string; points: string[]; example: { name: string; rows: [string, string][]; size: string } };
  budget: { eyebrow: string; title: string; body: string; message: string; stats: [string, string][]; split: { title: string; rows: [string, number][] } };
  channels: { eyebrow: string; title: string; body: string; live: string; soon: string; list: { name: string; live: boolean }[]; setting: string };
  research: { eyebrow: string; title: string; body: string; points: string[]; lead: { name: string; title: string; company: string; facts: string[]; subject: string; message: string } };
  ai: { eyebrow: string; title: string; body: string; uses: string[]; chat: { q: string; a: string } };
  leads: { eyebrow: string; title: string; body: string; message: string; columns: string[]; rows: string[][] };
  conversations: { eyebrow: string; title: string; body: string; thread: { who: string; campaign: string; state: string; messages: { from: "them" | "yolias"; text: string }[] } };
  meetings: { eyebrow: string; title: string; body: string; points: string[]; rows: { who: string; when: string; campaign: string }[]; costLabel: string };
  analytics: { eyebrow: string; title: string; body: string; kpis: [string, string][] };
  integrations: { eyebrow: string; title: string; body: string; items: { name: string; body: string }[]; connected: string };
  results: { eyebrow: string; title: string; body: string; note: string; scenarios: { who: string; goal: string; setup: string; href: string }[] };
  pricing: { eyebrow: string; title: string; body: string; points: string[]; cta: string };
  faq: { eyebrow: string; title: string; items: [string, string][] };
  cta: { title: string; body: string; strong: string; primary: string };
  example: string;
}

export const landing: Localized<Landing> = {
  en: {
    example: "Example",
    hero: {
      eyebrow: "YOLIAS · AI AGENTS FOR BUSINESS GROWTH",
      title: "Run customer acquisition campaigns. Grow your business.",
      lead: "Everything you need to build campaigns that target the right customers, manage how you reach them, and follow the results in one place.",
      lead2: "Define your audience, launch your campaigns, and track their performance through to meetings and qualified leads.",
      primary: "Get started", secondary: "Explore the platform",
      under: "One platform to run your growth campaigns.",
      shotAlt: "Yolias Campaigns: each campaign with its status, audience, people reached, replies, meetings, spend and cost per meeting",
    },
    intro: {
      eyebrow: "WHAT IS YOLIAS",
      title: "One platform to run customer acquisition campaigns.",
      body: [
        "Yolias is an advertising platform that runs customer acquisition from start to finish.",
        "Create campaigns, define who you want to reach, choose how to reach them, and manage performance from one dashboard.",
        "Instead of moving between tools for research, outreach, follow-up and reporting, the whole process lives in one platform.",
      ],
      shotAlt: "The Yolias dashboard: results, spend and campaigns at a glance",
    },
    capabilities: {
      eyebrow: "THE PLATFORM",
      title: "Everything you need to run your campaigns.",
      cards: [
        { title: "Campaigns", body: "A campaign for each service, goal or market, with its objective: meetings, sales, website leads or qualified leads." },
        { title: "Audiences", body: "The companies and people you want, by industry, location, company size and job title. Save them and use them again." },
        { title: "Budget", body: "A budget in US dollars for each campaign, the spend so far, and the cost of each result." },
        { title: "Channels", body: "Campaigns reach people by email from your own mailbox, with more channels added to the same campaigns." },
        { title: "Leads", body: "Every company and person a campaign found, with the campaign and audience they came from." },
        { title: "Conversations", body: "Replies from every campaign in one inbox, with Yolias answering and following up." },
        { title: "Performance", body: "Reached, replies, interested, meetings and cost per meeting for each campaign, side by side." },
      ],
    },
    manager: {
      eyebrow: "CAMPAIGN MANAGER",
      title: "Customer acquisition you can manage and measure.",
      body: [
        "Treat acquisition the way you treat your ad campaigns.",
        "One campaign for each service or goal, with its audience, its spend, and its results next to the others.",
      ],
      actions: ["Create a campaign", "Pause or resume", "Edit settings", "Duplicate", "Compare campaigns", "Break down by day, audience, country or job title"],
      message: "You don’t manage separate messages. You manage campaigns that acquire customers.",
      columns: ["Campaign", "Channel", "Audience", "Reached", "Replies", "Interested", "Meetings", "Spend", "Cost / meeting"],
      rows: [
        { name: "Real estate developers · Riyadh", status: "on", channel: "Email", audience: "Heads of sales", contacted: 620, replies: 41, interested: 14, meetings: 6, spend: 186 },
        { name: "Clinics · Cairo", status: "on", channel: "Email", audience: "Clinic owners", contacted: 410, replies: 22, interested: 9, meetings: 4, spend: 123 },
        { name: "Agencies · Dubai", status: "off", channel: "Email", audience: "Founders", contacted: 280, replies: 15, interested: 5, meetings: 2, spend: 84 },
      ],
    },
    audience: {
      eyebrow: "AUDIENCES",
      title: "Start with the people you want to reach.",
      body: "Define the businesses you want to work with, and build a different audience for each campaign or service.",
      points: ["Industry and activity", "Countries and cities", "Company type and size, when the data has it", "Job titles and seniority", "Saved audiences you reuse", "Custom audiences from your own lists, and lookalikes of your best customers"],
      example: { name: "Real estate developers · Riyadh", rows: [["Location", "Riyadh, Saudi Arabia"], ["Industry", "Real estate development"], ["Company size", "50–500 employees"], ["Job titles", "Head of Sales, Marketing Director, CEO"]], size: "Already known: 520 people, 410 with an email" },
    },
    budget: {
      eyebrow: "BUDGET AND CONTROL",
      title: "Control what your campaigns spend.",
      body: "Set each campaign’s budget and dates, follow its spend, and see what each lead and meeting cost.",
      message: "Know where your money goes and what it brings back.",
      stats: [["Budget", "$300"], ["Spent", "$186"], ["Cost per lead", "$13.29"], ["Cost per meeting", "$31.00"]],
      split: { title: "Today’s split between audiences", rows: [["Heads of sales", 55], ["Marketing directors", 30], ["CEOs", 15]] },
    },
    channels: {
      eyebrow: "CHANNELS",
      title: "Reach people through the right channel.",
      body: "The channel is a setting of the campaign. Replies, meetings and results stay linked to the campaign that started them.",
      live: "Live", soon: "Coming",
      list: [{ name: "Email (Gmail, Outlook, any mailbox)", live: true }, { name: "LinkedIn", live: false }, { name: "WhatsApp Business", live: false }],
      setting: "Campaign channel",
    },
    research: {
      eyebrow: "RESEARCH AND PERSONALIZATION",
      title: "Make every campaign speak to its audience.",
      body: "Yolias researches each company and person and writes a first email about their business, in their language.",
      points: ["Finds the companies and decision makers", "Reads what each company does", "Uses what is public about the person and the company", "Writes a first email for each person", "Keeps the research with the campaign"],
      lead: {
        name: "Khalid Al-Harbi", title: "Head of Sales", company: "Al Noor Developments",
        facts: ["Launched a new residential project in North Riyadh", "Sales team of 12", "Hiring two sales managers"],
        subject: "Buyers for the North Riyadh project",
        message: "Khalid, congratulations on the North Riyadh launch. With two sales managers joining, filling their calendars early matters…",
      },
    },
    ai: {
      eyebrow: "YOLIAS AI",
      title: "The engine behind your growth campaigns.",
      body: "Yolias AI runs the work of each campaign and helps you plan the next one, from the audience to the analysis of results.",
      uses: ["Plans campaigns with you", "Suggests audiences", "Finds the people", "Writes each message", "Analyzes results", "Recommends what to change"],
      chat: { q: "Which audience should get more budget this week?", a: "Heads of sales: 6 meetings from 620 people reached, at $31 each. CEOs booked none from 210. I suggest moving $40 from CEOs to heads of sales." },
    },
    leads: {
      eyebrow: "LEADS",
      title: "Every lead in one place.",
      body: "The companies and people your campaigns found, organized and linked to the campaigns that reached them.",
      message: "Never lose sight of the customers your campaigns reached.",
      columns: ["Person", "Job title", "Company", "Source", "Campaign", "Status"],
      rows: [
        ["Khalid Al-Harbi", "Head of Sales", "Al Noor Developments", "Search", "Real estate · Riyadh", "Meeting booked"],
        ["Mona Fathy", "Clinic Owner", "Smile Dental", "Search", "Clinics · Cairo", "Interested"],
        ["Omar Saleh", "Founder", "Pixel Agency", "Audience", "Agencies · Dubai", "Replied"],
      ],
    },
    conversations: {
      eyebrow: "CONVERSATIONS",
      title: "Follow every conversation from one place.",
      body: "Replies from every campaign arrive in one inbox, with the person, the campaign and the full thread. Yolias answers, follows up and books; what needs you comes to you.",
      thread: {
        who: "Mona Fathy · Smile Dental", campaign: "Clinics · Cairo", state: "Interested",
        messages: [
          { from: "them", text: "Sounds interesting. How does it work for a clinic with two branches?" },
          { from: "yolias", text: "Each branch can have its own campaign and audience. Would a 20-minute call on Tuesday or Wednesday work?" },
          { from: "them", text: "Wednesday at 11 works." },
        ],
      },
    },
    meetings: {
      eyebrow: "MEETINGS AND RESULTS",
      title: "Connect your campaigns to the results that matter.",
      body: "Go past the number of people reached. See who is interested, which meetings were booked, and which campaigns bring them.",
      points: ["Meetings booked on your Yolias booking page and your Google Calendar", "The campaign and audience behind each meeting", "Cost per meeting from the campaign’s spend"],
      rows: [{ who: "Mona Fathy", when: "Wed 11:00", campaign: "Clinics · Cairo" }, { who: "Khalid Al-Harbi", when: "Thu 14:30", campaign: "Real estate · Riyadh" }],
      costLabel: "Cost per meeting",
    },
    analytics: {
      eyebrow: "PERFORMANCE",
      title: "Know your campaigns by the numbers.",
      body: "A clear view of acquisition performance over any period, campaign by campaign.",
      kpis: [["Campaigns", "3"], ["Reached", "1,310"], ["Replies", "78"], ["Reply rate", "6.0%"], ["Interested", "28"], ["Meetings", "12"], ["Booking rate", "0.9%"], ["Spend", "$393"], ["Cost per meeting", "$32.75"]],
    },
    integrations: {
      eyebrow: "INTEGRATIONS",
      title: "Connect your tools. Run your campaigns from one place.",
      body: "Yolias connects to what campaigns need to send, book and measure.",
      connected: "Connected",
      items: [
        { name: "Gmail", body: "Campaign emails go from your Gmail and replies come back to Yolias." },
        { name: "Outlook / Microsoft 365", body: "The same with your Microsoft mailbox." },
        { name: "Any mailbox (IMAP/SMTP)", body: "Any other business mailbox." },
        { name: "Google Calendar", body: "Meetings land on your calendar at the times you are free." },
        { name: "Yolias Pixel", body: "Sales and form leads on your website, counted for the campaign that sent each person." },
        { name: "CSV import", body: "Your own lists as custom audiences." },
      ],
    },
    results: {
      eyebrow: "WHO IT IS FOR",
      title: "Growth starts with better-run campaigns.",
      body: "How agencies, consultants and service businesses set up Yolias.",
      note: "Examples of setups, not customer results.",
      scenarios: [
        { who: "Marketing agency", goal: "Meetings with brands that need a new agency", setup: "Audiences of marketing managers at companies in their cities.", href: "/solutions" },
        { who: "Consultant", goal: "Meetings with business owners", setup: "One campaign for each service, each with its own audience.", href: "/solutions" },
        { who: "SaaS company", goal: "Sales on the website", setup: "A Sales campaign that sends interested people to the pricing page; the pixel counts each purchase.", href: "/solutions" },
      ],
    },
    pricing: {
      eyebrow: "PRICING",
      title: "Choose how you run your campaigns.",
      body: "Every option includes every Yolias feature and unlimited users.",
      points: [
        "Pay As You Go: prepaid credit from $5, no subscription, no expiry.",
        "Growth ($100/month) and Scale ($200/month): monthly prospects.",
        "You pay for the prospects Yolias finds and reaches. Emails, replies and meetings are not charged.",
        "Cancel from Settings any time; your plan runs to the end of the period you paid for.",
        "Pay by card on our payment partner’s secure page.",
      ],
      cta: "See pricing",
    },
    faq: {
      eyebrow: "QUESTIONS",
      title: "Frequently asked questions",
      items: [
        ["What is Yolias?", "An advertising platform for customer acquisition campaigns. You define your audience, run your campaigns and follow their results in one place."],
        ["Is Yolias just an email tool?", "No. Email is the channel campaigns use today. Yolias runs the campaign: the audience, finding the people, the messages, the conversations, the meetings and the results."],
        ["Can I run more than one campaign?", "Yes. Each campaign has its own objective, audiences, budget and dates."],
        ["Can I choose my audience?", "Yes: industry, countries and cities, company size, job titles, your own lists and lookalikes of your best customers."],
        ["Which channels are available?", "Email from your own mailbox (Gmail, Outlook or any mailbox). More channels join the same campaigns as they launch."],
        ["Can I follow my campaigns’ performance?", "Yes: reached, replies, interested, meetings, spend and cost per result for each campaign and audience, by day."],
        ["Does Yolias guarantee meetings?", "No platform can guarantee a business result. Yolias runs the acquisition process and measures every result and what it cost."],
        ["Do I need sales experience?", "No. You set the goal and the audience; Yolias does the research, writing, replies and booking."],
        ["How do I start?", "Create your account, tell Yolias about your company, then create your first campaign: the objective, the audience and the budget."],
      ],
    },
    cta: {
      title: "Run customer acquisition a different way.",
      body: "Choose the customers you want, create your campaigns, and follow their performance and results in one platform.",
      strong: "Start with Yolias today.",
      primary: "Get started",
    },
  },
  ar: {
    example: "مثال توضيحي",
    hero: {
      eyebrow: "يولياس · وكلاء ذكاء اصطناعي لنمو الأعمال",
      title: "أدر حملات اكتساب العملاء. ونمِّ أعمالك.",
      lead: "كل ما تحتاجه لإنشاء حملات تستهدف العملاء المناسبين، وإدارة الوصول إليهم، ومتابعة النتائج من مكان واحد.",
      lead2: "حدد جمهورك، وأطلق حملاتك، وتابع أداءها حتى الاجتماعات والعملاء المحتملين.",
      primary: "ابدأ الآن", secondary: "استكشف المنصة",
      under: "منصة واحدة لإدارة حملات نمو أعمالك.",
      shotAlt: "الحملات في يولياس: كل حملة بحالتها وجمهورها ومن وصلت إليهم والردود والاجتماعات والإنفاق وتكلفة الاجتماع",
    },
    intro: {
      eyebrow: "ما هي يولياس",
      title: "منصة واحدة لإدارة حملات اكتساب العملاء.",
      body: [
        "يولياس منصة إعلانية تدير عملية اكتساب العملاء من البداية إلى النهاية.",
        "أنشئ حملاتك، وحدد من تريد الوصول إليه، واختر طريقة التواصل، وأدر الأداء من لوحة تحكم واحدة.",
        "بدلًا من التنقل بين أدوات البحث والتواصل والمتابعة والتحليل، تجتمع العملية كلها في منصة واحدة.",
      ],
      shotAlt: "لوحة تحكم يولياس: النتائج والإنفاق والحملات في نظرة واحدة",
    },
    capabilities: {
      eyebrow: "المنصة",
      title: "كل ما تحتاجه لإدارة حملاتك.",
      cards: [
        { title: "الحملات", body: "حملة لكل خدمة أو هدف أو سوق، ولكل حملة هدفها: اجتماعات أو مبيعات أو عملاء من الموقع أو عملاء مؤهلون." },
        { title: "الجماهير", body: "الشركات والأشخاص الذين تريدهم حسب المجال والموقع وحجم الشركة والمسمى الوظيفي. احفظها واستخدمها مجددًا." },
        { title: "الميزانية", body: "ميزانية بالدولار لكل حملة، والإنفاق حتى الآن، وتكلفة كل نتيجة." },
        { title: "القنوات", body: "تصل الحملات إلى الأشخاص بالبريد الإلكتروني من بريدك، وتنضم قنوات أخرى إلى الحملات نفسها." },
        { title: "العملاء المحتملون", body: "كل شركة وشخص وجدتهم الحملة، مع الحملة والجمهور الذي جاؤوا منه." },
        { title: "المحادثات", body: "ردود كل الحملات في صندوق واحد، ويولياس يرد ويتابع." },
        { title: "الأداء", body: "من وصلت إليهم الحملة والردود والمهتمون والاجتماعات وتكلفة الاجتماع، لكل حملة جنبًا إلى جنب." },
      ],
    },
    manager: {
      eyebrow: "مدير الحملات",
      title: "اكتساب العملاء أصبح عملية تديرها وتقيسها.",
      body: [
        "تعامل مع اكتساب العملاء كما تتعامل مع حملاتك الإعلانية.",
        "حملة لكل خدمة أو هدف، بجمهورها وإنفاقها ونتائجها بجانب الحملات الأخرى.",
      ],
      actions: ["إنشاء حملة", "إيقاف أو تشغيل", "تعديل الإعدادات", "نسخ حملة", "مقارنة الحملات", "التقسيم حسب اليوم أو الجمهور أو البلد أو المسمى الوظيفي"],
      message: "أنت لا تدير رسائل منفصلة؛ أنت تدير حملات لاكتساب العملاء.",
      columns: ["الحملة", "القناة", "الجمهور", "وصلت إليهم", "الردود", "المهتمون", "الاجتماعات", "الإنفاق", "تكلفة الاجتماع"],
      rows: [
        { name: "المطورون العقاريون · الرياض", status: "on", channel: "البريد", audience: "مديرو المبيعات", contacted: 620, replies: 41, interested: 14, meetings: 6, spend: 186 },
        { name: "العيادات · القاهرة", status: "on", channel: "البريد", audience: "أصحاب العيادات", contacted: 410, replies: 22, interested: 9, meetings: 4, spend: 123 },
        { name: "الوكالات · دبي", status: "off", channel: "البريد", audience: "المؤسسون", contacted: 280, replies: 15, interested: 5, meetings: 2, spend: 84 },
      ],
    },
    audience: {
      eyebrow: "الجماهير",
      title: "ابدأ بالأشخاص الذين تريد الوصول إليهم.",
      body: "حدد الشركات التي تريد العمل معها، وأنشئ جمهورًا مختلفًا لكل حملة أو خدمة.",
      points: ["المجال والنشاط التجاري", "الدول والمدن", "نوع الشركة وحجمها عندما تتوفر البيانات", "المسميات الوظيفية والمستوى", "جماهير محفوظة تعيد استخدامها", "جماهير مخصصة من قوائمك، وجماهير مشابهة لأفضل عملائك"],
      example: { name: "المطورون العقاريون · الرياض", rows: [["الموقع", "الرياض، السعودية"], ["المجال", "التطوير العقاري"], ["حجم الشركة", "50–500 موظف"], ["المسميات", "مدير المبيعات، مدير التسويق، الرئيس التنفيذي"]], size: "معروف مسبقًا: 520 شخصًا، منهم 410 لديهم بريد" },
    },
    budget: {
      eyebrow: "الميزانية والتحكم",
      title: "تحكم في إنفاق حملاتك.",
      body: "حدد ميزانية كل حملة وتواريخها، وتابع إنفاقها، واعرف تكلفة كل عميل محتمل وكل اجتماع.",
      message: "اعرف أين تذهب أموالك وماذا تعيد إليك.",
      stats: [["الميزانية", "$300"], ["المُنفق", "$186"], ["تكلفة العميل المحتمل", "$13.29"], ["تكلفة الاجتماع", "$31.00"]],
      split: { title: "توزيع اليوم بين الجماهير", rows: [["مديرو المبيعات", 55], ["مديرو التسويق", 30], ["الرؤساء التنفيذيون", 15]] },
    },
    channels: {
      eyebrow: "القنوات",
      title: "تواصل مع جمهورك عبر القناة المناسبة.",
      body: "القناة إعداد من إعدادات الحملة، والردود والاجتماعات والنتائج تبقى مرتبطة بالحملة التي بدأتها.",
      live: "متاحة", soon: "قريبًا",
      list: [{ name: "البريد الإلكتروني (Gmail وOutlook وأي بريد)", live: true }, { name: "LinkedIn", live: false }, { name: "واتساب للأعمال", live: false }],
      setting: "قناة الحملة",
    },
    research: {
      eyebrow: "البحث والتخصيص",
      title: "اجعل كل حملة تخاطب جمهورها.",
      body: "يبحث يولياس عن كل شركة وكل شخص، ويكتب رسالة أولى عن نشاطهم وبلغتهم.",
      points: ["يجد الشركات وصنّاع القرار", "يفهم نشاط كل شركة", "يستخدم المعلومات العامة عن الشخص والشركة", "يكتب رسالة أولى لكل شخص", "يحفظ البحث مع الحملة"],
      lead: {
        name: "خالد الحربي", title: "مدير المبيعات", company: "النور للتطوير العقاري",
        facts: ["أطلقت مشروعًا سكنيًا جديدًا شمال الرياض", "فريق مبيعات من 12 شخصًا", "توظف مديرَي مبيعات"],
        subject: "مشترون لمشروع شمال الرياض",
        message: "أستاذ خالد، مبروك إطلاق مشروع شمال الرياض. ومع انضمام مديرَي مبيعات جديدين، يهم أن تمتلئ مواعيدهما مبكرًا…",
      },
    },
    ai: {
      eyebrow: "Yolias AI",
      title: "المحرك الذي يشغّل حملات نمو أعمالك.",
      body: "يدير Yolias AI عمل كل حملة، ويساعدك في التخطيط للحملة التالية، من الجمهور إلى تحليل النتائج.",
      uses: ["يخطط الحملات معك", "يقترح الجماهير", "يجد الأشخاص", "يكتب كل رسالة", "يحلل النتائج", "يقترح ما يجب تغييره"],
      chat: { q: "أي جمهور يستحق ميزانية أكبر هذا الأسبوع؟", a: "مديرو المبيعات: 6 اجتماعات من 620 شخصًا، بتكلفة 31 دولارًا للاجتماع. والرؤساء التنفيذيون لم يحجزوا أي اجتماع من 210. أقترح نقل 40 دولارًا إلى مديري المبيعات." },
    },
    leads: {
      eyebrow: "العملاء المحتملون",
      title: "كل العملاء المحتملين في مكان واحد.",
      body: "الشركات والأشخاص الذين وجدتهم حملاتك، منظمين ومرتبطين بالحملات التي وصلت إليهم.",
      message: "لا تفقد أثر أي عميل وصلت إليه حملاتك.",
      columns: ["الشخص", "المسمى", "الشركة", "المصدر", "الحملة", "الحالة"],
      rows: [
        ["خالد الحربي", "مدير المبيعات", "النور للتطوير العقاري", "بحث", "العقارات · الرياض", "اجتماع محجوز"],
        ["منى فتحي", "صاحبة عيادة", "سمايل لطب الأسنان", "بحث", "العيادات · القاهرة", "مهتمة"],
        ["عمر صالح", "مؤسس", "بيكسل إيجنسي", "جمهور", "الوكالات · دبي", "رد"],
      ],
    },
    conversations: {
      eyebrow: "المحادثات",
      title: "تابع كل محادثة من مكان واحد.",
      body: "تصل ردود كل الحملات إلى صندوق واحد، مع الشخص والحملة والمحادثة كاملة. يولياس يرد ويتابع ويحجز، وما يحتاجك يصلك.",
      thread: {
        who: "منى فتحي · سمايل لطب الأسنان", campaign: "العيادات · القاهرة", state: "مهتمة",
        messages: [
          { from: "them", text: "يبدو مثيرًا للاهتمام. كيف يعمل مع عيادة لها فرعان؟" },
          { from: "yolias", text: "لكل فرع حملته وجمهوره. هل يناسبك اتصال لمدة 20 دقيقة يوم الثلاثاء أو الأربعاء؟" },
          { from: "them", text: "الأربعاء الساعة 11 مناسب." },
        ],
      },
    },
    meetings: {
      eyebrow: "الاجتماعات والنتائج",
      title: "اربط حملاتك بالنتائج التي تهم أعمالك.",
      body: "لا تتوقف عند عدد من وصلت إليهم. اعرف من اهتم، وأي الاجتماعات حُجزت، وأي الحملات أتت بها.",
      points: ["اجتماعات تُحجز على صفحة الحجز في يولياس وفي تقويم Google", "الحملة والجمهور وراء كل اجتماع", "تكلفة الاجتماع من إنفاق الحملة"],
      rows: [{ who: "منى فتحي", when: "الأربعاء 11:00", campaign: "العيادات · القاهرة" }, { who: "خالد الحربي", when: "الخميس 14:30", campaign: "العقارات · الرياض" }],
      costLabel: "تكلفة الاجتماع",
    },
    analytics: {
      eyebrow: "الأداء",
      title: "اعرف أداء حملاتك بالأرقام.",
      body: "رؤية واضحة لأداء اكتساب العملاء في أي فترة، حملة بحملة.",
      kpis: [["الحملات", "3"], ["وصلت إليهم", "1,310"], ["الردود", "78"], ["نسبة الرد", "6.0%"], ["المهتمون", "28"], ["الاجتماعات", "12"], ["نسبة الحجز", "0.9%"], ["الإنفاق", "$393"], ["تكلفة الاجتماع", "$32.75"]],
    },
    integrations: {
      eyebrow: "التكاملات",
      title: "اربط أدواتك. وأدر حملاتك من مكان واحد.",
      body: "يتصل يولياس بما تحتاجه الحملات للإرسال والحجز والقياس.",
      connected: "متصل",
      items: [
        { name: "Gmail", body: "رسائل الحملات تُرسل من Gmail الخاص بك والردود تعود إلى يولياس." },
        { name: "Outlook / Microsoft 365", body: "وبالطريقة نفسها مع بريد Microsoft." },
        { name: "أي بريد (IMAP/SMTP)", body: "أي بريد عمل آخر." },
        { name: "تقويم Google", body: "تصل الاجتماعات إلى تقويمك في أوقات فراغك." },
        { name: "بيكسل يولياس", body: "المبيعات ونماذج موقعك تُحسب للحملة التي أرسلت كل شخص." },
        { name: "استيراد CSV", body: "قوائمك الخاصة كجماهير مخصصة." },
      ],
    },
    results: {
      eyebrow: "لمن يولياس",
      title: "نمو أعمالك يبدأ بحملات أكثر تنظيمًا.",
      body: "كيف تُعد الوكالات والاستشاريون وشركات الخدمات حملاتها على يولياس.",
      note: "أمثلة على إعداد الحملات، وليست نتائج عملاء.",
      scenarios: [
        { who: "وكالة تسويق", goal: "اجتماعات مع علامات تجارية تبحث عن وكالة", setup: "جماهير من مديري التسويق في شركات مدنها.", href: "/solutions" },
        { who: "استشاري", goal: "اجتماعات مع أصحاب الأعمال", setup: "حملة لكل خدمة، ولكل حملة جمهورها.", href: "/solutions" },
        { who: "شركة برمجيات", goal: "مبيعات على الموقع", setup: "حملة مبيعات ترسل المهتمين إلى صفحة الأسعار، والبيكسل يحسب كل عملية شراء.", href: "/solutions" },
      ],
    },
    pricing: {
      eyebrow: "الأسعار",
      title: "اختر الطريقة المناسبة لإدارة حملاتك.",
      body: "كل خيار يشمل كل مزايا يولياس وعدد مستخدمين غير محدود.",
      points: [
        "الدفع حسب الاستخدام: رصيد مسبق من 5 دولارات، بلا اشتراك وبلا انتهاء صلاحية.",
        "النمو (100 دولار شهريًا) والتوسع (200 دولار شهريًا): عملاء محتملون كل شهر.",
        "تدفع مقابل العملاء المحتملين الذين يجدهم يولياس ويصل إليهم. الرسائل والردود والاجتماعات لا تُحتسب.",
        "ألغِ من الإعدادات في أي وقت؛ وتبقى خطتك حتى نهاية الفترة المدفوعة.",
        "الدفع بالبطاقة على صفحة شريك الدفع الآمنة.",
      ],
      cta: "اطّلع على الأسعار",
    },
    faq: {
      eyebrow: "أسئلة",
      title: "الأسئلة الشائعة",
      items: [
        ["ما هي يولياس؟", "منصة إعلانية لإدارة حملات اكتساب العملاء. تحدد جمهورك، وتشغّل حملاتك، وتتابع نتائجها من مكان واحد."],
        ["هل يولياس مجرد أداة لإرسال البريد الإلكتروني؟", "لا. البريد الإلكتروني هو القناة التي تستخدمها الحملات اليوم. يولياس يدير الحملة: الجمهور، وإيجاد الأشخاص، والرسائل، والمحادثات، والاجتماعات، والنتائج."],
        ["هل يمكنني إنشاء أكثر من حملة؟", "نعم. لكل حملة هدفها وجماهيرها وميزانيتها وتواريخها."],
        ["هل يمكنني تحديد الجمهور المستهدف؟", "نعم: المجال، والدول والمدن، وحجم الشركة، والمسميات الوظيفية، وقوائمك الخاصة، وجماهير مشابهة لأفضل عملائك."],
        ["ما قنوات التواصل المتاحة؟", "البريد الإلكتروني من بريدك (Gmail أو Outlook أو أي بريد). وتنضم قنوات أخرى إلى الحملات نفسها عند إطلاقها."],
        ["هل يمكنني متابعة أداء الحملات؟", "نعم: من وصلت إليهم، والردود، والمهتمون، والاجتماعات، والإنفاق، وتكلفة كل نتيجة، لكل حملة وجمهور، يومًا بيوم."],
        ["هل تضمن يولياس الحصول على اجتماعات؟", "لا تضمن أي منصة نتيجة تجارية محددة. يولياس يدير عملية اكتساب العملاء ويقيس كل نتيجة وتكلفتها."],
        ["هل أحتاج إلى خبرة في المبيعات؟", "لا. تحدد الهدف والجمهور، ويتولى يولياس البحث والكتابة والردود والحجز."],
        ["كيف أبدأ؟", "أنشئ حسابك، وعرّف يولياس بشركتك، ثم أنشئ حملتك الأولى: الهدف والجمهور والميزانية."],
      ],
    },
    cta: {
      title: "ابدأ إدارة حملات اكتساب العملاء بطريقة مختلفة.",
      body: "حدد العملاء الذين تريد الوصول إليهم، وأنشئ حملاتك، وتابع أداءها ونتائجها من منصة واحدة.",
      strong: "ابدأ مع يولياس اليوم.",
      primary: "ابدأ الآن",
    },
  },
};
