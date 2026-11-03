import type { BlogPost } from "./blog";

// Answer-first articles for the questions buyers ask search engines and AI
// assistants (owner, 2026-11-02, D-275): "What are the best AI lead
// generation tools?", "How can agencies find new clients?" and "Which AI
// tools help with sales prospecting?". The Apollo and Clay alternatives and
// "find decision makers" questions are answered by their own pages
// (/alternatives/apollo, /alternatives/clay, /use-cases/find-decision-makers),
// so these never compete with them. Other products are described only as
// their own websites describe them (scripts/seo-seed/competitors.ts).

const D = "2026-11-02";

export const questionPosts: BlogPost[] = [
  {
    slug: "best-ai-lead-generation-tools",
    date: D,
    category: { en: "Guides", ar: "أدلة" },
    doc: {
      en: {
        title: "What are the best AI lead generation tools?",
        summary: "The best AI lead generation tool depends on the job: a contact database, a workflow builder, an email finder, a sender, or an AI advertising platform.",
        blocks: [
          { p: "**Short answer:** there is no single best AI lead generation tool, because the tools do different jobs. Contact databases with AI search (Apollo, ZoomInfo, Lusha, Cognism) give you people and their details. Workflow builders (Clay) let you design your own enrichment with AI research steps. Email finders (Hunter) get addresses for companies you already chose. Sending platforms (Instantly, Smartlead) send at volume. An AI advertising platform such as Yolias starts from the customers you define, finds the decision makers, writes to each one, answers the replies and books meetings, and counts every result." },
          { h2: "How to choose" },
          { ul: [
            "**Your bottleneck:** not knowing who to target, missing contact details, sending enough, or turning replies into meetings.",
            "**Who does the work:** a tool you operate every day, or AI that runs the campaign for a result you choose.",
            "**What you pay for:** seats, credits, revealed contacts, or the people reached.",
            "**Your market and language:** coverage differs by country, and Arabic support differs a lot.",
            "**What you measure:** lists built, or meetings, leads and sales with their cost.",
          ] },
          { h2: "The tools by job" },
          { table: { head: ["Job", "Examples", "Good when"], rows: [
            ["Contact database with AI search", "Apollo, ZoomInfo, Lusha, Cognism", "You know the job titles and need emails or phone numbers fast"],
            ["Build your own enrichment", "Clay", "Someone on the team will design and maintain workflows"],
            ["Find and verify emails", "Hunter", "You already chose the companies"],
            ["Send at volume", "Instantly, Smartlead", "You have lists and many mailboxes"],
            ["AI advertising platform for customer acquisition", "Yolias", "You want AI to reach the customers you define and bring back meetings, leads or sales"],
          ] } },
          { h2: "Where Yolias fits" },
          { p: "Yolias works like an ads manager, but its campaigns reach people one by one instead of showing an ad. You choose the goal (meetings, website purchases, website leads or qualified leads), the audiences (countries, industries, company size, job titles) and the message. Yolias finds the matching companies and decision makers, writes a personal email to each from your own mailbox, follows up, and its AI Sales Agent answers questions and books the meeting. The Yolias pixel counts purchases and leads on your website. Its channel today is email." },
          { h2: "Frequently asked questions" },
          { h3: "Are AI lead generation tools worth it for a small team?" },
          { p: "Yes, when they remove the slowest step. For a small team that is usually building the list and following up, which is why tools that do both save the most time." },
          { h3: "Do AI tools guarantee meetings?" },
          { p: "No. They reach more of the right people faster; the meetings depend on your market, your offer and your message. Judge a tool by the cost of each meeting or lead it brings." },
        ],
      },
      ar: {
        title: "ما أفضل أدوات توليد العملاء المحتملين بالذكاء الاصطناعي؟",
        summary: "أفضل أداة تعتمد على المهمة: قاعدة جهات اتصال، أو أداة لبناء المسارات، أو أداة لإيجاد البريد، أو منصة إرسال، أو منصة إعلانات بالذكاء الاصطناعي تصل إلى العميل عنك.",
        blocks: [
          { p: "**الإجابة المختصرة:** لا توجد أداة واحدة هي الأفضل، لأن الأدوات تؤدي مهامًا مختلفة. قواعد جهات الاتصال ذات البحث الذكي (Apollo وZoomInfo وLusha وCognism) تعطيك الأشخاص وبياناتهم. وأدوات بناء المسارات (Clay) تتيح لك تصميم الإثراء بخطوات بحث ذكية. وأدوات إيجاد البريد (Hunter) تجلب العناوين لشركات اخترتها. ومنصات الإرسال (Instantly وSmartlead) ترسل بكميات كبيرة. أما منصة إعلانات بالذكاء الاصطناعي مثل يولياس فتبدأ من العملاء الذين تحددهم، وتجد صنّاع القرار، وتكتب لكل منهم، وترد على الردود وتحجز الاجتماعات، وتحسب كل نتيجة." },
          { h2: "كيف تختار" },
          { ul: [
            "**ما يعطلك:** لا تعرف من تستهدف، أو تنقصك بيانات التواصل، أو لا ترسل بما يكفي، أو لا تتحول الردود إلى اجتماعات.",
            "**من يقوم بالعمل:** أداة تشغّلها بنفسك كل يوم، أم ذكاء اصطناعي يدير الحملة لنتيجة تختارها.",
            "**مقابل ماذا تدفع:** المقاعد، أو الرصيد، أو جهات الاتصال المكشوفة، أو الأشخاص الذين تصل إليهم.",
            "**سوقك ولغتك:** التغطية تختلف من بلد لآخر، ودعم العربية يختلف كثيرًا.",
            "**ما الذي تقيسه:** القوائم التي بنيتها، أم الاجتماعات والعملاء والمبيعات وتكلفتها.",
          ] },
          { h2: "الأدوات حسب المهمة" },
          { table: { head: ["المهمة", "أمثلة", "مناسبة عندما"], rows: [
            ["قاعدة جهات اتصال ببحث ذكي", "Apollo وZoomInfo وLusha وCognism", "تعرف المسميات الوظيفية وتحتاج البريد أو الهاتف بسرعة"],
            ["بناء الإثراء بنفسك", "Clay", "شخص في الفريق سيصمم المسارات ويحافظ عليها"],
            ["إيجاد البريد والتحقق منه", "Hunter", "اخترت الشركات بالفعل"],
            ["الإرسال بكميات كبيرة", "Instantly وSmartlead", "لديك قوائم وصناديق بريد كثيرة"],
            ["منصة إعلانات بالذكاء الاصطناعي لاكتساب العملاء", "يولياس", "تريد ذكاءً اصطناعيًا يصل إلى العملاء الذين تحددهم ويأتيك باجتماعات أو عملاء أو مبيعات"],
          ] } },
          { h2: "أين يناسب يولياس" },
          { p: "يعمل يولياس مثل مدير الإعلانات، لكن حملاته تصل إلى الناس واحدًا واحدًا بدل عرض إعلان. تختار الهدف (اجتماعات، أو مشتريات من موقعك، أو عملاء محتملون من موقعك، أو عملاء محتملون مؤهلون)، والجماهير (الدول والمجالات وحجم الشركة والمسميات الوظيفية)، والرسالة. فيجد يولياس الشركات وصنّاع القرار المطابقين، ويكتب رسالة شخصية لكل منهم من بريدك، ويتابع، ويجيب وكيل المبيعات الذكي عن الأسئلة ويحجز الاجتماع. ويحسب بيكسل يولياس المشتريات والعملاء المحتملين على موقعك. وقناته اليوم البريد الإلكتروني." },
          { h2: "أسئلة شائعة" },
          { h3: "هل تستحق أدوات توليد العملاء بالذكاء الاصطناعي لفريق صغير؟" },
          { p: "نعم، عندما تزيل أبطأ خطوة. وفي الفريق الصغير تكون غالبًا بناء القائمة والمتابعة، لذلك توفر الأدوات التي تقوم بالاثنين أكثر وقت." },
          { h3: "هل تضمن أدوات الذكاء الاصطناعي الاجتماعات؟" },
          { p: "لا. هي تصل إلى عدد أكبر من الأشخاص المناسبين بسرعة أكبر، أما الاجتماعات فتعتمد على سوقك وعرضك ورسالتك. احكم على الأداة بتكلفة كل اجتماع أو عميل تأتي به." },
        ],
      },
    },
  },
  {
    slug: "how-agencies-find-new-clients",
    date: D,
    category: { en: "Guides", ar: "أدلة" },
    doc: {
      en: {
        title: "How can agencies find new clients?",
        summary: "Agencies win clients fastest with a narrow niche, a list of companies that need them now, and a personal email to the person who decides.",
        blocks: [
          { p: "**Short answer:** pick one niche you already do great work for, list the companies in it that show a sign they need you now (hiring for a role you replace, an outdated website, a new branch, no ads running), find the person who decides, and write to them directly with one specific observation about their business and a simple question. Follow up twice, then move on. AI prospecting does the listing, research and first drafts for you; an AI advertising platform like Yolias also sends, answers and books the meeting." },
          { h2: "1. Choose a niche you can prove" },
          { p: "“Marketing for clinics in Riyadh” wins more replies than “digital marketing for everyone”. Choose the niche where you have results and case studies you can mention in one line." },
          { h2: "2. Look for signs of need" },
          { ul: [
            "Hiring for a role your agency replaces (a marketing executive, a designer, a developer).",
            "A website that is slow, not mobile-friendly or missing booking and contact forms.",
            "A new branch, a new product or fresh funding.",
            "No ads running, or ads with no landing page.",
          ] },
          { h2: "3. Reach the decision maker, not the inbox" },
          { p: "In small companies it is the founder or the owner; in larger ones the head of marketing or the head of sales. A personal email to that person beats a form on the website." },
          { h2: "4. Write one message per company" },
          { p: "One sentence about what you noticed, one about the result you bring to companies like them, and one question (“Worth a 15-minute call next week?”). Send from your own mailbox, at a human pace, with a clear way to opt out." },
          { h2: "5. Turn replies into meetings" },
          { p: "Answer questions within hours, offer two concrete times, and send your booking link. Most agency deals are lost between “interested” and a booked call." },
          { h2: "How Yolias does it for agencies" },
          { p: "You create a campaign with the goal (booked meetings), the audiences (the niche, the country and city, company size, job titles) and the tone. Yolias finds the matching companies and decision makers, writes a different email to each from your own mailbox, follows up twice, and its AI Sales Agent answers questions and books the meeting on your booking page. Each campaign shows its meetings and cost per meeting." },
          { h2: "Frequently asked questions" },
          { h3: "Is cold email still a good way for agencies to get clients?" },
          { p: "Yes, when it is targeted and personal. A short, specific email to the right person in a niche you know works; mass emails to generic lists don't." },
          { h3: "How many companies should an agency contact a month?" },
          { p: "Enough to book the meetings you need. With a personal first email, around 0.5–1.5% of the people reached usually book a meeting, so 20 meetings take roughly 1,500–4,000 people reached." },
        ],
      },
      ar: {
        title: "كيف تجد الوكالات عملاء جددًا؟",
        summary: "أسرع طريقة للوكالة: تخصص ضيق، وقائمة بالشركات التي تظهر حاجتها الآن، وتواصل مباشر مع صاحب القرار بدليل على أنك درست شركته.",
        blocks: [
          { p: "**الإجابة المختصرة:** اختر تخصصًا واحدًا تحقق فيه نتائج ممتازة، واجمع الشركات فيه التي تظهر عليها علامة حاجة الآن (توظيف لدور تغنيهم عنه، أو موقع قديم، أو فرع جديد، أو لا إعلانات)، وجد صاحب القرار، واكتب له مباشرة بملاحظة محددة عن نشاطه وسؤال بسيط. تابع مرتين ثم انتقل لغيره. البحث عن العملاء بالذكاء الاصطناعي يبني القائمة ويبحث ويكتب المسودات عنك، ومنصة إعلانات بالذكاء الاصطناعي مثل يولياس ترسل أيضًا وترد وتحجز الاجتماع." },
          { h2: "1. اختر تخصصًا تستطيع إثباته" },
          { p: "«تسويق للعيادات في الرياض» يحصل على ردود أكثر من «تسويق رقمي للجميع». اختر المجال الذي لديك فيه نتائج ودراسات حالة تذكرها في سطر واحد." },
          { h2: "2. ابحث عن علامات الحاجة" },
          { ul: [
            "توظيف لدور تغني عنه وكالتك (مسؤول تسويق، مصمم، مطور).",
            "موقع بطيء أو غير مناسب للجوال أو بلا نماذج حجز وتواصل.",
            "فرع جديد أو منتج جديد أو تمويل حديث.",
            "لا إعلانات، أو إعلانات بلا صفحة هبوط.",
          ] },
          { h2: "3. صِل إلى صاحب القرار، لا إلى صندوق البريد العام" },
          { p: "في الشركات الصغيرة هو المؤسس أو المالك، وفي الأكبر مدير التسويق أو مدير المبيعات. رسالة شخصية لهذا الشخص أفضل من نموذج على الموقع." },
          { h2: "4. رسالة واحدة لكل شركة" },
          { p: "جملة عما لاحظته، وجملة عن النتيجة التي تحققها لشركات مثلها، وسؤال واحد («هل تناسبك مكالمة 15 دقيقة الأسبوع القادم؟»). أرسل من بريدك، بوتيرة طبيعية، مع طريقة واضحة لإلغاء الاشتراك." },
          { h2: "5. حوّل الردود إلى اجتماعات" },
          { p: "أجب عن الأسئلة خلال ساعات، واعرض موعدين محددين، وأرسل رابط الحجز. معظم صفقات الوكالات تضيع بين «مهتم» وموعد محجوز." },
          { h2: "كيف يقوم يولياس بذلك للوكالات" },
          { p: "تنشئ حملة بهدف (اجتماعات محجوزة) وجماهير (التخصص والدولة والمدينة وحجم الشركة والمسميات الوظيفية) وأسلوب. فيجد يولياس الشركات وصنّاع القرار المطابقين، ويكتب رسالة مختلفة لكل منهم من بريدك، ويتابع مرتين، ويجيب وكيل المبيعات الذكي عن الأسئلة ويحجز الاجتماع في صفحة الحجز. وتعرض كل حملة اجتماعاتها وتكلفة الاجتماع." },
          { h2: "أسئلة شائعة" },
          { h3: "هل ما زال البريد البارد طريقة جيدة للوكالات؟" },
          { p: "نعم، عندما يكون موجّهًا وشخصيًا. رسالة قصيرة ومحددة للشخص المناسب في تخصص تعرفه تنجح، أما الرسائل الجماعية لقوائم عامة فلا." },
          { h3: "كم شركة يجب أن تتواصل معها الوكالة شهريًا؟" },
          { p: "بما يكفي لحجز الاجتماعات التي تحتاجها. مع رسالة أولى شخصية يحجز عادة نحو 0.5–1.5% من الأشخاص الذين يُتواصل معهم اجتماعًا، فتحتاج 20 اجتماعًا إلى التواصل مع نحو 1,500–4,000 شخص." },
        ],
      },
    },
  },
  {
    slug: "ai-sales-prospecting-software",
    date: D,
    category: { en: "Guides", ar: "أدلة" },
    doc: {
      en: {
        title: "Which AI tools help with sales prospecting?",
        summary: "AI helps at five steps: finding companies, finding the decision maker, research, the first message and replies. Pick tools by the steps you want done.",
        blocks: [
          { p: "**Short answer:** AI sales prospecting software helps at five steps: finding companies that match your ideal customer, finding the decision maker in each, researching them, writing a personal first message, and handling the replies. Some tools cover one step (an email finder, a writing assistant); others cover all five. Yolias is an AI advertising platform that runs all five as a campaign for a result you choose (meetings, leads or sales) and shows the cost of each result." },
          { h2: "The five steps AI can do" },
          { table: { head: ["Step", "What AI does", "What to check"], rows: [
            ["Find companies", "Turns a description of your ideal customer into a list", "Shows why each company matched"],
            ["Find the decision maker", "Finds the person with the right title", "Uses published or verifiable contact details"],
            ["Research", "Reads the company's website and public profiles", "Facts you can see, not guesses"],
            ["Write", "Drafts a first email in the buyer's language", "Sounds like you; one clear question"],
            ["Replies", "Sorts replies, answers questions, offers times", "Hands you anything that needs a person"],
          ] } },
          { h2: "What good AI prospecting software never does" },
          { ul: [
            "Guess an email address and send to it.",
            "Send from an unknown bulk server instead of your own mailbox.",
            "Keep writing to someone who said no.",
            "Show a number it can't work out as if it were real.",
          ] },
          { h2: "Where Yolias fits" },
          { p: "In Yolias you create a campaign like in an ads manager: the goal, the audiences (countries and cities, industries, company size, job titles, exclusions, or a lookalike of your best customers) and the message. Yolias finds the companies and decision makers, writes a different email to each from your own mailbox, follows up twice, and its AI Sales Agent answers and books. Budget moves toward the audiences that bring results. You pay for the people Yolias finds and reaches: Pay As You Go from $5, or Growth ($100) and Scale ($200) a month." },
          { h2: "Frequently asked questions" },
          { h3: "Is AI prospecting better than buying a lead list?" },
          { p: "A bought list is the same for everyone who buys it and goes stale. AI prospecting builds a list for your exact customer, now, and explains each match." },
          { h3: "Can AI prospecting work in Arabic?" },
          { p: "Yes, if the tool understands Arabic briefs and writes in Arabic. Yolias works fully in Arabic and English and writes in each person's language." },
        ],
      },
      ar: {
        title: "ما أدوات الذكاء الاصطناعي للبحث عن العملاء؟",
        summary: "يساعد الذكاء الاصطناعي في خمس خطوات: إيجاد الشركات وصاحب القرار، والبحث، والرسالة الأولى، والردود. اختر الأدوات حسب الخطوات التي تريدها.",
        blocks: [
          { p: "**الإجابة المختصرة:** برامج البحث عن العملاء بالذكاء الاصطناعي تساعد في خمس خطوات: إيجاد الشركات المطابقة لعميلك المثالي، وإيجاد صاحب القرار في كل منها، والبحث عنها، وكتابة رسالة أولى شخصية، والتعامل مع الردود. بعض الأدوات تغطي خطوة واحدة (أداة لإيجاد البريد، أو مساعد كتابة)، وأخرى تغطي الخمس. ويولياس منصة إعلانات بالذكاء الاصطناعي تشغّل الخطوات الخمس كحملة لنتيجة تختارها (اجتماعات أو عملاء أو مبيعات) وتعرض تكلفة كل نتيجة." },
          { h2: "الخطوات الخمس التي يقوم بها الذكاء الاصطناعي" },
          { table: { head: ["الخطوة", "ما يفعله الذكاء الاصطناعي", "ما يجب أن تتحقق منه"], rows: [
            ["إيجاد الشركات", "يحوّل وصف عميلك المثالي إلى قائمة", "يوضح سبب تطابق كل شركة"],
            ["إيجاد صاحب القرار", "يجد الشخص صاحب المسمى المناسب", "يستخدم بيانات تواصل منشورة أو يمكن التحقق منها"],
            ["البحث", "يقرأ موقع الشركة وصفحاتها العامة", "حقائق تراها، لا تخمينات"],
            ["الكتابة", "يكتب رسالة أولى بلغة المشتري", "تشبه أسلوبك وفيها سؤال واحد واضح"],
            ["الردود", "يصنّف الردود ويجيب ويقترح مواعيد", "يسلّمك ما يحتاج إلى شخص"],
          ] } },
          { h2: "ما لا تفعله أداة جيدة أبدًا" },
          { ul: [
            "تخمين عنوان بريد والإرسال إليه.",
            "الإرسال من خادم جماعي مجهول بدل بريدك.",
            "الاستمرار في مراسلة من رفض.",
            "عرض رقم لا يمكن حسابه كأنه حقيقي.",
          ] },
          { h2: "أين يناسب يولياس" },
          { p: "في يولياس تنشئ حملة كما في مدير الإعلانات: الهدف، والجماهير (الدول والمدن، والمجالات، وحجم الشركة، والمسميات الوظيفية، والاستبعادات، أو جمهور مشابه لأفضل عملائك)، والرسالة. فيجد يولياس الشركات وصنّاع القرار، ويكتب رسالة مختلفة لكل منهم من بريدك، ويتابع مرتين، ويجيب وكيل المبيعات الذكي ويحجز. وتتجه الميزانية نحو الجماهير التي تحقق نتائج. وتدفع مقابل الأشخاص الذين يجدهم يولياس ويتواصل معهم: الدفع حسب الاستخدام من 5 دولارات، أو النمو (100 دولار) والتوسع (200 دولار) شهريًا." },
          { h2: "أسئلة شائعة" },
          { h3: "هل البحث بالذكاء الاصطناعي أفضل من شراء قائمة عملاء؟" },
          { p: "القائمة المشتراة واحدة لكل من يشتريها وتتقادم. أما البحث بالذكاء الاصطناعي فيبني قائمة لعميلك أنت الآن، ويشرح كل تطابق." },
          { h3: "هل يعمل البحث عن العملاء بالذكاء الاصطناعي بالعربية؟" },
          { p: "نعم، إذا كانت الأداة تفهم الطلب بالعربية وتكتب بها. يعمل يولياس بالكامل بالعربية والإنجليزية ويكتب بلغة كل شخص." },
        ],
      },
    },
  },
];
