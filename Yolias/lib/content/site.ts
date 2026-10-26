import type { Localized } from "./types";

// Copy for the public website pages. Written around what Yolias does today
// (owner brief 2026-10-20, conversion pass): find companies and decision
// makers from one sentence, explain each match, write outreach the member
// approves, keep replies and deals in Inbox and CRM. No claim the product
// can't keep: the free trial is promised only while checkout offers it.

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
    eyebrow: "AI PROSPECTING FOR B2B SALES",
    title: "Find the companies and decision makers worth selling to.",
    lead: "Describe your ideal customer in one sentence, in English or Arabic. Yolias finds the companies, local businesses and decision makers that match, shows why each one fits, and writes first emails you approve before they go out from your own mailbox.",
    primary: "Get started",
    primaryTrial: "Start free trial",
    secondary: "See how it works",
    reassure: "All features on every plan · Unlimited users · Cancel anytime",
    reassureTrial: "{days}-day free trial · All features on every plan · Cancel anytime",
    compare: {
      eyebrow: "WHY YOLIAS",
      title: "The list-building part of sales, done for you.",
      without: "Prospecting by hand",
      with: "With Yolias",
      rows: [
        { before: "Hours on Google, maps and LinkedIn looking for companies that might fit.", after: "One sentence. Yolias finds companies that match your market, industry, size and signals." },
        { before: "Guessing who decides, then copying names into a spreadsheet.", after: "The decision makers at each company, with the contact details that exist. Missing ones are marked, never guessed." },
        { before: "A generic first email that ignores what the company does.", after: "A first email and follow-ups written from your company knowledge and what Yolias found, sent only after you approve." },
        { before: "Replies scattered across inboxes and sheets.", after: "Replies in one place, Conversations, and every lead’s stage, deal value and next step in the CRM." },
      ],
    },
    how: {
      eyebrow: "HOW IT WORKS",
      title: "From one sentence to conversations with the right people.",
      steps: [
        { title: "Describe the customer", body: "Write it the way you would brief a colleague, in Arabic or English. Add a screenshot or an ICP document if that is easier." },
        { title: "Yolias finds and explains", body: "It turns your request into criteria (market, industry, size, signals, job titles), searches, and returns matching companies and decision makers with the reasons each one fits." },
        { title: "Approve outreach, follow replies", body: "Keep the prospects you want. Yolias writes the emails, sends them from your connected mailbox once you approve, and brings the replies to Conversations." },
      ],
    },
    features: {
      eyebrow: "WHAT YOU GET",
      title: "Built for people who sell services to businesses.",
      tiles: [
        { title: "Search in plain language", body: "No filter panels to learn. Say who you sell to, and Yolias fills what you left open from what it knows about your business, listed as assumptions you can see." },
        { title: "Reasons, not just a score", body: "Each prospect shows why it matched (market, industry, size, hiring, role), so you decide quickly who is worth a message." },
        { title: "Outreach you approve", body: "Personal first emails and follow-ups from your own Gmail or IMAP mailbox. Nothing is sent without your approval." },
        { title: "Arabic and English, end to end", body: "The whole product works right-to-left and left-to-right, and Yolias answers in the language you choose." },
      ],
    },
    statement: {
      text: "Yolias finds and qualifies the people worth talking to. How you reach them stays your decision.",
      small: "Nothing is sent without your approval, and only from your own account.",
    },
    faq: {
      eyebrow: "QUESTIONS, ANSWERED",
      title: "What people ask before they start",
      items: [
        { q: "What is Yolias?", a: "Yolias is an AI prospecting platform for businesses that sell services to other businesses. You describe your ideal customer in plain language, in English or Arabic, and Yolias finds matching companies, local businesses and decision makers, explains why each one fits, and writes first emails that it sends from your own mailbox once you approve." },
        { q: "Is Yolias a general AI chatbot?", a: "No. You talk to Yolias AI to describe customers and ask about your results, but it works inside Yolias: it runs searches, prepares outreach for your approval, reads replies and updates your CRM. It doesn’t browse the web for you or act outside your workspace." },
        { q: "Who is Yolias for?", a: "Teams and people who sell services to other businesses: marketing and software agencies, consultants, recruitment agencies, freelancers, real estate sales professionals and B2B sales teams." },
        { q: "What can I search for?", a: "Decision makers at companies that match your criteria, companies on their own, local businesses in a city or area, and companies similar to ones you name." },
        { q: "Where does the data come from, and how accurate is it?", a: "From the data sources connected to Yolias and from public information such as company websites. Every record keeps the source it came from, contact details are labelled by verification state, and anything Yolias couldn’t find is shown as not available instead of being guessed. What Yolias finds depends on your market and on what those sources cover." },
        { q: "Does Yolias send messages for me?", a: "Yes, after you approve. Yolias writes a first email and follow-ups from your Company Knowledge and the facts it found, and sends them from your own connected mailbox (Gmail or any IMAP/SMTP account). Yolias never messages anyone on LinkedIn." },
        { q: "Does Yolias run campaigns by itself?", a: "Yes, after one approval per campaign. When a search finishes, Yolias prepares an email campaign for the people it found, writes the first email and asks you once in the chat. You choose what the campaign is for: meetings, introducing your company, or selling directly with a sign-up link. After you approve, Yolias sends from your own mailbox within a daily limit, follows up with those who don’t reply and answers simple questions, even with the site closed. When someone is interested or asks for a meeting, Yolias moves them to the CRM and notifies you, and you take the deal from there. Objections, requests to talk to a person, unclear replies and stop requests come to you, and a campaign pauses itself if too many emails bounce. You can still create and send a campaign yourself from Prospects." },
        { q: "Can I manage replies and deals in Yolias?", a: "Yes. Replies to the emails Yolias sent from your mailbox come into Conversations, sorted, with a suggested answer. The CRM is a pipeline of every lead with a conversation, by where it stands: needs action (their reply waits for you), waiting on them, or follow-ups exhausted, as a board or a list. Each lead keeps its record with stage, deal value, meetings, reminders and history, linked to the conversation." },
        { q: "What do I need to get started?", a: "A work email, a plan, and a few lines about your company (or your website address, which Yolias can read to fill them in). Connect your mailbox when you are ready to send." },
        { q: "Which languages does Yolias support?", a: "The whole product works in Arabic and English, right-to-left and left-to-right. Messages can be drafted in 15 languages." },
        { q: "How much does Yolias cost?", a: "Three options: Pay As You Go (prepaid credit from $5, no subscription), or the monthly plans Pro and Growth. Every option has all the features and unlimited users. You pay for prospects only: emails are never charged. Monthly plans cancel any time. See the pricing page for current prices." },
      ],
    },
    cta: {
      title: "Start with one search.",
      body: "Describe your first customer profile and see who Yolias finds for it.",
      primary: "Get started",
      primaryTrial: "Start free trial",
      secondary: "See pricing",
    },
  },
  ar: {
    eyebrow: "اكتشاف العملاء بالذكاء الاصطناعي للمبيعات بين الشركات",
    title: "اعثر على الشركات وصنّاع القرار المناسبين لك.",
    lead: "صِف عميلك المثالي في جملة واحدة، بالعربية أو الإنجليزية. يجد يولـياس الشركات والأنشطة المحلية وصنّاع القرار المطابقين، ويوضّح سبب تطابق كل منهم، ويكتب رسائل بريد أولى توافق عليها قبل أن تُرسل من بريدك أنت.",
    primary: "ابدأ الآن",
    primaryTrial: "ابدأ التجربة المجانية",
    secondary: "شاهد كيف يعمل",
    reassure: "كل الميزات في كل خطة · مستخدمون غير محدودين · إلغاء في أي وقت",
    reassureTrial: "تجربة مجانية {days} أيام · كل الميزات في كل خطة · إلغاء في أي وقت",
    compare: {
      eyebrow: "لماذا يولـياس",
      title: "جزء بناء القوائم في المبيعات، يقوم به يولـياس عنك.",
      without: "البحث عن العملاء يدويًا",
      with: "مع يولـياس",
      rows: [
        { before: "ساعات على جوجل والخرائط و LinkedIn بحثًا عن شركات قد تناسبك.", after: "جملة واحدة، فيجد يولـياس الشركات المطابقة لسوقك وقطاعك وحجم الشركة والمؤشرات التي تريدها." },
        { before: "تخمين صاحب القرار، ثم نسخ الأسماء في جدول.", after: "صنّاع القرار في كل شركة مع بيانات التواصل المتوفرة فعلًا. وما لم يُعثر عليه يظهر كذلك، ولا يُخمَّن أبدًا." },
        { before: "رسالة أولى عامة لا تذكر ما تفعله الشركة.", after: "رسالة أولى ومتابعات مكتوبة من معرفة شركتك وما وجده يولـياس، ولا تُرسل إلا بعد موافقتك." },
        { before: "ردود متفرقة بين صناديق البريد والجداول.", after: "الردود في صندوق وارد واحد، ومرحلة كل عميل وقيمة صفقته وخطوته التالية في إدارة العملاء." },
      ],
    },
    how: {
      eyebrow: "كيف يعمل",
      title: "من جملة واحدة إلى محادثات مع الأشخاص المناسبين.",
      steps: [
        { title: "صِف العميل", body: "اكتبه كما تشرح المهمة لزميل، بالعربية أو الإنجليزية. أضف لقطة شاشة أو مستند ICP إن كان ذلك أسهل." },
        { title: "يجد يولـياس ويشرح", body: "يحوّل طلبك إلى معايير (السوق والقطاع والحجم والمؤشرات والمسميات الوظيفية)، ويبحث، ويعيد لك الشركات وصنّاع القرار المطابقين مع سبب تطابق كل منهم." },
        { title: "وافق على التواصل وتابع الردود", body: "احتفظ بمن تريد. يكتب يولـياس الرسائل، ويرسلها من بريدك المتصل بعد موافقتك، ويجلب الردود إلى المحادثات." },
      ],
    },
    features: {
      eyebrow: "ما الذي تحصل عليه",
      title: "مصمم لمن يبيعون خدماتهم للشركات.",
      tiles: [
        { title: "بحث بلغة طبيعية", body: "لا لوحات فلاتر لتتعلمها. قل لمن تبيع، ويكمل يولـياس ما تركته مفتوحًا مما يعرفه عن عملك، ويعرضه كافتراضات تراها بوضوح." },
        { title: "أسباب، لا مجرد رقم", body: "يوضّح كل عميل محتمل سبب تطابقه (السوق والقطاع والحجم والتوظيف والمنصب)، فتقرر بسرعة من يستحق رسالة." },
        { title: "تواصل توافق عليه", body: "رسائل أولى ومتابعات شخصية من بريدك على Gmail أو IMAP. لا يُرسل شيء بدون موافقتك." },
        { title: "العربية والإنجليزية بالكامل", body: "يعمل المنتج كله من اليمين لليسار ومن اليسار لليمين، ويرد يولـياس باللغة التي تختارها." },
      ],
    },
    statement: {
      text: "يجد يولـياس الأشخاص الذين يستحقون التواصل ويؤهلهم. أما طريقة الوصول إليهم فتبقى قرارك.",
      small: "لا يُرسل شيء بدون موافقتك، ومن حسابك أنت فقط.",
    },
    faq: {
      eyebrow: "إجابات مباشرة",
      title: "أسئلة يطرحها الناس قبل البدء",
      items: [
        { q: "ما هو يولـياس؟", a: "يولـياس منصة لاكتشاف العملاء بالذكاء الاصطناعي للشركات والأشخاص الذين يبيعون خدماتهم لشركات أخرى. تصف عميلك المثالي بلغة طبيعية، بالعربية أو الإنجليزية، فيجد يولـياس الشركات والأنشطة المحلية وصنّاع القرار المطابقين، ويشرح سبب تطابق كل نتيجة، ويكتب رسائل بريد أولى يرسلها من بريدك بعد موافقتك." },
        { q: "هل يولـياس روبوت محادثة عام؟", a: "لا. تتحدث مع Yolias AI لتصف عملاءك وتسأل عن نتائجك، لكنه يعمل داخل يولـياس: يشغّل عمليات البحث، ويجهّز رسائل التواصل لموافقتك، ويقرأ الردود، ويحدّث إدارة العملاء. لا يتصفح الإنترنت نيابة عنك ولا يتصرف خارج مساحة عملك." },
        { q: "لمن صُمم يولـياس؟", a: "للفرق والأشخاص الذين يبيعون خدمات لشركات أخرى: وكالات التسويق والبرمجيات، والاستشاريين، ووكالات التوظيف، والمستقلين، ومسوّقي العقارات، وفرق المبيعات B2B." },
        { q: "عن ماذا يمكنني البحث؟", a: "عن صنّاع القرار في الشركات المطابقة لمعاييرك، أو عن الشركات وحدها، أو عن الأنشطة التجارية المحلية في مدينة أو منطقة، أو عن شركات تشبه شركات تذكرها." },
        { q: "من أين تأتي البيانات، وما مدى دقتها؟", a: "من مصادر البيانات المتصلة بيولـياس ومن المعلومات العامة مثل مواقع الشركات. يحتفظ كل سجل بالمصدر الذي جاء منه، وتُصنَّف بيانات التواصل حسب حالة التحقق، وما لم يعثر عليه يولـياس يظهر كغير متوفر بدل تخمينه. ما يجده يولـياس يعتمد على سوقك وعلى ما تغطيه هذه المصادر." },
        { q: "هل يرسل يولـياس الرسائل نيابةً عني؟", a: "نعم، بعد موافقتك. يكتب يولـياس رسالة أولى ومتابعات من معرفة شركتك والمعلومات التي وجدها، ويرسلها من صندوق بريدك المتصل (Gmail أو أي بريد IMAP/SMTP). ولا يرسل يولـياس رسائل على LinkedIn أبدًا." },
        { q: "هل يدير يولـياس الحملات بنفسه؟", a: "نعم، بعد موافقة واحدة لكل حملة. عندما ينتهي البحث يجهّز يولـياس حملة بريد للأشخاص الذين وجدهم، ويكتب أول رسالة، ويسألك مرة واحدة في المحادثة. تختار هدف الحملة: اجتماعات، أو التعريف بشركتك، أو البيع المباشر برابط التسجيل. بعد موافقتك يرسل يولـياس من بريدك ضمن حد يومي، ويتابع من لم يرد، ويجيب عن الأسئلة البسيطة، حتى لو أغلقت الموقع. وعندما يهتم شخص أو يطلب اجتماعًا، ينقله يولـياس إلى إدارة العملاء ويرسل لك إشعارًا لتكمل الصفقة بنفسك. الاعتراضات وطلبات التحدث مع شخص والردود غير الواضحة وطلبات الإيقاف تصلك أنت، وتتوقف الحملة وحدها إذا ارتدت رسائل كثيرة. ويمكنك دائمًا إنشاء حملة وإرسالها بنفسك من العملاء المحتملين." },
        { q: "هل يمكنني إدارة الردود والصفقات في يولـياس؟", a: "نعم. تصل الردود على الرسائل التي أرسلها يولـياس من بريدك إلى المحادثات مصنّفة مع رد مقترح. وإدارة العملاء لوحة لكل عميل لديه محادثة حسب موقعه: يحتاج إجراء (رده ينتظرك)، أو في انتظارهم، أو انتهت متابعاته، كلوحة أو قائمة. ولكل عميل سجله بمرحلته وقيمة الصفقة والاجتماعات والتذكيرات والسجل، مع رابط للمحادثة." },
        { q: "ماذا أحتاج لأبدأ؟", a: "بريد عمل، وخطة، وبضعة أسطر عن شركتك (أو عنوان موقعك ليقرأه يولـياس ويملأها). واربط بريدك عندما تكون جاهزًا للإرسال." },
        { q: "ما اللغات التي يدعمها يولـياس؟", a: "يعمل المنتج كله بالعربية والإنجليزية، من اليمين لليسار ومن اليسار لليمين، ويمكن كتابة الرسائل بـ 15 لغة." },
        { q: "كم تكلفة يولـياس؟", a: "ثلاثة خيارات: الدفع حسب الاستخدام (رصيد مسبق من 5 دولارات بدون اشتراك)، أو الخطتان الشهريتان برو والنمو. كل خيار فيه كل الميزات ومستخدمون غير محدودين. تدفع مقابل العملاء المحتملين فقط، والرسائل بدون رسوم. الخطط الشهرية تُلغى في أي وقت. الأسعار الحالية في صفحة الأسعار." },
      ],
    },
    cta: {
      title: "ابدأ ببحث واحد.",
      body: "صِف أول ملف لعملائك، وشاهد من يجده يولـياس لك.",
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
    eyebrow: "YOLIAS AI",
    title: "Turn one sentence about your customer into a list of people to talk to.",
    lead: "Describe who you sell to. Yolias AI finds the companies and decision makers that fit, explains every match, writes the outreach you approve and keeps the replies and deals in one place.",
    primary: "Get started",
    secondary: "See pricing",
    sections: [
      {
        title: "Start a search",
        body: "Start from the prompt box. Type your request or attach a file: a CSV of accounts you like, a PDF brief, or a screenshot of a company you want more of.",
        points: ["Arabic or English, typed naturally", "Up to three attachments per request", "Quick-start examples for common markets"],
      },
      {
        title: "Yolias reads the ICP",
        body: "Your request becomes structured criteria. Anything you left open is filled from what you told Yolias about your business, and listed as an assumption so you can see it.",
      },
      {
        title: "Follow the search as it works",
        body: "Each search has a target number of prospects. Yolias AI shows the step it is on, from planning to delivery, and tells you when the results are ready or when fewer matches exist than you asked for.",
      },
      {
        title: "Prospects with their evidence",
        body: "Results show the company, headcount, location and the person’s role. Contact channels are labelled by verification state, and every record keeps the source it came from.",
      },
      {
        title: "Outreach, replies and deals",
        body: "Pick the prospects you want and Yolias writes a personal first email and follow-ups from your Company Knowledge. They are sent from your own mailbox only after you approve.",
        points: ["Gmail or any IMAP/SMTP mailbox", "Replies arrive in Conversations, sorted, with a suggested answer", "Every lead’s stage, deal value and meetings in the CRM"],
      },
    ],
    icp: [
      { label: "Market", value: "Saudi Arabia" },
      { label: "Industry", value: "B2B SaaS" },
      { label: "Company size", value: "20–200 employees" },
      { label: "Signals", value: "Hiring: sales, engineering" },
      { label: "Decision makers", value: "Founder, CEO, CTO" },
      { label: "Assumed", value: "Target of 100 companies" },
    ],
    stages: ["Understand the request", "Plan the search", "Find companies", "Find decision makers", "Enrich and verify", "Qualify and deliver"],
    shotCaption: "A real Yolias screen, shown with sample data.",
    more: {
      eyebrow: "AROUND THE CORE",
      title: "Everything else you need to work the list.",
      tiles: [
        { title: "Analytics", body: "Companies and decision makers found, average ICP match, emails sent, replies, meetings and deals won, over 7, 30 or 90 days." },
        { title: "Export", body: "Filter saved prospects by type, market, industry or match score and download them as CSV for your own tools." },
        { title: "Team", body: "Unlimited users on every plan, with owner, admin and member roles for each workspace." },
        { title: "History", body: "Pin the searches you return to, rename them, or remove the ones you no longer need." },
      ],
    },
    cta: { title: "See it on your own market.", body: "The fastest way to understand Yolias is to give it a real target.", primary: "Get started" },
  },
  ar: {
    eyebrow: "يولـياس AI",
    title: "حوّل جملة واحدة عن عميلك إلى قائمة بأشخاص تتحدث معهم.",
    lead: "صِف لمن تبيع. يجد Yolias AI الشركات وصنّاع القرار المناسبين، ويشرح كل تطابق، ويكتب رسائل التواصل التي توافق عليها، ويجمع الردود والصفقات في مكان واحد.",
    primary: "ابدأ الآن",
    secondary: "عرض الأسعار",
    sections: [
      {
        title: "ابدأ بحثًا",
        body: "ابدأ من مربع الكتابة. اكتب طلبك أو أرفق ملفًا: قائمة CSV بحسابات تعجبك، أو ملف PDF، أو لقطة شاشة لشركة تريد أمثالها.",
        points: ["اكتب بالعربية أو الإنجليزية بشكل طبيعي", "حتى ثلاثة مرفقات في كل طلب", "أمثلة جاهزة لأسواق شائعة"],
      },
      {
        title: "يقرأ يولـياس ملف العميل المثالي",
        body: "يتحول طلبك إلى معايير منظمة. وما تركته مفتوحًا يُكمل مما أخبرت به يولـياس عن عملك، ويظهر كافتراض حتى تراه بوضوح.",
      },
      {
        title: "تابع البحث وهو يعمل",
        body: "لكل بحث عدد مستهدف من العملاء المحتملين. يعرض Yolias AI الخطوة التي يعمل عليها من التخطيط حتى التسليم، ويخبرك عندما تجهز النتائج أو عندما تكون المطابقات أقل مما طلبت.",
      },
      {
        title: "عملاء محتملون مع أدلتهم",
        body: "تعرض النتائج الشركة وعدد موظفيها وموقعها ومنصب الشخص. تُصنَّف قنوات التواصل حسب حالة التحقق، ويحتفظ كل سجل بالمصدر الذي جاء منه.",
      },
      {
        title: "التواصل والردود والصفقات",
        body: "اختر العملاء المحتملين الذين تريدهم، ويكتب يولـياس رسالة أولى ومتابعات شخصية من معرفة شركتك. ولا تُرسل من بريدك إلا بعد موافقتك.",
        points: ["Gmail أو أي بريد IMAP/SMTP", "تصل الردود إلى المحادثات مصنّفة مع رد مقترح", "مرحلة كل عميل وقيمة صفقته واجتماعاته في إدارة العملاء"],
      },
    ],
    icp: [
      { label: "السوق", value: "السعودية" },
      { label: "القطاع", value: "B2B SaaS" },
      { label: "حجم الشركة", value: "20–200 موظف" },
      { label: "المؤشرات", value: "توظيف: مبيعات، هندسة" },
      { label: "صنّاع القرار", value: "المؤسس، CEO، CTO" },
      { label: "افتراض", value: "هدف 100 شركة" },
    ],
    stages: ["فهم الطلب", "تخطيط البحث", "العثور على الشركات", "العثور على صنّاع القرار", "الإثراء والتحقق", "التأهيل والتسليم"],
    shotCaption: "شاشة حقيقية من يولـياس ببيانات توضيحية.",
    more: {
      eyebrow: "حول المنتج الأساسي",
      title: "كل ما تحتاجه للعمل على القائمة.",
      tiles: [
        { title: "التحليلات", body: "الشركات وصنّاع القرار المكتشفون، ومتوسط مطابقة ICP، والرسائل المرسلة والردود والاجتماعات والصفقات الرابحة، لآخر 7 أو 30 أو 90 يومًا." },
        { title: "التصدير", body: "فلتر العملاء المحفوظين حسب النوع أو السوق أو القطاع أو نسبة التطابق، ونزّلهم كملف CSV لأدواتك." },
        { title: "الفريق", body: "مستخدمون غير محدودين في كل خطة، مع أدوار المالك والمسؤول والعضو لكل مساحة عمل." },
        { title: "السجل", body: "ثبّت عمليات البحث التي تعود إليها، وأعد تسميتها، أو احذف ما لم تعد تحتاجه." },
      ],
    },
    cta: { title: "جرّبه على سوقك أنت.", body: "أسرع طريقة لفهم يولـياس أن تعطيه هدفًا حقيقيًا.", primary: "ابدأ الآن" },
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
    title: "Customer discovery should take minutes, not weeks.",
    lead: "Most B2B teams spend more time building lists than talking to customers. Yolias exists to reverse that ratio.",
    storyTitle: "Why we built it",
    story: [
      "Finding the right companies is slow work: searching directories, checking headcounts, guessing who decides, copying details into a sheet. By the time the list is ready, the market has moved and the team is tired of it.",
      "In the Gulf and the wider region the problem is sharper. Company data is scattered across sources, and most prospecting tools treat Arabic as an afterthought. We wanted a tool that understands a brief written the way founders and sales leads actually write, in either language, and does the research part properly.",
    ],
    principlesEyebrow: "WHAT WE BELIEVE",
    principlesTitle: "Four rules the product follows.",
    principles: [
      { title: "You approve before anything goes out", body: "Yolias finds and qualifies, prepares the campaign and shows it to you. It sends only after you approve, from your own mailbox, and stops when someone replies or asks not to be contacted." },
      { title: "Fewer, better-matched prospects", body: "A short list with clear reasons beats a long one you have to clean. Match scores always show their evidence." },
      { title: "Arabic is a first language", body: "Every screen, email and answer works in Arabic and English, right-to-left and left-to-right." },
      { title: "Your data stays yours", body: "Workspaces are isolated, exports are yours, and deleting your account removes your discovered data." },
    ],
    cta: { title: "Questions about Yolias?", body: "Tell us what you are trying to sell and to whom. We read every message.", primary: "Contact us" },
  },
  ar: {
    eyebrow: "عن يولـياس",
    title: "اكتشاف العملاء يجب أن يستغرق دقائق، لا أسابيع.",
    lead: "تقضي معظم فرق B2B وقتًا في بناء القوائم أكثر مما تقضيه في التحدث مع العملاء. وُجد يولـياس ليعكس هذه المعادلة.",
    storyTitle: "لماذا بنيناه",
    story: [
      "العثور على الشركات المناسبة عمل بطيء: بحث في الأدلة، والتحقق من أعداد الموظفين، وتخمين من يملك القرار، ونسخ التفاصيل إلى جدول. وحين تجهز القائمة يكون السوق قد تغيّر والفريق قد ملّ منها.",
      "وفي الخليج والمنطقة تكون المشكلة أوضح. بيانات الشركات موزعة على مصادر كثيرة، ومعظم أدوات البحث عن العملاء تتعامل مع العربية كأمر ثانوي. أردنا أداة تفهم الطلب كما يكتبه المؤسسون ومديرو المبيعات فعلًا، بأي من اللغتين، وتنجز جزء البحث كما يجب.",
    ],
    principlesEyebrow: "ما نؤمن به",
    principlesTitle: "أربع قواعد يلتزم بها المنتج.",
    principles: [
      { title: "موافقتك قبل أي إرسال", body: "يجد يولـياس العملاء ويؤهلهم، ويجهّز الحملة ويعرضها عليك. لا يرسل إلا بعد موافقتك، ومن صندوق بريدك أنت، ويتوقف عندما يرد أحد أو يطلب عدم التواصل." },
      { title: "عدد أقل ومطابقة أدق", body: "قائمة قصيرة بأسباب واضحة أفضل من قائمة طويلة تحتاج إلى تنظيف. نسب التطابق تعرض أدلتها دائمًا." },
      { title: "العربية لغة أولى", body: "كل شاشة وبريد وإجابة تعمل بالعربية والإنجليزية، من اليمين لليسار ومن اليسار لليمين." },
      { title: "بياناتك تبقى لك", body: "مساحات العمل معزولة، والتصدير ملكك، وحذف حسابك يحذف البيانات التي اكتشفتها." },
    ],
    cta: { title: "لديك أسئلة عن يولـياس؟", body: "أخبرنا ماذا تبيع ولمن، فنحن نقرأ كل رسالة.", primary: "تواصل معنا" },
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
    title: "تحدّث مع فريق يولـياس.",
    lead: "سؤال عن الخطط، أو مشكلة في مساحة عملك، أو فكرة شراكة: أرسلها هنا وسيرد عليك شخص من الفريق.",
    ways: [
      { title: "المبيعات والخطط", body: "للمساعدة في الاختيار بين الدفع حسب الاستخدام والخطط الشهرية.", link: { label: "قارن الخطط", href: "/pricing" } },
      { title: "دعم المنتج", body: "معظم الإجابات مكتوبة بالفعل خطوة بخطوة.", link: { label: "افتح مركز المساعدة", href: "/help-center" } },
      { title: "الشراكات والإعلام", body: "مزودو البيانات والوكالات ووسائل الإعلام: اختر الموضوع المناسب في النموذج." },
    ],
    formTitle: "أرسل لنا رسالة",
  },
};
