import type { Localized } from "./types";

// Copy for the public website pages. Written around what Yolias is (owner,
// 2026-11-02, D-275): an AI advertising platform for customer acquisition.
// The member defines the customers it wants and the result (meetings, leads
// or sales); Yolias's AI campaigns find the people, contact each one from the
// member's mailbox, answer the replies and book the meetings, and every
// result is counted. No claim the product can't keep (email is the channel
// today; others are "soon"); there is no free trial.

export const home: Localized<{
  eyebrow: string; title: string; lead: string; primary: string; primaryTrial: string; secondary: string;
  /** Under the hero buttons: what starting costs (with or without a free trial). */
  reassure: string; reassureTrial: string;
  compare: { eyebrow: string; title: string; without: string; with: string; rows: { before: string; after: string }[] };
  how: { eyebrow: string; title: string; steps: { title: string; body: string }[] };
  features: { eyebrow: string; title: string; tiles: { title: string; body: string }[] };
  statement: { text: string; small: string };
  cta: { title: string; body: string; primary: string; primaryTrial: string; secondary: string };
  /** Direct answers for people and answer engines (also FAQPage structured data). */
  faq: { eyebrow: string; title: string; items: { q: string; a: string }[] };
}> = {
  en: {
    eyebrow: "Yolias · AI Advertising Platform for Customer Acquisition",
    title: "Run customer acquisition campaigns. Grow your business.",
    lead: "Yolias is an advertising platform for customer acquisition campaigns. Create campaigns that target the right customers, manage how you reach them, and follow the results through to meetings, leads and sales in one place.",
    primary: "Get started",
    primaryTrial: "Start free trial",
    secondary: "See how it works",
    reassure: "Free signup · Pay at launch, from $5 · Unlimited users",
    reassureTrial: "{days}-day free trial · All features on every plan · Cancel anytime",
    compare: {
      eyebrow: "WHY YOLIAS",
      title: "Ads buy attention. Yolias goes straight to the customer.",
      without: "Traditional ads",
      with: "Yolias",
      rows: [
        { before: "You pay for reach, views and clicks, and hope the right buyer is somewhere among them.", after: "You define the customers you want: countries, cities, industries, company size and job titles. Yolias reaches only the companies and decision makers who fit." },
        { before: "One ad for everyone, easy to scroll past.", after: "A personal message to each person, written from your Company Knowledge and what Yolias found about them, sent from your own mailbox." },
        { before: "The ad stops at the click or the form; the follow-up is on you.", after: "Yolias AI answers questions and objections, follows up and books the meeting on your calendar." },
        { before: "Costs per click and per lead keep rising as everyone bids for the same audience.", after: "Each campaign works for the result you choose (meetings, leads or sales) and shows conversions, revenue and the cost per result." },
      ],
    },
    how: {
      eyebrow: "HOW IT WORKS",
      title: "Launch a campaign in three steps.",
      steps: [
        { title: "Choose the goal", body: "Meetings, sales, website leads or qualified leads; then what you offer, the budget and the dates." },
        { title: "Define your customers", body: "One or more audiences: locations anywhere in the world, industries, company size, job titles and exclusions, or a custom or lookalike audience." },
        { title: "Launch, and let the AI work", body: "Pick the mailbox, the tone and the language, and preview the message. Yolias finds the people, contacts them, follows up, answers and books, and counts every result." },
      ],
    },
    features: {
      eyebrow: "WHAT YOU GET",
      title: "One platform, from the first contact to the customer.",
      tiles: [
        { title: "Campaigns like an ads manager", body: "Campaigns, audiences and messages with spend, results and cost per result for each. Yolias moves the budget toward the audiences that convert, within a daily budget and cost cap you control." },
        { title: "Lead discovery", body: "Companies and decision makers matching your audiences, found every day with the reason each one fits; custom audiences and lookalikes of your best customers." },
        { title: "Yolias AI", body: "Answers questions and objections from your Company Knowledge, sends interested people your booking page and books the meeting; when a person is needed, you're told." },
        { title: "Pixel, conversions and revenue", body: "The Yolias pixel counts purchases and leads on your website, so every campaign shows its conversions, revenue and return on spend, in Arabic and English." },
      ],
    },
    statement: {
      text: "Reach fewer people. Win more customers.",
      small: "Choose the customer. Yolias brings the result.",
    },
    faq: {
      eyebrow: "QUESTIONS, ANSWERED",
      title: "What people ask before they start",
      items: [
        { q: "What is Yolias?", a: "Yolias is an AI advertising platform for customer acquisition. Instead of paying for reach and views, you define the customers you want, and Yolias's AI campaigns find the matching companies and decision makers, contact each one directly from your own mailbox, answer the replies and book the meetings. Each campaign has a goal (meetings, leads or sales) and shows its conversions, revenue and cost per result." },
        { q: "How is Yolias different from Facebook, Google or TikTok ads?", a: "Those platforms show an ad to an audience and charge for impressions or clicks; what happens after the click is up to you. Yolias starts from the customers you define, contacts each decision maker directly with a personal message, and Yolias AI carries the conversation to a meeting, a lead or a sale. You pay for the people Yolias finds and reaches, not for views." },
        { q: "Does Yolias replace my ads?", a: "No, it adds an acquisition channel. Many businesses keep their ads for awareness and use Yolias to reach specific companies and decision makers directly, so they depend less on ad costs." },
        { q: "Is Yolias a lead database?", a: "No. Yolias doesn't sell lists or data: you pay for the people it finds and reaches for your campaigns, and what you watch is the result (meetings, leads or sales) and the cost of each." },
        { q: "Who is Yolias for?", a: "Businesses that sell to other businesses and want more customers from a channel they control: agencies, service providers, software and SaaS companies, consultants, freelancers, founders and sales teams." },
        { q: "How do I create a campaign?", a: "In three steps, like an ads manager: the campaign (the meetings you want, your offer, budget and dates), one or more audiences (locations, industries, company size, job titles, exclusions, or a saved, custom or lookalike audience) and the message (your mailbox, tone, language and notes, with a preview). Then you launch it." },
        { q: "Does Yolias answer replies by itself?", a: "Yes. It answers questions and objections from your Company Knowledge, sends interested people your booking page and books the meeting. Anything that needs you comes to you." },
        { q: "Where does the data come from, and how accurate is it?", a: "From the data sources connected to Yolias and from public information such as company websites. Every record keeps its source, contact details are labelled by verification state, and anything Yolias couldn't find is shown as not available instead of being guessed." },
        { q: "What do the numbers mean?", a: "Each campaign shows the people and companies Yolias found, emails sent, opened (approximate), replied and not replied, meetings booked, confirmed and held, the booking link's visits, bookings and forms left unfinished, the spend and the cost per meeting (everything spent ÷ meetings booked), the result Yolias works for. A number that can't be worked out yet is shown as a dash, never as zero." },
        { q: "How does Yolias decide where the budget goes?", a: "Like campaign budget optimization in an ads platform: once a day it gives each audience a share of the campaign's budget from its rate of booked meetings (purchases or website leads for those objectives). While there are too few, it uses positive replies, and a new audience gets a fair try first. An audience that clearly does worse, or costs more than your cost cap per meeting, gets no new budget. It never changes how Yolias writes, how much it sends or who it may contact." },
        { q: "What do I need to get started?", a: "A work email, a mailbox to send from (Gmail or any IMAP/SMTP account), a few lines about your company (or your website, which Yolias reads), and credit or a plan." },
        { q: "Which languages does Yolias support?", a: "The product works in Arabic and English, and Yolias writes emails in 15 languages, in each person's language when you choose it." },
        { q: "How much does Yolias cost?", a: "Pay As You Go (prepaid credit from $5, about $0.10 for each person Yolias finds and reaches) or the plans Growth ($100) and Scale ($200) at half the rate per person, monthly or annual at 20% off. Emails, replies and meetings aren't charged. All features and unlimited users on every option. See the pricing page." },
      ],
    },
    cta: {
      title: "Launch your first campaign.",
      body: "Define the customers you want. Yolias reaches them and brings back the results.",
      primary: "Get started",
      primaryTrial: "Start free trial",
      secondary: "See pricing",
    },
  },
  ar: {
    eyebrow: "يولياس · منصة إعلانات بالذكاء الاصطناعي لاكتساب العملاء",
    title: "أدر حملات اكتساب العملاء. ونمِّ أعمالك.",
    lead: "يولياس منصة إعلانية لإدارة حملات اكتساب العملاء. أنشئ حملات تستهدف العملاء المناسبين، وأدر الوصول إليهم، وتابع النتائج حتى الاجتماعات والعملاء والمبيعات من مكان واحد.",
    primary: "ابدأ الآن",
    primaryTrial: "ابدأ التجربة المجانية",
    secondary: "شاهد كيف يعمل",
    reassure: "تسجيل مجاني · الدفع عند الإطلاق من 5 دولارات · مستخدمون غير محدودين",
    reassureTrial: "تجربة مجانية {days} أيام · كل الميزات في كل خطة · إلغاء في أي وقت",
    compare: {
      eyebrow: "لماذا يولياس",
      title: "الإعلانات تشتري الانتباه. ويولياس يذهب إلى العميل مباشرة.",
      without: "الإعلانات التقليدية",
      with: "يولياس",
      rows: [
        { before: "تدفع مقابل الوصول والمشاهدات والنقرات، وتأمل أن يكون المشتري المناسب بينهم.", after: "تحدد العملاء الذين تريدهم: الدول والمدن والمجالات وحجم الشركة والمسميات الوظيفية. ويصل يولياس إلى الشركات وصنّاع القرار المطابقين فقط." },
        { before: "إعلان واحد للجميع، يسهل تجاوزه.", after: "رسالة شخصية لكل شخص، مكتوبة من معرفة شركتك وما وجده يولياس عنه، تُرسل من بريدك أنت." },
        { before: "ينتهي الإعلان عند النقرة أو النموذج، والمتابعة عليك.", after: "يجيب Yolias AI عن الأسئلة والاعتراضات، ويتابع، ويحجز الاجتماع في تقويمك." },
        { before: "تكلفة النقرة والعميل ترتفع لأن الجميع يتنافس على الجمهور نفسه.", after: "كل حملة تعمل للنتيجة التي تختارها (اجتماعات أو عملاء أو مبيعات) وتعرض التحويلات والإيرادات وتكلفة النتيجة." },
      ],
    },
    how: {
      eyebrow: "كيف يعمل",
      title: "أطلق حملتك في ثلاث خطوات.",
      steps: [
        { title: "اختر الهدف", body: "اجتماعات، أو مبيعات، أو عملاء من موقعك، أو عملاء مؤهلون؛ ثم عرضك والميزانية والتواريخ." },
        { title: "حدد عملاءك", body: "جمهور أو أكثر: مواقع في أي مكان في العالم، ومجالات، وحجم الشركة، ومسميات وظيفية، واستبعادات، أو جمهور مخصص أو مشابه." },
        { title: "أطلق الحملة ودع الذكاء الاصطناعي يعمل", body: "اختر البريد والأسلوب واللغة، وعاين الرسالة. يجد يولياس الأشخاص ويتواصل معهم ويتابع ويرد ويحجز، ويحسب كل نتيجة." },
      ],
    },
    features: {
      eyebrow: "ما الذي تحصل عليه",
      title: "منصة واحدة، من أول تواصل حتى العميل.",
      tiles: [
        { title: "حملات مثل مدير الإعلانات", body: "حملات وجماهير ورسائل، لكل منها الإنفاق والنتائج وتكلفة النتيجة. ويحرّك يولياس الميزانية نحو الجماهير التي تحقق نتائج، داخل ميزانية يومية وحد أقصى للتكلفة تتحكم فيهما." },
        { title: "اكتشاف العملاء", body: "شركات وصنّاع قرار يطابقون جماهيرك، يُكتشفون كل يوم مع سبب تطابق كل منهم؛ وجماهير مخصصة وجماهير مشابهة لأفضل عملائك." },
        { title: "Yolias AI", body: "يجيب عن الأسئلة والاعتراضات من معرفة شركتك، ويرسل للمهتمين صفحة الحجز ويحجز الاجتماع، وإذا احتاج الأمر إليك يخبرك." },
        { title: "البيكسل والتحويلات والإيرادات", body: "بيكسل يولياس يحسب المشتريات والعملاء على موقعك، فتعرض كل حملة تحويلاتها وإيراداتها والعائد على الإنفاق، بالعربية والإنجليزية." },
      ],
    },
    statement: {
      text: "تصل إلى عدد أقل من الناس، وتكسب عملاء أكثر.",
      small: "اختر العميل، ويأتيك يولياس بالنتيجة.",
    },
    faq: {
      eyebrow: "إجابات مباشرة",
      title: "أسئلة يطرحها الناس قبل البدء",
      items: [
        { q: "ما هو يولياس؟", a: "يولياس منصة إعلانات بالذكاء الاصطناعي لاكتساب العملاء. بدل أن تدفع مقابل الوصول والمشاهدات، تحدد العملاء الذين تريدهم، فتجد حملات يولياس الذكية الشركات وصنّاع القرار المطابقين، وتتواصل مع كل منهم مباشرة من بريدك، وترد على الردود، وتحجز الاجتماعات. لكل حملة هدف (اجتماعات أو عملاء أو مبيعات)، وتعرض تحويلاتها وإيراداتها وتكلفة النتيجة." },
        { q: "ما الفرق بين يولياس وإعلانات فيسبوك وجوجل وتيك توك؟", a: "تلك المنصات تعرض إعلانًا على جمهور وتحاسبك على الظهور أو النقرات، وما يحدث بعد النقرة مسؤوليتك. أما يولياس فيبدأ من العملاء الذين تحددهم، ويتواصل مع كل صاحب قرار مباشرة برسالة شخصية، ويكمل Yolias AI المحادثة حتى اجتماع أو عميل أو بيع. تدفع مقابل الأشخاص الذين يجدهم يولياس ويتواصل معهم، لا مقابل المشاهدات." },
        { q: "هل يغني يولياس عن إعلاناتي؟", a: "لا، بل يضيف قناة لاكتساب العملاء. كثير من الشركات تُبقي إعلاناتها للانتشار، وتستخدم يولياس للوصول إلى شركات وصنّاع قرار محددين مباشرة، فيقل اعتمادها على تكلفة الإعلانات." },
        { q: "هل يولياس قاعدة بيانات عملاء؟", a: "لا. يولياس لا يبيع قوائم ولا بيانات: تدفع مقابل الأشخاص الذين يجدهم ويتواصل معهم لحملاتك، وما تتابعه هو النتيجة (اجتماعات أو عملاء أو مبيعات) وتكلفة كل منها." },
        { q: "لمن صُمم يولياس؟", a: "للشركات التي تبيع لشركات أخرى وتريد عملاء أكثر من قناة تتحكم فيها: الوكالات ومقدمو الخدمات وشركات البرمجيات وSaaS والاستشاريون والمستقلون والمؤسسون وفرق المبيعات." },
        { q: "كيف أنشئ حملة؟", a: "في ثلاث خطوات مثل مدير الإعلانات: الحملة (الاجتماعات التي تريدها وعرضك والميزانية والتواريخ)، وجمهور أو أكثر (المواقع والمجالات وحجم الشركة والمسميات الوظيفية والاستبعادات، أو جمهور محفوظ أو مخصص أو مشابه)، والرسالة (بريدك والأسلوب واللغة والملاحظات، مع معاينة). ثم تشغّلها." },
        { q: "هل يرد يولياس على الردود بنفسه؟", a: "نعم. يجيب عن الأسئلة والاعتراضات من معرفة شركتك، ويرسل للمهتمين صفحة الحجز ويحجز الاجتماع. وما يحتاجك يصلك." },
        { q: "من أين تأتي البيانات، وما مدى دقتها؟", a: "من مصادر البيانات المتصلة بيولياس ومن المعلومات العامة مثل مواقع الشركات. يحتفظ كل سجل بمصدره، وتُصنَّف بيانات التواصل حسب حالة التحقق، وما لم يعثر عليه يولياس يظهر كغير متوفر بدل تخمينه." },
        { q: "ماذا تعني الأرقام؟", a: "تعرض كل حملة الأشخاص والشركات التي اكتشفها يولياس، والرسائل المرسلة والتي فُتحت (تقريبيًا) والتي رُد عليها والتي لم يُرد عليها، والاجتماعات المحجوزة والمؤكدة والمنعقدة، وزيارات رابط الحجز والحجوزات منه والنماذج التي لم تكتمل، والإنفاق وتكلفة الاجتماع (كل ما صُرف ÷ الاجتماعات المحجوزة)، وهي النتيجة التي يعمل لها يولياس. والرقم الذي لا يمكن حسابه بعد يظهر شرطة، وليس صفرًا." },
        { q: "كيف يقرر يولياس أين تذهب الميزانية؟", a: "مثل تحسين ميزانية الحملة في منصات الإعلانات: مرة يوميًا يعطي كل جمهور نصيبًا من ميزانية الحملة حسب معدل الاجتماعات المحجوزة (أو الشراء أو النماذج لتلك الأهداف). وحين تكون قليلة يعتمد على الردود الإيجابية، ويحصل الجمهور الجديد على فرصة عادلة أولًا. والجمهور الأضعف بوضوح، أو الذي تتجاوز تكلفته الحد الأقصى الذي حددته للاجتماع، لا يحصل على ميزانية جديدة. ولا يغيّر ذلك طريقة الكتابة ولا كمية الإرسال ولا من يمكن التواصل معه." },
        { q: "ماذا أحتاج لأبدأ؟", a: "بريد عمل، وصندوق بريد للإرسال (Gmail أو أي بريد IMAP/SMTP)، وبضعة أسطر عن شركتك (أو موقعك ليقرأه يولياس)، ورصيد أو خطة." },
        { q: "ما اللغات التي يدعمها يولياس؟", a: "يعمل المنتج بالعربية والإنجليزية، ويكتب يولياس الرسائل بخمس عشرة لغة، وبلغة كل شخص عندما تختار ذلك." },
        { q: "كم تكلفة يولياس؟", a: "الدفع حسب الاستخدام (رصيد مسبق من 5 دولارات، نحو 0.10 دولار لكل شخص يجده يولياس ويتواصل معه) أو خطتا النمو (100 دولار) والتوسع (200 دولار) بنصف السعر للشخص، شهريًا أو سنويًا بخصم 20%. الرسائل والردود والاجتماعات بلا رسوم. كل الميزات ومستخدمون بلا حد في كل خيار. الأسعار في صفحة الأسعار." },
      ],
    },
    cta: {
      title: "أطلق حملتك الأولى.",
      body: "حدد العملاء الذين تريدهم. ويصل إليهم يولياس ويعود إليك بالنتائج.",
      primary: "ابدأ الآن",
      primaryTrial: "ابدأ التجربة المجانية",
      secondary: "عرض الأسعار",
    },
  },
};

export const product: Localized<{
  eyebrow: string; title: string; lead: string; primary: string; secondary: string;
  sections: { title: string; body: string; points?: string[] }[];
  icp: { label: string; value: string }[];
  stages: string[];
  shotCaption: string;
  more: { eyebrow: string; title: string; tiles: { title: string; body: string }[] };
  cta: { title: string; body: string; primary: string };
}> = {
  en: {
    eyebrow: "THE PLATFORM",
    title: "An advertising platform for customer acquisition campaigns.",
    lead: "Create campaigns, define audiences, set budgets and follow every result through to meetings and sales. Yolias AI runs each campaign: it finds the people, writes to each one, answers and books.",
    primary: "Get started",
    secondary: "See pricing",
    sections: [
      {
        title: "Campaign Manager",
        body: "A campaign for each service, goal or market, created in three levels like an ads manager. Campaign: the objective (meetings, sales, website leads or qualified leads), your offer, the budget in US dollars and the dates. Audiences: who to reach. Message: your mailbox, tone and language.",
        points: ["Total or daily budget, with the people it buys shown before you launch", "On/off, edit, duplicate and compare campaigns", "Days and hours to contact people, in your time zone"],
      },
      {
        title: "Audiences anywhere in the world",
        body: "Every country, then its regions and cities, included or excluded; industries, company type and size, job titles, seniority, departments, signals and companies never to contact. Save an audience, build one from your own list, or a lookalike of your best customers.",
      },
      {
        title: "Yolias AI runs each campaign",
        body: "Yolias AI finds the companies and decision makers, writes a different email to each from your Company Knowledge, sends it from your mailbox and follows up twice. It answers questions and objections, offers times and books the meeting; what needs you comes to you.",
        points: ["Answers in each person's language", "Books meetings on your calendar", "Splits the budget daily between audiences by their results"],
      },
      {
        title: "Budget and results like an ads dashboard",
        body: "Campaigns, audiences and messages in one table with an on/off switch per row and a Breakdown by day, audience, country or job title: reached, replies, interested, meetings, spend and cost per result, conversions and revenue from the Yolias pixel.",
      },
      {
        title: "Conversations and meetings",
        body: "Every reply from every campaign is in Conversations, with the campaign it came from; every booking is in Meetings, on your booking page and in Google Calendar.",
        points: ["Gmail, Outlook or any IMAP/SMTP mailbox, each with its own sending rules", "Google Calendar busy times never offered", "Arabic and English, end to end"],
      },
    ],
    icp: [
      { label: "Market", value: "Saudi Arabia" },
      { label: "Industry", value: "SaaS" },
      { label: "Company size", value: "20–200 employees" },
      { label: "Signals", value: "Hiring: sales, engineering" },
      { label: "Decision makers", value: "Founder, CEO, CTO" },
      { label: "Assumed", value: "Target of 100 companies" },
    ],
    stages: ["Campaign", "Audience", "Find the people", "Write to each", "Conversation", "Meeting or sale"],
    shotCaption: "A real Yolias screen, shown with sample data.",
    more: {
      eyebrow: "MORE",
      title: "Around your campaigns.",
      tiles: [
        { title: "Yolias AI", body: "Ask about your campaigns, replies and meetings from any screen, or describe who you want to meet and it prepares the campaign for you to launch." },
        { title: "Export", body: "Download campaigns, audiences and the people Yolias reached as CSV." },
        { title: "Team", body: "Unlimited users on every plan, with owner, admin and member roles for each workspace." },
        { title: "Daily emails", body: "New people found, changes to your campaigns and yesterday's numbers, only when there is something to say." },
      ],
    },
    cta: { title: "See it on your own market.", body: "The fastest way to understand Yolias is to give it a real target: the result you want and the customers you want to reach.", primary: "Get started" },
  },
  ar: {
    eyebrow: "المنصة",
    title: "منصة إعلانية لإدارة حملات اكتساب العملاء.",
    lead: "أنشئ الحملات، وحدد الجماهير، واضبط الميزانيات، وتابع كل نتيجة حتى الاجتماعات والمبيعات. ويدير Yolias AI كل حملة: يجد الأشخاص، ويكتب لكل منهم، ويرد ويحجز.",
    primary: "ابدأ الآن",
    secondary: "عرض الأسعار",
    sections: [
      {
        title: "مدير الحملات",
        body: "حملة لكل خدمة أو هدف أو سوق، تُنشأ على ثلاثة مستويات مثل مدير الإعلانات. الحملة: الهدف (اجتماعات أو مبيعات أو عملاء من موقعك أو عملاء مؤهلون)، وعرضك، والميزانية بالدولار، والتواريخ. الجماهير: من تريد الوصول إليه. الرسالة: بريدك ونبرتك ولغتك.",
        points: ["ميزانية إجمالية أو يومية، مع عدد الأشخاص الذي تشتريه قبل التشغيل", "تشغيل وإيقاف وتعديل ونسخ ومقارنة الحملات", "أيام وساعات التواصل بمنطقتك الزمنية"],
      },
      {
        title: "جماهير في أي مكان في العالم",
        body: "كل الدول، ثم مناطقها ومدنها، تضمينًا أو استبعادًا؛ والمجالات ونوع الشركة وحجمها والمسميات الوظيفية والمستوى والأقسام والمؤشرات والشركات التي لا تريد التواصل معها. احفظ الجمهور، أو ابنه من قائمتك، أو أنشئ جمهورًا مشابهًا لأفضل عملائك.",
      },
      {
        title: "Yolias AI يدير كل حملة",
        body: "يجد Yolias AI الشركات وصنّاع القرار، ويكتب لكل منهم رسالة مختلفة من معرفة شركتك، ويرسلها من بريدك ويتابع مرتين. ويجيب عن الأسئلة والاعتراضات، ويقترح المواعيد ويحجز الاجتماع، وما يحتاجك يصلك.",
        points: ["يرد بلغة كل شخص", "يحجز الاجتماعات في تقويمك", "يوزع الميزانية يوميًا بين الجماهير حسب نتائجها"],
      },
      {
        title: "الميزانية والنتائج مثل لوحة الإعلانات",
        body: "الحملات والجماهير والرسائل في جدول واحد بزر تشغيل وإيقاف لكل صف، وتقسيم حسب اليوم أو الجمهور أو البلد أو المسمى الوظيفي: من وصلت إليهم الحملة، والردود، والمهتمون، والاجتماعات، والإنفاق، وتكلفة كل نتيجة، والتحويلات والإيرادات من بيكسل يولياس.",
      },
      {
        title: "المحادثات والاجتماعات",
        body: "كل رد من كل حملة في المحادثات مع الحملة التي جاء منها؛ وكل حجز في الاجتماعات، وفي صفحة الحجز وتقويم Google.",
        points: ["Gmail أو Outlook أو أي بريد IMAP/SMTP، ولكل منها قواعد إرسال", "أوقات انشغالك في تقويم Google لا تُعرض أبدًا", "العربية والإنجليزية من البداية للنهاية"],
      },
    ],
    icp: [
      { label: "السوق", value: "السعودية" },
      { label: "القطاع", value: "SaaS" },
      { label: "حجم الشركة", value: "20–200 موظف" },
      { label: "المؤشرات", value: "توظيف: مبيعات، هندسة" },
      { label: "صنّاع القرار", value: "المؤسس، CEO، CTO" },
      { label: "افتراض", value: "هدف 100 شركة" },
    ],
    stages: ["الحملة", "الجمهور", "إيجاد الأشخاص", "الكتابة لكل منهم", "المحادثة", "اجتماع أو بيع"],
    shotCaption: "شاشة حقيقية من يولياس ببيانات توضيحية.",
    more: {
      eyebrow: "المزيد",
      title: "حول حملاتك.",
      tiles: [
        { title: "يولياس AI", body: "اسأل عن حملاتك وردودك واجتماعاتك من أي شاشة، أو صف من تريد مقابلتهم فيجهّز لك الحملة لتشغّلها." },
        { title: "التصدير", body: "نزّل الحملات والجماهير والأشخاص الذين تواصل معهم يولياس كملف CSV." },
        { title: "الفريق", body: "مستخدمون غير محدودين في كل خطة، مع أدوار المالك والمسؤول والعضو لكل مساحة عمل." },
        { title: "رسائل يومية", body: "أشخاص جدد وُجدوا، وتغييرات حملاتك، وأرقام أمس، فقط عندما يوجد ما يُقال." },
      ],
    },
    cta: { title: "جرّبه على سوقك أنت.", body: "أسرع طريقة لفهم يولياس أن تعطيه هدفًا حقيقيًا: النتيجة التي تريدها والعملاء الذين تريد الوصول إليهم.", primary: "ابدأ الآن" },
  },
};

export const about: Localized<{
  eyebrow: string; title: string; lead: string;
  storyTitle: string; story: string[];
  principlesEyebrow: string; principlesTitle: string; principles: { title: string; body: string }[];
  cta: { title: string; body: string; primary: string };
}> = {
  en: {
    eyebrow: "ABOUT YOLIAS",
    title: "Advertising that starts from the customer.",
    lead: "Every ad platform sells attention. Yolias sells customers: you choose who you want, and AI goes to them.",
    storyTitle: "Why we built it",
    story: [
      "Businesses that sell to other businesses pay more every year for clicks and views, and most of those views come from people who will never buy.",
      "The customers they want are known: a company, a city, a job title. What was missing is a platform that reaches those exact people, starts the conversation and carries it to a meeting, a lead or a sale.",
      "Yolias is that platform. A campaign has a goal, audiences and a message, like an ads manager. Yolias finds the decision makers, writes to each one, answers, follows up, books the meeting and counts every result and what it cost.",
      "We build it in Arabic and English from day one, for the markets we know best and the companies everywhere that sell the way they do.",
      "Under every campaign is one engine, Yolias AI. It understands the offer, finds the companies and people, writes each message, holds the conversation, follows up and measures the result; the campaign objective tells it which result to pursue: meetings, sales, website leads or qualified leads.",
      "Yolias is for agencies, consultants, service providers, freelancers and businesses of any size that want new customers every month, not only large sales teams. Each of them runs acquisition the way advertisers run ads: a campaign for each service, its own audience and budget, and its results next to the others.",
    ],
    principlesEyebrow: "WHAT WE BELIEVE",
    principlesTitle: "How Yolias works.",
    principles: [
      { title: "Results over reach", body: "A campaign is measured by meetings, leads and sales and the cost of each, not by views." },
      { title: "One person at a time", body: "Every message is written for the person who reads it, in their language." },
      { title: "Arabic is a first language", body: "Every screen, message and answer works in Arabic and English." },
      { title: "Your data is yours", body: "Isolated workspaces, your exports, your customers." },
    ],
    cta: { title: "Talk to us.", body: "Tell us who you sell to. We read every message.", primary: "Contact us" },
  },
  ar: {
    eyebrow: "عن يولياس",
    title: "إعلان يبدأ من العميل.",
    lead: "كل منصات الإعلانات تبيع الانتباه. ويولياس يبيع العملاء: تختار من تريد، والذكاء الاصطناعي يذهب إليه.",
    storyTitle: "لماذا بنيناه",
    story: [
      "الشركات التي تبيع لشركات أخرى تدفع كل عام أكثر مقابل النقرات والمشاهدات، ومعظم هذه المشاهدات من أشخاص لن يشتروا أبدًا.",
      "العملاء الذين تريدهم معروفون: شركة، ومدينة، ومسمى وظيفي. وما كان ينقص هو منصة تصل إلى هؤلاء الأشخاص بالذات، وتبدأ المحادثة وتكملها حتى اجتماع أو عميل أو بيع.",
      "يولياس هو هذه المنصة. للحملة هدف وجماهير ورسالة، مثل مدير الإعلانات. ويجد يولياس صنّاع القرار، ويكتب لكل منهم، ويرد ويتابع ويحجز الاجتماع، ويحسب كل نتيجة وتكلفتها.",
      "نبنيه بالعربية والإنجليزية من اليوم الأول، للأسواق التي نعرفها جيدًا وللشركات في كل مكان التي تبيع بالطريقة نفسها.",
      "وتحت كل حملة محرك واحد هو Yolias AI: يفهم العرض، ويجد الشركات والأشخاص، ويكتب كل رسالة، ويدير المحادثة، ويتابع، ويقيس النتيجة. وهدف الحملة يحدد له النتيجة التي يسعى إليها: اجتماعات أو مبيعات أو عملاء من الموقع أو عملاء مؤهلون.",
      "يولياس لوكالات التسويق والتصميم والتطوير، وللاستشاريين ومقدمي الخدمات والمستقلين، وللشركات الصغيرة والمتوسطة التي تبيع لشركات أخرى وتريد عملاء جددًا كل شهر، لا لفرق المبيعات الكبيرة وحدها. وكل منهم يدير اكتساب العملاء كما يدير المعلنون إعلاناتهم: حملة لكل خدمة، ولكل حملة جمهورها وميزانيتها، ونتائجها بجانب الحملات الأخرى.",
    ],
    principlesEyebrow: "ما نؤمن به",
    principlesTitle: "كيف يعمل يولياس.",
    principles: [
      { title: "النتائج قبل الانتشار", body: "تُقاس الحملة بالاجتماعات والعملاء والمبيعات وتكلفة كل منها، لا بالمشاهدات." },
      { title: "شخص واحد في كل مرة", body: "كل رسالة تُكتب لمن يقرؤها، وبلغته." },
      { title: "العربية لغة أولى", body: "كل شاشة ورسالة وإجابة تعمل بالعربية والإنجليزية." },
      { title: "بياناتك لك", body: "مساحات عمل معزولة، وتصديرك، وعملاؤك." },
    ],
    cta: { title: "تحدث معنا.", body: "أخبرنا لمن تبيع. نقرأ كل رسالة.", primary: "تواصل معنا" },
  },
};

export const contactPage: Localized<{
  eyebrow: string; title: string; lead: string;
  ways: { title: string; body: string; link?: { label: string; href: string } }[];
  formTitle: string;
}> = {
  en: {
    eyebrow: "CONTACT",
    title: "Talk to the Yolias team.",
    lead: "Questions about plans, a problem in your workspace or an idea for a partnership: send it here and a person will reply.",
    ways: [
      { title: "Sales & plans", body: "Choosing between Pay As You Go and the monthly plans.", link: { label: "Compare plans", href: "/pricing" } },
      { title: "Product support", body: "Most answers are already written up step by step.", link: { label: "Open the Help Center", href: "/help-center" } },
      { title: "Partnerships & press", body: "Data providers, agencies and media: pick the matching topic in the form." },
    ],
    formTitle: "Send us a message",
  },
  ar: {
    eyebrow: "تواصل",
    title: "تحدّث مع فريق يولياس.",
    lead: "سؤال عن الخطط، أو مشكلة في مساحة عملك، أو فكرة شراكة: أرسلها هنا وسيرد عليك شخص من الفريق.",
    ways: [
      { title: "المبيعات والخطط", body: "للمساعدة في الاختيار بين الدفع حسب الاستخدام والخطط الشهرية.", link: { label: "قارن الخطط", href: "/pricing" } },
      { title: "دعم المنتج", body: "معظم الإجابات مكتوبة بالفعل خطوة بخطوة.", link: { label: "افتح مركز المساعدة", href: "/help-center" } },
      { title: "الشراكات والإعلام", body: "مزودو البيانات والوكالات ووسائل الإعلام: اختر الموضوع المناسب في النموذج." },
    ],
    formTitle: "أرسل لنا رسالة",
  },
};
