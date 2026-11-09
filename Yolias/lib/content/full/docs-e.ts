import type { Doc, Localized } from "../types";

// Full-length Documentation pages (English and Arabic): how each part of Yolias
// is built and behaves. Every number mirrors the code (lib/engine/objectives.ts,
// lib/campaigns/*, lib/outreach/*, lib/agent-core/*). Task-style answers live in
// the Help Center.

export const docsE: Record<string, Localized<Doc>> = {
  introduction: {
    en: {
      title: "Introduction",
      summary: "What Yolias is, the objects it is built from, and how a campaign moves from a budget to a result.",
      updated: "2026-11-05",
      blocks: [
        { p: "Yolias is an AI advertising platform for customer acquisition. You create campaigns the way you would in an ads manager: an objective, a budget, audiences and a message. Instead of showing an ad to a crowd, Yolias finds the companies and people who match your targeting, writes a personal email to each one from your own mailbox, follows up, reads every reply, answers from what it knows about your company, and brings back the result you asked for." },
        { p: "This page describes the whole product at the level of objects and rules. Every part has its own page in this documentation. For step-by-step tasks, use the [Help Center](/help-center)." },

        { h2: "What Yolias is" },
        { p: "Three ideas explain most of the product." },
        { ul: [
          "**One engine, four objectives.** Every campaign runs on the same engine: understand the offer, define the audience, find companies and people, write each message, hold the conversation, follow up and measure the result. The objective tells the engine which result to pursue.",
          "**The message is the ad.** A campaign has no creative to upload. Its ad is the offer, the tone, the notes you give and the email Yolias writes for each person from what it knows about them.",
          "**You pay for people found.** The unit of cost is one person or company Yolias finds for a campaign. Writing, sending, following up and answering are not charged.",
        ] },

        { h2: "The parts of the product" },
        { p: "Each object below has a clear job. The campaign is the center: everything else either feeds it or records what came back." },
        { table: { head: ["Part", "What it holds", "Documentation"], rows: [
          ["Campaign", "One objective, one budget, one schedule, one mailbox and one or more audiences", "[Campaigns](/docs/campaigns)"],
          ["Audience", "Who a campaign reaches: targeting, a saved audience, a custom list or a lookalike", "[Audiences](/docs/audiences)"],
          ["Company Knowledge", "Your company, offers, ideal customer and competitors. Yolias writes and answers from it", "[Company Knowledge](/docs/customer-profile)"],
          ["Yolias AI", "The work inside a running campaign, and the assistant you can chat with", "[Yolias AI](/docs/searches)"],
          ["Mailbox", "The Gmail or IMAP/SMTP account a campaign sends from and reads replies in", "[Connect Gmail](/help-center/connect-gmail)"],
          ["Leads", "Every company and person your campaigns found or you imported, at /leads", "[Leads](/docs/prospects)"],
          ["Conversations", "Every thread, with a marker on those handed to you", "[Conversations](/help-center/conversations)"],
          ["Meetings", "Bookings, your booking page and outcomes", "[Meetings and booking page](/docs/meetings)"],
          ["Events Manager", "Your pixels and the events they record on your website", "[Pixel and Events Manager](/docs/pixel)"],
          ["Results", "Every number, per campaign, audience and message", "[Results and metrics](/docs/analytics)"],
        ] } },

        { h2: "How it works" },
        { p: "A campaign moves through the same stages whatever its objective. A Qualified leads campaign stops after step 3, because it contacts no one." },
        { ol: [
          "**You set the campaign.** You choose an objective, an offer, a budget, dates, audiences and a mailbox, or press **Build with Yolias** to fill the campaign from Company Knowledge and review it.",
          "**You launch.** Launching is the approval. There is no approval per email after it. If your balance is empty, the first payment happens here, and the campaign stays saved as a draft until you top up.",
          "**Yolias finds people.** For each audience it searches for matching companies and the decision makers inside them, and saves them in Leads. Each person found is charged at your rate.",
          "**Yolias writes and sends.** Each person gets a different email from your mailbox, inside your days and hours. Two openings are tested for each audience.",
          "**Yolias follows up.** Someone who doesn't reply gets two follow-ups in the same thread: 3 days after the first email, then 7 days after that.",
          "**Yolias reads and answers.** Every reply is classified. Questions are answered from Company Knowledge, interest moves toward your result, and a reply that needs a person is handed to you.",
          "**The result is counted.** A booked meeting, or a purchase or form on your website, is credited to the campaign and the audience that brought it.",
          "**Yolias learns.** Once a day each audience gets a share from its rate of the result, and each new day's budget follows those shares, and what worked shapes who is contacted first and how the next emails are written.",
        ] },

        { h2: "The four objectives" },
        { p: "The objective decides what Yolias does when a person shows interest, what the campaign needs, and which number counts as a result. See [Campaign objectives](/help-center/campaign-objectives) for help choosing one." },
        { table: { head: ["Objective", "On interest", "Needs", "Result"], rows: [
          ["Meetings", "Sends two free times and your booking page", "A mailbox", "Booked meetings"],
          ["Sales", "Sends a tracked link to your website", "A mailbox, a website page and a pixel", "Conversions (Purchase by default)"],
          ["Website leads", "Sends a tracked link to your form", "A mailbox, a form page and a pixel", "Conversions (Lead by default)"],
          ["Qualified leads", "Contacts no one", "Nothing beyond the audience", "People and companies found"],
        ] } },

        { h2: "What you pay for" },
        { p: "Signing up is free, and you can build and save campaigns without paying. Payment comes at launch, and the smallest campaign budget is $5." },
        { p: "Spend is the number of people found for a campaign multiplied by your rate. On Pay As You Go the rate is $0.10 per person. On Growth and Scale it works out at $0.05 per person. The same lead is never charged twice, and viewing your leads again is free." },
        { table: { head: ["Option", "Price", "Included"], rows: [
          ["Pay As You Go", "Top up from $5", "Credit, which doesn't expire"],
          ["Growth", "$100 a month", "2,000 leads a month"],
          ["Scale", "$200 a month", "4,000 leads a month"],
        ] } },
        { p: "A worked example: a $20 total budget on Pay As You Go allows up to 200 people. If Yolias has found 140 so far, spend is $14, and nothing is charged for people not yet found. Emails, follow-ups and answers never add to that number, which is why **Cost per meeting** on the campaign page is a plain division: spend divided by meetings booked. If your balance can't cover the whole budget, Yolias uses what is available, then stops finding new people until you top up or your plan renews." },
        { p: "Every plan has every feature and unlimited users. Annual billing is 20% off. See [Plans and usage](/docs/plans-and-usage) for how balance is used and reset." },

        { h2: "Example" },
        { p: "A company sells a booking system to clinics. It creates a Meetings campaign with a total budget of $50. On Pay As You Go, $50 buys about 500 people at $0.10 each." },
        { ul: [
          "It adds two audiences: clinic owners in Riyadh, and dental practice managers in Jeddah. At launch each audience gets 250 people.",
          "Yolias finds matching people, writes to each from the company's Gmail between 09:00 and 17:00, and tests two openings per audience.",
          "A clinic owner replies asking about the price. Yolias answers from the Pricing field in Company Knowledge. She then asks for a call, so Yolias sends two free times and the booking page.",
          "She books. The meeting appears in **Meetings** and in Google Calendar, and the campaign page counts one meeting and updates **Cost per meeting**.",
          "A manager replies with a complaint. Yolias stops and hands the conversation to the team, marked **Needs you**.",
          "Once enough people in both audiences have been contacted, clinic owners turn out to book more often. With a total budget, each audience keeps the 250 people reserved at launch. With a daily budget, clinic owners would get a larger share of each new day's budget, and the change would be logged on the campaign page.",
        ] },

        { h2: "Permissions and requirements" },
        { p: "A workspace has unlimited users, and each user has one of three roles. See [Team and roles](/docs/team-and-roles)." },
        { table: { head: ["Role", "Access"], rows: [
          ["Admin", "Everything, including billing, the team and Company Knowledge"],
          ["Advertiser", "Campaigns, audiences, leads, conversations and meetings"],
          ["Analyst", "View only. An Analyst can read results and ask Yolias AI, and changes nothing"],
        ] } },
        { p: "To launch a campaign that contacts people you need:" },
        { ul: [
          "A connected mailbox of your own. A campaign sends from a mailbox of the person who launches it.",
          "A budget of at least $5, and a plan or credit in the account.",
          "A website page and a pixel for Sales and Website leads.",
          "Your booking page set up for Meetings. See [Meetings and booking page](/docs/meetings).",
        ] },

        { h2: "Limits at a glance" },
        { table: { head: ["Limit", "Value"], rows: [
          ["Smallest campaign budget", "$5"],
          ["Audiences in one campaign", "8"],
          ["Mailboxes in one campaign", "1"],
          ["Emails to someone who doesn't reply", "3 (the first email and two follow-ups)"],
          ["Yolias's own answers in one thread", "4, then it hands over to you"],
          ["Objections Yolias answers in one thread", "1, and the next one goes to you"],
          ["Emails from one mailbox in a day", "50 at most, less during warm-up"],
          ["Rows in one CSV file", "5,000"],
        ] } },

        { h2: "Terms used in this documentation" },
        { table: { head: ["Term", "Meaning"], rows: [
          ["Lead", "A company or person in your workspace, found by a campaign or imported"],
          ["Opening", "The angle a first email leads with. Each audience tests Opening A and Opening B"],
          ["Follow-up", "An email in the same thread to someone who hasn't replied"],
          ["Result", "What the objective counts: a booked meeting, a conversion, or a lead found"],
          ["Learning", "An audience without enough results yet. It keeps an equal share of the budget"],
          ["Balance", "What your plan's monthly leads or your credit are still worth"],
          ["Needs you", "A conversation Yolias handed to you instead of answering it"],
          ["Do not contact", "A lead no campaign may write to, after an opt-out or a stop request"],
        ] } },

        { h2: "Important notes" },
        { ul: [
          "**Email is the only channel.** Yolias writes, sends and reads email. It sends from your mailbox, so replies arrive in your own inbox as well as in Yolias.",
          "**Yolias states only what it knows.** Emails and answers use your Company Knowledge and the facts found about each person. Nothing else is claimed, and a question it can't answer comes to you.",
          "**Opt-outs are final.** Every campaign email ends with an unsubscribe line. A person who unsubscribes or asks to stop is marked do not contact, and no campaign writes to them again.",
          "**One person, one conversation.** Nobody is written to by two campaigns at once.",
          "**Arabic and English.** The product works in both languages. Emails can be written in the campaign's language, or in each person's language based on their country.",
          "**Estimates are labelled.** Forecasts appear as ranges and are never mixed with actual results. A number that can't be worked out yet shows – and not 0.",
        ] },

        { h2: "Troubleshooting" },
        { table: { head: ["What you see", "What it means"], rows: [
          ["**Launch campaign** asks you to top up", "The account has no plan or credit, or the balance is empty. The campaign stays saved as a draft"],
          ["**Build with Yolias** says to add your company", "Company Knowledge is empty. Fill it in or analyze your website first"],
          ["Chat with Yolias AI doesn't answer on a free account", "Chat needs a plan or credit. Builder AI works on a free account up to a daily limit"],
          ["A number shows –", "It can't be worked out yet, for example because nothing was sent"],
        ] } },

        { h2: "Related articles" },
        { ul: [
          "[Quickstart](/docs/quickstart)",
          "[Campaigns](/docs/campaigns)",
          "[Audiences](/docs/audiences)",
          "[Company Knowledge](/docs/customer-profile)",
          "[Yolias AI](/docs/searches)",
          "[Creating a campaign](/help-center/creating-a-campaign)",
        ] },
      ],
    },
    ar: {
      title: "مقدمة",
      summary: "ما هو يولياس، والمكونات التي بُني منها، وكيف تنتقل الحملة من الميزانية إلى النتيجة.",
      updated: "2026-11-05",
      blocks: [
        { p: "يولياس منصة إعلانات بالذكاء الاصطناعي لاكتساب العملاء. تنشئ حملاتك كما تفعل في مدير الإعلانات: هدف وميزانية وجماهير ورسالة. وبدل عرض إعلان على جمهور واسع، يجد يولياس الشركات والأشخاص المطابقين لاستهدافك، ويكتب لكل واحد منهم رسالة شخصية من بريدك أنت، ويتابعه، ويقرأ كل رد، ويجيب مما يعرفه عن شركتك، ثم يأتيك بالنتيجة التي طلبتها." },
        { p: "تصف هذه الصفحة المنتج كله على مستوى المكونات والقواعد، ولكل جزء منه صفحته الخاصة في هذا التوثيق. أما خطوات تنفيذ المهام فتجدها في [مركز المساعدة](/help-center)." },

        { h2: "ما هو يولياس" },
        { p: "ثلاث أفكار تشرح معظم المنتج." },
        { ul: [
          "**محرك واحد وأربعة أهداف.** تعمل كل حملة على المحرك نفسه: فهم العرض، وتحديد الجمهور، وإيجاد الشركات والأشخاص، وكتابة كل رسالة، وإدارة المحادثة، والمتابعة، وقياس النتيجة. والهدف هو ما يخبر المحرك بالنتيجة المطلوبة.",
          "**الرسالة هي الإعلان.** لا توجد في الحملة تصاميم ترفعها. إعلانها هو العرض والأسلوب وملاحظاتك والرسالة التي يكتبها يولياس لكل شخص مما يعرفه عنه.",
          "**تدفع مقابل من يُعثر عليهم.** وحدة التكلفة هي الشخص أو الشركة التي يجدها يولياس للحملة. أما الكتابة والإرسال والمتابعة والرد فلا تُحسب عليك.",
        ] },

        { h2: "أجزاء المنتج" },
        { p: "لكل مكوّن مما يلي مهمة واضحة. والحملة هي المركز: فكل ما عداها إما يغذيها وإما يسجل ما عاد منها." },
        { table: { head: ["الجزء", "ما يحمله", "التوثيق"], rows: [
          ["الحملة", "هدف واحد وميزانية واحدة وجدول واحد وبريد واحد وجمهور أو أكثر", "[الحملات](/docs/campaigns)"],
          ["الجمهور", "من تصل إليهم الحملة: استهداف، أو جمهور محفوظ، أو قائمة مخصصة، أو جمهور مشابه", "[الجماهير](/docs/audiences)"],
          ["معرفة الشركة", "شركتك وعروضك وعميلك المثالي ومنافسوك، ومنها يكتب يولياس ويجيب", "[معرفة الشركة](/docs/customer-profile)"],
          ["Yolias AI", "العمل داخل الحملة الجارية، والمساعد الذي يمكنك محادثته", "[Yolias AI](/docs/searches)"],
          ["البريد", "حساب Gmail أو IMAP/SMTP الذي ترسل منه الحملة وتقرأ فيه الردود", "[ربط Gmail](/help-center/connect-gmail)"],
          ["العملاء", "كل شركة وشخص وجدتهم حملاتك أو استوردتهم، في صفحة /leads", "[العملاء](/docs/prospects)"],
          ["المحادثات", "كل محادثة، مع علامة على ما سُلِّم إليك", "[المحادثات](/help-center/conversations)"],
          ["الاجتماعات", "الحجوزات وصفحة الحجز ونتائج الاجتماعات", "[الاجتماعات وصفحة الحجز](/docs/meetings)"],
          ["مدير الأحداث", "البيكسلات والأحداث التي تسجلها على موقعك", "[البيكسل ومدير الأحداث](/docs/pixel)"],
          ["النتائج", "كل رقم لكل حملة وجمهور ورسالة", "[النتائج والمقاييس](/docs/analytics)"],
        ] } },

        { h2: "كيف يعمل" },
        { p: "تمر الحملة بالمراحل نفسها أيًا كان هدفها. وتتوقف حملة العملاء المؤهلين بعد الخطوة 3 لأنها لا تتواصل مع أحد." },
        { ol: [
          "**تضبط الحملة.** تختار الهدف والعرض والميزانية والتواريخ والجماهير والبريد، أو تضغط **أنشئ مع يولياس** ليملأ الحملة من معرفة الشركة ثم تراجعها.",
          "**تشغّل الحملة.** التشغيل هو الموافقة، ولا توجد بعده موافقة على كل رسالة. وإذا كان رصيدك فارغًا فهنا تأتي أول دفعة، وتبقى الحملة محفوظة كمسودة حتى تشحن.",
          "**يجد يولياس الأشخاص.** يبحث لكل جمهور عن الشركات المطابقة وأصحاب القرار فيها، ويحفظهم في العملاء. ويُحسب كل شخص يُعثر عليه بسعرك.",
          "**يكتب يولياس ويرسل.** يستلم كل شخص رسالة مختلفة من بريدك في أيامك وساعاتك، وتُختبر افتتاحيتان لكل جمهور.",
          "**يتابع يولياس.** من لا يرد يستلم متابعتين في المحادثة نفسها: بعد 3 أيام من الرسالة الأولى، ثم بعد 7 أيام من ذلك.",
          "**يقرأ يولياس ويجيب.** يُصنَّف كل رد. وتُجاب الأسئلة من معرفة الشركة، ويقود الاهتمام إلى نتيجتك، ويُسلَّم إليك الرد الذي يحتاج إلى شخص.",
          "**تُحسب النتيجة.** يُنسب الاجتماع المحجوز، أو الشراء أو النموذج على موقعك، إلى الحملة والجمهور اللذين جاءا به.",
          "**يتعلم يولياس.** مرة يوميًا يحصل كل جمهور على نصيب حسب معدل النتيجة لديه، وتتبع ميزانية كل يوم جديد هذه الأنصبة، ويحدد ما نجح من يُتواصل معه أولًا وكيف تُكتب الرسائل التالية.",
        ] },

        { h2: "الأهداف الأربعة" },
        { p: "يحدد الهدف ما يفعله يولياس عندما يُبدي شخص اهتمامًا، وما تحتاجه الحملة، وأي رقم يُحسب نتيجة. ولاختيار الهدف المناسب راجع [أهداف الحملة](/help-center/campaign-objectives)." },
        { table: { head: ["الهدف", "عند الاهتمام", "ما يحتاجه", "النتيجة"], rows: [
          ["اجتماعات", "يرسل موعدين متاحين وصفحة الحجز", "بريد", "الاجتماعات المحجوزة"],
          ["المبيعات", "يرسل رابطًا متتبَّعًا إلى موقعك", "بريد وصفحة في الموقع وبيكسل", "التحويلات (Purchase افتراضيًا)"],
          ["نماذج الموقع", "يرسل رابطًا متتبَّعًا إلى نموذجك", "بريد وصفحة نموذج وبيكسل", "التحويلات (Lead افتراضيًا)"],
          ["عملاء مؤهلون", "لا يتواصل مع أحد", "لا شيء غير الجمهور", "الأشخاص والشركات التي يُعثر عليها"],
        ] } },

        { h2: "ما الذي تدفع مقابله" },
        { p: "التسجيل مجاني، ويمكنك إنشاء الحملات وحفظها دون دفع. ويأتي الدفع عند التشغيل، وأقل ميزانية للحملة 5 دولارات." },
        { p: "الإنفاق هو عدد الأشخاص الذين يُعثر عليهم للحملة مضروبًا في سعرك. في الدفع حسب الاستخدام يبلغ السعر 0.10 دولار للشخص، وفي خطتي النمو والتوسع يعادل 0.05 دولار للشخص. ولا يُحسب العميل نفسه مرتين، وعرض عملائك مجددًا مجاني." },
        { table: { head: ["الخيار", "السعر", "ما يتضمنه"], rows: [
          ["الدفع حسب الاستخدام", "شحن من 5 دولارات", "رصيد لا تنتهي صلاحيته"],
          ["النمو", "100 دولار شهريًا", "2,000 عميل شهريًا"],
          ["التوسع", "200 دولار شهريًا", "4,000 عميل شهريًا"],
        ] } },
        { p: "مثال على الحساب: ميزانية إجمالية قدرها 20 دولارًا في الدفع حسب الاستخدام تعني 200 شخص بحد أقصى. وإذا وجد يولياس 140 شخصًا فقط حتى الآن، فالإنفاق 14 دولارًا، ولا يُحسب ما لم يُعثر عليه بعد. ولا تزيد الرسائل والمتابعات والردود هذا الرقم مهما كثرت، ولذلك تظهر **تكلفة الاجتماع** في صفحة الحملة كقسمة مباشرة: الإنفاق مقسومًا على الاجتماعات المحجوزة. وإذا لم يكف رصيدك لكامل الميزانية، يستخدم يولياس المتاح منه فقط ثم يتوقف البحث عن أشخاص جدد حتى تشحن أو تتجدد خطتك." },
        { p: "كل الخطط بكل الميزات ومستخدمين بلا حد، والفوترة السنوية بخصم 20%. ولمعرفة طريقة استخدام الرصيد وتجدده راجع [الخطط والاستخدام](/docs/plans-and-usage)." },

        { h2: "مثال" },
        { p: "شركة تبيع نظام حجز للعيادات تنشئ حملة اجتماعات بميزانية إجمالية قدرها 50 دولارًا. في الدفع حسب الاستخدام تكفي 50 دولارًا لنحو 500 شخص بسعر 0.10 دولار للشخص." },
        { ul: [
          "تضيف جمهورين: ملاك العيادات في الرياض، ومديري عيادات الأسنان في جدة. وعند التشغيل يحصل كل جمهور على 250 شخصًا.",
          "يجد يولياس الأشخاص المطابقين، ويكتب لكل منهم من Gmail الخاص بالشركة بين 09:00 و17:00، ويختبر افتتاحيتين لكل جمهور.",
          "تسأل مالكة عيادة عن السعر، فيجيبها يولياس من حقل الأسعار في معرفة الشركة. ثم تطلب مكالمة، فيرسل موعدين متاحين وصفحة الحجز.",
          "تحجز موعدًا، فيظهر الاجتماع في **الاجتماعات** وفي تقويم Google، وتحسب صفحة الحملة اجتماعًا واحدًا وتحدّث **تكلفة الاجتماع**.",
          "يرد مدير بشكوى، فيتوقف يولياس ويسلّم المحادثة إلى الفريق بعلامة **يحتاجك**.",
          "بعد التواصل مع عدد كافٍ من الجمهورين يتضح أن ملاك العيادات يحجزون أكثر. ومع الميزانية الإجمالية يحتفظ كل جمهور بالـ250 شخصًا المحجوزين له عند التشغيل، أما مع الميزانية اليومية فيحصل ملاك العيادات على نصيب أكبر من ميزانية كل يوم جديد، ويُسجَّل ذلك في صفحة الحملة.",
        ] },

        { h2: "الصلاحيات والمتطلبات" },
        { p: "مساحة العمل بمستخدمين بلا حد، ولكل مستخدم أحد ثلاثة أدوار. راجع [الفريق والأدوار](/docs/team-and-roles)." },
        { table: { head: ["الدور", "الوصول"], rows: [
          ["مدير", "كل شيء، ومنه الفوترة والفريق ومعرفة الشركة"],
          ["معلن", "الحملات والجماهير والعملاء والمحادثات والاجتماعات"],
          ["محلل", "عرض فقط: يقرأ النتائج ويسأل Yolias AI ولا يغيّر شيئًا"],
        ] } },
        { p: "لتشغيل حملة تتواصل مع الأشخاص تحتاج إلى:" },
        { ul: [
          "بريد متصل خاص بك، فالحملة ترسل من بريد الشخص الذي يشغّلها.",
          "ميزانية لا تقل عن 5 دولارات، وخطة أو رصيد في الحساب.",
          "صفحة في موقعك وبيكسل لحملات المبيعات ونماذج الموقع.",
          "صفحة حجز مضبوطة لحملات الاجتماعات. راجع [الاجتماعات وصفحة الحجز](/docs/meetings).",
        ] },

        { h2: "الحدود باختصار" },
        { table: { head: ["الحد", "القيمة"], rows: [
          ["أقل ميزانية للحملة", "5 دولارات"],
          ["الجماهير في الحملة الواحدة", "8"],
          ["صناديق البريد في الحملة الواحدة", "1"],
          ["الرسائل لمن لا يرد", "3 (الرسالة الأولى ومتابعتان)"],
          ["ردود يولياس في المحادثة الواحدة", "4، ثم يسلّمها إليك"],
          ["الاعتراضات التي يجيبها يولياس في المحادثة", "1، والتالي يصل إليك"],
          ["رسائل البريد الواحد في اليوم", "50 بحد أقصى، وأقل أثناء الإحماء"],
          ["الصفوف في ملف CSV واحد", "5,000"],
        ] } },

        { h2: "المصطلحات المستخدمة في هذا التوثيق" },
        { table: { head: ["المصطلح", "المعنى"], rows: [
          ["العميل", "شركة أو شخص في مساحة عملك، وجدته حملة أو استوردته أنت"],
          ["الافتتاحية", "الزاوية التي تبدأ بها الرسالة الأولى. ويختبر كل جمهور الافتتاحية أ والافتتاحية ب"],
          ["المتابعة", "رسالة في المحادثة نفسها إلى من لم يرد بعد"],
          ["النتيجة", "ما يحسبه الهدف: اجتماع محجوز، أو تحويل على موقعك، أو عميل يُعثر عليه"],
          ["في مرحلة التعلم", "جمهور لم يجمع نتائج كافية بعد، فيحتفظ بنصيب متساوٍ من الميزانية"],
          ["الرصيد", "ما تبقى من عملاء خطتك الشهرية أو من رصيدك المشحون"],
          ["يحتاجك", "محادثة سلّمها يولياس إليك بدل أن يرد عليها بنفسه"],
          ["عدم التواصل", "عميل لا يحق لأي حملة مراسلته، بعد إلغاء اشتراكه أو طلبه التوقف"],
        ] } },
        { p: "ستجد هذه المصطلحات بالأسماء نفسها في واجهة يولياس، في صفحة الحملة وجدول الحملات والمحادثات والعملاء. وعندما تقرأ في هذا التوثيق اسم زر أو حقل بخط عريض، فهو الاسم الذي يظهر على الشاشة كما هو، لتصل إليه مباشرة." },

        { h2: "ما يحدث بعد التشغيل مباشرة" },
        { p: "بعد أن تضغط **تشغيل الحملة** تتغير حالتها إلى **نشطة**، أو إلى **مجدولة** إذا كان تاريخ البداية في المستقبل. ويبدأ يولياس البحث لكل جمهور، ويظهر كل ما يفعله في قسم **ما فعله يولياس** في صفحة الحملة: إيجاد أشخاص جدد، والرد على رسالة، وحجز اجتماع، وتحريك الميزانية بين الجماهير، وتسليم محادثة إليك. وتصل الرسائل الأولى في أول نافذة إرسال مفتوحة لبريدك وللحملة معًا، وليس في لحظة التشغيل بالضرورة." },
        { p: "ولا تحتاج إلى متابعة الحملة يوميًا. يعرض **يحتاجك** في لوحة التحكم ما ينتظرك فقط: ردود سُلّمت إليك، واجتماعات تنتظر نتيجتها، وحملات أوقفها يولياس مع السبب." },

        { h2: "ملاحظات مهمة" },
        { ul: [
          "**البريد الإلكتروني هو القناة الوحيدة.** يكتب يولياس البريد ويرسله ويقرؤه. ولأنه يرسل من بريدك، تصل الردود إلى صندوقك أنت كما تظهر في يولياس.",
          "**لا يذكر يولياس إلا ما يعرفه.** تعتمد الرسائل والإجابات على معرفة الشركة والحقائق التي وُجدت عن كل شخص، ولا يُدّعى غير ذلك، والسؤال الذي لا يستطيع إجابته يصل إليك.",
          "**طلب الإيقاف نهائي.** تنتهي كل رسالة حملة بسطر إلغاء الاشتراك. ومن يلغي اشتراكه أو يطلب التوقف يُسجَّل بعدم التواصل، ولا تراسله أي حملة بعدها.",
          "**شخص واحد ومحادثة واحدة.** لا تراسل حملتان الشخص نفسه في الوقت نفسه.",
          "**العربية والإنجليزية.** يعمل المنتج باللغتين. ويمكن كتابة الرسائل بلغة الحملة أو بلغة كل شخص حسب دولته.",
          "**التقديرات موضحة.** تظهر التوقعات كنطاقات ولا تُخلط أبدًا بالنتائج الفعلية. والرقم الذي لا يمكن حسابه بعد يظهر – وليس 0.",
        ] },

        { h2: "حل المشكلات" },
        { table: { head: ["ما تراه", "معناه"], rows: [
          ["**تشغيل الحملة** يطلب منك الشحن", "لا توجد خطة أو رصيد في الحساب، أو الرصيد فارغ. وتبقى الحملة محفوظة كمسودة"],
          ["**أنشئ مع يولياس** يطلب إضافة شركتك", "معرفة الشركة فارغة. املأها أو حلّل موقعك أولًا"],
          ["محادثة Yolias AI لا تجيب في حساب مجاني", "تحتاج المحادثة إلى خطة أو رصيد. ويعمل الذكاء الاصطناعي في إنشاء الحملة على الحساب المجاني بحد يومي"],
          ["رقم يظهر –", "لا يمكن حسابه بعد، مثلًا لأنه لم يُرسل شيء"],
        ] } },

        { h2: "مقالات ذات صلة" },
        { ul: [
          "[البداية السريعة](/docs/quickstart)",
          "[الحملات](/docs/campaigns)",
          "[الجماهير](/docs/audiences)",
          "[معرفة الشركة](/docs/customer-profile)",
          "[Yolias AI](/docs/searches)",
          "[إنشاء حملة](/help-center/creating-a-campaign)",
        ] },
      ],
    },
  },
  quickstart: {
    en: {
      title: "Quickstart",
      summary: "The shortest path from signup to a running campaign, and what each setup step changes in Yolias.",
      updated: "2026-11-05",
      blocks: [
        { p: "This page takes you from a new account to a running campaign. It follows the order Yolias needs things in: who you are, where to send from, where meetings land, and then the campaign. Plan on about 15 minutes. Each step links to the page that explains it in depth." },

        { h2: "Before you start" },
        { ul: [
          "Your company's website address. Yolias reads it to fill your company profile.",
          "Access to the mailbox you want to send from: a Google account for Gmail, or the IMAP and SMTP details of your company mailbox.",
          "A way to pay at launch if you plan to launch today. Signing up and building are free, and the smallest campaign budget is $5.",
        ] },

        { h2: "Step-by-step" },
        { h3: "1. Create your account" },
        { p: "[Create an account](/signup) with Google or with a sign-in link sent to your email. Onboarding asks for your name and **What is your company's website?** Yolias reads the site and fills your company profile and your ideal customer. If you have no website, choose **No website? Fill it in yourself** and enter your industry, products and services, ideal customer and target markets. Press **Get Started**." },
        { p: "What it changes: these answers become the first version of Company Knowledge, which every email and answer is written from." },

        { h3: "2. Check Company Knowledge" },
        { p: "Open **Company Knowledge**. Read what Yolias filled in, correct it, and add what the website doesn't say: pricing you are happy to mention, real case studies, frequent questions and a reply policy. Add your offers under **Business Offers**. Press **Save** at the bottom of the page. You can run **Analyze website** again at any time." },
        { p: "What it changes: the campaign builder shows how complete Company Knowledge is, and **Build with Yolias** needs it to propose a campaign. See [Company Knowledge](/docs/customer-profile)." },

        { h3: "3. Connect a mailbox" },
        { p: "Open **Integrations** and connect Gmail, or your company mailbox over IMAP and SMTP. The mailbox belongs to you: a campaign sends from a mailbox of the person who launches it, and Yolias reads the replies there. See [Connect Gmail](/help-center/connect-gmail) or [Connect IMAP and SMTP](/help-center/connect-imap-smtp)." },
        { p: "What it changes: a new mailbox starts with a warm-up. It sends at most 15 emails a day in its first week, 25 in the second and 40 in the third, then its own limit." },

        { h3: "4. Set your booking page" },
        { p: "For a Meetings campaign, open **Meetings** and set your booking page: your meeting types and weekly hours. Connect Google Calendar in Integrations so bookings land in your calendar, your busy times are skipped and guests get an invitation. See [Google Calendar](/help-center/google-calendar)." },
        { p: "What it changes: when someone shows interest, Yolias offers two free times from this page and sends its link." },

        { h3: "5. Add a pixel, for Sales or Website leads" },
        { p: "Skip this step for Meetings and Qualified leads. For Sales or Website leads, open **Events Manager**, create a pixel and add its base code to your website. The campaign uses it to count purchases or forms from the people Yolias sends there. See [Pixel and events](/help-center/pixel-and-events)." },

        { h3: "6. Build the campaign" },
        { p: "Open **Campaigns** and choose **Create campaign**. At the top of the builder press **Build with Yolias**. Yolias fills the campaign from Company Knowledge: a name, the offer, a meetings target, a budget, messages a day, and one to three audiences with countries, industries, job titles and company sizes. The objective, the channel and the mailbox stay as you set them." },
        { p: "Review the three steps: **Campaign**, **Audience** and **Message**. On the Message step choose the mailbox under **Send from**, then press **Write a sample email** to see how Yolias will write to a typical person in each audience." },

        { h3: "7. Launch" },
        { p: "Tick the confirmation that Yolias may email the people it finds from your mailbox, and press **Launch campaign**. If the account has no plan or credit, Yolias asks you to top up from $5 or choose a plan; the campaign stays saved as a draft and you launch it after paying. See [Creating a campaign](/help-center/creating-a-campaign)." },

        { h2: "What the builder checks before launch" },
        { p: "**Launch campaign** stays blocked until every item under **Before you launch** is resolved. The messages below are the ones the builder shows." },
        { table: { head: ["Message", "Why it appears"], rows: [
          ["**Name the campaign.**", "The campaign has no name"],
          ["**Set a budget of at least $5.00.**", "The budget is below the smallest campaign budget"],
          ["**The end must be after the start.**", "The end date is before the start date"],
          ["**Give every audience a targeting or a saved audience.**", "An audience has no targeting field, no description and no saved audience"],
          ["**Add your website page (purchase or form).**", "A Sales or Website leads campaign has no website link"],
          ["**Choose the pixel that measures this objective.**", "A Sales or Website leads campaign has no pixel"],
          ["**Connect a mailbox to send from.**", "No mailbox is chosen in **Send from**"],
          ["**Confirm that Yolias may email on your behalf.**", "The confirmation box is not ticked"],
        ] } },
        { p: "Next to each audience the builder also shows warnings that don't block the launch: the same value is included and excluded, no job titles are set, or the audience has no location or no industry. Fix them for a more precise audience." },

        { h2: "What happens next" },
        { table: { head: ["When", "What you see"], rows: [
          ["Right after launch", "The campaign is **Active**, or **Scheduled** if its start date is ahead. **What Yolias did** shows the first actions"],
          ["Within the first hours", "People start appearing in **Leads** as Yolias finds them for each audience"],
          ["In the next sending window", "First emails go out from your mailbox, one at a time, 18 to 24 minutes apart, inside your days and hours"],
          ["Day 3 and day 10", "People who haven't replied get the two follow-ups in the same thread"],
          ["When someone replies", "Yolias answers, books, or hands the conversation to you as **Needs you**"],
          ["After about 50 people contacted", "**Recommendations** and **Yolias learned** start to appear on the campaign page"],
        ] } },

        { h2: "What to review on the first day" },
        { ul: [
          "Open the campaign page and check that the status is **Active** and that **Sends from** shows the right mailbox.",
          "Open **Leads** and check that the people listed match who you want to reach. If they don't, edit the campaign and add an audience with tighter targeting, because a running audience's targeting can't change.",
          "Open the **Messages** tab on the campaign page and read the first emails sent. To change the approach, add **Notes for Yolias** when you edit the campaign; they apply to the emails that follow.",
        ] },

        { h2: "Example" },
        { p: "A consultancy signs up with its website. Onboarding fills its profile with three services and an ideal customer of finance directors at mid-size companies in the UAE. It adds a pricing range and two case studies in Company Knowledge, connects Gmail, sets a 30-minute meeting type and connects Google Calendar. **Build with Yolias** proposes a $25 Meetings campaign with two audiences. The consultancy changes one audience's job titles, writes a sample email, tops up $25 and launches." },

        { h2: "Permissions and requirements" },
        { ul: [
          "Admins and Advertisers can build and launch campaigns. Analysts can view them but not change them.",
          "Only owners and admins can change Company Knowledge.",
          "Each person connects their own mailbox. You can't launch from a teammate's mailbox.",
        ] },

        { h2: "Troubleshooting" },
        { table: { head: ["Problem", "What to do"], rows: [
          ["**Add your company in Company Knowledge first.**", "Company Knowledge is empty. Fill it in or run **Analyze website**, then press **Build with Yolias** again"],
          ["**Connect a mailbox to send from.**", "Connect a mailbox in Integrations. Only a connected mailbox of your own can be chosen"],
          ["**Top up from $5 to keep using Yolias AI today.**", "A free account reached its daily AI limit in the builder. Top up, or fill the fields yourself"],
          ["**Your balance is empty. Top up to launch this campaign.**", "Top up or choose a plan. The draft keeps everything you entered"],
        ] } },

        { h2: "Related articles" },
        { ul: [
          "[Introduction](/docs/introduction)",
          "[Campaigns](/docs/campaigns)",
          "[Company Knowledge](/docs/customer-profile)",
          "[Meetings and booking page](/docs/meetings)",
          "[Creating a campaign](/help-center/creating-a-campaign)",
        ] },
      ],
    },
    ar: {
      title: "البداية السريعة",
      summary: "أقصر طريق من التسجيل إلى حملة تعمل، وما تغيّره كل خطوة إعداد في يولياس.",
      updated: "2026-11-05",
      blocks: [
        { p: "تأخذك هذه الصفحة من حساب جديد إلى حملة تعمل، بالترتيب الذي يحتاجه يولياس: من أنت، ومن أين يرسل، وأين تصل الاجتماعات، ثم الحملة نفسها. ويستغرق ذلك نحو 15 دقيقة، ولكل خطوة رابط إلى الصفحة التي تشرحها بالتفصيل." },

        { h2: "قبل أن تبدأ" },
        { ul: [
          "رابط موقع شركتك، فمنه يملأ يولياس ملف شركتك.",
          "إمكانية الوصول إلى البريد الذي تريد الإرسال منه: حساب Google لبريد Gmail، أو بيانات IMAP وSMTP لبريد شركتك.",
          "وسيلة دفع عند التشغيل إذا أردت تشغيل الحملة اليوم. فالتسجيل وإنشاء الحملات مجانيان، وأقل ميزانية للحملة 5 دولارات.",
        ] },

        { h2: "الخطوات" },
        { h3: "1. أنشئ حسابك" },
        { p: "[أنشئ حسابًا](/signup) عبر Google أو عبر رابط دخول يصل إلى بريدك. تسألك خطوات البداية عن اسمك وعن **ما رابط موقع شركتك؟** فيقرأ يولياس الموقع ويملأ ملف الشركة وعميلك المثالي. وإذا لم يكن لديك موقع فاختر **لا يوجد موقع إلكتروني؟ املأ البيانات بنفسك** وأدخل المجال والمنتجات والخدمات والعميل المثالي والأسواق المستهدفة، ثم اضغط **ابدأ الآن**." },
        { p: "ما تغيّره: تصبح هذه الإجابات النسخة الأولى من معرفة الشركة، التي تُكتب منها كل رسالة وكل إجابة." },

        { h3: "2. راجع معرفة الشركة" },
        { p: "افتح **معرفة الشركة** واقرأ ما ملأه يولياس وصحّحه، وأضف ما لا يذكره الموقع: الأسعار التي تسمح بذكرها، ودراسات حالة حقيقية، والأسئلة الشائعة، وسياسة الرد. وأضف عروضك في **عروض الأعمال**، ثم اضغط **حفظ** في آخر الصفحة. ويمكنك تشغيل **تحليل الموقع** مرة أخرى في أي وقت." },
        { p: "ما تغيّره: يعرض منشئ الحملة نسبة اكتمال معرفة الشركة، ويحتاجها **أنشئ مع يولياس** ليقترح حملة. راجع [معرفة الشركة](/docs/customer-profile)." },

        { h3: "3. اربط بريدًا" },
        { p: "افتح **التكاملات** واربط Gmail أو بريد شركتك عبر IMAP وSMTP. والبريد ملك لك: فالحملة ترسل من بريد الشخص الذي يشغّلها، ويقرأ يولياس الردود فيه. راجع [ربط Gmail](/help-center/connect-gmail) أو [ربط IMAP وSMTP](/help-center/connect-imap-smtp)." },
        { p: "ما تغيّره: يبدأ البريد الجديد بفترة إحماء، فيرسل 15 رسالة يوميًا بحد أقصى في أسبوعه الأول، و25 في الثاني، و40 في الثالث، ثم حدّه المعتاد." },

        { h3: "4. اضبط صفحة الحجز" },
        { p: "لحملة الاجتماعات افتح **الاجتماعات** واضبط صفحة الحجز: أنواع الاجتماعات وساعاتك الأسبوعية. واربط تقويم Google من التكاملات لتصل الحجوزات إلى تقويمك وتُتخطى أوقات انشغالك ويستلم الضيف دعوة. راجع [تقويم Google](/help-center/google-calendar)." },
        { p: "ما تغيّره: عندما يبدي شخص اهتمامًا، يعرض عليه يولياس موعدين متاحين من هذه الصفحة ويرسل رابطها." },

        { h3: "5. أضف بيكسل للمبيعات أو نماذج الموقع" },
        { p: "تخطَّ هذه الخطوة في حملات الاجتماعات والعملاء المؤهلين. أما في المبيعات ونماذج الموقع فافتح **مدير الأحداث** وأنشئ بيكسل وأضف كوده الأساسي إلى موقعك، لتحسب الحملة عمليات الشراء أو النماذج ممن يرسلهم يولياس إلى موقعك. راجع [البيكسل والأحداث](/help-center/pixel-and-events)." },

        { h3: "6. أنشئ الحملة" },
        { p: "افتح **الحملات** واختر **إنشاء حملة**، ثم اضغط **أنشئ مع يولياس** في أعلى المنشئ. يملأ يولياس الحملة من معرفة الشركة: الاسم والعرض وعدد الاجتماعات المستهدف والميزانية وعدد الرسائل اليومية، ومن جمهور إلى ثلاثة جماهير بالدول والمجالات والمسميات الوظيفية وأحجام الشركات. ويبقى الهدف والقناة والبريد كما ضبطتها أنت." },
        { p: "راجع الخطوات الثلاث: **الحملة** و**الجمهور** و**الرسالة**. وفي خطوة الرسالة اختر البريد في **الإرسال من**، ثم اضغط **اكتب رسالة نموذجية** لترى كيف سيكتب يولياس لشخص نموذجي في كل جمهور." },

        { h3: "7. شغّل الحملة" },
        { p: "حدّد خانة الموافقة على أن يراسل يولياس من يجدهم من بريدك، واضغط **تشغيل الحملة**. وإذا لم يكن في الحساب خطة أو رصيد، يطلب منك يولياس الشحن من 5 دولارات أو اختيار خطة، وتبقى الحملة محفوظة كمسودة لتشغّلها بعد الدفع. راجع [إنشاء حملة](/help-center/creating-a-campaign)." },

        { h2: "ما يفحصه المنشئ قبل التشغيل" },
        { p: "يبقى زر **تشغيل الحملة** معطلًا حتى يُحل كل بند تحت **قبل التشغيل**. وهذه هي الرسائل كما يعرضها المنشئ." },
        { table: { head: ["الرسالة", "سبب ظهورها"], rows: [
          ["**سمِّ الحملة.**", "لا يوجد اسم للحملة"],
          ["**حدد ميزانية لا تقل عن $5.00.**", "الميزانية أقل من الحد الأدنى للحملة"],
          ["**يجب أن تكون النهاية بعد البداية.**", "تاريخ النهاية يسبق تاريخ البداية"],
          ["**حدد لكل جمهور استهدافًا أو جمهورًا محفوظًا.**", "أحد الجماهير بلا حقل استهداف ولا وصف ولا جمهور محفوظ"],
          ["**أضف رابط صفحة موقعك (الشراء أو النموذج).**", "حملة مبيعات أو نماذج موقع بلا رابط للموقع"],
          ["**اختر البيكسل الذي يقيس هذا الهدف.**", "حملة مبيعات أو نماذج موقع بلا بيكسل"],
          ["**اربط بريدًا للإرسال منه.**", "لم يُختر بريد في **الإرسال من**"],
          ["**أكّد أن يولياس يمكنه المراسلة نيابةً عنك.**", "خانة الموافقة غير محددة"],
        ] } },
        { p: "ويعرض المنشئ بجانب كل جمهور تنبيهات لا تمنع التشغيل: القيمة نفسها مضمّنة ومستبعدة، أو لا توجد مسميات وظيفية، أو ينقص الجمهور موقع أو مجال. أصلحها ليبقى الجمهور دقيقًا ويصل يولياس إلى من يقرر فعلًا." },

        { h2: "ما تراجعه في اليوم الأول" },
        { ul: [
          "افتح صفحة الحملة وتأكد أن الحالة **نشطة** وأن البريد الظاهر في **ترسل من** هو البريد الصحيح.",
          "افتح **العملاء** وتأكد أن من يظهرون يطابقون من تريد الوصول إليهم. وإذا لم يطابقوا، فعدّل الحملة وأضف جمهورًا باستهداف أدق، لأن استهداف الجمهور الجاري لا يتغير.",
          "افتح تبويب **الرسائل** في صفحة الحملة واقرأ أول الرسائل المرسلة. وإذا أردت تغيير الأسلوب، فأضف **ملاحظات ليولياس** من تعديل الحملة، فتنطبق على الرسائل التالية.",
        ] },

        { h2: "ما يحدث بعد ذلك" },
        { table: { head: ["متى", "ما تراه"], rows: [
          ["بعد التشغيل مباشرة", "تصبح الحملة **نشطة**، أو **مجدولة** إذا كان تاريخ بدايتها لاحقًا، ويعرض **ما فعله يولياس** أول الإجراءات"],
          ["في الساعات الأولى", "يبدأ ظهور الأشخاص في **العملاء** مع إيجاد يولياس لهم لكل جمهور"],
          ["في نافذة الإرسال التالية", "تخرج الرسائل الأولى من بريدك واحدة تلو الأخرى، بفاصل من 18 إلى 24 دقيقة، داخل أيامك وساعاتك"],
          ["اليوم الثالث واليوم العاشر", "يستلم من لم يرد المتابعتين في المحادثة نفسها"],
          ["عندما يرد شخص", "يجيب يولياس أو يحجز، أو يسلّم المحادثة إليك بعلامة **يحتاجك**"],
          ["بعد التواصل مع نحو 50 شخصًا", "تبدأ **التوصيات** و**يولياس تعلّم** بالظهور في صفحة الحملة"],
        ] } },

        { h2: "مثال" },
        { p: "شركة استشارات تسجل بموقعها، فتملأ خطوات البداية ملفها بثلاث خدمات وعميل مثالي هو المدير المالي في الشركات المتوسطة بالإمارات. تضيف نطاقًا للأسعار ودراستي حالة في معرفة الشركة، وتربط Gmail، وتضبط نوع اجتماع مدته 30 دقيقة، وتربط تقويم Google. يقترح **أنشئ مع يولياس** حملة اجتماعات بـ25 دولارًا وجمهورين، فتغيّر الشركة المسميات الوظيفية لأحدهما، وتكتب رسالة نموذجية، وتشحن 25 دولارًا وتشغّل الحملة." },

        { h2: "الصلاحيات والمتطلبات" },
        { ul: [
          "يستطيع المدير والمعلن إنشاء الحملات وتشغيلها، أما المحلل فيراها ولا يغيّرها.",
          "يستطيع المالكون والمسؤولون فقط تغيير معرفة الشركة.",
          "يربط كل شخص بريده الخاص، ولا يمكنك التشغيل من بريد زميلك.",
        ] },

        { h2: "حل المشكلات" },
        { table: { head: ["المشكلة", "ما تفعله"], rows: [
          ["**أضف شركتك في معرفة الشركة أولًا.**", "معرفة الشركة فارغة. املأها أو شغّل **تحليل الموقع**، ثم اضغط **أنشئ مع يولياس** مرة أخرى"],
          ["**اربط بريدًا للإرسال منه.**", "اربط بريدًا من التكاملات. ولا يمكن اختيار إلا بريد متصل خاص بك"],
          ["**اشحن من 5 دولارات لتواصل استخدام Yolias AI اليوم.**", "بلغ الحساب المجاني حده اليومي من الذكاء الاصطناعي في المنشئ. اشحن رصيدك أو املأ الحقول بنفسك"],
          ["**رصيدك فارغ. اشحن لتشغيل هذه الحملة.**", "اشحن أو اختر خطة، وتحتفظ المسودة بكل ما أدخلته"],
        ] } },

        { h2: "مقالات ذات صلة" },
        { ul: [
          "[مقدمة](/docs/introduction)",
          "[الحملات](/docs/campaigns)",
          "[معرفة الشركة](/docs/customer-profile)",
          "[الاجتماعات وصفحة الحجز](/docs/meetings)",
          "[إنشاء حملة](/help-center/creating-a-campaign)",
        ] },
      ],
    },
  },
  campaigns: {
    en: {
      title: "Campaigns",
      summary: "The objects in a campaign, its settings, how its budget and sending work, its lifecycle and its controls.",
      updated: "2026-11-05",
      blocks: [
        { p: "A campaign is the unit you create, pay for and measure in Yolias. It holds one objective, one budget, one schedule, one mailbox and one or more audiences, and it runs until its end date or until you end it. This page describes how a campaign is built, what each setting does, how money and sending are controlled, and every status a campaign can be in. To create one step by step, see [Creating a campaign](/help-center/creating-a-campaign)." },

        { h2: "What is a campaign" },
        { p: "Campaigns are built in three levels, like an ads manager. The builder shows them as three steps: **Campaign**, **Audience** and **Message**." },
        { table: { head: ["Level", "What it holds"], rows: [
          ["Campaign", "Name, objective, offer, the result you want, budget, schedule, and **Days, hours and pace**"],
          ["Audience", "Who to reach, up to 8 per campaign. Each has its own targeting or saved audience, its own openings and its own results"],
          ["Message", "The mailbox under **Send from**, **Sign emails as**, **Tone**, **Language**, **Notes for Yolias**, Yolias's two openings and a sample email"],
        ] } },
        { p: "There is no sequence to write. The first email, the follow-ups and the answers are Yolias's work, written for each person from Company Knowledge, the offer and what is known about them. Your settings steer it." },

        { h2: "Settings" },
        { h3: "Objective" },
        { p: "One of **Meetings**, **Sales**, **Website leads (forms)** or **Qualified leads**. Sales and Website leads also ask for the website page Yolias links to, the pixel that measures it, the **Conversion event** (Purchase or Lead by default) and the **Attribution window**: 1, 7 or 28 days after the click or the email. Qualified leads contacts no one, so it has no mailbox and no message. See [Campaign objectives](/help-center/campaign-objectives)." },
        { h3: "Offer and result" },
        { p: "Pick one of your offers from Company Knowledge, or describe the offer in up to 1,500 characters. The result you want (for example **Meetings you want**, from 1 to 1,000) is a target, not a promise: the campaign page shows progress against it. The builder also shows **Company Knowledge is N% complete**, counted from eight fields that hold more than a few words." },
        { h3: "Who to contact" },
        { p: "**Contact** sets who receives the emails: **People** (decision makers by name), **Companies** (a company's general address, such as info@) or **Both** (a person when Yolias finds one, otherwise the company address)." },
        { h3: "Message settings" },
        { ul: [
          "**Tone**: Direct (the default), Friendly or Formal.",
          "**Language**: a fixed language, or **Each person's language (from their country)**. With the second option, people in Arabic-speaking countries get Arabic, people in France get French, and anyone whose country has no mapped language gets English.",
          "**Notes for Yolias**: up to 2,000 characters, for example places to mention or things never to offer. They apply to every email and answer written after you save them.",
          "**Opening A** and **Opening B**: the two angles of the first email for each audience, written from Company Knowledge. You can edit them or press **Write again**.",
        ] },

        { h2: "Budget and spend" },
        { p: "The budget is what this campaign may spend. Your account balance is what you have. They are separate: a budget larger than your balance is allowed, and Yolias never reserves more than is available." },
        { table: { head: ["Budget type", "How it is used"], rows: [
          ["**Total**", "Budget ÷ your rate = the most people Yolias may find. Reserved once at launch, split equally between the audiences that find people"],
          ["**Per day**", "One day's people are reserved at launch. Every new day from the start date adds one more day's people, split by the audiences' current shares, until the end date"],
        ] } },
        { ul: [
          "**Smallest budget**: $5. The builder shows how many new people the budget buys at your rate, for example ≈ 50 at $0.10 each.",
          "**At least 10 people per audience.** An audience whose share is under 10 people doesn't start, and the launch shows a warning naming it.",
          "**Spend** = people found × your rate. Emails and AI are included.",
          "**Account limits.** The **Daily budget** on the dashboard caps what all campaigns spend in one UTC day, and the **Account spending limit** caps spend since it was set or reset. When either is reached, finding new people waits; conversations already running continue.",
          "**Balance.** When the balance is used up, finding new people stops until you top up or your plan renews, then continues by itself. The campaign stays Active and keeps sending to the people it already has.",
        ] },

        { h2: "Schedule and sending" },
        { p: "**Start** and **End** are set in the campaign's **Time zone**. With no end date the campaign runs **Until I stop it**. Under **Days, hours and pace** you set:" },
        { table: { head: ["Setting", "Default", "Range"], rows: [
          ["**Days Yolias contacts people**", "All seven days", "At least one day"],
          ["**Hours**", "09:00 to 17:00", "Any start and end"],
          ["**Messages a day**", "30", "1 to 500"],
          ["**Cost cap per result**", "No cap", "Any amount in USD"],
          ["**Track email opens**", "On", "On or off"],
        ] } },
        { p: "Only new emails follow these days and hours. Replies are answered at any time. An email goes out only when both windows are open: the campaign's, and the mailbox's own sending days and hours (Monday to Friday, 09:00 to 18:00 by default). Check both if your week starts on Sunday." },
        { p: "How many emails a campaign sends in a day is the smallest of:" },
        { ul: [
          "the campaign's **Messages a day**;",
          "the mailbox's daily limit, which during warm-up is 15 in the first week, 25 in the second and 40 in the third, counted across every campaign using that mailbox;",
          "50 emails per mailbox per day for the workspace;",
          "the pace: one email per mailbox every 18 to 24 minutes, chosen at random. An eight-hour window allows about 20 to 26 emails.",
        ] },
        { p: "Follow-ups are sent before new people. New people are ordered by how well they fit the audience, whether their email is verified, and what the workspace's results say about people like them." },

        { h2: "The conversation with each person" },
        { ol: [
          "**First email.** Written for the person, from the audience's Opening A or Opening B. Openings alternate until each has 20 people in that audience, then the one with more interested replies is sent more.",
          "**Follow-up 1.** 3 days after the first email, in the same thread, if there is no reply.",
          "**Follow-up 2.** 7 days after follow-up 1, in the same thread, if there is still no reply.",
        ] },
        { p: "The sequence stops for anyone who replies, books a meeting, bounces, unsubscribes or asks not to be contacted. An out-of-office reply doesn't count as a reply: the next follow-up waits 7 days. Every campaign email ends with an unsubscribe line. How replies are answered is described in [Yolias AI](/docs/searches)." },
        { p: "Before a person joins a campaign, Yolias skips anyone marked do not contact, anyone without an email address or company to write to, anyone another campaign is still writing to, and anyone your workspace emailed in the last 30 days." },

        { h2: "Lifecycle" },
        { table: { head: ["Status", "Meaning"], rows: [
          ["**Draft**", "Saved, not launched. Nothing runs and nothing is charged"],
          ["**Scheduled**", "Launched with a start date ahead. It starts by itself on that date"],
          ["**Active**", "Finding people, sending, following up and answering"],
          ["**Paused**", "Sending and finding stopped, by you or by a protection. Replies are still read"],
          ["**Ended**", "Reached its end date, or you chose **End campaign**. Results are kept"],
          ["**Archived**", "Stopped and removed from the list. Results are kept"],
        ] } },
        { p: "A campaign doesn't end when its budget is used. It stays Active, finishes the follow-ups of the people it has and keeps answering, until its end date or until you end it." },
        { p: "Yolias pauses a campaign by itself, and tells you why, when:" },
        { ul: [
          "the mailbox it sends from is disconnected or its permission expired;",
          "5% or more of the campaign's emails bounced, after at least 20 sent;",
          "more than 5% of the mailbox's emails bounced in the last 7 days, after at least 20 sent. Every campaign using that mailbox pauses.",
        ] },
        { p: "While a campaign is paused, replies that arrive are handed to you rather than answered." },

        { h2: "Controls" },
        { table: { head: ["Action", "What it does", "Available for"], rows: [
          ["On / off switch", "Pause or resume. Resuming works only for a launched campaign whose end date hasn't passed", "Active, Scheduled, Paused"],
          ["**Edit**", "Opens the builder with the campaign's settings", "Every status except Ended and Archived"],
          ["**Duplicate**", "Copies the campaign as a new draft named with (2), without dates", "Any campaign"],
          ["**End campaign**", "Stops finding and writing to new people, cancels unsent emails. Replies stay in Conversations", "Active, Scheduled, Paused"],
          ["**Archive**", "Stops sending, removes it from the list, keeps its results", "Any launched campaign"],
          ["**Delete draft**", "Deletes a draft that never sent anything. Anything else can only be archived", "Draft"],
        ] } },
        { p: "In the **Campaigns** table you can select up to 200 campaigns and pause, resume, duplicate, archive or delete them together, or edit their owner, end date, daily pace and budget in one step." },

        { h2: "Editing a running campaign" },
        { ul: [
          "Settings, message and mailbox can change. Changes apply to what Yolias does next; emails already sent don't change.",
          "An audience's targeting can't change once it runs. Add a new audience instead.",
          "A new audience starts at once. With a daily budget its reservation is one day's people; with a total budget it is what the budget grew by since launch. Either way it is divided between the audiences added together, and a total budget is never exceeded.",
          "A new total budget applies to audiences added from then on. Audiences already running keep what they reserved at launch.",
          "You can pause, resume or archive one audience on the campaign's **Audiences** tab. A paused audience stops finding people and its people wait.",
        ] },

        { h2: "Example" },
        { p: "A software company runs a Sales campaign at $10 per day on Pay As You Go, linking to its pricing page with Purchase as the conversion event and a 7-day attribution window. At launch Yolias reserves 100 people. Each new day adds 100 more, split by the audiences' shares. A person who clicks the link and buys within 7 days is credited to the campaign and the audience that reached them, and the campaign page shows **Results**, **Cost per result** and **Purchase ROAS**." },

        { h2: "Permissions and requirements" },
        { ul: [
          "Admins and Advertisers create, launch and change campaigns. Analysts view them.",
          "The mailbox must be connected and belong to the person who launches or edits the campaign.",
          "Launching needs a plan or credit, a budget of at least $5 and the confirmation that Yolias may email on your behalf.",
        ] },

        { h2: "Troubleshooting" },
        { table: { head: ["What you see", "Cause and fix"], rows: [
          ["A warning that an audience has too little budget", "Its share is under 10 people. Raise the budget or use fewer audiences"],
          ["A warning that Yolias couldn't start finding people", "The audience couldn't be searched. Edit the campaign and add an audience with clearer targeting"],
          ["Active, but no new people today", "The daily budget, the spending limit or the balance is reached, or the audience got no budget today"],
          ["Active, but no emails in hours", "Outside the campaign's or the mailbox's days and hours, or a daily limit is reached"],
          ["Paused by Yolias", "Read the reason on the campaign page, fix the mailbox or the addresses, then resume"],
        ] } },

        { h2: "Related articles" },
        { ul: [
          "[Audiences](/docs/audiences)",
          "[Campaign status and learning](/docs/search-status)",
          "[Results and metrics](/docs/analytics)",
          "[Budget and optimization](/help-center/budget-and-optimization)",
          "[Campaign results](/help-center/campaign-results)",
        ] },
      ],
    },
    ar: {
      title: "الحملات",
      summary: "مكونات الحملة وإعداداتها، وكيف تعمل ميزانيتها وإرسالها، ودورة حياتها وأدوات التحكم فيها.",
      updated: "2026-11-05",
      blocks: [
        { p: "الحملة هي الوحدة التي تنشئها وتدفع مقابلها وتقيسها في يولياس. لها هدف واحد وميزانية واحدة وجدول واحد وبريد واحد وجمهور أو أكثر، وتعمل حتى تاريخ نهايتها أو حتى تنهيها أنت. تشرح هذه الصفحة كيف تُبنى الحملة، وما يفعله كل إعداد، وكيف يُضبط الإنفاق والإرسال، وكل حالة يمكن أن تكون فيها الحملة. ولإنشاء حملة خطوة بخطوة راجع [إنشاء حملة](/help-center/creating-a-campaign)." },

        { h2: "ما هي الحملة" },
        { p: "تُبنى الحملة على ثلاثة مستويات مثل مدير الإعلانات، ويعرضها المنشئ في ثلاث خطوات: **الحملة** و**الجمهور** و**الرسالة**." },
        { table: { head: ["المستوى", "ما يحمله"], rows: [
          ["الحملة", "الاسم والهدف والعرض والنتيجة المطلوبة والميزانية والجدول و**الأيام والساعات والوتيرة**"],
          ["الجمهور", "من تصل إليهم، بحد أقصى 8 جماهير للحملة. لكل جمهور استهدافه أو جمهوره المحفوظ وافتتاحيتاه ونتائجه"],
          ["الرسالة", "البريد في **الإرسال من**، و**التوقيع باسم**، و**الأسلوب**، و**اللغة**، و**ملاحظات ليولياس**، وافتتاحيتا يولياس، ورسالة نموذجية"],
        ] } },
        { p: "لا توجد سلسلة رسائل تكتبها بنفسك. فالرسالة الأولى والمتابعات والردود من عمل يولياس، يكتبها لكل شخص من معرفة الشركة والعرض وما يُعرف عنه، وإعداداتك هي التي توجّهه." },

        { h2: "الإعدادات" },
        { h3: "الهدف" },
        { p: "واحد من **اجتماعات** أو **المبيعات** أو **نماذج الموقع** أو **عملاء مؤهلون**. وتطلب المبيعات ونماذج الموقع أيضًا صفحة الموقع التي يرسل يولياس رابطها، والبيكسل الذي يقيسها، و**حدث التحويل** (Purchase أو Lead افتراضيًا)، و**نافذة الاحتساب**: يوم واحد أو 7 أيام أو 28 يومًا بعد النقرة أو الرسالة. أما العملاء المؤهلون فلا تتواصل مع أحد، فلا بريد فيها ولا رسالة. راجع [أهداف الحملة](/help-center/campaign-objectives)." },
        { h3: "العرض والنتيجة" },
        { p: "اختر أحد عروضك من معرفة الشركة، أو اكتب العرض بنفسك في حدود 1,500 حرف. والنتيجة المطلوبة (مثل **عدد الاجتماعات الذي تريده**، من 1 إلى 1,000) هدف وليست وعدًا، وتعرض صفحة الحملة التقدم نحوها. ويعرض المنشئ أيضًا **معرفة الشركة مكتملة بنسبة** محسوبة من ثمانية حقول تحتوي أكثر من بضع كلمات." },
        { h3: "مع من يتواصل" },
        { p: "يحدد **التواصل مع** من يستلم الرسائل: **أشخاص** (أصحاب القرار بالاسم)، أو **شركات** (البريد العام للشركة مثل info@)، أو **الاثنين** (شخص حين يجده يولياس، وإلا البريد العام للشركة)." },
        { h3: "إعدادات الرسالة" },
        { ul: [
          "**الأسلوب**: مباشر (الافتراضي) أو ودود أو رسمي.",
          "**اللغة**: لغة ثابتة، أو **لغة كل شخص (حسب دولته)**. وفي الخيار الثاني يستلم من في الدول العربية رسائل بالعربية، ومن في فرنسا بالفرنسية، ومن لا ترتبط دولته بلغة محددة بالإنجليزية.",
          "**ملاحظات ليولياس**: حتى 2,000 حرف، مثل أماكن تريد ذكرها أو أشياء لا تُعرض أبدًا. وتنطبق على كل رسالة وإجابة تُكتب بعد حفظها.",
          "**الافتتاحية أ** و**الافتتاحية ب**: زاويتا الرسالة الأولى لكل جمهور، مكتوبتان من معرفة الشركة. ويمكنك تعديلهما أو الضغط على **إعادة الكتابة**.",
        ] },

        { h2: "الميزانية والإنفاق" },
        { p: "الميزانية هي ما يحق لهذه الحملة إنفاقه، ورصيد الحساب هو ما تملكه. وهما منفصلان: يمكن أن تزيد الميزانية على الرصيد، ولا يحجز يولياس أبدًا أكثر من المتاح." },
        { table: { head: ["نوع الميزانية", "طريقة استخدامها"], rows: [
          ["**إجمالية**", "الميزانية ÷ سعرك = أقصى عدد من الأشخاص يمكن إيجادهم. تُحجز مرة واحدة عند التشغيل وتُقسم بالتساوي على الجماهير التي تبحث عن أشخاص"],
          ["**يومية**", "يُحجز أشخاص يوم واحد عند التشغيل. وكل يوم جديد من تاريخ البداية يضيف أشخاص يوم آخر، مقسّمين حسب أنصبة الجماهير الحالية، حتى تاريخ النهاية"],
        ] } },
        { ul: [
          "**أقل ميزانية**: 5 دولارات. ويعرض المنشئ عدد الأشخاص الجدد الذين تكفيهم الميزانية بسعرك، مثل ≈ 50 شخصًا بسعر 0.10 دولار للشخص.",
          "**10 أشخاص على الأقل لكل جمهور.** الجمهور الذي يقل نصيبه عن 10 أشخاص لا يبدأ، ويظهر تنبيه باسمه عند التشغيل.",
          "**الإنفاق** = الأشخاص الذين يُعثر عليهم × سعرك. والرسائل والذكاء الاصطناعي مشمولة.",
          "**حدود الحساب.** تحدد **الميزانية اليومية** في لوحة التحكم ما تنفقه كل الحملات في يوم واحد بتوقيت UTC، ويحدد **حد الإنفاق للحساب** الإنفاق منذ ضبطه أو إعادة تعيينه. وعند بلوغ أيهما ينتظر إيجاد أشخاص جدد، وتستمر المحادثات الجارية.",
          "**الرصيد.** عند نفاد الرصيد يتوقف إيجاد أشخاص جدد حتى تشحن أو تتجدد خطتك، ثم يستأنف وحده. وتبقى الحملة نشطة وتواصل مراسلة من لديها من أشخاص.",
        ] },

        { h2: "الجدول والإرسال" },
        { p: "تُضبط **البداية** و**النهاية** حسب **المنطقة الزمنية** للحملة. وبدون تاريخ نهاية تعمل الحملة **حتى أوقفها**. وتضبط في **الأيام والساعات والوتيرة**:" },
        { table: { head: ["الإعداد", "الافتراضي", "النطاق"], rows: [
          ["**الأيام التي يتواصل فيها يولياس**", "أيام الأسبوع السبعة", "يوم واحد على الأقل"],
          ["**الساعات**", "من 09:00 إلى 17:00", "أي بداية ونهاية"],
          ["**عدد الرسائل اليومية**", "30", "من 1 إلى 500"],
          ["**حد أقصى لتكلفة النتيجة**", "بدون حد", "أي مبلغ بالدولار"],
          ["**تتبّع فتح الرسائل**", "مفعّل", "مفعّل أو متوقف"],
        ] } },
        { p: "تلتزم الرسائل الجديدة فقط بهذه الأيام والساعات، أما الردود فيُجاب عليها في أي وقت. ولا تُرسل رسالة إلا إذا كانت النافذتان مفتوحتين: نافذة الحملة، وأيام الإرسال وساعاته الخاصة بالبريد نفسه (من الاثنين إلى الجمعة، من 09:00 إلى 18:00 افتراضيًا). راجع الاثنتين إذا كان أسبوع عملك يبدأ يوم الأحد." },
        { p: "عدد الرسائل التي ترسلها الحملة في اليوم هو الأقل من:" },
        { ul: [
          "**عدد الرسائل اليومية** في الحملة؛",
          "الحد اليومي للبريد، وهو أثناء الإحماء 15 رسالة في الأسبوع الأول و25 في الثاني و40 في الثالث، ويُحسب عبر كل الحملات التي تستخدم هذا البريد؛",
          "50 رسالة للبريد الواحد يوميًا على مستوى مساحة العمل؛",
          "الوتيرة: رسالة واحدة من البريد كل 18 إلى 24 دقيقة بشكل عشوائي، فتسمح نافذة من ثماني ساعات بنحو 20 إلى 26 رسالة.",
        ] },
        { p: "تُرسل المتابعات قبل الأشخاص الجدد. ويُرتَّب الأشخاص الجدد حسب مدى مطابقتهم للجمهور، وهل بريدهم موثّق، وما تقوله نتائج مساحة العمل عمّن يشبهونهم." },

        { h2: "المحادثة مع كل شخص" },
        { ol: [
          "**الرسالة الأولى.** تُكتب للشخص نفسه انطلاقًا من الافتتاحية أ أو الافتتاحية ب لجمهوره. وتتناوب الافتتاحيتان حتى تصل كل منهما إلى 20 شخصًا في ذلك الجمهور، ثم تُرسل أكثر تلك التي تحصل على ردود مهتمة أكثر.",
          "**المتابعة الأولى.** بعد 3 أيام من الرسالة الأولى في المحادثة نفسها، إذا لم يأتِ رد.",
          "**المتابعة الثانية.** بعد 7 أيام من المتابعة الأولى في المحادثة نفسها، إذا لم يأتِ رد بعد.",
        ] },
        { p: "تتوقف السلسلة لكل من يرد أو يحجز اجتماعًا أو يرتد بريده أو يلغي اشتراكه أو يطلب عدم التواصل. ولا يُحسب الرد الآلي خارج المكتب ردًا، بل تنتظر المتابعة التالية 7 أيام. وتنتهي كل رسالة حملة بسطر لإلغاء الاشتراك. أما طريقة الرد على الرسائل فتجدها في [Yolias AI](/docs/searches)." },
        { p: "قبل أن ينضم شخص إلى حملة، يتخطى يولياس كل من سُجّل بعدم التواصل، ومن لا يوجد له بريد أو شركة يُراسل عليها، ومن تراسله حملة أخرى حاليًا، ومن راسلته مساحة عملك خلال آخر 30 يومًا." },

        { h2: "دورة الحياة" },
        { table: { head: ["الحالة", "المعنى"], rows: [
          ["**مسودة**", "محفوظة وغير مشغّلة، لا يعمل فيها شيء ولا يُحسب شيء"],
          ["**مجدولة**", "شُغّلت بتاريخ بداية لاحق، وتبدأ وحدها في ذلك التاريخ"],
          ["**نشطة**", "تجد أشخاصًا وترسل وتتابع وتجيب"],
          ["**متوقفة**", "توقف الإرسال والبحث بقرارك أو بسبب حماية، وتظل الردود تُقرأ"],
          ["**انتهت**", "بلغت تاريخ نهايتها أو اخترت **إنهاء الحملة**، وتبقى نتائجها"],
          ["**مؤرشفة**", "متوقفة وخارج القائمة، وتبقى نتائجها"],
        ] } },
        { p: "لا تنتهي الحملة عند استخدام ميزانيتها، بل تبقى نشطة وتكمل متابعات من لديها من أشخاص وتواصل الرد، حتى تاريخ نهايتها أو حتى تنهيها أنت." },
        { p: "يوقف يولياس الحملة وحده ويخبرك بالسبب في هذه الحالات:" },
        { ul: [
          "إذا انفصل البريد الذي ترسل منه أو انتهت صلاحية إذنه؛",
          "إذا ارتد 5% أو أكثر من رسائل الحملة بعد إرسال 20 رسالة على الأقل؛",
          "إذا ارتد أكثر من 5% من رسائل البريد خلال آخر 7 أيام بعد إرسال 20 رسالة على الأقل، فتتوقف كل الحملات التي تستخدمه.",
        ] },
        { p: "أثناء توقف الحملة، تُسلَّم إليك الردود التي تصل بدل أن يجيب عليها يولياس." },

        { h2: "أدوات التحكم" },
        { table: { head: ["الإجراء", "ما يفعله", "متاح في"], rows: [
          ["زر التشغيل والإيقاف", "يوقف الحملة أو يستأنفها. ولا يعمل الاستئناف إلا لحملة مشغّلة لم يمر تاريخ نهايتها", "نشطة ومجدولة ومتوقفة"],
          ["**تعديل**", "يفتح المنشئ بإعدادات الحملة", "كل الحالات عدا انتهت ومؤرشفة"],
          ["**نسخ**", "ينسخ الحملة كمسودة جديدة باسمها مع (2) وبدون تواريخ", "أي حملة"],
          ["**إنهاء الحملة**", "يوقف إيجاد أشخاص جدد ومراسلتهم ويلغي الرسائل غير المرسلة، وتبقى الردود في المحادثات", "نشطة ومجدولة ومتوقفة"],
          ["**أرشفة**", "يوقف الإرسال ويخرج الحملة من القائمة ويحتفظ بنتائجها", "أي حملة مشغّلة"],
          ["**حذف المسودة**", "يحذف مسودة لم ترسل شيئًا، وما عداها يمكن أرشفته فقط", "مسودة"],
        ] } },
        { p: "في جدول **الحملات** يمكنك تحديد حتى 200 حملة وإيقافها أو استئنافها أو نسخها أو أرشفتها أو حذفها معًا، أو تعديل المسؤول وتاريخ النهاية والوتيرة اليومية والميزانية دفعة واحدة." },

        { h2: "تعديل حملة تعمل" },
        { ul: [
          "يمكن تغيير الإعدادات والرسالة والبريد، وتنطبق التغييرات على ما يفعله يولياس بعدها، ولا تتغير الرسائل المرسلة.",
          "لا يتغير استهداف جمهور بعد بدء عمله، فأضف جمهورًا جديدًا بدلًا من ذلك.",
          "يبدأ الجمهور الجديد فورًا. ومع الميزانية اليومية يُحجز له أشخاص يوم واحد، ومع الميزانية الإجمالية يُحجز له ما زادته الميزانية منذ التشغيل فقط. وفي الحالتين يُقسم ذلك على الجماهير المضافة معًا، ولا تُتجاوز الميزانية الإجمالية أبدًا.",
          "تنطبق الميزانية الإجمالية الجديدة على الجماهير التي تُضاف بعدها، وتحتفظ الجماهير الجارية بما حُجز لها عند التشغيل.",
          "يمكنك إيقاف جمهور واحد أو استئنافه أو أرشفته من تبويب **الجماهير** في صفحة الحملة، فيتوقف الجمهور المتوقف عن إيجاد أشخاص وينتظر من فيه.",
        ] },

        { h2: "مثال" },
        { p: "شركة برمجيات تشغّل حملة مبيعات بـ10 دولارات يوميًا في الدفع حسب الاستخدام، برابط إلى صفحة الأسعار، وحدث التحويل Purchase، ونافذة احتساب 7 أيام. عند التشغيل يحجز يولياس 100 شخص، ويضيف كل يوم جديد 100 آخرين مقسّمين حسب أنصبة الجماهير. ومن يضغط الرابط ويشتري خلال 7 أيام يُنسب إلى الحملة والجمهور الذي وصل إليه، وتعرض صفحة الحملة **النتائج** و**تكلفة النتيجة** و**العائد على الإنفاق (المبيعات)**." },

        { h2: "الصلاحيات والمتطلبات" },
        { ul: [
          "ينشئ المدير والمعلن الحملات ويشغّلانها ويغيّرانها، ويراها المحلل فقط.",
          "يجب أن يكون البريد متصلًا ومملوكًا للشخص الذي يشغّل الحملة أو يعدّلها.",
          "يحتاج التشغيل إلى خطة أو رصيد، وميزانية لا تقل عن 5 دولارات، والموافقة على أن يراسل يولياس نيابةً عنك.",
        ] },

        { h2: "حل المشكلات" },
        { table: { head: ["ما تراه", "السبب والحل"], rows: [
          ["تنبيه بأن ميزانية جمهور أقل من أن يجد أشخاصًا", "نصيبه أقل من 10 أشخاص. ارفع الميزانية أو قلّل عدد الجماهير"],
          ["تنبيه بأن يولياس تعذّر عليه بدء إيجاد أشخاص", "تعذّر البحث لهذا الجمهور. عدّل الحملة وأضف جمهورًا باستهداف أوضح"],
          ["نشطة بلا أشخاص جدد اليوم", "بلغت الميزانية اليومية أو حد الإنفاق أو الرصيد، أو لم يحصل الجمهور على ميزانية اليوم"],
          ["نشطة بلا رسائل منذ ساعات", "خارج أيام الحملة أو البريد وساعاتهما، أو بلغ حد يومي"],
          ["أوقفها يولياس", "اقرأ السبب في صفحة الحملة، وأصلح البريد أو العناوين، ثم استأنفها"],
        ] } },

        { h2: "مقالات ذات صلة" },
        { ul: [
          "[الجماهير](/docs/audiences)",
          "[حالة الحملة والتعلّم](/docs/search-status)",
          "[النتائج والمقاييس](/docs/analytics)",
          "[الميزانية والتحسين](/help-center/budget-and-optimization)",
          "[نتائج الحملة](/help-center/campaign-results)",
        ] },
      ],
    },
  },
  audiences: {
    en: {
      title: "Audiences",
      summary: "Targeting fields, how matching and the audience check work, and how custom, lookalike and saved audiences are built.",
      updated: "2026-11-05",
      blocks: [
        { p: "An audience defines who a campaign reaches. A campaign has from one to eight audiences, and each one works like an ad set: its own targeting, its own two openings, its own share of the budget and its own results, so you can see which group of people responds. This page describes the targeting fields, the matching rules, the check you see in the builder, and the three kinds of audience you keep in the **Audiences** section. For the task itself, see [Audiences in the Help Center](/help-center/audiences)." },

        { h2: "What is an audience" },
        { p: "Each audience in a campaign has one of two sources, chosen under **People** on the Audience step:" },
        { table: { head: ["Source", "What happens"], rows: [
          ["**Find new people for this targeting**", "Yolias searches for companies and decision makers that match the fields you set. Each person found is charged at your rate"],
          ["**Use a saved audience**", "The campaign uses an audience from the Audiences section: saved targeting, a custom audience or a lookalike"],
        ] } },
        { p: "Building an audience never contacts anyone. Only a running campaign writes to people." },

        { h2: "Targeting fields" },
        { p: "The editor groups the fields under **Locations**, **Companies**, **People**, **Signals** and **Exclusions**. Lists are searchable, and fields marked as free accept your own values, such as a job title or a keyword not in the list." },
        { table: { head: ["Group", "Field", "Include / exclude"], rows: [
          ["Locations", "**Countries**, then **Regions** and **Cities** of a chosen country", "Both"],
          ["Companies", "**Industries** (40 in the list, plus your own)", "Both"],
          ["Companies", "**Company type**, **Employees** (1–10 up to 1,000+)", "Include"],
          ["Companies", "**Revenue (yearly)**, only where the data is published", "Include"],
          ["People", "**Decision makers only**, **Seniority**, **Department**", "Include"],
          ["People", "**Job titles** (30 in the list, plus your own)", "Both"],
          ["Signals", "**Buying intent (what they need now)**, **Hiring now**, **Technologies they use**", "Include"],
          ["Signals", "**Funding stage**, only where the data is published", "Include"],
          ["Signals", "**Keywords (services, needs, website topics)**", "Both"],
          ["Exclusions", "**Companies never to contact**: names or websites of customers, partners or competitors", "Exclude"],
        ] } },
        { p: "Below the fields, **Anything else about who fits (optional)** takes up to 2,000 characters in your own words, such as clinics that take online bookings and run their own marketing. Yolias reads it together with the fields." },
        { p: "Targeting has no age, gender or other personal traits. It describes companies and the roles inside them." },

        { h2: "How matching works" },
        { ul: [
          "**Inside a field: any of the values.** Industries Dental and Healthcare & clinics match a company in either.",
          "**Across fields: all of them.** Country Saudi Arabia and job title Owner match owners in Saudi Arabia only.",
          "**Exclusions remove matches.** An excluded country, city, industry, job title or keyword removes anyone who has it, and a company never to contact is never written to in that audience.",
          "**Places are chosen after the country.** Regions and cities come from a list for each country, and each can be included or excluded.",
        ] },
        { p: "An audience needs at least one targeting field or a description, or a saved audience. Otherwise the builder shows **Give every audience a targeting or a saved audience.**" },

        { h2: "The audience check" },
        { p: "The **Audience** box on the Audience step counts what Yolias already knows for sure. It doesn't estimate the size of the wider market." },
        { ul: [
          "**N matching companies and people already in Yolias**: people and companies in your workspace that match the audience's countries, regions and cities, industries, job titles, company size and companies never to contact. Other fields are not part of this count.",
          "**N of them can be emailed**: those with an email address that isn't known to be invalid.",
          "For an audience that finds new people: **While the campaign runs, Yolias keeps finding new companies and people that match.**",
          "For a custom audience: its size and how many have an email.",
        ] },
        { p: "Press **Check again** after changing fields. The check looks at up to 5,000 people and 5,000 companies in your workspace." },
        { p: "Beside each audience the builder also warns, without blocking the launch, when the same value is included and excluded, when no job titles, seniority or department are set (unless the campaign contacts companies), and when the audience has no location or no industry, company type, keyword or technology." },

        { h2: "How an audience finds people" },
        { p: "When a campaign launches, every audience that finds new people starts its own search." },
        { ol: [
          "Yolias turns the fields and the description into search criteria, using your Company Knowledge to fill what the audience leaves open, such as the decision makers who usually buy what you sell. What the audience says always wins.",
          "It finds matching companies, then the decision makers inside them. A lookalike searches for companies similar to its seed companies, within its traits.",
          "Each company and person found is saved in Leads with what Yolias found about them, and is charged once at your rate.",
          "With an end date, the search runs again every day until that date, within the budget. Without one, it runs until the audience's reservation is used.",
        ] },
        { p: "Starting a search counts toward your plan's daily number of searches, which resets at 00:00 UTC. An audience that can't start shows the warning **Yolias couldn't start finding people for** the audience; add it again later or on another day." },

        { h2: "Custom audiences" },
        { p: "A custom audience is a list of people you already have. In **Audiences** choose **Create audience**, then **Custom audience** and **Build it from**:" },
        { table: { head: ["Source", "Who is in it"], rows: [
          ["**A previous campaign's contacts**", "Everyone who joined the campaign you pick"],
          ["**Your customers**", "Leads whose deal is marked won"],
          ["**People who booked a meeting**", "Leads with a meeting that wasn't canceled"],
          ["**Interested people**", "Leads at the interested stage or later"],
          ["**A file (CSV)**", "One row per person or company, up to 5,000 rows. A name column is required; email, company, title, website and country columns help Yolias"],
        ] } },
        { p: "**Preview** shows the total, how many have an email, and how many asked not to be contacted. Campaigns skip those people. **Refresh from source** rebuilds the list from its source, so a customers audience picks up deals won since." },
        { p: "When you upload a CSV file, you pick the column that holds each field: **Name column**, **Email column**, **Company column**, **Title column**, **Website column** and **Country column**, or **Not in the file**. Under **Each row is** you choose **A person** or **A company**. The rows are added to Leads as imported contacts, then the audience is built from them. A row with a company and no person is written to at the company's general address, when it has one." },
        { p: "People from a custom audience are already in your workspace, so a campaign doesn't search for them. They join the campaign as they are, with the usual checks: anyone marked do not contact, contacted by your workspace in the last 30 days, or in another running campaign is skipped." },

        { h2: "Lookalike audiences" },
        { p: "A lookalike finds new companies like the ones that work for you. Choose **Lookalike audience**, a base under **Similar to** (**Your customers**, **People who booked a meeting**, **Interested people** or **One of your custom audiences**), a **Similarity** level, then **Analyze** and **Create lookalike**." },
        { table: { head: ["Similarity", "Traits kept", "Companies used as the seed"], rows: [
          ["1 (**Closest**)", "Values shared by at least 60% of the base: industries, countries, company sizes and job titles", "8"],
          ["5", "Values shared by at least 40%, job titles included", "16"],
          ["7", "Values shared by at least 30%; job titles dropped", "20"],
          ["10 (**Broader**)", "Values shared by at least 15%; job titles and sizes dropped", "26"],
        ] } },
        { p: "Each level between them lowers the share by 5 points and adds two seed companies. A trait must appear at least twice, and at most four values are kept for each field. Up to 1,000 people of the base are read." },
        { table: { head: ["Confidence", "Base size"], rows: [
          ["Low", "Fewer than 5 people"],
          ["Medium", "5 to 19 people"],
          ["High", "20 or more people"],
        ] } },
        { p: "Similar is not the same as ready to buy: Yolias still qualifies each company before writing. Once a workspace has 3 meetings, Yolias keeps a lookalike named **Like the people who booked a meeting** up to date in Audiences, at similarity 3. It is never added to a campaign by itself, and it keeps the name you give it." },

        { h2: "Saved targeting" },
        { p: "Saved targeting is a set of fields you reuse. Save it from the Audiences section with **Save targeting**, or from an audience in the builder with **Save as an audience**. When a campaign uses it, Yolias finds new people for it like any targeting." },

        { h2: "Audiences in a running campaign" },
        { ul: [
          "An audience's targeting can't change once it runs. Add a new audience to try different targeting.",
          "On the campaign's **Audiences** tab you can pause, resume or archive one audience. A paused audience stops finding people and its people wait.",
          "Each audience has a share of new budget, shown as a percentage, or **Learning** while it collects results. See [Campaign status and learning](/docs/search-status).",
          "Deleting an audience in the Audiences section doesn't affect campaigns that used it: they keep their people.",
          "At launch the budget is split equally between every audience that uses a saved audience or finds new people. A custom audience counts in that split although it finds no one.",
        ] },

        { h2: "Example" },
        { p: "A logistics company has 24 won deals. It builds a lookalike of **Your customers** at similarity 3. The analysis reads 24 people, so confidence is high, and finds that 70% are in Wholesale & distribution, 60% in Saudi Arabia and 55% have 51–200 employees. The lookalike keeps those traits and 12 customer companies as the seed. A new campaign uses it as one audience, next to a targeting audience of operations managers in the UAE, and the results show which audience books more meetings." },

        { h2: "Permissions and requirements" },
        { ul: [
          "Admins and Advertisers create, change and delete audiences. Analysts view them.",
          "A lookalike needs a base with at least one person. An empty base shows **There is nobody to learn from yet in this base.**",
          "Revenue and funding stage only narrow results where the data publishes them.",
        ] },

        { h2: "Troubleshooting" },
        { table: { head: ["What you see", "Cause and fix"], rows: [
          ["The check shows 0 matching", "Nothing in your workspace matches yet. The campaign still finds new people for the targeting"],
          ["**Nobody to add.**", "The custom audience's source is empty"],
          ["An audience had nobody to add at launch", "Everyone in it was already contacted, is in another campaign, or asked not to be contacted"],
          ["The campaign waits for a data source", "See [A campaign waiting to start](/help-center/awaiting-data-source)"],
          ["**This campaign is running: its audiences' targeting can't change.**", "Add a new audience instead"],
        ] } },

        { h2: "Related articles" },
        { ul: [
          "[Campaigns](/docs/campaigns)",
          "[Leads](/docs/prospects)",
          "[Campaign status and learning](/docs/search-status)",
          "[Audiences in the Help Center](/help-center/audiences)",
        ] },
      ],
    },
    ar: {
      title: "الجماهير",
      summary: "حقول الاستهداف، وكيف تعمل المطابقة وفحص الجمهور، وكيف تُبنى الجماهير المخصصة والمشابهة والاستهداف المحفوظ.",
      updated: "2026-11-05",
      blocks: [
        { p: "يحدد الجمهور من تصل إليهم الحملة. وللحملة من جمهور واحد إلى ثمانية جماهير، يعمل كل منها مثل مجموعة إعلانية: له استهدافه وافتتاحيتاه ونصيبه من الميزانية ونتائجه، لترى أي فئة من الأشخاص تستجيب. تشرح هذه الصفحة حقول الاستهداف وقواعد المطابقة والفحص الذي تراه في المنشئ، وأنواع الجماهير الثلاثة التي تحفظها في قسم **الجماهير**. ولتنفيذ المهمة نفسها راجع [الجماهير في مركز المساعدة](/help-center/audiences)." },

        { h2: "ما هو الجمهور" },
        { p: "لكل جمهور في الحملة أحد مصدرين، تختاره في **الأشخاص** من خطوة الجمهور:" },
        { table: { head: ["المصدر", "ما يحدث"], rows: [
          ["**إيجاد أشخاص جدد لهذا الاستهداف**", "يبحث يولياس عن الشركات وأصحاب القرار المطابقين للحقول التي ضبطتها، ويُحسب كل شخص يُعثر عليه بسعرك"],
          ["**استخدام جمهور محفوظ**", "تستخدم الحملة جمهورًا من قسم الجماهير: استهدافًا محفوظًا أو جمهورًا مخصصًا أو جمهورًا مشابهًا"],
        ] } },
        { p: "إنشاء الجمهور لا يراسل أحدًا، فالحملة الجارية وحدها هي التي تراسل الأشخاص." },

        { h2: "حقول الاستهداف" },
        { p: "يجمع المحرر الحقول تحت **المواقع** و**الشركات** و**الأشخاص** و**إشارات** و**الاستبعادات**. والقوائم قابلة للبحث، والحقول المفتوحة تقبل قيمك الخاصة، مثل مسمى وظيفي أو كلمة مفتاحية غير موجودة في القائمة." },
        { table: { head: ["المجموعة", "الحقل", "تضمين / استبعاد"], rows: [
          ["المواقع", "**الدول**، ثم **المناطق والمحافظات** و**المدن** في الدولة المختارة", "الاثنان"],
          ["الشركات", "**المجالات** (40 في القائمة، إضافة إلى قيمك)", "الاثنان"],
          ["الشركات", "**نوع الشركة** و**عدد الموظفين** (من 1–10 حتى +1,000)", "تضمين"],
          ["الشركات", "**الإيرادات السنوية**، حيث تكون البيانات منشورة فقط", "تضمين"],
          ["الأشخاص", "**أصحاب القرار فقط** و**المستوى الوظيفي** و**الإدارة**", "تضمين"],
          ["الأشخاص", "**المسميات الوظيفية** (30 في القائمة، إضافة إلى قيمك)", "الاثنان"],
          ["إشارات", "**نية الشراء (ما يحتاجونه الآن)** و**توظّف الآن** و**تقنيات يستخدمونها**", "تضمين"],
          ["إشارات", "**مرحلة التمويل**، حيث تكون البيانات منشورة فقط", "تضمين"],
          ["إشارات", "**كلمات مفتاحية (خدمات، احتياجات، موضوعات الموقع)**", "الاثنان"],
          ["الاستبعادات", "**شركات لا يتم التواصل معها**: أسماء أو مواقع عملائك وشركائك ومنافسيك", "استبعاد"],
        ] } },
        { p: "وتحت الحقول يقبل **أي شيء آخر عن المناسبين (اختياري)** حتى 2,000 حرف بكلماتك أنت، مثل: عيادات تقبل الحجز عبر الإنترنت وتدير تسويقها بنفسها. ويقرؤه يولياس مع الحقول." },
        { p: "لا يتضمن الاستهداف العمر أو الجنس أو أي صفات شخصية، فهو يصف الشركات والأدوار داخلها." },

        { h2: "كيف تعمل المطابقة" },
        { ul: [
          "**داخل الحقل الواحد: أيٌّ من القيم.** مجالا طب الأسنان والرعاية الصحية والعيادات يطابقان شركة في أي منهما.",
          "**بين الحقول: كلها معًا.** دولة السعودية والمسمى المالك يطابقان الملاك في السعودية فقط.",
          "**الاستبعادات تزيل المطابقات.** الدولة أو المدينة أو المجال أو المسمى أو الكلمة المستبعدة تزيل كل من يحملها، والشركة المدرجة في الشركات التي لا يُتواصل معها لا يُراسل أحد فيها ضمن هذا الجمهور.",
          "**تُختار الأماكن بعد الدولة.** تأتي المناطق والمدن من قائمة خاصة بكل دولة، ويمكن تضمين كل منها أو استبعاده.",
        ] },
        { p: "يحتاج الجمهور إلى حقل استهداف واحد على الأقل أو وصف أو جمهور محفوظ، وإلا يعرض المنشئ **حدد لكل جمهور استهدافًا أو جمهورًا محفوظًا.**" },

        { h2: "فحص الجمهور" },
        { p: "يحسب مربع **الجمهور** في خطوة الجمهور ما يعرفه يولياس يقينًا، ولا يقدّر حجم السوق الأوسع." },
        { ul: [
          "**N شركة وشخص مطابقون موجودون في يولياس**: الأشخاص والشركات في مساحة عملك المطابقون لدول الجمهور ومناطقه ومدنه ومجالاته ومسمياته الوظيفية وحجم شركاته والشركات التي لا يُتواصل معها. ولا تدخل الحقول الأخرى في هذا العدد.",
          "**N منهم يمكن مراسلتهم بالبريد**: من لديهم بريد غير معروف بأنه غير صالح.",
          "في الجمهور الذي يجد أشخاصًا جددًا: **أثناء تشغيل الحملة يستمر يولياس في إيجاد شركات وأشخاص جدد مطابقين.**",
          "في الجمهور المخصص: حجمه وعدد من لديهم بريد.",
        ] },
        { p: "اضغط **افحص مرة أخرى** بعد تغيير الحقول. ويقرأ الفحص حتى 5,000 شخص و5,000 شركة من مساحة عملك." },
        { p: "ويعرض المنشئ بجانب كل جمهور تنبيهات لا تمنع التشغيل: عندما تكون القيمة نفسها مضمّنة ومستبعدة، وعندما لا توجد مسميات وظيفية أو مستوى وظيفي أو إدارة (ما لم تتواصل الحملة مع الشركات)، وعندما ينقص الجمهور موقع أو مجال أو نوع شركة أو كلمة مفتاحية أو تقنية." },

        { h2: "كيف يجد الجمهور الأشخاص" },
        { p: "عند تشغيل الحملة يبدأ كل جمهور يجد أشخاصًا جددًا بحثه الخاص." },
        { ol: [
          "يحوّل يولياس الحقول والوصف إلى معايير بحث، ويستعين بمعرفة الشركة ليكمل ما يتركه الجمهور مفتوحًا، مثل أصحاب القرار الذين يشترون عادةً ما تبيعه. وما يحدده الجمهور هو الذي يُعتمد دائمًا.",
          "يجد الشركات المطابقة، ثم أصحاب القرار داخلها. أما الجمهور المشابه فيبحث عن شركات تشبه شركات أساسه، ضمن صفاته.",
          "تُحفظ كل شركة وكل شخص يُعثر عليه في العملاء مع ما وجده يولياس عنه، ويُحسب مرة واحدة بسعرك.",
          "إذا كان للحملة تاريخ نهاية، يتكرر البحث كل يوم حتى ذلك التاريخ في حدود الميزانية. وبدونه يستمر حتى يُستخدم ما حُجز للجمهور.",
        ] },
        { p: "يُحسب بدء البحث من عدد عمليات البحث اليومية في خطتك، ويتجدد عند 00:00 بتوقيت UTC. والجمهور الذي يتعذر بدؤه يعرض تنبيهًا بأن يولياس تعذّر عليه بدء إيجاد أشخاص له، فأضفه مرة أخرى لاحقًا أو في يوم آخر." },
        { p: "ولأن كل جمهور يبحث مستقلًا، تظهر نتائجه منفصلة في صفحة الحملة: من وُجد، ومن تُواصل معه، ومن رد، ومن حجز. وهذا ما يجعل المقارنة بين الجماهير ممكنة، وما يعتمد عليه يولياس عندما يوزّع الميزانية الجديدة." },

        { h2: "الجماهير المخصصة" },
        { p: "الجمهور المخصص قائمة بأشخاص لديك بالفعل. في **الجماهير** اختر **إنشاء جمهور** ثم **جمهور مخصص** ثم **أنشئه من**:" },
        { table: { head: ["المصدر", "من فيه"], rows: [
          ["**جهات حملة سابقة**", "كل من انضم إلى الحملة التي تختارها"],
          ["**عملاؤك**", "العملاء الذين سُجّلت صفقتهم كمكسوبة"],
          ["**من حجزوا اجتماعًا**", "العملاء الذين لهم اجتماع لم يُلغَ"],
          ["**المهتمون**", "العملاء في مرحلة الاهتمام أو ما بعدها"],
          ["**ملف (CSV)**", "صف لكل شخص أو شركة، حتى 5,000 صف. وعمود الاسم مطلوب، وأعمدة البريد والشركة والمسمى والموقع والدولة تساعد يولياس"],
        ] } },
        { p: "تعرض **معاينة** العدد الكلي وعدد من لديهم بريد وعدد من طلبوا عدم التواصل، وتتخطى الحملات هؤلاء. ويعيد **تحديث من المصدر** بناء القائمة من مصدرها، فيضيف جمهور العملاء الصفقات التي كُسبت بعد إنشائه." },
        { p: "عند رفع ملف CSV تختار لكل حقل العمود الذي يحمله: **عمود الاسم** و**عمود البريد** و**عمود الشركة** و**عمود المسمى** و**عمود الموقع** و**عمود الدولة**، أو **غير موجود في الملف** إذا لم يتضمن ملفك هذه البيانات. وكلما اكتملت الأعمدة كتب يولياس رسائل أدق. وتحدد في **كل صف هو** إن كان الصف **شخص** أو **شركة**. وتُضاف الصفوف إلى العملاء كجهات مستوردة، ثم يُبنى الجمهور منها. والصف الذي يحمل شركة بلا شخص يُراسل على البريد العام للشركة إن وُجد." },
        { p: "أشخاص الجمهور المخصص موجودون في مساحة عملك أصلًا، فلا تبحث الحملة عنهم، بل ينضمون إليها كما هم مع الفحوص المعتادة: يُتخطى من سُجّل بعدم التواصل، ومن راسلته مساحة عملك خلال آخر 30 يومًا، ومن هو في حملة أخرى جارية." },

        { h2: "الجماهير المشابهة" },
        { p: "يجد الجمهور المشابه شركات جديدة تشبه من ينجح معك. اختر **جمهور مشابه** ثم أساسًا في **مشابه لـ** (**عملاؤك** أو **من حجزوا اجتماعًا** أو **المهتمون** أو **أحد جماهيرك المخصصة**)، ثم **درجة التشابه**، ثم **تحليل** و**إنشاء جمهور مشابه**." },
        { table: { head: ["درجة التشابه", "الصفات المحفوظة", "شركات الأساس المستخدمة"], rows: [
          ["1 (**الأقرب**)", "القيم التي يشترك فيها 60% على الأقل من الأساس: المجالات والدول وأحجام الشركات والمسميات الوظيفية", "8"],
          ["5", "القيم التي يشترك فيها 40% على الأقل، مع المسميات الوظيفية", "16"],
          ["7", "القيم التي يشترك فيها 30% على الأقل، بدون المسميات الوظيفية", "20"],
          ["10 (**الأوسع**)", "القيم التي يشترك فيها 15% على الأقل، بدون المسميات والأحجام", "26"],
        ] } },
        { p: "كل درجة بينها تخفض النسبة 5 نقاط وتضيف شركتين إلى الأساس. ويجب أن تتكرر الصفة مرتين على الأقل، ويُحفظ أربع قيم بحد أقصى لكل حقل، ويُقرأ حتى 1,000 شخص من الأساس." },
        { table: { head: ["الثقة", "حجم الأساس"], rows: [
          ["منخفضة", "أقل من 5 أشخاص"],
          ["متوسطة", "من 5 إلى 19 شخصًا"],
          ["عالية", "20 شخصًا أو أكثر"],
        ] } },
        { p: "التشابه لا يعني الاستعداد للشراء، فيولياس يتحقق من ملاءمة كل شركة قبل مراسلتها. وعندما يصل عدد اجتماعات مساحة العمل إلى 3، يحتفظ يولياس في الجماهير بجمهور مشابه محدَّث باسم **Like the people who booked a meeting** بدرجة تشابه 3. ولا يُضاف إلى أي حملة وحده، ويحتفظ بالاسم الذي تمنحه له." },

        { h2: "الاستهداف المحفوظ" },
        { p: "الاستهداف المحفوظ مجموعة حقول تعيد استخدامها. احفظه من قسم الجماهير عبر **حفظ الاستهداف**، أو من جمهور في المنشئ عبر **حفظ كجمهور**. وعندما تستخدمه حملة، يجد له يولياس أشخاصًا جددًا مثل أي استهداف." },

        { h2: "الجماهير في حملة تعمل" },
        { ul: [
          "لا يتغير استهداف الجمهور بعد بدء عمله، فأضف جمهورًا جديدًا لتجربة استهداف مختلف.",
          "في تبويب **الجماهير** بصفحة الحملة يمكنك إيقاف جمهور واحد أو استئنافه أو أرشفته، فيتوقف الجمهور المتوقف عن إيجاد أشخاص وينتظر من فيه.",
          "لكل جمهور نصيب من الميزانية الجديدة يظهر كنسبة مئوية، أو **في مرحلة التعلم** أثناء جمع النتائج. راجع [حالة الحملة والتعلّم](/docs/search-status).",
          "حذف جمهور من قسم الجماهير لا يؤثر في الحملات التي استخدمته، فهي تحتفظ بأشخاصها.",
          "عند التشغيل تُقسم الميزانية بالتساوي على كل جمهور يستخدم جمهورًا محفوظًا أو يجد أشخاصًا جددًا، ويدخل الجمهور المخصص في هذه القسمة رغم أنه لا يبحث عن أحد.",
        ] },

        { h2: "مثال" },
        { p: "لدى شركة لوجستيات 24 صفقة مكسوبة، فتنشئ جمهورًا مشابهًا لـ **عملاؤك** بدرجة تشابه 3. يقرأ التحليل 24 شخصًا فتكون الثقة عالية، ويجد أن 70% منهم في الجملة والتوزيع، و60% في السعودية، و55% في شركات من 51 إلى 200 موظف. فيحتفظ الجمهور المشابه بهذه الصفات ويستخدم 12 شركة من عملائها أساسًا. ثم تستخدمه حملة جديدة كجمهور بجانب جمهور استهداف لمديري العمليات في الإمارات، وتُظهر النتائج أي الجمهورين يحجز اجتماعات أكثر." },

        { h2: "الصلاحيات والمتطلبات" },
        { ul: [
          "ينشئ المدير والمعلن الجماهير ويغيّرانها ويحذفانها، ويراها المحلل فقط.",
          "يحتاج الجمهور المشابه إلى أساس فيه شخص واحد على الأقل، والأساس الفارغ يعرض **لا يوجد بعد من يُتعلم منه في هذا الأساس.**",
          "لا تضيّق الإيرادات ومرحلة التمويل النتائج إلا حيث تنشر البيانات هذه المعلومات.",
        ] },

        { h2: "حل المشكلات" },
        { table: { head: ["ما تراه", "السبب والحل"], rows: [
          ["يعرض الفحص 0 مطابقين", "لا يطابق شيء في مساحة عملك بعد، وتواصل الحملة إيجاد أشخاص جدد للاستهداف"],
          ["**لا يوجد أحد للإضافة.**", "مصدر الجمهور المخصص فارغ"],
          ["لم يكن في جمهور أحد للإضافة عند التشغيل", "كلهم تم التواصل معهم من قبل، أو في حملة أخرى، أو طلبوا عدم التواصل"],
          ["الحملة تنتظر مصدر بيانات", "راجع [حملة تنتظر البدء](/help-center/awaiting-data-source)"],
          ["**هذه الحملة تعمل: لا يمكن تغيير استهداف جماهيرها.**", "أضف جمهورًا جديدًا بدلًا من ذلك"],
        ] } },

        { h2: "مقالات ذات صلة" },
        { ul: [
          "[الحملات](/docs/campaigns)",
          "[العملاء](/docs/prospects)",
          "[حالة الحملة والتعلّم](/docs/search-status)",
          "[الجماهير في مركز المساعدة](/help-center/audiences)",
        ] },
      ],
    },
  },
  "customer-profile": {
    en: {
      title: "Company Knowledge",
      summary: "The source of everything Yolias says: its sections and fields, how it is filled, where it is used, and the rules that keep emails to it.",
      updated: "2026-11-05",
      blocks: [
        { p: "Company Knowledge is what Yolias knows about your company: who you are, what you sell, who buys from you, your offers and your competitors. Every email, follow-up and answer Yolias writes comes from it, together with the facts found about the person it writes to. Yolias states nothing beyond it. This page describes how Company Knowledge is organized, how it is filled, where each part is used and what happens when it is incomplete. To fill it in step by step, see [Company Knowledge in the Help Center](/help-center/company-knowledge)." },

        { h2: "What is Company Knowledge" },
        { p: "It is one page, **Company Knowledge**, with the subtitle **What Yolias knows about your company.** It has five parts:" },
        { table: { head: ["Section", "What it holds", "How it saves"], rows: [
          ["**Company profile**", "Company name, website, industry, products and services, target markets", "With the page's **Save**"],
          ["**Company information**", "Ten written fields about the company (below)", "With the page's **Save**"],
          ["**Customer Profiles**", "Your ideal customer: who buys, their problems, goals, industries, sizes, job titles and countries", "With the page's **Save**"],
          ["**Business Offers**", "Each thing you sell, with its problem, audience, value, price and terms", "Each offer as you add it"],
          ["**Competitors**", "Who else sells to your customers, and how you differ", "Each competitor as you add it"],
        ] } },

        { h2: "The fields of Company information" },
        { table: { head: ["Field", "What to write", "Limit"], rows: [
          ["**About the company**", "What you do, for whom, since when", "4,000 characters"],
          ["**Services**", "The services you provide", "4,000"],
          ["**Products**", "The products you sell", "4,000"],
          ["**Pricing**", "Prices or ranges you're happy for AI to mention", "4,000"],
          ["**Competitive advantages**", "Why customers choose you", "4,000"],
          ["**Case studies**", "Real results with real customers only", "6,000"],
          ["**FAQ**", "Questions leads ask and your answers", "6,000"],
          ["**Reply policy**", "What to promise, what never to say, when to hand over to a person", "4,000"],
          ["**Value proposition**", "The main reason to buy from you, in a sentence or two", "4,000"],
          ["**Contact details**", "Public email, phone and address leads may use", "4,000"],
        ] } },

        { h2: "How it is filled" },
        { h3: "From your website" },
        { p: "At signup, and whenever you press **Analyze website** under **Fill this in from your website**, Yolias reads your public pages: home, about, services, products, pricing, contact and FAQ. The progress shows the real steps: **Opening your website**, **Finding and reading your pages** with a page count, **Reading your company details, services, products and customers**, then **Preparing the result**." },
        { ul: [
          "It reads only your site's own address, at most 7 pages, and no pages behind a login.",
          "It fills only what the site supports. A field the site doesn't cover stays as it was and is listed after **Not found on the website:**.",
          "Text on the pages is treated as data. Instructions written inside a page are ignored.",
          "Nothing is saved until you press **Save**. The result card says **Filled from N pages of your website. Review the fields below, then save.**",
        ] },
        { h3: "By you" },
        { p: "You can write or correct every field. Offers and competitors save as you add them; everything else saves together with **Save** at the bottom of the page." },
        { h3: "Find competitors" },
        { p: "**Find competitors** searches for companies that sell to the same customers and adds them. Each one found shows **Direct** or **Indirect**, how sure Yolias is (**Confirmed in search** or **Website checked**), and its **Source**. It needs your website or what you sell first." },

        { h2: "Where it is used" },
        { table: { head: ["Where", "What is read"], rows: [
          ["Every campaign email and follow-up", "Company profile, Company information, active offers (up to five) and the default customer profile"],
          ["Every answer to a reply", "The same, including the **Reply policy**"],
          ["**Opening A** and **Opening B**", "The company, the campaign's offer and what worked before"],
          ["**Build with Yolias**", "All of the above, to propose a whole campaign"],
          ["Finding people for an audience", "Company profile and customer profile, used for what the audience leaves open"],
          ["Meeting briefs", "All of the above, plus your competitor notes"],
        ] } },
        { p: "Competitors are never named in emails or answers. Your notes about them are used only in meeting briefs, and Yolias never presents them as verified facts. An offer is used only while **Used by AI** is on." },

        { h2: "Offers" },
        { p: "An offer is one thing you sell, described the way a lead needs to hear it. Its fields are **Offer name**, **Description**, **Problem it solves**, **Who it's for**, **Value and benefits**, **Price or range** and **Terms or limits**, and the switch **Used by AI**." },
        { ul: [
          "A campaign can name one offer under **What are you offering them?**, or describe its own. With a named offer, its emails and answers use that offer only.",
          "Without one, Yolias reads up to five active offers and picks what fits the person.",
          "Price and terms in an offer are the only prices and terms Yolias may state for it.",
        ] },

        { h2: "How a reply uses it" },
        { p: "When a reply arrives, Yolias classifies it and checks whether the answer is in Company Knowledge." },
        { table: { head: ["The reply", "What Yolias does"], rows: [
          ["A question whose answer is in Company Knowledge", "Answers it in the same thread"],
          ["A question about something Company Knowledge doesn't hold", "Hands the conversation to you"],
          ["An objection", "Answers the first one from Company Knowledge; the next one comes to you"],
          ["Interest or a request for a meeting", "Answers and moves toward the campaign's result"],
          ["A complaint, a legal question or a price or contract negotiation", "Hands the conversation to you"],
        ] } },
        { p: "Every gap that sends a question to you is a field worth filling. Over time, the questions that land in **Needs you** show what Company Knowledge is missing." },

        { h2: "Keeping it current" },
        { ul: [
          "When prices change, update Pricing and each offer's price the same day. The next emails read the new values at once.",
          "When you win a customer with a result you can mention, add it to Case studies.",
          "When you launch a new service, add it as an offer with **Used by AI** on, then create a campaign that names it under **What are you offering them?**.",
          "Run **Analyze website** again after your site changes, and review what changed before saving.",
        ] },

        { h2: "Rules that keep emails to it" },
        { ul: [
          "Yolias uses only facts present in Company Knowledge and in what was found about the person and their company. It never invents news, numbers, clients, results or a past relationship.",
          "It never promises prices, discounts, dates or terms that aren't in Company Knowledge.",
          "A reply asking about something Company Knowledge doesn't hold is handed to you instead of answered.",
          "Each draft is checked before it is sent. A draft that claims a fact not in its input, uses an exclamation mark, asks more than two questions, or is shorter than 12 words or longer than 220 words is rejected and written again.",
          "Signals about a company, such as hiring, are used only if they were found in the last 60 days.",
        ] },

        { h2: "Completeness" },
        { p: "The campaign builder shows **Company Knowledge is N% complete**, with a link to **Open Company Knowledge**. The percentage counts eight fields: About the company, Services, Products, Pricing, Competitive advantages, Case studies, FAQ and Value proposition. A field counts once it has more than 20 characters. Below 70%, the builder adds **The more Yolias knows about your company, the better it writes and answers.**" },
        { p: "Reply policy and Contact details don't count toward the percentage, but both are read by the writer." },

        { h2: "When it is thin" },
        { p: "Yolias writes with what it has, so thin knowledge shows in the work rather than as an error. Emails lean on the facts found about each person and say less about you. More replies are handed to you, because fewer questions have an answer in Company Knowledge. The openings for each audience are less specific. And **Build with Yolias** proposes audiences from less information. Only an empty Company Knowledge stops anything: **Build with Yolias** won't run until it has content." },

        { h2: "Customer Profiles" },
        { p: "The **Customer Profiles** section describes the ideal customer. Its first field is the ideal customer in your own words, up to 2,000 characters, used when an audience doesn't say who to look for. The profile fields add **Problems You Solve**, **Key Benefits**, **Unique Selling Proposition**, **Customer Goals**, **Success Stories**, **Include Keywords**, **Exclude Keywords**, industries, company size, job titles, countries and other criteria. Onboarding fills them from your website, for you to review." },
        { p: "The default profile is read when Yolias writes and when an audience is searched. Exclude keywords become exclusions, and the audience's own fields always win over the profile." },

        { h2: "Example" },
        { p: "A clinic software company fills Pricing with \"from $49 a month per clinic\" and adds a Reply policy: \"Never offer discounts. Hand contract questions to a person.\" A clinic owner replies: \"What does it cost for three branches?\" Yolias answers with the per-clinic price from Pricing. A week later another owner asks for a discount on a two-year contract. That is a contract and price negotiation, so Yolias hands the conversation over, marked **Needs you**." },

        { h2: "Permissions and requirements" },
        { ul: [
          "Only owners and admins can change Company Knowledge. Everyone else sees **Only owners and admins can change this.**",
          "**Build with Yolias** needs Company Knowledge to have content. Otherwise it shows **Add your company in Company Knowledge first.**",
          "**Analyze website** needs a public website address.",
        ] },

        { h2: "Important notes" },
        { ul: [
          "Changes apply to everything written after you save. Emails already sent don't change.",
          "Write only what you are happy for Yolias to say to a lead. Anything in Pricing, Case studies or FAQ may appear in an email or an answer.",
          "Case studies are quoted, so use real results only.",
          "There is one Company Knowledge per workspace, shared by every campaign and every teammate. If you sell two different product lines, make each one its own offer and name the right offer in each campaign, rather than mixing them in one field.",
        ] },

        { h2: "Troubleshooting" },
        { table: { head: ["Message", "What to do"], rows: [
          ["**Enter your website address (e.g. yourcompany.com).**", "The address isn't a public website. Check it"],
          ["**We couldn't open that website. Check the address and try again.**", "The site didn't respond or blocked the visit. Fill the fields yourself"],
          ["**We couldn't find enough text on that website.**", "The pages have too little text. Fill the fields yourself"],
          ["**Add your website or what you sell first, so Yolias knows your market.**", "Fill Company profile before **Find competitors**"],
          ["Yolias hands many questions to you", "Add the missing answers to FAQ, Pricing or Reply policy"],
        ] } },

        { h2: "Related articles" },
        { ul: [
          "[Yolias AI](/docs/searches)",
          "[Campaigns](/docs/campaigns)",
          "[Audiences](/docs/audiences)",
          "[Company Knowledge in the Help Center](/help-center/company-knowledge)",
        ] },
      ],
    },
    ar: {
      title: "معرفة الشركة",
      summary: "مصدر كل ما يقوله يولياس: أقسامها وحقولها، وكيف تُملأ، وأين تُستخدم، والقواعد التي تُبقي الرسائل في حدودها.",
      updated: "2026-11-05",
      blocks: [
        { p: "معرفة الشركة هي ما يعرفه يولياس عن شركتك: من أنتم، وماذا تبيعون، ومن يشتري منكم، وعروضكم ومنافسوكم. ومنها يكتب يولياس كل رسالة ومتابعة وإجابة، مع الحقائق التي وُجدت عن الشخص الذي يكتب له، ولا يذكر شيئًا خارجها. تشرح هذه الصفحة كيف تُنظَّم معرفة الشركة، وكيف تُملأ، وأين يُستخدم كل جزء منها، وما يحدث عندما تكون ناقصة. ولملئها خطوة بخطوة راجع [معرفة الشركة في مركز المساعدة](/help-center/company-knowledge)." },

        { h2: "ما هي معرفة الشركة" },
        { p: "هي صفحة واحدة باسم **معرفة الشركة** وعنوانها الفرعي **ما يعرفه يولياس عن شركتك.** وتضم خمسة أجزاء:" },
        { table: { head: ["القسم", "ما يحمله", "طريقة الحفظ"], rows: [
          ["**ملف الشركة**", "اسم الشركة والموقع والمجال والمنتجات والخدمات والأسواق المستهدفة", "مع زر **حفظ** في الصفحة"],
          ["**معلومات الشركة**", "عشرة حقول مكتوبة عن الشركة (أدناه)", "مع زر **حفظ** في الصفحة"],
          ["**ملفات العملاء**", "عميلك المثالي: من يشتري، ومشكلاته وأهدافه، والمجالات والأحجام والمسميات الوظيفية والدول", "مع زر **حفظ** في الصفحة"],
          ["**عروض الأعمال**", "كل ما تبيعه، مع المشكلة التي يحلها ولمن هو وقيمته وسعره وشروطه", "كل عرض عند إضافته"],
          ["**المنافسون**", "من يبيع أيضًا لعملائك، وكيف تختلف عنهم", "كل منافس عند إضافته"],
        ] } },

        { h2: "حقول معلومات الشركة" },
        { table: { head: ["الحقل", "ما تكتبه", "الحد"], rows: [
          ["**عن الشركة**", "ماذا تفعلون ولمن ومنذ متى", "4,000 حرف"],
          ["**الخدمات**", "الخدمات التي تقدمونها", "4,000"],
          ["**المنتجات**", "المنتجات التي تبيعونها", "4,000"],
          ["**الأسعار**", "الأسعار أو النطاقات التي تسمح بذكرها", "4,000"],
          ["**المميزات التنافسية**", "لماذا يختاركم العملاء", "4,000"],
          ["**دراسات الحالة**", "نتائج حقيقية مع عملاء حقيقيين فقط", "6,000"],
          ["**الأسئلة الشائعة**", "أسئلة العملاء وإجاباتكم", "6,000"],
          ["**سياسة الرد**", "ما يمكن الوعد به، وما لا يجب قوله أبدًا، ومتى يُحوَّل الأمر إلى شخص", "4,000"],
          ["**القيمة التي تقدمها**", "السبب الأساسي للشراء منك في جملة أو اثنتين", "4,000"],
          ["**بيانات التواصل**", "البريد والهاتف والعنوان العام الذي يمكن للعملاء استخدامه", "4,000"],
        ] } },

        { h2: "كيف تُملأ" },
        { h3: "من موقعك" },
        { p: "عند التسجيل، وكلما ضغطت **تحليل الموقع** تحت **املأ هذه البيانات من موقعك**، يقرأ يولياس صفحاتك العامة: الرئيسية ومن نحن والخدمات والمنتجات والأسعار والتواصل والأسئلة الشائعة. ويعرض التقدم الخطوات الفعلية: **فتح موقعك**، ثم **إيجاد صفحات موقعك وقراءتها** مع عدد الصفحات، ثم **قراءة بيانات شركتك وخدماتها ومنتجاتها وعملائها**، ثم **تجهيز النتيجة**." },
        { ul: [
          "يقرأ عنوان موقعك نفسه فقط، وبحد أقصى 7 صفحات، ولا يقرأ صفحات تحتاج إلى تسجيل دخول.",
          "يملأ ما يدعمه الموقع فقط، والحقل الذي لا يغطيه الموقع يبقى كما كان ويُذكر بعد **لم يُعثر عليه في الموقع:**.",
          "يُعامل نص الصفحات كبيانات، وتُتجاهل أي تعليمات مكتوبة داخل الصفحة.",
          "لا يُحفظ شيء حتى تضغط **حفظ**، وتقول بطاقة النتيجة: **تم الملء من N صفحات من موقعك. راجع الحقول أدناه ثم احفظ.**",
        ] },
        { h3: "بنفسك" },
        { p: "يمكنك كتابة كل حقل أو تصحيحه. وتُحفظ العروض والمنافسون عند إضافتها، أما الباقي فيُحفظ معًا بزر **حفظ** في آخر الصفحة." },
        { h3: "اكتشف المنافسين" },
        { p: "يبحث **اكتشف المنافسين** عن الشركات التي تبيع للعملاء أنفسهم ويضيفها. ويظهر لكل منافس يُعثر عليه **مباشر** أو **غير مباشر**، ومدى تأكد يولياس (**مؤكد في البحث** أو **تم التحقق من الموقع**)، و**المصدر**. ويحتاج أولًا إلى موقعك أو ما تبيعه." },

        { h2: "أين تُستخدم" },
        { table: { head: ["أين", "ما يُقرأ"], rows: [
          ["كل رسالة حملة وكل متابعة", "ملف الشركة ومعلومات الشركة والعروض المفعّلة (حتى خمسة) وملف العميل الافتراضي"],
          ["كل إجابة على رد", "الأشياء نفسها، ومنها **سياسة الرد**"],
          ["**الافتتاحية أ** و**الافتتاحية ب**", "الشركة وعرض الحملة وما نجح من قبل"],
          ["**أنشئ مع يولياس**", "كل ما سبق، لاقتراح حملة كاملة"],
          ["إيجاد الأشخاص لجمهور", "ملف الشركة وملف العميل، لما يتركه الجمهور مفتوحًا"],
          ["ملخصات الاجتماعات", "كل ما سبق، إضافة إلى ملاحظاتك عن المنافسين"],
        ] } },
        { p: "لا يُذكر المنافسون أبدًا في الرسائل أو الإجابات. وتُستخدم ملاحظاتك عنهم في ملخصات الاجتماعات فقط، ولا يقدّمها يولياس كحقائق متحقق منها. ولا يُستخدم العرض إلا وخيار **يستخدمه الذكاء الاصطناعي** مفعّل." },

        { h2: "العروض" },
        { p: "العرض شيء واحد تبيعه، موصوف بالطريقة التي يحتاج العميل أن يسمعه بها. وحقوله: **اسم العرض** و**الوصف** و**المشكلة التي يعالجها** و**لمن** و**القيمة والفوائد** و**السعر أو النطاق** و**الشروط أو القيود**، ومعها خيار **يستخدمه الذكاء الاصطناعي**." },
        { ul: [
          "يمكن للحملة أن تحدد عرضًا واحدًا في **ماذا تقدم لهم؟** أو أن تكتب عرضها بنفسها. ومع العرض المحدد تستخدم رسائلها وإجاباتها ذلك العرض وحده.",
          "وبدون عرض محدد يقرأ يولياس حتى خمسة عروض مفعّلة ويختار ما يناسب الشخص.",
          "السعر والشروط في العرض هي الأسعار والشروط الوحيدة التي يحق ليولياس ذكرها عنه.",
          "العرض الذي أوقفت خيار **يستخدمه الذكاء الاصطناعي** فيه يبقى محفوظًا، لكن يولياس لا يذكره في أي رسالة أو إجابة حتى تفعّله من جديد.",
        ] },

        { h2: "كيف يستخدمها الرد" },
        { p: "عندما يصل رد، يصنّفه يولياس ويتحقق هل الإجابة موجودة في معرفة الشركة." },
        { table: { head: ["الرد", "ما يفعله يولياس"], rows: [
          ["سؤال إجابته في معرفة الشركة", "يجيبه في المحادثة نفسها"],
          ["سؤال عن شيء لا تحمله معرفة الشركة", "يسلّم المحادثة إليك"],
          ["اعتراض", "يجيب الاعتراض الأول من معرفة الشركة، والتالي يصل إليك"],
          ["اهتمام أو طلب اجتماع", "يجيب ويتجه نحو نتيجة الحملة"],
          ["شكوى أو سؤال قانوني أو تفاوض على سعر أو عقد", "يسلّم المحادثة إليك"],
        ] } },
        { p: "كل فجوة ترسل إليك سؤالًا هي حقل يستحق أن تملأه. ومع الوقت تكشف الأسئلة التي تصل إلى **يحتاجك** ما ينقص معرفة الشركة، فإذا تكرر السؤال نفسه فأضف إجابته إلى الأسئلة الشائعة، وسيجيبه يولياس بنفسه في المرة التالية." },

        { h2: "إبقاؤها محدَّثة" },
        { ul: [
          "عندما تغيّر أسعارك، حدّث حقل الأسعار وسعر كل عرض في اليوم نفسه، فالرسائل التالية تقرأ القيم الجديدة فورًا.",
          "عندما تكسب عميلًا بنتيجة يمكن ذكرها، أضفها إلى دراسات الحالة.",
          "عندما تطلق خدمة جديدة، أضفها كعرض وفعّل **يستخدمه الذكاء الاصطناعي**، ثم أنشئ لها حملة تحددها في **ماذا تقدم لهم؟**.",
          "أعد تشغيل **تحليل الموقع** بعد تحديث موقعك، وراجع ما تغيّر قبل الحفظ.",
        ] },

        { h2: "القواعد التي تُبقي الرسائل في حدودها" },
        { ul: [
          "لا يستخدم يولياس إلا الحقائق الموجودة في معرفة الشركة وفيما وُجد عن الشخص وشركته، ولا يختلق أخبارًا أو أرقامًا أو عملاء أو نتائج أو علاقة سابقة.",
          "لا يعد بأسعار أو خصومات أو مواعيد أو شروط غير موجودة في معرفة الشركة.",
          "الرد الذي يسأل عن شيء لا تحمله معرفة الشركة يُسلَّم إليك بدل الإجابة عنه.",
          "تُفحص كل مسودة قبل إرسالها. والمسودة التي تدّعي حقيقة غير موجودة في مدخلاتها، أو تستخدم علامة تعجب، أو تطرح أكثر من سؤالين، أو تقل عن 12 كلمة أو تزيد على 220 كلمة، تُرفض وتُكتب من جديد.",
          "لا تُستخدم الإشارات عن الشركة، مثل التوظيف، إلا إذا وُجدت خلال آخر 60 يومًا.",
        ] },

        { h2: "نسبة الاكتمال" },
        { p: "يعرض منشئ الحملة **معرفة الشركة مكتملة بنسبة N**، مع رابط **فتح معرفة الشركة**. وتُحسب النسبة من ثمانية حقول: عن الشركة، والخدمات، والمنتجات، والأسعار، والمميزات التنافسية، ودراسات الحالة، والأسئلة الشائعة، والقيمة التي تقدمها. ويُحسب الحقل عندما يتجاوز 20 حرفًا. وتحت 70% يضيف المنشئ: **كلما عرف يولياس أكثر عن شركتك، كتب ورد بشكل أفضل.**" },
        { p: "لا تدخل سياسة الرد وبيانات التواصل في النسبة، لكن يولياس يقرؤهما عند الكتابة." },

        { h2: "عندما تكون ناقصة" },
        { p: "يكتب يولياس بما لديه، فيظهر نقص المعرفة في جودة العمل لا في رسالة خطأ. فتعتمد الرسائل أكثر على الحقائق التي وُجدت عن كل شخص وتقول عنك أقل، وتُسلَّم إليك ردود أكثر لأن أسئلة أقل تجد إجابتها في معرفة الشركة، وتصبح افتتاحيات كل جمهور أقل تحديدًا، ويقترح **أنشئ مع يولياس** جماهير من معلومات أقل. ولا يتوقف شيء إلا عندما تكون معرفة الشركة فارغة تمامًا، إذ لا يعمل **أنشئ مع يولياس** حتى يجد فيها محتوى." },
        { p: "لذلك ابدأ بالحقول التي تؤثر مباشرة في الردود: الأسعار، والأسئلة الشائعة، وسياسة الرد. فهي التي تحدد هل يجيب يولياس السؤال بنفسه أم يسلّمه إليك. ثم أضف دراسات الحالة والمميزات التنافسية، لأنها ما تعتمد عليه الافتتاحيات عند تقديم الدليل على قيمة عرضك. وراجع بعد أسبوع من التشغيل ما وصل إلى **يحتاجك**، فهو أدق مؤشر على ما ينقص." },

        { h2: "ملفات العملاء" },
        { p: "يصف قسم **ملفات العملاء** العميل المثالي. وأول حقوله هو العميل المثالي بكلماتك، حتى 2,000 حرف، ويُستخدم عندما لا يحدد الجمهور من يُبحث عنه. وتضيف حقول الملف **المشكلات التي تحلها** و**الفوائد الرئيسية** و**ما يميزك** و**أهداف العميل** و**قصص النجاح** و**كلمات التضمين** و**كلمات الاستبعاد**، والمجالات وحجم الشركة والمسميات الوظيفية والدول ومعايير أخرى. وتملؤها خطوات البداية من موقعك لتراجعها." },
        { p: "يُقرأ الملف الافتراضي عندما يكتب يولياس وعندما يُبحث لجمهور. وتصبح كلمات الاستبعاد استبعادات، وحقول الجمهور نفسه هي المعتمدة دائمًا قبل الملف." },

        { h2: "مثال" },
        { p: "شركة برمجيات للعيادات تكتب في الأسعار: «من 49 دولارًا شهريًا لكل عيادة»، وتضيف سياسة رد: «لا تعرض خصومات أبدًا، وحوّل أسئلة العقود إلى شخص». يرد مالك عيادة: «كم التكلفة لثلاثة فروع؟» فيجيبه يولياس بسعر العيادة الواحدة من حقل الأسعار. وبعد أسبوع يطلب مالك آخر خصمًا على عقد لعامين، وهذا تفاوض على عقد وسعر، فيسلّم يولياس المحادثة بعلامة **يحتاجك**." },

        { h2: "الصلاحيات والمتطلبات" },
        { ul: [
          "يستطيع المالكون والمسؤولون فقط تغيير معرفة الشركة، ويرى الآخرون: **يستطيع المالكون والمسؤولون فقط تغيير هذا.**",
          "يحتاج **أنشئ مع يولياس** إلى محتوى في معرفة الشركة، وإلا يعرض **أضف شركتك في معرفة الشركة أولًا.**",
          "يحتاج **تحليل الموقع** إلى عنوان موقع عام.",
        ] },

        { h2: "ملاحظات مهمة" },
        { ul: [
          "تنطبق التغييرات على كل ما يُكتب بعد الحفظ، ولا تتغير الرسائل المرسلة.",
          "اكتب فقط ما تقبل أن يقوله يولياس للعميل، فكل ما في الأسعار ودراسات الحالة والأسئلة الشائعة قد يظهر في رسالة أو إجابة.",
          "تُقتبس دراسات الحالة، فاستخدم نتائج حقيقية فقط.",
          "معرفة الشركة واحدة لمساحة العمل كلها، فكل الحملات وكل أعضاء الفريق يعتمدون عليها. وإذا كان لديك خطان مختلفان من المنتجات، فاجعل كل خط عرضًا مستقلًا وحدد العرض المناسب في كل حملة، بدل أن تخلط بينهما في حقل واحد، حتى لا تذكر رسالة منتجًا لا يناسب من تُكتب له.",
        ] },

        { h2: "حل المشكلات" },
        { table: { head: ["الرسالة", "ما تفعله"], rows: [
          ["**أدخل عنوان موقعك (مثل yourcompany.com).**", "العنوان ليس موقعًا عامًا، فتحقق منه"],
          ["**تعذّر فتح هذا الموقع. تأكد من العنوان وحاول مرة أخرى.**", "لم يستجب الموقع أو منع الزيارة، فاملأ الحقول بنفسك"],
          ["**لم نجد نصًا كافيًا في هذا الموقع.**", "النص في الصفحات قليل، فاملأ الحقول بنفسك"],
          ["**أضف موقعك أو ما تبيعه أولًا ليعرف يولياس سوقك.**", "املأ ملف الشركة قبل **اكتشف المنافسين**"],
          ["يسلّمك يولياس أسئلة كثيرة", "أضف الإجابات الناقصة إلى الأسئلة الشائعة أو الأسعار أو سياسة الرد"],
        ] } },

        { h2: "مقالات ذات صلة" },
        { ul: [
          "[Yolias AI](/docs/searches)",
          "[الحملات](/docs/campaigns)",
          "[الجماهير](/docs/audiences)",
          "[معرفة الشركة في مركز المساعدة](/help-center/company-knowledge)",
        ] },
      ],
    },
  },
  searches: {
    en: {
      title: "Yolias AI",
      summary: "What Yolias AI does inside a campaign, how it handles each kind of reply, what you can ask it in chat, and the limits it works within.",
      updated: "2026-11-05",
      blocks: [
        { p: "Yolias AI is the work inside every campaign, and the assistant you can talk to on any screen. In a campaign it finds people, writes to each one, follows up, reads replies, answers and books results. In chat it reads your campaigns, leads, conversations and meetings, and can prepare a campaign or pause one when you ask. This page describes both, the rules that bind them, and their limits. For the task view, see [Yolias AI in the Help Center](/help-center/yolias-ai)." },

        { h2: "What it does inside a campaign" },
        { p: "The work is split into steps, each with a defined job and nothing else. Steps marked as rules run as fixed code, not as AI judgment." },
        { table: { head: ["Step", "What it does", "Runs as"], rows: [
          ["Understand the company", "Reads your website into Company Knowledge for you to review", "AI"],
          ["Understand the audience", "Turns targeting and description into search criteria", "AI"],
          ["Find companies and people", "Searches within the budget and saves results in Leads", "Rules"],
          ["Qualify", "Scores how well each person fits the audience", "Rules"],
          ["Write", "Writes each first email and follow-up for one person", "AI"],
          ["Send", "Sends from your connected mailbox inside your windows and limits", "Rules"],
          ["Read replies", "Reads replies in the campaign's threads", "Rules"],
          ["Understand a reply", "Classifies it and writes a suggested answer", "AI"],
          ["Hold the conversation", "Answers in the thread, hands over to you, or stops contact", "AI and rules"],
          ["Book meetings", "Offers two free times, books a named time, sends your booking page", "Rules"],
          ["Learn", "Records what worked, once a day", "Rules"],
        ] } },

        { h2: "How it handles replies" },
        { p: "Every reply is classified into one of nine kinds, shown on the campaign's **Conversations** tab. The action follows fixed rules, checked in this order:" },
        { table: { head: ["Reply", "What Yolias does"], rows: [
          ["**Asked to stop**", "Marks the lead do not contact and sends nothing more. This is caught by keywords in Arabic and English even when no AI is available"],
          ["**Not interested**", "Closes the conversation. No follow-ups"],
          ["**Out of office**", "Doesn't count as a reply. The next follow-up waits 7 days"],
          ["**Wants a person**, **Unclear**, or a complaint, legal question or negotiation", "Hands the conversation to you"],
          ["A specific time is named", "Books it if you are free and confirms in the thread"],
          ["**Interested** or **Asked for a meeting**", "Meetings: answers with two free times and your booking page. Sales and Website leads: answers and sends your tracked link"],
          ["**Question**", "Answers from Company Knowledge, or hands it to you if the answer isn't there"],
          ["**Objection**", "Answers the first one from Company Knowledge. The next goes to you"],
        ] } },
        { ul: [
          "Yolias sends at most 4 of its own answers in one thread. After that, the conversation comes to you.",
          "If the campaign isn't running (paused, ended or archived), every reply is handed to you.",
          "A conversation handed to you is marked **Needs you** in Conversations; you mark it **Done** when it is handled. A later reply in the same thread is judged again by the same rules.",
          "Automatic replies are stored but never counted as the lead replying.",
        ] },

        { h2: "How it writes" },
        { ul: [
          "Each email is written for one person, from Company Knowledge, the campaign's offer and notes, and the facts found about them and their company.",
          "It uses only facts in its input and never invents news, numbers, clients, results or a past relationship. It never claims to know the person.",
          "It never promises prices, discounts, dates or terms that aren't in Company Knowledge.",
          "A draft is rejected and rewritten if it claims an unsupported fact, uses an exclamation mark, asks more than two questions, or is under 12 or over 220 words.",
          "It writes in the campaign's language, or each person's language from their country, in the campaign's **Tone**.",
          "Lines of what worked before are given to the writer as hints. They never change these rules.",
        ] },

        { h2: "How it books meetings" },
        { ul: [
          "To an interested person in a Meetings campaign, Yolias offers two free times from your booking page and the page's link, so they can pick another time themselves.",
          "If they name a time and you are free, Yolias books it and confirms in the thread. With Google Calendar connected, your busy times are skipped and the guest gets an invitation.",
          "The booking appears in **Meetings** and on the campaign's **Meetings** tab, and counts as the campaign's result.",
          "The guest is reminded a day and an hour before, and you get a prepared brief. After the meeting you mark whether it happened; a no-show gets the booking page to pick another time.",
          "Yolias never invents a date or time. Every time it offers comes from your booking page.",
        ] },

        { h2: "How it learns" },
        { p: "Once a day Yolias reads the last 180 days of your first emails and what came of them: which industries, countries, job titles, company sizes and openings got interested replies, meetings, deals won and website conversions." },
        { ul: [
          "**Who goes first.** People like those who brought results are contacted earlier. The effect is bounded, between 0.6 and 1.6 times a person's normal priority, and it starts after 50 people contacted.",
          "**What the writer sees.** The strongest lines become hints for the next emails and openings.",
          "**What you see.** **Yolias learned** on the campaign page states a clear difference, such as a job title booking at 1.5 times the rate of the rest or more, with at least 20 people on each side.",
        ] },

        { h2: "What it never does" },
        { ul: [
          "Change an audience's targeting.",
          "Change sending limits, permissions or safety limits. Learning moves budget between the audiences you chose and reorders who is contacted first; nothing more.",
          "Launch a campaign. In chat it can prepare a draft; you launch it.",
          "Send campaign emails outside your days and hours. Answers to replies can go at any time.",
          "Contact anyone marked do not contact, or anyone another campaign is still writing to.",
        ] },

        { h2: "When it hands a conversation to you" },
        { p: "A handover is a decision, not a failure. Yolias hands over when a person is the right one to answer: a complaint, a negotiation, a question Company Knowledge can't answer, a second objection, or a thread that already had four of its answers. The conversation appears in **Conversations** marked **Needs you**, and counts on the dashboard under **Needs you**. You answer from Yolias or from your own mailbox, since the thread is the same." },

        { h2: "AI in the campaign builder" },
        { table: { head: ["Action", "What it does"], rows: [
          ["**Build with Yolias**", "Fills a whole campaign from Company Knowledge: name, offer, a target of up to 100, a budget of $5 to $5,000, messages a day, and one to three audiences. Objective, channel and mailbox stay yours. Nothing is saved or launched"],
          ["**Write again**", "Writes the two openings for one audience"],
          ["**Write a sample email**", "Writes an example first email for a typical person in the audience. Nothing is saved or sent"],
        ] } },
        { p: "These work on a free account up to 30 AI requests in 24 hours for the workspace. Past that, the builder shows **Top up from $5 to keep using Yolias AI today.** With a plan or credit there is no such limit." },

        { h2: "Chat with Yolias AI" },
        { p: "Press **Ask Yolias AI** on any screen. A panel opens on the side of the page with ready questions, such as **How did my campaigns do last week?** and **What needs me today?** It knows which page you opened it from. **New chat** starts a fresh conversation, **Open full size** opens it on its own page, and past chats are listed under **Yolias AI chats** in the sidebar." },
        { table: { head: ["It can", "Examples"], rows: [
          ["Read results", "Campaign performance, the activity log, cost per meeting by audience"],
          ["Read people and conversations", "Leads, companies, replies, meetings, leads in conversations"],
          ["Read audiences and usage", "Your audiences, your usage; billing for owners and admins"],
          ["Research a company", "A short summary of public web sources about one company"],
          ["Prepare a campaign draft", "From what you describe. It returns a link; you review the three steps and launch"],
          ["Pause, resume, end or archive a campaign", "Only when you ask"],
          ["Exclude a lead", "From one campaign or all, optionally marking them do not contact"],
          ["Remember a fact", "A lasting fact about your business or preferences. Never contact details or anything sensitive"],
        ] } },
        { ul: [
          "It reports only what its tools return. A number that can't be worked out is –, never 0, and it never says an email was sent or a meeting booked unless the data says so.",
          "If something essential is missing to prepare a campaign, such as who to target, it asks one short question first.",
          "It answers in your language: Arabic or English.",
          "It declines questions unrelated to your campaigns, leads or using Yolias, and doesn't discuss how Yolias is built.",
        ] },

        { h2: "Permissions and limits" },
        { table: { head: ["Rule", "Value"], rows: [
          ["Who can chat", "Every role. Analysts get read-only tools"],
          ["Account needed for chat", "A plan or credit, and finished onboarding"],
          ["Billing questions", "Owners and admins only"],
          ["Pace", "6 messages a minute and 200 a day per user"],
          ["Daily message limit", "Set by plan; resets at 00:00 UTC"],
          ["Conversation memory", "The last 30 turns of the chat"],
          ["Builder AI on a free account", "30 requests in 24 hours per workspace"],
        ] } },

        { h2: "Example" },
        { p: "You open **Ask Yolias AI** on the Campaigns page and write: \"Which audience brings the cheapest meetings?\" It reads campaign performance and answers that \"Clinic owners, Riyadh\" has 4 meetings at $11.50 each, and \"Dental managers, Jeddah\" has 1 at $38. You write: \"Pause the Jeddah campaign.\" It pauses it and confirms. You write: \"Prepare a campaign for dental chains in Dubai, $30, 5 meetings.\" It returns a draft link; you open it, check the three steps and launch." },

        { h2: "Troubleshooting" },
        { table: { head: ["What you see", "What it means"], rows: [
          ["**You're sending messages too fast. Wait a moment and try again.**", "More than 6 messages in a minute"],
          ["**You've reached today's Yolias AI message limit for your plan. It resets at 00:00 UTC.**", "The plan's daily limit is used"],
          ["Chat doesn't answer on a new account", "Chat needs a plan or credit"],
          ["A request fails with a card", "See [When Yolias AI can't read a request](/help-center/search-needs-attention)"],
          ["Yolias answered something it shouldn't have", "Add the rule to **Reply policy** in Company Knowledge or to **Notes for Yolias** in the campaign"],
        ] } },

        { h2: "Related articles" },
        { ul: [
          "[Company Knowledge](/docs/customer-profile)",
          "[Campaigns](/docs/campaigns)",
          "[Campaign status and learning](/docs/search-status)",
          "[Conversations](/help-center/conversations)",
          "[Yolias AI in the Help Center](/help-center/yolias-ai)",
        ] },
      ],
    },
    ar: {
      title: "Yolias AI",
      summary: "ما يفعله Yolias AI داخل الحملة، وكيف يتعامل مع كل نوع من الردود، وما يمكنك سؤاله عنه في المحادثة، والحدود التي يعمل داخلها.",
      updated: "2026-11-05",
      blocks: [
        { p: "Yolias AI هو العمل الذي يجري داخل كل حملة، وهو أيضًا المساعد الذي يمكنك محادثته من أي شاشة. ففي الحملة يجد الأشخاص ويكتب لكل منهم ويتابع ويقرأ الردود ويجيب ويحقق النتائج. وفي المحادثة يقرأ حملاتك وعملاءك ومحادثاتك واجتماعاتك، ويمكنه تجهيز حملة أو إيقاف حملة عندما تطلب. تشرح هذه الصفحة الجانبين، والقواعد التي تلزمهما، وحدودهما. ولتنفيذ المهام راجع [Yolias AI في مركز المساعدة](/help-center/yolias-ai)." },

        { h2: "ما يفعله داخل الحملة" },
        { p: "يُقسَّم العمل إلى خطوات، لكل منها مهمة محددة ولا شيء غيرها. والخطوات التي تعمل بالقواعد تنفذها برمجة ثابتة، لا تقدير الذكاء الاصطناعي." },
        { table: { head: ["الخطوة", "ما تفعله", "تعمل بـ"], rows: [
          ["فهم الشركة", "تقرأ موقعك إلى معرفة الشركة لتراجعه", "الذكاء الاصطناعي"],
          ["فهم الجمهور", "تحوّل الاستهداف والوصف إلى معايير بحث", "الذكاء الاصطناعي"],
          ["إيجاد الشركات والأشخاص", "تبحث في حدود الميزانية وتحفظ النتائج في العملاء", "القواعد"],
          ["التأهيل", "تقيس مدى مطابقة كل شخص للجمهور", "القواعد"],
          ["الكتابة", "تكتب كل رسالة أولى ومتابعة لشخص واحد", "الذكاء الاصطناعي"],
          ["الإرسال", "ترسل من بريدك المتصل داخل نوافذك وحدودك", "القواعد"],
          ["قراءة الردود", "تقرأ الردود في محادثات الحملة", "القواعد"],
          ["فهم الرد", "تصنّفه وتكتب إجابة مقترحة", "الذكاء الاصطناعي"],
          ["إدارة المحادثة", "تجيب في المحادثة، أو تسلّمها إليك، أو توقف التواصل", "الذكاء الاصطناعي والقواعد"],
          ["حجز الاجتماعات", "تعرض موعدين متاحين، وتحجز الموعد الذي يحدده الشخص، وترسل صفحة الحجز", "القواعد"],
          ["التعلم", "تسجل ما نجح، مرة يوميًا", "القواعد"],
        ] } },

        { h2: "كيف يتعامل مع الردود" },
        { p: "يُصنَّف كل رد في واحد من تسعة أنواع تظهر في تبويب **المحادثات** بصفحة الحملة. ويتبع الإجراء قواعد ثابتة تُفحص بهذا الترتيب:" },
        { table: { head: ["الرد", "ما يفعله يولياس"], rows: [
          ["**طلب التوقف**", "يسجّل العميل بعدم التواصل ولا يرسل شيئًا بعدها. ويُكتشف هذا بكلمات مفتاحية بالعربية والإنجليزية حتى عند عدم توفر الذكاء الاصطناعي"],
          ["**غير مهتم**", "يغلق المحادثة، ولا متابعات بعدها"],
          ["**خارج المكتب**", "لا يُحسب ردًا، وتنتظر المتابعة التالية 7 أيام"],
          ["**يريد شخصًا** أو **غير واضح** أو شكوى أو سؤال قانوني أو تفاوض", "يسلّم المحادثة إليك"],
          ["تحديد موعد بعينه", "يحجزه إذا كنت متاحًا ويؤكده في المحادثة"],
          ["**مهتم** أو **طلب اجتماعًا**", "في الاجتماعات: يجيب بموعدين متاحين وصفحة الحجز. وفي المبيعات ونماذج الموقع: يجيب ويرسل رابطك المتتبَّع"],
          ["**سؤال**", "يجيب من معرفة الشركة، أو يسلّمه إليك إذا لم تكن الإجابة فيها"],
          ["**اعتراض**", "يجيب الأول من معرفة الشركة، والتالي يصل إليك"],
        ] } },
        { ul: [
          "يرسل يولياس 4 إجابات منه بحد أقصى في المحادثة الواحدة، ثم تصل المحادثة إليك.",
          "إذا لم تكن الحملة تعمل (متوقفة أو منتهية أو مؤرشفة) يُسلَّم إليك كل رد.",
          "المحادثة المسلَّمة إليك تحمل علامة **يحتاجك** في المحادثات، وتضع عليها **تم** بعد معالجتها. وأي رد لاحق في المحادثة نفسها يُحكم عليه من جديد بالقواعد نفسها.",
          "تُحفظ الردود الآلية لكنها لا تُحسب أبدًا ردًا من العميل.",
        ] },

        { h2: "كيف يكتب" },
        { ul: [
          "تُكتب كل رسالة لشخص واحد، من معرفة الشركة وعرض الحملة وملاحظاتها، والحقائق التي وُجدت عنه وعن شركته.",
          "لا يستخدم إلا الحقائق الموجودة في مدخلاته، ولا يختلق أخبارًا أو أرقامًا أو عملاء أو نتائج أو علاقة سابقة، ولا يدّعي أنه يعرف الشخص.",
          "لا يعد بأسعار أو خصومات أو مواعيد أو شروط غير موجودة في معرفة الشركة.",
          "تُرفض المسودة وتُكتب من جديد إذا ادّعت حقيقة بلا مصدر، أو استخدمت علامة تعجب، أو طرحت أكثر من سؤالين، أو قلّت عن 12 كلمة أو زادت على 220 كلمة.",
          "يكتب بلغة الحملة أو بلغة كل شخص حسب دولته، وبـ**الأسلوب** المحدد في الحملة.",
          "تصل إلى الكاتب أسطر عما نجح من قبل كإرشادات، ولا تغيّر هذه القواعد أبدًا.",
        ] },

        { h2: "كيف يحجز الاجتماعات" },
        { ul: [
          "يعرض يولياس على المهتم في حملة الاجتماعات موعدين متاحين من صفحة الحجز ورابطها، ليختار موعدًا آخر بنفسه إن أراد.",
          "إذا حدد الشخص موعدًا وكنت متاحًا، يحجزه يولياس ويؤكده في المحادثة. ومع ربط تقويم Google تُتخطى أوقات انشغالك ويستلم الضيف دعوة.",
          "يظهر الحجز في **الاجتماعات** وفي تبويب **الاجتماعات** بصفحة الحملة، ويُحسب نتيجةً للحملة.",
          "يُذكَّر الضيف قبل الاجتماع بيوم وبساعة، وتستلم أنت ملخصًا مجهزًا. وبعد الاجتماع تحدد هل انعقد، ومن لم يحضر يستلم صفحة الحجز ليختار موعدًا آخر.",
          "لا يختلق يولياس تاريخًا أو موعدًا أبدًا، فكل موعد يعرضه يأتي من صفحة الحجز.",
        ] },

        { h2: "كيف يتعلم" },
        { p: "مرة يوميًا يقرأ يولياس آخر 180 يومًا من رسائلك الأولى وما نتج عنها: أي المجالات والدول والمسميات الوظيفية وأحجام الشركات والافتتاحيات حصلت على ردود مهتمة واجتماعات وصفقات مكسوبة وتحويلات على الموقع." },
        { ul: [
          "**من يأتي أولًا.** يُتواصل مبكرًا مع من يشبهون من جاءت منهم النتائج. والأثر محدود بين 0.6 و1.6 ضعف الأولوية المعتادة للشخص، ويبدأ بعد التواصل مع 50 شخصًا.",
          "**ما يراه الكاتب.** تصبح أقوى الأسطر إرشادات للرسائل والافتتاحيات التالية.",
          "**ما تراه أنت.** يذكر **يولياس تعلّم** في صفحة الحملة الفرق الواضح فقط، مثل مسمى وظيفي يحجز بمعدل 1.5 ضعف الباقين أو أكثر، مع 20 شخصًا على الأقل في كل جانب.",
          "لا يُنسخ نص أي رسالة في هذا التعلم، فهو أعداد وعبارات قصيرة فقط، ولا يغيّر قواعد الكتابة أو حدود الإرسال أو الصلاحيات.",
        ] },
        { p: "ولهذا تتحسن الحملة مع الوقت دون أن تغيّر إعداداتها بنفسك: فالأسابيع الأولى تجمع البيانات، ثم يتجه التواصل والميزانية الجديدة نحو ما أثبت نتيجته." },

        { h2: "ما لا يفعله أبدًا" },
        { ul: [
          "تغيير استهداف أي جمهور.",
          "تغيير حدود الإرسال أو الصلاحيات أو حدود الأمان. فالتعلم ينقل الميزانية بين الجماهير التي اخترتها ويعيد ترتيب من يُتواصل معه أولًا، ولا شيء أكثر.",
          "تشغيل حملة. ففي المحادثة يجهّز مسودة، وأنت من يشغّلها.",
          "إرسال رسائل الحملة خارج أيامك وساعاتك، أما الإجابات على الردود فتُرسل في أي وقت.",
          "مراسلة من سُجّل بعدم التواصل، أو من تراسله حملة أخرى حاليًا.",
        ] },

        { h2: "عندما يسلّمك محادثة" },
        { p: "التسليم قرار وليس فشلًا. يسلّم يولياس المحادثة عندما يكون الشخص المناسب للإجابة هو أنت: شكوى، أو تفاوض، أو سؤال لا تجيب عنه معرفة الشركة، أو اعتراض ثانٍ، أو محادثة استنفدت إجاباته الأربع. وتظهر المحادثة في **المحادثات** بعلامة **يحتاجك**، وتُحسب في لوحة التحكم تحت **يحتاجك**. وتجيب من يولياس أو من بريدك مباشرة، فالمحادثة واحدة في الحالتين." },
        { p: "وبعد أن تجيب، ضع على المحادثة **تم** لتخرج من قائمة ما يحتاجك. وإذا وصل رد جديد في المحادثة نفسها، يُصنَّف ويُعامل بالقواعد نفسها: فقد يجيبه يولياس إذا كان سؤالًا تجيب عنه معرفة الشركة ولم تُستنفد إجاباته الأربع، أو يسلّمه إليك مرة أخرى. ويبقى كل ما سبق في المحادثة ظاهرًا لك لتعرف ما قيل قبل أن تتولاها." },

        { h2: "الذكاء الاصطناعي في منشئ الحملة" },
        { table: { head: ["الإجراء", "ما يفعله"], rows: [
          ["**أنشئ مع يولياس**", "يملأ حملة كاملة من معرفة الشركة: الاسم والعرض وهدفًا حتى 100، وميزانية من 5 إلى 5,000 دولار، وعدد الرسائل اليومية، ومن جمهور إلى ثلاثة جماهير. ويبقى الهدف والقناة والبريد كما ضبطتها، ولا يُحفظ شيء ولا يُشغَّل"],
          ["**إعادة الكتابة**", "يكتب الافتتاحيتين لجمهور واحد"],
          ["**اكتب رسالة نموذجية**", "يكتب رسالة أولى مثالًا لشخص نموذجي في الجمهور، دون حفظ أو إرسال"],
        ] } },
        { p: "تعمل هذه الإجراءات على الحساب المجاني حتى 30 طلبًا للذكاء الاصطناعي خلال 24 ساعة لمساحة العمل. وبعدها يعرض المنشئ **اشحن من 5 دولارات لتواصل استخدام Yolias AI اليوم.** ومع خطة أو رصيد لا يوجد هذا الحد." },

        { h2: "محادثة Yolias AI" },
        { p: "اضغط **اسأل يولياس AI** في أي شاشة، فتُفتح لوحة على جانب الصفحة فيها أربعة أسئلة جاهزة: **كيف كان أداء حملاتي الأسبوع الماضي؟** و**أي جمهور يجلب أرخص اجتماعات؟** و**اقترح جمهورًا جديدًا لأفضل حملة عندي** و**ما الذي يحتاجني اليوم؟**. ويمكنك كتابة أي سؤال آخر عن حملاتك بكلماتك. ويعرف Yolias AI الصفحة التي فتحته منها. ويبدأ **محادثة جديدة** محادثة جديدة، ويفتحها **فتح بالحجم الكامل** في صفحة مستقلة، وتظهر المحادثات السابقة في **محادثات يولياس AI** بالشريط الجانبي." },
        { table: { head: ["يستطيع", "أمثلة"], rows: [
          ["قراءة النتائج", "أداء الحملات، وسجل النشاط، وتكلفة الاجتماع لكل جمهور"],
          ["قراءة الأشخاص والمحادثات", "العملاء والشركات والردود والاجتماعات والعملاء في المحادثات"],
          ["قراءة الجماهير والاستخدام", "جماهيرك واستخدامك، والفوترة للمالكين والمسؤولين"],
          ["البحث عن شركة", "ملخص قصير من مصادر الويب العامة عن شركة واحدة"],
          ["تجهيز مسودة حملة", "مما تصفه، ويعيد رابطًا تراجع منه الخطوات الثلاث ثم تشغّلها"],
          ["إيقاف حملة أو استئنافها أو إنهاؤها أو أرشفتها", "عندما تطلب ذلك فقط"],
          ["استبعاد عميل", "من حملة واحدة أو من كل الحملات، مع تسجيله بعدم التواصل إن أردت"],
          ["تذكّر معلومة", "معلومة دائمة عن عملك أو تفضيلاتك، ولا يحفظ بيانات تواصل أو أي شيء حساس"],
        ] } },
        { ul: [
          "لا يذكر إلا ما تعيده أدواته. والرقم الذي لا يمكن حسابه يظهر –، وليس 0، ولا يقول إن رسالة أُرسلت أو اجتماعًا حُجز إلا إذا قالت البيانات ذلك.",
          "إذا نقص شيء أساسي لتجهيز حملة، مثل من تستهدفهم، يسأل سؤالًا قصيرًا واحدًا أولًا.",
          "يجيب بلغتك: العربية أو الإنجليزية.",
          "يعتذر عن الأسئلة التي لا تتعلق بحملاتك أو عملائك أو استخدام يولياس، ولا يناقش طريقة بناء يولياس.",
        ] },

        { h2: "الصلاحيات والحدود" },
        { table: { head: ["القاعدة", "القيمة"], rows: [
          ["من يستطيع المحادثة", "كل الأدوار، والمحلل يحصل على أدوات القراءة فقط"],
          ["ما يحتاجه الحساب للمحادثة", "خطة أو رصيد، وإكمال خطوات البداية"],
          ["أسئلة الفوترة", "للمالكين والمسؤولين فقط"],
          ["الوتيرة", "6 رسائل في الدقيقة و200 رسالة يوميًا لكل مستخدم"],
          ["حد الرسائل اليومي", "حسب الخطة، ويتجدد عند 00:00 بتوقيت UTC"],
          ["ذاكرة المحادثة", "آخر 30 دورة من المحادثة"],
          ["الذكاء الاصطناعي في المنشئ على حساب مجاني", "30 طلبًا خلال 24 ساعة لمساحة العمل"],
        ] } },

        { h2: "مثال" },
        { p: "تفتح **اسأل يولياس AI** في صفحة الحملات وتكتب: «أي جمهور يأتي بأرخص الاجتماعات؟» فيقرأ أداء الحملات ويجيب بأن جمهور «ملاك العيادات، الرياض» حقق 4 اجتماعات بتكلفة 11.50 دولار للاجتماع، وجمهور «مديرو عيادات الأسنان، جدة» حقق اجتماعًا واحدًا بتكلفة 38 دولارًا. تكتب: «أوقف حملة جدة»، فيوقفها ويؤكد. ثم تكتب: «جهّز حملة لسلاسل عيادات الأسنان في دبي، 30 دولارًا، 5 اجتماعات»، فيعيد رابط مسودة تفتحه وتراجع خطواته الثلاث ثم تشغّله." },

        { h2: "حل المشكلات" },
        { table: { head: ["ما تراه", "معناه"], rows: [
          ["رسالة بأنك ترسل بسرعة كبيرة", "أكثر من 6 رسائل في الدقيقة، فانتظر قليلًا ثم أعد المحاولة"],
          ["رسالة بأنك بلغت حد رسائل Yolias AI اليومي لخطتك", "استُخدم الحد اليومي للخطة، ويتجدد عند 00:00 بتوقيت UTC"],
          ["المحادثة لا تجيب في حساب جديد", "تحتاج المحادثة إلى خطة أو رصيد"],
          ["يفشل طلب وتظهر بطاقة", "راجع [عندما لا يقرأ Yolias AI طلبًا](/help-center/search-needs-attention)"],
          ["أجاب يولياس عن شيء ما كان ينبغي أن يجيبه", "أضف القاعدة إلى **سياسة الرد** في معرفة الشركة أو إلى **ملاحظات ليولياس** في الحملة"],
        ] } },

        { h2: "مقالات ذات صلة" },
        { ul: [
          "[معرفة الشركة](/docs/customer-profile)",
          "[الحملات](/docs/campaigns)",
          "[حالة الحملة والتعلّم](/docs/search-status)",
          "[المحادثات](/help-center/conversations)",
          "[Yolias AI في مركز المساعدة](/help-center/yolias-ai)",
        ] },
      ],
    },
  },
  "search-status": {
    en: {
      title: "Campaign status and learning",
      summary: "What Learning, the budget split, pauses and waiting mean, and the exact rules that move budget between audiences.",
      updated: "2026-11-05",
      blocks: [
        { p: "A running campaign has two layers of state. The campaign has a status, such as Active or Paused. Each of its audiences has its own state: learning, getting a share of the budget, or getting no new budget. This page explains both layers, the optimizer that sets the shares once a day, the reasons a campaign or an audience waits, and the recommendations the campaign page shows. For the campaign statuses themselves, see [Campaigns](/docs/campaigns). For the task view, see [Budget and optimization](/help-center/budget-and-optimization)." },

        { h2: "What you see on the campaign page" },
        { table: { head: ["Where", "What it shows"], rows: [
          ["Next to the status", "**Optimizing for** an event (positive replies, booked meetings, purchases or website forms), or **Learning** while there isn't enough of any"],
          ["**Today's split between audiences**", "Each active audience's share of new budget as a percentage, with a reason"],
          ["**Audiences** tab and the Campaigns table", "The same share per audience, or the reason it gets no new budget"],
          ["**What Yolias did**", "Every decision with its reason: people found, replies answered, meetings booked, budget moved, pauses"],
          ["**Recommendations**", "Suggestions from the numbers, once there is enough data"],
          ["**Yolias learned**", "Clear differences between job titles, industries, sizes, countries or openings"],
        ] } },

        { h2: "Audience states" },
        { table: { head: ["Reason shown", "Meaning"], rows: [
          ["**Learning**", "The audience has fewer than 30 people contacted, or the campaign has too few results to compare. It keeps at least an equal share"],
          ["**Best results**", "The audience with the highest chance of being the best"],
          ["**Getting a share**", "A share between the floor and the best, from its results"],
          ["**No new budget (weaker results)**", "It clearly loses after a fair try"],
          ["**No new budget (over the cost cap)**", "Its cost per result is above the campaign's **Cost cap per result**"],
        ] } },

        { h2: "How the optimizer works" },
        { p: "Once a day, for every launched campaign that is Active or Scheduled, Yolias sets each active audience's share of the budget. The steps are fixed." },
        { h3: "1. Choose the event" },
        { p: "Each objective has an event it optimizes for, and positive replies stand in until there are enough of it. An event counts once the campaign has at least 5 of it." },
        { table: { head: ["Objective", "Optimizes for", "Until then"], rows: [
          ["Meetings", "Booked meetings", "Positive replies, then Learning"],
          ["Sales", "Purchases", "Positive replies, then Learning"],
          ["Website leads", "Website forms", "Positive replies, then Learning"],
          ["Qualified leads", "Nothing: every audience keeps an equal share", "Learning"],
        ] } },
        { p: "Positive replies are replies classified as **Interested** or **Asked for a meeting**. Opens never count." },
        { h3: "2. Estimate which audience is best" },
        { p: "For each audience Yolias takes its people contacted and its events, and draws its rate of the event 2,000 times from what is known so far. The share of draws an audience wins is its chance of being the best. A small audience has a wide range, so it still wins some draws; a large one with a clear rate wins consistently." },
        { h3: "3. Set the shares" },
        { ul: [
          "**Learning audiences** (under 30 contacted) get at least 1 ÷ the number of audiences.",
          "**Every other audience** gets 20% of an equal share as a floor, plus 80% weighted by its chance of being the best.",
          "**Weaker results**: with more than one audience, an audience with at least 60 people contacted and less than a 2% chance of being the best gets 0.",
          "**Over the cost cap**: an audience with at least 30 contacted whose cost per result is above the cap gets 0. An audience with no results yet is over the cap once it has spent more than twice the cap. The cap applies only when the campaign optimizes for a result, not for positive replies.",
          "The shares are then scaled to add up to 100%.",
        ] },
        { p: "The floor has a reason: in the first days a good audience can get few results by chance. If the split followed the chance alone, it would lose its budget before proving itself. So every audience keeps a small share until larger numbers show how it really performs, and none is cut off before a fair try." },
        { p: "When every audience is over the cost cap, all shares are 0, new budget is held, and you get a notification: **Over the cost cap**, with the campaign's name. Raise the cap or change the audiences." },
        { p: "The same day's result is the same on every run, so the split doesn't change when you refresh the page. A change is written to **What Yolias did** when an audience's share moves by 10 points or more, or an audience stops getting new budget." },

        { h2: "What a share changes" },
        { ul: [
          "**Daily budget**: each new day's people are split between the audiences by their shares.",
          "**A share of 0**: the audience's search doesn't run that day. It is checked again the next day, and its people already in the campaign keep getting follow-ups and answers.",
          "**Total budget**: the people reserved at launch stay with each audience. A share of 0 still stops that audience from finding more people that day.",
        ] },
        { p: "The optimizer only moves budget between the audiences you chose. It never changes targeting, the writing rules, sending limits or permissions. Once a workspace has 3 meetings, it also keeps the lookalike **Like the people who booked a meeting** up to date in Audiences, for you to use." },

        { h2: "Why a campaign or an audience waits" },
        { table: { head: ["Situation", "What happens", "What starts it again"], rows: [
          ["The account's **Daily budget** is spent", "No new people today; the search continues tomorrow (UTC)", "The next day, or a higher daily budget"],
          ["The **Account spending limit** is reached", "No new people", "Raising, resetting or removing the limit"],
          ["The balance is used up", "Finding new people pauses; the campaign stays Active and keeps sending to the people it has", "A top-up or the plan's renewal, then it continues by itself"],
          ["The audience got no budget today", "Its search waits", "Tomorrow's split"],
          ["No data source covers this kind of search", "The audience waits, at no cost", "A data source becoming available, or a different audience. See [A campaign waiting to start](/help-center/awaiting-data-source)"],
          ["Outside the sending days and hours", "Emails wait; replies are still answered", "The next open window"],
          ["A daily sending limit is reached", "Emails wait until the next day", "The next day"],
        ] } },

        { h2: "When Yolias pauses a campaign" },
        { table: { head: ["Cause", "Rule", "What to do"], rows: [
          ["Mailbox disconnected or permission expired", "Checked before each send", "Reconnect it in Integrations, then resume"],
          ["The campaign's bounces", "5% or more of its emails bounced, after at least 20 sent", "Check the addresses in the campaign's audiences, then resume"],
          ["The mailbox's bounces", "More than 5% bounced in 7 days, after at least 20 sent. Every campaign sending from it pauses", "Check the addresses, then resume each campaign"],
        ] } },
        { p: "Each pause is written to **What Yolias did** with its reason and sent to you as a notification. Between 3% and 5% bounces, nothing pauses, but the campaign page shows a recommendation to check the addresses." },

        { h2: "Reading What Yolias did" },
        { p: "**What Yolias did** is the campaign's log. Each line is one decision with its time, written in plain words with the numbers behind it, such as which audience got what share of the budget. The log records:" },
        { table: { head: ["Event", "What the line says"], rows: [
          ["Launch", "That the campaign launched, or the date it will start on"],
          ["People found", "How many new people an audience's search delivered"],
          ["A reply handled", "Who replied and what Yolias did: answered, sent the booking page or your link, or handed it to you"],
          ["A meeting booked", "Who booked from the campaign"],
          ["The budget split", "The event the campaign optimizes for, the audience with the largest share and its percentage, and any audience that gets no new budget"],
          ["A new budget day", "How many more people an audience may find that day"],
          ["A protection pause", "The bounce rate and the number of emails behind it"],
          ["Your changes", "Pauses, resumes, the end of the campaign, settings changed and audiences added"],
        ] } },
        { p: "When the log is empty, the campaign shows **Nothing yet.** Read it first when a number surprises you: a day with no new people usually has a line about the budget or the balance, and a sudden drop in sending usually has a pause or an audience that got no budget." },

        { h2: "Progress toward the target" },
        { p: "On a Meetings campaign, the campaign details show progress toward **Meetings you want** as **N of M meetings**, counted from meetings held. It is an actual number, not a forecast. The target doesn't change the optimizer or the budget: the optimizer follows each audience's rate of the result, and the budget follows what you set. To reach the target sooner, raise the budget or add an audience like your best one." },

        { h2: "Recommendations" },
        { table: { head: ["Recommendation", "When it appears"], rows: [
          ["An audience gets far fewer interested replies than the best one", "At least two audiences with 30 or more contacted, and one under half the best rate"],
          ["One opening gets more interested replies", "Both openings of an audience reached 20 people, and one rate is at least 1.5 times the other"],
          ["Emails bounced", "At least 20 sent and more than 3% bounced"],
          ["No reply yet", "50 or more people contacted and no replies"],
        ] } },
        { p: "Before that, the page shows **Recommendations appear once the campaign has enough results.** **Yolias learned** follows its own rule: about 50 people contacted, and a difference of at least 1.5 times with 20 or more people on each side." },

        { h2: "Example" },
        { p: "A Meetings campaign on a $20 daily budget has three audiences. After four days they have 40, 35 and 25 people contacted and 3, 1 and 0 interested replies. The campaign has 4 positive replies and no meetings, so it shows **Learning**: shares are equal. On day six it has 6 positive replies, so it optimizes for positive replies. The third audience has under 30 contacted and keeps a third. The first wins most draws and gets the largest share of the rest. By day twelve the campaign has 5 booked meetings and switches to **Optimizing for booked meetings**." },

        { h2: "Permissions and requirements" },
        { ul: [
          "The optimizer runs on its own for every launched campaign. There is nothing to turn on.",
          "Admins and Advertisers set the cost cap, pause or resume audiences and resume paused campaigns. Analysts view the states.",
        ] },

        { h2: "Troubleshooting" },
        { table: { head: ["What you see", "What to do"], rows: [
          ["**Learning** for a long time", "The campaign has fewer than 5 positive replies. Give it time, or check the openings and the audiences"],
          ["One audience gets everything", "It has the best rate by a clear margin. Learning audiences still keep their share"],
          ["Every audience shows over the cost cap", "Raise the cap under **Days, hours and pace**, or add a different audience"],
          ["Paused, and the reason mentions bounces", "Check the addresses in the campaign's audiences, then resume"],
        ] } },

        { h2: "Related articles" },
        { ul: [
          "[Campaigns](/docs/campaigns)",
          "[Audiences](/docs/audiences)",
          "[Results and metrics](/docs/analytics)",
          "[Budget and optimization](/help-center/budget-and-optimization)",
        ] },
      ],
    },
    ar: {
      title: "حالة الحملة والتعلّم",
      summary: "معنى التعلم وتوزيع الميزانية والتوقف والانتظار، والقواعد الدقيقة التي تنقل الميزانية بين الجماهير.",
      updated: "2026-11-05",
      blocks: [
        { p: "للحملة الجارية مستويان من الحالة. فللحملة حالتها، مثل نشطة أو متوقفة، ولكل جمهور فيها حالته الخاصة: في مرحلة التعلم، أو يأخذ نصيبًا من الميزانية، أو بدون ميزانية جديدة. تشرح هذه الصفحة المستويين، والمحسّن الذي يضبط الأنصبة مرة يوميًا، وأسباب انتظار الحملة أو الجمهور، والتوصيات التي تعرضها صفحة الحملة. ولحالات الحملة نفسها راجع [الحملات](/docs/campaigns)، ولتنفيذ المهام راجع [الميزانية والتحسين](/help-center/budget-and-optimization)." },

        { h2: "ما تراه في صفحة الحملة" },
        { table: { head: ["أين", "ما يعرضه"], rows: [
          ["بجانب الحالة", "**يحسّن على:** حدث معين (الردود الإيجابية أو الاجتماعات المحجوزة أو المشتريات أو نماذج الموقع)، أو **في مرحلة التعلم** حين لا يتوفر ما يكفي من أي منها"],
          ["**توزيع اليوم بين الجماهير**", "نصيب كل جمهور نشط من الميزانية الجديدة كنسبة مئوية، مع السبب"],
          ["تبويب **الجماهير** وجدول الحملات", "النصيب نفسه لكل جمهور، أو سبب عدم حصوله على ميزانية جديدة"],
          ["**ما فعله يولياس**", "كل قرار مع سببه: أشخاص وُجدوا، وردود أُجيبت، واجتماعات حُجزت، وميزانية نُقلت، وتوقفات"],
          ["**التوصيات**", "اقتراحات من الأرقام، عندما تتوفر بيانات كافية"],
          ["**يولياس تعلّم**", "فروق واضحة بين المسميات الوظيفية أو المجالات أو الأحجام أو الدول أو الافتتاحيات"],
        ] } },

        { h2: "حالات الجمهور" },
        { table: { head: ["السبب الظاهر", "المعنى"], rows: [
          ["**في مرحلة التعلم**", "تواصل الجمهور مع أقل من 30 شخصًا، أو نتائج الحملة أقل من أن تُقارن. ويحتفظ بنصيب متساوٍ على الأقل"],
          ["**أفضل نتائج**", "الجمهور صاحب أعلى فرصة لأن يكون الأفضل"],
          ["**يأخذ نصيبًا**", "نصيب بين الحد الأدنى والأفضل، حسب نتائجه"],
          ["**بدون ميزانية جديدة (نتائج أضعف)**", "يخسر بوضوح بعد تجربة عادلة"],
          ["**بدون ميزانية جديدة (فوق حد التكلفة)**", "تكلفة النتيجة لديه أعلى من **حد أقصى لتكلفة النتيجة** في الحملة"],
        ] } },

        { h2: "كيف يعمل المحسّن" },
        { p: "مرة يوميًا، ولكل حملة مشغّلة نشطة أو مجدولة، يضبط يولياس نصيب كل جمهور نشط من الميزانية بخطوات ثابتة." },
        { h3: "1. اختيار الحدث" },
        { p: "لكل هدف حدث يحسّن عليه، وتحل الردود الإيجابية محله حتى يتوفر منه ما يكفي. ويُعتمد الحدث عندما يكون لدى الحملة 5 منه على الأقل." },
        { table: { head: ["الهدف", "يحسّن على", "وقبل ذلك"], rows: [
          ["اجتماعات", "الاجتماعات المحجوزة", "الردود الإيجابية، ثم التعلم"],
          ["المبيعات", "المشتريات", "الردود الإيجابية، ثم التعلم"],
          ["نماذج الموقع", "نماذج الموقع", "الردود الإيجابية، ثم التعلم"],
          ["عملاء مؤهلون", "لا شيء: يحتفظ كل جمهور بنصيب متساوٍ", "التعلم"],
        ] } },
        { p: "الردود الإيجابية هي الردود المصنفة **مهتم** أو **طلب اجتماعًا**، ولا يُحسب فتح الرسائل أبدًا." },
        { h3: "2. تقدير أي جمهور هو الأفضل" },
        { p: "يأخذ يولياس لكل جمهور عدد من تواصل معهم وعدد أحداثه، ويسحب معدل الحدث لديه 2,000 مرة مما هو معروف حتى الآن. ونسبة السحبات التي يفوز بها الجمهور هي فرصته لأن يكون الأفضل. فالجمهور الصغير نطاقه واسع فيفوز ببعض السحبات، والجمهور الكبير صاحب المعدل الواضح يفوز باستمرار." },
        { h3: "3. ضبط الأنصبة" },
        { ul: [
          "**الجماهير في مرحلة التعلم** (أقل من 30 شخصًا تم التواصل معهم) تحصل على 1 ÷ عدد الجماهير على الأقل.",
          "**كل جمهور آخر** يحصل على 20% من النصيب المتساوي حدًا أدنى، إضافة إلى 80% موزعة حسب فرصته لأن يكون الأفضل.",
          "**نتائج أضعف**: عند وجود أكثر من جمهور، يحصل على 0 الجمهور الذي تواصل مع 60 شخصًا على الأقل وفرصته لأن يكون الأفضل أقل من 2%.",
          "**فوق حد التكلفة**: يحصل على 0 الجمهور الذي تواصل مع 30 شخصًا على الأقل وتكلفة النتيجة لديه أعلى من الحد. والجمهور الذي لا نتائج له بعد يُعد فوق الحد عندما ينفق أكثر من ضعف الحد. ولا ينطبق الحد إلا عندما تحسّن الحملة على نتيجة، لا على الردود الإيجابية.",
          "ثم تُضبط الأنصبة لتصل إلى 100% مجتمعة.",
        ] },
        { p: "ولهذا الحد الأدنى سبب: في الأيام الأولى قد يحصل جمهور جيد على نتائج قليلة بالصدفة، فلو اعتمد التوزيع على الفرصة وحدها لحُرم من الميزانية قبل أن يثبت نفسه. ولذلك يبقى لكل جمهور نصيب صغير حتى تكشف الأعداد الأكبر حقيقة أدائه، ولا يُحجب عنه إلا بعد تجربة عادلة مع 60 شخصًا على الأقل." },
        { p: "عندما تكون كل الجماهير فوق حد التكلفة تصبح كل الأنصبة 0، وتُحجب الميزانية الجديدة، ويصلك إشعار بأن الحملة فوق حد التكلفة. ارفع الحد أو غيّر الجماهير." },
        { p: "نتيجة اليوم الواحد ثابتة في كل تشغيل، فلا يتغير التوزيع عند تحديث الصفحة. ويُسجَّل التغيير في **ما فعله يولياس** عندما يتحرك نصيب جمهور 10 نقاط أو أكثر، أو يتوقف جمهور عن الحصول على ميزانية جديدة." },

        { h2: "ما يغيّره النصيب" },
        { ul: [
          "**الميزانية اليومية**: يُقسم أشخاص كل يوم جديد على الجماهير حسب أنصبتها.",
          "**نصيب 0**: لا يعمل بحث الجمهور في ذلك اليوم، ويُفحص مجددًا في اليوم التالي، ويستمر من في الحملة من أشخاصه في تلقي المتابعات والإجابات.",
          "**الميزانية الإجمالية**: يبقى الأشخاص المحجوزون عند التشغيل مع كل جمهور، والنصيب 0 يوقف مع ذلك إيجاد الجمهور لأشخاص جدد في ذلك اليوم.",
        ] },
        { p: "لا ينقل المحسّن الميزانية إلا بين الجماهير التي اخترتها، ولا يغيّر الاستهداف أو قواعد الكتابة أو حدود الإرسال أو الصلاحيات. وعندما تصل مساحة العمل إلى 3 اجتماعات، يحدّث أيضًا الجمهور المشابه **Like the people who booked a meeting** في الجماهير لتستخدمه." },

        { h2: "لماذا تنتظر الحملة أو الجمهور" },
        { table: { head: ["الحالة", "ما يحدث", "ما يعيد التشغيل"], rows: [
          ["أُنفقت **الميزانية اليومية** للحساب", "لا أشخاص جدد اليوم، ويستمر البحث غدًا (بتوقيت UTC)", "اليوم التالي، أو رفع الميزانية اليومية"],
          ["بُلغ **حد الإنفاق للحساب**", "لا أشخاص جدد", "رفع الحد أو إعادة تعيينه أو إزالته"],
          ["نفد الرصيد", "يتوقف إيجاد أشخاص جدد، وتبقى الحملة نشطة وتواصل مراسلة من لديها", "الشحن أو تجدد الخطة، ثم تستأنف وحدها"],
          ["لم يحصل الجمهور على ميزانية اليوم", "ينتظر بحثه", "توزيع الغد"],
          ["لا يوجد مصدر بيانات يغطي هذا النوع من البحث", "ينتظر الجمهور دون أي تكلفة", "توفر مصدر بيانات، أو جمهور مختلف. راجع [حملة تنتظر البدء](/help-center/awaiting-data-source)"],
          ["خارج أيام الإرسال وساعاته", "تنتظر الرسائل، وتظل الردود تُجاب", "نافذة الإرسال المفتوحة التالية"],
          ["بُلغ حد الإرسال اليومي", "تنتظر الرسائل حتى اليوم التالي", "اليوم التالي"],
        ] } },

        { h2: "متى يوقف يولياس الحملة" },
        { table: { head: ["السبب", "القاعدة", "ما تفعله"], rows: [
          ["انفصال البريد أو انتهاء صلاحية إذنه", "يُفحص قبل كل إرسال", "أعد ربطه من التكاملات ثم استأنف الحملة"],
          ["ارتداد رسائل الحملة", "ارتد 5% أو أكثر من رسائلها بعد إرسال 20 على الأقل", "راجع العناوين في جماهير الحملة ثم استأنفها"],
          ["ارتداد رسائل البريد", "ارتد أكثر من 5% خلال 7 أيام بعد إرسال 20 على الأقل، فتتوقف كل الحملات التي ترسل منه", "راجع العناوين ثم استأنف كل حملة"],
        ] } },
        { p: "يُسجَّل كل توقف في **ما فعله يولياس** مع سببه، ويصلك إشعار به. وبين 3% و5% من الارتداد لا يتوقف شيء، لكن صفحة الحملة تعرض توصية بمراجعة العناوين." },

        { h2: "قراءة ما فعله يولياس" },
        { p: "**ما فعله يولياس** هو سجل الحملة. وكل سطر فيه قرار واحد مع وقته. وفي الواجهة العربية يظهر كل سطر بنوعه، مع عدد الأشخاص حين يحمله السطر. وهذه أنواع الأسطر التي يعرضها:" },
        { table: { head: ["السطر", "متى يُكتب"], rows: [
          ["**شُغّلت الحملة.** / **جُدولت لتبدأ.**", "عندما تشغّل الحملة الآن أو بتاريخ بداية لاحق"],
          ["**وجد N شخصًا جديدًا لهذه الحملة.**", "عندما يأتي بحث أحد الجماهير بأشخاص"],
          ["**انضم أشخاص إلى الحملة.**", "عندما يدخل الحملة أشخاص من قائمة أو من بحث"],
          ["**رد على رد.**", "عندما يجيب يولياس في محادثة"],
          ["**حجز اجتماعًا.**", "عندما يُحجز اجتماع من الحملة"],
          ["**سلّمك محادثة.**", "عندما يحتاجك رد"],
          ["**حرّك الميزانية نحو الجمهور الأفضل.**", "عندما يتحرك التوزيع اليومي 10 نقاط أو أكثر، أو يتوقف جمهور عن الحصول على ميزانية جديدة"],
          ["**أُوقفت لحماية بريدك.**", "عندما يتجاوز الارتداد حد البريد"],
          ["**أُوقفت.** / **استؤنفت.** / **انتهت.**", "عندما تغيّر أنت أو إحدى الحمايات حالة الحملة"],
          ["**حُدّثت الحملة.**", "عند تغيير الإعدادات، أو بدء يوم ميزانية جديد، أو إضافة جمهور"],
        ] } },
        { p: "وعندما يكون السجل فارغًا تعرض الحملة **لا شيء بعد.** واقرأه أولًا عندما يفاجئك رقم، فالسبب يكون غالبًا أحد هذه الأسطر: يوم بلا أشخاص جدد يقابله سطر عن الميزانية أو الرصيد، وانخفاض مفاجئ في الإرسال يقابله توقف أو جمهور حُجبت عنه الميزانية." },

        { h2: "التقدم نحو الهدف" },
        { p: "في حملة الاجتماعات تعرض تفاصيل الحملة التقدم نحو **عدد الاجتماعات الذي تريده** بصيغة **N من M اجتماعات**، محسوبًا من الاجتماعات المنعقدة لا المحجوزة. وهو رقم فعلي وليس توقعًا. والهدف لا يغيّر عمل المحسّن ولا الميزانية، فالمحسّن يتبع معدل النتيجة لدى كل جمهور، والميزانية تتبع ما ضبطته أنت. وإذا أردت الوصول إلى الهدف أسرع، فارفع الميزانية أو أضف جمهورًا جديدًا يشبه أفضل جماهيرك أداءً." },

        { h2: "التوصيات" },
        { table: { head: ["التوصية", "متى تظهر"], rows: [
          ["جمهور يحصل على ردود مهتمة أقل بكثير من الأفضل", "جمهوران على الأقل تواصل كل منهما مع 30 شخصًا أو أكثر، وأحدهما أقل من نصف معدل الأفضل"],
          ["افتتاحية تحصل على ردود مهتمة أكثر", "وصلت افتتاحيتا الجمهور إلى 20 شخصًا لكل منهما، ومعدل إحداهما 1.5 ضعف الأخرى على الأقل"],
          ["ارتداد الرسائل", "أُرسلت 20 رسالة على الأقل وارتد أكثر من 3%"],
          ["لا ردود بعد", "التواصل مع 50 شخصًا أو أكثر دون أي رد"],
        ] } },
        { p: "وقبل ذلك تعرض الصفحة **تظهر التوصيات عندما تجمع الحملة نتائج كافية.** أما **يولياس تعلّم** فله قاعدته الخاصة: التواصل مع نحو 50 شخصًا، وفرق لا يقل عن 1.5 ضعف مع 20 شخصًا أو أكثر في كل جانب." },

        { h2: "مثال" },
        { p: "حملة اجتماعات بميزانية يومية قدرها 20 دولارًا ولها ثلاثة جماهير. بعد أربعة أيام تواصلت الجماهير مع 40 و35 و25 شخصًا، وحصلت على 3 وواحد و0 ردود مهتمة. لدى الحملة 4 ردود إيجابية ولا اجتماعات، فتظهر **في مرحلة التعلم** والأنصبة متساوية. وفي اليوم السادس تصل إلى 6 ردود إيجابية فتبدأ التحسين على الردود الإيجابية. يحتفظ الجمهور الثالث، الذي تواصل مع أقل من 30 شخصًا، بالثلث، ويفوز الأول بمعظم السحبات فيحصل على النصيب الأكبر من الباقي. وفي اليوم الثاني عشر تصل الحملة إلى 5 اجتماعات محجوزة فتنتقل إلى **يحسّن على: الاجتماعات المحجوزة**." },

        { h2: "الصلاحيات والمتطلبات" },
        { ul: [
          "يعمل المحسّن وحده لكل حملة مشغّلة، ولا يوجد ما تفعّله.",
          "يضبط المدير والمعلن حد التكلفة، ويوقفان الجماهير أو يستأنفانها، ويستأنفان الحملات المتوقفة. ويرى المحلل الحالات فقط.",
        ] },

        { h2: "حل المشكلات" },
        { table: { head: ["ما تراه", "ما تفعله"], rows: [
          ["**في مرحلة التعلم** لفترة طويلة", "لدى الحملة أقل من 5 ردود إيجابية. امنحها وقتًا، أو راجع الافتتاحيات والجماهير"],
          ["جمهور واحد يأخذ كل شيء", "معدله الأفضل بفارق واضح، والجماهير في مرحلة التعلم تحتفظ بنصيبها"],
          ["كل الجماهير فوق حد التكلفة", "ارفع الحد في **الأيام والساعات والوتيرة**، أو أضف جمهورًا مختلفًا"],
          ["متوقفة والسبب يذكر الارتداد", "راجع العناوين في جماهير الحملة ثم استأنفها"],
        ] } },

        { h2: "مقالات ذات صلة" },
        { ul: [
          "[الحملات](/docs/campaigns)",
          "[الجماهير](/docs/audiences)",
          "[النتائج والمقاييس](/docs/analytics)",
          "[الميزانية والتحسين](/help-center/budget-and-optimization)",
        ] },
      ],
    },
  },
};
