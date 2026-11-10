import type { Localized } from "./types";

// Use cases as working guides (owner, 2026-11-05): each page takes a visitor
// from a business problem to a running workflow in Yolias. A new one is one
// entry here. Only what Yolias does today, with its real button names; `shot`
// is a real screenshot in public/use-cases/<shot>-<locale>.png.

export type WorkflowShot = "knowledge" | "integrations" | "builder" | "audience" | "signals" | "message" | "campaign" | "campaigns" | "leads" | "companies" | "inbox" | "meetings" | "audiences" | "lookalike";

export interface WorkflowText {
  name: string; title: string; lead: string; seoTitle: string; seoDescription: string;
  used: { name: string; role: string }[];
  problem: string[];
  how: string[];
  steps: { title: string; where: string; body: string[]; result: string; shot: WorkflowShot }[];
  act: string[];
}

export interface Workflow {
  slug: string;
  status: "published" | "draft";
  updated: string;
  category: "find" | "reach" | "convert";
  template?: string;
  related: string[];
  help: { href: string; label: Localized<string> }[];
  text: Localized<WorkflowText>;
}

export const workflowLabels: Localized<{ used: string; resources: string; template: string; before: string; how: string; steps: string; step: string; where: string; result: string; act: string; related: string; start: string; ready: string; readyLead: string; updated: string; example: string }> = {
  en: { used: "What we used", resources: "Free resources", template: "Open the ready-made template", before: "Before we begin", how: "How it works", steps: "Step by step", step: "Step", where: "Where", result: "What you should see", act: "Act on the results", related: "Related resources", start: "Start building now", ready: "Run this workflow in Yolias", readyLead: "Sign up free, build the campaign and pay when you launch it, from $20.", updated: "Updated", example: "Screenshot from Yolias with sample data" },
  ar: { used: "ما استخدمناه", resources: "موارد مجانية", template: "افتح القالب الجاهز", before: "قبل أن نبدأ", how: "كيف يعمل", steps: "خطوة بخطوة", step: "الخطوة", where: "المكان", result: "ما يجب أن تراه", act: "ماذا تفعل بالنتائج", related: "موارد ذات صلة", start: "ابدأ البناء الآن", ready: "نفّذ هذا المسار في يولياس", readyLead: "سجّل مجانًا، وابنِ الحملة، وادفع عند إطلاقها من 20 دولارًا.", updated: "آخر تحديث", example: "لقطة من يولياس ببيانات توضيحية" },
};

export const workflowDemo: Localized<{ title: string; hint: string; next: string; back: string; of: string; restart: string }> = {
  en: { title: "See it in Yolias", hint: "Click the highlighted spot to move to the next step.", next: "Next", back: "Back", of: "of", restart: "Start again" },
  ar: { title: "شاهده داخل يولياس", hint: "اضغط على المكان المحدد للانتقال إلى الخطوة التالية.", next: "التالي", back: "السابق", of: "من", restart: "ابدأ من جديد" },
};

const help = (href: string, en: string, ar: string) => ({ href, label: { en, ar } });

export const workflows: Workflow[] = [
  {
    slug: "find-clients", status: "published", updated: "2026-11-05", category: "find", template: "/templates/companies-by-industry",
    related: ["find-decision-makers", "similar-companies"],
    help: [help("/help-center/creating-a-campaign", "Creating a campaign", "إنشاء حملة"), help("/help-center/connect-gmail", "Connecting Gmail", "ربط Gmail"), help("/help-center/company-knowledge", "Company Knowledge", "معرفة الشركة")],
    text: {
      en: {
        name: "New clients for a marketing agency", title: "Fill your agency's calendar with meetings from the businesses you want",
        lead: "Referrals are unpredictable. This workflow turns the clients you want into a campaign that finds them, writes to each one and books the meeting.",
        seoTitle: "Find Clients for Your Agency: A Step-by-Step Campaign | Yolias", seoDescription: "A practical workflow for agencies: define the businesses you want, run a campaign in Yolias and book meetings, step by step.",
        used: [
          { name: "Company Knowledge", role: "What your agency sells and who it fits. Yolias writes every email from it." },
          { name: "Campaigns", role: "The objective, the budget and the target number of meetings." },
          { name: "Audiences", role: "The businesses and the people who decide, by location, industry, size and job title." },
          { name: "Gmail or IMAP/SMTP", role: "Emails go out from your own mailbox and replies come back to Yolias." },
          { name: "Conversations", role: "Every reply, with what Yolias answered." },
          { name: "Meetings", role: "Your booking page and every booked meeting." },
        ],
        problem: [
          "Most agencies live on referrals. Referrals feel free, and they arrive when they arrive: two good months, then a quiet one, and the team is sold before it can plan.",
          "The usual fix is to send messages between client work. It stops the moment the agency gets busy, and restarts when the work has already dried up. Nobody can say what a new client costs, because nobody counted.",
          "The idea here is to treat new clients the way you treat a client's ads: a defined audience, a budget, a target and a number you can read every week.",
        ],
        how: ["Tell Yolias what your agency sells.", "Connect the mailbox you send from.", "Create a meetings campaign with a budget.", "Define two or three audiences to compare.", "Review the openings and launch.", "Read replies and meetings, then move budget to what works."],
        steps: [
          { title: "Describe your agency", where: "Company Knowledge in the sidebar", shot: "knowledge", body: ["Add your services, the clients you serve best, and one or two results you can stand behind. Yolias uses only what you write here, so anything you leave out won't appear in an email."], result: "The page shows how complete your Company Knowledge is." },
          { title: "Connect your mailbox", where: "Integrations", shot: "integrations", body: ["Open Gmail or IMAP/SMTP mailbox, choose Connect and finish the steps. Use an address on a domain you can send from, with a daily limit you are comfortable with."], result: "The integration shows 1 active." },
          { title: "Create the campaign", where: "Campaigns → Create campaign", shot: "builder", body: ["Choose Build with Yolias to fill the whole campaign from your Company Knowledge, or enter it yourself: the name, the Meetings objective, your offer, the number of meetings you want and a budget of at least $5.", "The summary box shows how many people the budget reaches, how long it takes, and the replies and meetings to expect."], result: "The summary shows a forecast for your budget." },
          { title: "Define your audiences", where: "The Audience step of the campaign", shot: "audience", body: ["Add one audience for each kind of client, for example dental clinics in Riyadh and real estate developers in Jeddah. Pick countries and cities, the industry, the company size and the job titles of the people who decide.", "Two audiences in one campaign let Yolias compare them. Each starts with an equal share of the budget."], result: "Each audience shows how many matching companies and people Yolias already knows." },
          { title: "Review the message and launch", where: "The Message step", shot: "message", body: ["Choose Send from, the name to sign with, the tone and the language. Yolias shows two openings for each audience. Choose Write a sample email to read one, confirm that Yolias may email on your behalf, then choose Launch campaign.", "Your first payment comes at this step when your balance is empty."], result: "The campaign page opens with the campaign running." },
          { title: "Read the replies and meetings", where: "Conversations and Meetings", shot: "inbox", body: ["Yolias answers questions from your Company Knowledge and sends interested people your booking page. Replies that need you, such as a negotiation, stop and wait for you."], result: "Booked meetings appear in Meetings and in your calendar when Google Calendar is connected." },
        ],
        act: ["Open the campaign and compare audiences by cost per meeting.", "Pause the audience that brings no replies and let the budget move.", "Save the audience that works and reuse it in the next campaign.", "Add what you learn from calls to Company Knowledge, so the next emails answer it."],
      },
      ar: {
        name: "عملاء جدد لوكالة تسويق", title: "املأ تقويم وكالتك باجتماعات من الشركات التي تريدها",
        lead: "الترشيحات لا يمكن توقعها. هذا المسار يحوّل العملاء الذين تريدهم إلى حملة تجدهم وتكتب لكل واحد وتحجز الاجتماع.",
        seoTitle: "اكتساب عملاء لوكالتك: حملة خطوة بخطوة | يولياس", seoDescription: "مسار عملي للوكالات: حدد الجهات التي تريدها، وشغّل حملة في يولياس، واحجز الاجتماعات خطوة بخطوة.",
        used: [
          { name: "معرفة الشركة", role: "ما تبيعه وكالتك ومن يناسبه. يكتب يولياس كل رسالة منها." },
          { name: "الحملات", role: "الهدف والميزانية وعدد الاجتماعات المستهدف." },
          { name: "الجماهير", role: "الجهات والأشخاص أصحاب القرار حسب الموقع والمجال والحجم والمسمى." },
          { name: "Gmail أو IMAP/SMTP", role: "تخرج الرسائل من بريدك وتعود الردود إلى يولياس." },
          { name: "المحادثات", role: "كل رد مع ما أجاب به يولياس." },
          { name: "الاجتماعات", role: "صفحة الحجز وكل اجتماع محجوز." },
        ],
        problem: [
          "معظم الوكالات تعيش على الترشيحات. تبدو الترشيحات مجانية، لكنها تأتي وقت ما تأتي: شهران جيدان ثم شهر هادئ، وتصبح خطة الفريق رهينة لذلك.",
          "الحل المعتاد هو إرسال رسائل بين أعمال العملاء. ويتوقف ذلك فور انشغال الوكالة، ويعود بعد أن يجف العمل. ولا أحد يعرف كم يكلف العميل الجديد لأن أحدًا لم يحسب.",
          "الفكرة هنا أن تعامل عملاءك الجدد كما تعامل إعلانات عملائك: جمهور محدد وميزانية وهدف ورقم تقرؤه كل أسبوع.",
        ],
        how: ["عرّف يولياس بما تبيعه وكالتك.", "اربط البريد الذي ترسل منه.", "أنشئ حملة اجتماعات بميزانية.", "حدد جمهورين أو ثلاثة للمقارنة.", "راجع الافتتاحيات وشغّل الحملة.", "اقرأ الردود والاجتماعات، ووجّه الميزانية لما ينجح."],
        steps: [
          { title: "صف وكالتك", where: "معرفة الشركة في الشريط الجانبي", shot: "knowledge", body: ["أضف خدماتك والعملاء الذين تخدمهم أفضل، ونتيجة أو نتيجتين تثق بهما. يستخدم يولياس ما تكتبه هنا فقط، فما لا تكتبه لن يظهر في أي رسالة."], result: "تعرض الصفحة نسبة اكتمال معرفة الشركة." },
          { title: "اربط بريدك", where: "التكاملات", shot: "integrations", body: ["افتح Gmail أو بريد IMAP/SMTP، واختر اربط وأكمل الخطوات. استخدم عنوانًا على نطاق تستطيع الإرسال منه، بحد يومي مناسب لك."], result: "يعرض التكامل 1 نشط." },
          { title: "أنشئ الحملة", where: "الحملات ← إنشاء حملة", shot: "builder", body: ["اختر أنشئ مع يولياس ليملأ الحملة كاملة من معرفة شركتك، أو أدخلها بنفسك: الاسم، وهدف الاجتماعات، وعرضك، وعدد الاجتماعات، وميزانية لا تقل عن 5 دولارات.", "يعرض صندوق الملخص عدد من تصل إليهم الميزانية والمدة والردود والاجتماعات المتوقعة."], result: "يعرض الملخص توقعًا لميزانيتك." },
          { title: "حدد جماهيرك", where: "خطوة الجمهور في الحملة", shot: "audience", body: ["أضف جمهورًا لكل نوع من العملاء، مثل عيادات الأسنان في الرياض والمطورين العقاريين في جدة. اختر الدول والمدن والمجال وحجم الشركة ومسميات أصحاب القرار.", "وجود جمهورين في حملة واحدة يتيح ليولياس المقارنة بينهما، ويبدأ كل منهما بنصيب متساوٍ من الميزانية."], result: "يعرض كل جمهور عدد الشركات والأشخاص المطابقين المعروفين ليولياس." },
          { title: "راجع الرسالة وشغّل الحملة", where: "خطوة الرسالة", shot: "message", body: ["اختر الإرسال من والتوقيع باسم والأسلوب واللغة. يعرض يولياس افتتاحيتين لكل جمهور. اقرأ رسالة تجريبية، وأكّد أن يولياس يمكنه المراسلة نيابةً عنك، ثم اختر تشغيل الحملة.", "تأتي دفعتك الأولى في هذه الخطوة إذا كان رصيدك فارغًا."], result: "تفتح صفحة الحملة والحملة تعمل." },
          { title: "اقرأ الردود والاجتماعات", where: "المحادثات والاجتماعات", shot: "inbox", body: ["يجيب يولياس عن الأسئلة من معرفة شركتك، ويرسل صفحة الحجز للمهتمين. والردود التي تحتاجك، مثل التفاوض، تتوقف وتنتظرك."], result: "تظهر الاجتماعات المحجوزة في الاجتماعات، وفي تقويمك عند ربط تقويم Google." },
        ],
        act: ["افتح الحملة وقارن الجماهير حسب تكلفة الاجتماع.", "أوقف الجمهور الذي لا يأتي بردود ودع الميزانية تتحرك.", "احفظ الجمهور الناجح واستخدمه في الحملة التالية.", "أضف ما تتعلمه من المكالمات إلى معرفة الشركة لتجيب الرسائل القادمة عنه."],
      },
    },
  },
  {
    slug: "find-decision-makers", status: "published", updated: "2026-11-05", category: "find", template: "/templates/leads-by-job-title",
    related: ["find-clients", "similar-companies"],
    help: [help("/help-center/audiences", "Audiences", "الجماهير"), help("/help-center/prospects-workspace", "Working with leads", "العمل مع العملاء")],
    text: {
      en: {
        name: "Reach the person who decides", title: "Reach the person who decides, not the info@ inbox",
        lead: "A good offer sent to the wrong person goes nowhere. This workflow targets the job titles that own the decision, then measures which titles answer.",
        seoTitle: "How to Find and Reach Decision Makers at Target Companies | Yolias", seoDescription: "A step-by-step workflow to reach the people who decide: job title targeting, audiences compared by results, and replies handled in Yolias.",
        used: [
          { name: "Audiences", role: "Job titles and seniority for each group you want to reach." },
          { name: "Leads", role: "The companies and people Yolias found, with their title, source, campaign and status." },
          { name: "Campaigns", role: "Results per audience, so you see which title answers." },
          { name: "Conversations", role: "Replies from the people you reached." },
        ],
        problem: [
          "General addresses are read by whoever is on shift, and they rarely reach the person who can say yes. Even a correct company list wastes the budget when the message stops at the front desk.",
          "The title that signs is not always the one you expect. In one market the owner decides; in another it is the head of sales. Guessing once and sending to everyone hides that difference.",
          "The idea is to give each likely title its own audience, then let the results say who decides in your market.",
        ],
        how: ["List the titles that may own the decision.", "Give each title its own audience in one campaign.", "Launch and let Yolias find the people.", "Compare audiences in the campaign results.", "Keep the titles that reply."],
        steps: [
          { title: "Create the campaign", where: "Campaigns → Create campaign", shot: "builder", body: ["Enter your offer and budget. Budget is split between audiences, so allow enough for each one: the summary shows how many people it reaches."], result: "The campaign is saved when you choose Save draft." },
          { title: "One audience per title", where: "The Audience step", shot: "audience", body: ["Name the first audience Owners and add its job titles. Choose Add audience for Sales leaders and again for Marketing leaders. Keep location, industry and company size the same in each, so the title is the only difference."], result: "Each audience shows its matching companies and people." },
          { title: "Launch", where: "The Message step", shot: "message", body: ["Choose your mailbox, tone and language, review the openings, confirm and choose Launch campaign."], result: "Yolias starts finding people for each audience within the budget." },
          { title: "Check who it found", where: "Leads → People", shot: "leads", body: ["The People tab lists each person with their title, company, source, campaign and status. Filter by the campaign to see this one only."], result: "You see real titles and companies in the campaign." },
          { title: "Compare the titles", where: "The campaign page", shot: "campaign", body: ["Read Reached, Replies, Interested and Meetings for each audience. Give it time: a title needs enough people reached before its numbers mean something."], result: "You can see which title brings replies and meetings." },
        ],
        act: ["Pause the titles that don't reply.", "Save the winning audience in Audiences and reuse it.", "Reply yourself where a conversation needs you."],
      },
      ar: {
        name: "الوصول إلى صاحب القرار", title: "صِل إلى من يقرر، لا إلى البريد العام",
        lead: "العرض الجيد يضيع إذا وصل إلى الشخص الخطأ. يستهدف هذا المسار المسميات صاحبة القرار، ثم يقيس أيها يرد.",
        seoTitle: "كيف تصل إلى أصحاب القرار في الشركات المستهدفة | يولياس", seoDescription: "مسار خطوة بخطوة للوصول إلى من يقرر: استهداف المسميات، ومقارنة الجماهير بالنتائج، والردود داخل يولياس.",
        used: [
          { name: "الجماهير", role: "المسميات والمستوى الوظيفي لكل مجموعة تريد الوصول إليها." },
          { name: "العملاء", role: "الشركات والأشخاص الذين وجدهم يولياس، مع المسمى والمصدر والحملة والحالة." },
          { name: "الحملات", role: "نتائج كل جمهور لتعرف أي مسمى يرد." },
          { name: "المحادثات", role: "ردود الأشخاص الذين وصلت إليهم." },
        ],
        problem: [
          "البريد العام يقرؤه من في المناوبة، ونادرًا ما يصل إلى من يستطيع الموافقة. حتى القائمة الصحيحة من الشركات تهدر الميزانية إذا توقفت الرسالة عند الاستقبال.",
          "من يوقّع ليس دائمًا من تتوقعه. في سوق يقرر المالك، وفي آخر مدير المبيعات. والتخمين مرة واحدة والإرسال للجميع يخفي هذا الفرق.",
          "الفكرة أن تعطي كل مسمى محتمل جمهوره الخاص، ثم تدع النتائج تقول من يقرر في سوقك.",
        ],
        how: ["اكتب المسميات التي قد تملك القرار.", "اجعل لكل مسمى جمهورًا في حملة واحدة.", "شغّل الحملة ودع يولياس يجد الأشخاص.", "قارن الجماهير في نتائج الحملة.", "أبقِ المسميات التي ترد."],
        steps: [
          { title: "أنشئ الحملة", where: "الحملات ← إنشاء حملة", shot: "builder", body: ["أدخل عرضك وميزانيتك. تُقسم الميزانية بين الجماهير، فاترك ما يكفي لكل جمهور: يعرض الملخص عدد من تصل إليهم."], result: "تُحفظ الحملة عند اختيار حفظ كمسودة." },
          { title: "جمهور لكل مسمى", where: "خطوة الجمهور", shot: "audience", body: ["سمِّ الجمهور الأول الملاك وأضف مسمياته. اختر إضافة جمهور لقادة المبيعات، ثم لقادة التسويق. أبقِ الموقع والمجال وحجم الشركة كما هي، ليكون المسمى هو الفرق الوحيد."], result: "يعرض كل جمهور الشركات والأشخاص المطابقين." },
          { title: "شغّل الحملة", where: "خطوة الرسالة", shot: "message", body: ["اختر البريد والأسلوب واللغة، وراجع الافتتاحيات، وأكّد، ثم اختر تشغيل الحملة."], result: "يبدأ يولياس إيجاد الأشخاص لكل جمهور في حدود الميزانية." },
          { title: "راجع من وجدهم", where: "العملاء ← الأشخاص", shot: "leads", body: ["يعرض تبويب الأشخاص كل شخص بمسماه وشركته ومصدره وحملته وحالته. صفِّ حسب الحملة لتراها وحدها."], result: "ترى مسميات وشركات حقيقية في الحملة." },
          { title: "قارن المسميات", where: "صفحة الحملة", shot: "campaign", body: ["اقرأ وصلت إليهم والردود والمهتمين والاجتماعات لكل جمهور. امنحها وقتًا: يحتاج المسمى إلى عدد كافٍ من الأشخاص قبل أن تعني أرقامه شيئًا."], result: "ترى أي مسمى يأتي بالردود والاجتماعات." },
        ],
        act: ["أوقف المسميات التي لا ترد.", "احفظ الجمهور الناجح في الجماهير واستخدمه مجددًا.", "رد بنفسك حيث تحتاجك المحادثة."],
      },
    },
  },
  {
    slug: "similar-companies", status: "published", updated: "2026-11-05", category: "find",
    related: ["find-clients", "find-decision-makers"],
    help: [help("/help-center/audiences", "Audiences", "الجماهير"), help("/help-center/budget-and-optimization", "Budget and optimization", "الميزانية والتحسين")],
    text: {
      en: {
        name: "More customers like your best ones", title: "Find more customers like the ones who already said yes",
        lead: "Your best customers already tell you who to reach next. This workflow turns them into a lookalike audience and a campaign.",
        seoTitle: "Lookalike Audience: Find Customers Like Your Best Ones | Yolias", seoDescription: "Build a lookalike audience from the customers and meetings you already have, then run it as a campaign in Yolias, step by step.",
        used: [
          { name: "Audiences", role: "A lookalike audience from the people who worked for you." },
          { name: "Campaigns", role: "Runs the audience with its own budget and results." },
          { name: "Meetings", role: "The result you compare." },
        ],
        problem: [
          "After a few good customers, most businesses go back to searching from scratch. What those customers have in common stays in the founder's head.",
          "That costs twice: the budget reaches people who look nothing like your buyers, and the patterns you already paid to learn go unused.",
          "The idea is to start from what worked: the traits your best customers share, widened only as far as you choose.",
        ],
        how: ["Pick who to base it on.", "Review the shared traits.", "Save the lookalike audience.", "Use it in a campaign.", "Compare it with your other audiences."],
        steps: [
          { title: "Create the lookalike audience", where: "Audiences → Create audience", shot: "lookalike", body: ["Choose Lookalike audience, then the base: for example people who booked meetings, or a custom audience of your customers. A base with more people gives clearer traits."], result: "Yolias lists the traits the base shares." },
          { title: "Save it", where: "The same window", shot: "audiences", body: ["Choose how far to widen it, name the audience and save it. Building an audience never contacts anyone."], result: "The audience appears in Audiences." },
          { title: "Use it in a campaign", where: "Campaigns → Create campaign → Audience", shot: "audience", body: ["Under People choose Use a saved audience and pick it. New companies like the ones that work for you are found while the campaign runs."], result: "The audience shows in the campaign." },
          { title: "Compare it", where: "The campaign page", shot: "campaign", body: ["Add a second audience with ordinary targeting in the same campaign, launch, and compare the cost per meeting of both."], result: "You can see whether the lookalike beats your usual targeting." },
        ],
        act: ["Give the winner more budget.", "Rebuild the audience as you get more meetings: a bigger base gives clearer traits."],
      },
      ar: {
        name: "عملاء يشبهون أفضل عملائك", title: "جد عملاء يشبهون من وافقوا بالفعل",
        lead: "أفضل عملائك يخبرونك بمن تصل إليه بعدهم. يحوّلهم هذا المسار إلى جمهور مشابه وحملة.",
        seoTitle: "الجمهور المشابه: جد عملاء مثل أفضل عملائك | يولياس", seoDescription: "أنشئ جمهورًا مشابهًا من عملائك واجتماعاتك، وشغّله كحملة في يولياس خطوة بخطوة.",
        used: [
          { name: "الجماهير", role: "جمهور مشابه من الأشخاص الذين نجحوا معك." },
          { name: "الحملات", role: "تشغّل الجمهور بميزانيته ونتائجه." },
          { name: "الاجتماعات", role: "النتيجة التي تقارن بها." },
        ],
        problem: [
          "بعد عدد من العملاء الجيدين، تعود معظم الأعمال إلى البحث من الصفر. وما يجمع هؤلاء العملاء يبقى في رأس المؤسس.",
          "وهذا يكلف مرتين: تصل الميزانية إلى من لا يشبهون مشتريك، وتبقى الأنماط التي دفعت ثمن تعلمها بلا استخدام.",
          "الفكرة أن تبدأ مما نجح: السمات المشتركة بين أفضل عملائك، موسعة بالقدر الذي تختاره.",
        ],
        how: ["اختر الأساس.", "راجع السمات المشتركة.", "احفظ الجمهور المشابه.", "استخدمه في حملة.", "قارنه بجماهيرك الأخرى."],
        steps: [
          { title: "أنشئ الجمهور المشابه", where: "الجماهير ← إنشاء جمهور", shot: "lookalike", body: ["اختر جمهور مشابه ثم الأساس: مثل من حجزوا اجتماعات أو جمهورًا مخصصًا من عملائك. الأساس الأكبر يعطي سمات أوضح."], result: "يعرض يولياس السمات المشتركة في الأساس." },
          { title: "احفظه", where: "النافذة نفسها", shot: "audiences", body: ["اختر مدى التوسيع، وسمِّ الجمهور واحفظه. إنشاء جمهور لا يتواصل مع أحد."], result: "يظهر الجمهور في الجماهير." },
          { title: "استخدمه في حملة", where: "الحملات ← إنشاء حملة ← الجمهور", shot: "audience", body: ["في الأشخاص اختر استخدام جمهور محفوظ وحدده. تُكتشف الشركات الجديدة المشابهة أثناء عمل الحملة."], result: "يظهر الجمهور في الحملة." },
          { title: "قارنه", where: "صفحة الحملة", shot: "campaign", body: ["أضف جمهورًا ثانيًا باستهداف عادي في الحملة نفسها، وشغّلها، وقارن تكلفة الاجتماع بينهما."], result: "ترى هل يتفوق الجمهور المشابه على استهدافك المعتاد." },
        ],
        act: ["امنح الجمهور الفائز ميزانية أكبر.", "أعد بناء الجمهور كلما زادت اجتماعاتك: الأساس الأكبر يعطي سمات أوضح."],
      },
    },
  },
  {
    slug: "buying-intent", status: "published", updated: "2026-11-05", category: "find",
    related: ["find-decision-makers", "icp-company-search"],
    help: [help("/help-center/audiences", "Audiences", "الجماهير"), help("/help-center/creating-a-campaign", "Creating a campaign", "إنشاء حملة")],
    text: {
      en: {
        name: "Companies showing buying intent", title: "Reach companies while they need what you sell",
        lead: "A company that is hiring, raising money or looking for a service is easier to reach this month than next year. This workflow targets those signals.",
        seoTitle: "Find Companies Showing Buying Intent, Step by Step | Yolias", seoDescription: "Use buying intent, hiring and funding signals to build an audience, then run it as a campaign in Yolias.",
        used: [
          { name: "Audiences", role: "The Signals section: Buying intent, Hiring now, Funding stage, Technologies and Keywords." },
          { name: "Leads", role: "The companies found, with their source, campaign and status." },
          { name: "Campaigns", role: "Runs each signal as its own audience and compares them." },
        ],
        problem: [
          "Timing decides most sales. The same company that ignores you today answers in the week it starts hiring a sales team or opens a new branch.",
          "Without signals, every company on a list looks equal, so budget is spread across companies with no reason to buy now.",
          "The idea is to describe the moment, not only the company: what they need now, and the signs that show it.",
        ],
        how: ["Describe what they need now.", "Add the signals that show it.", "Give each signal its own audience.", "Launch and compare."],
        steps: [
          { title: "Create the campaign", where: "Campaigns → Create campaign", shot: "builder", body: ["Enter your offer, the Meetings objective and a budget of at least $5."], result: "The summary shows the people your budget reaches." },
          { title: "Add the signals", where: "The Audience step → Signals", shot: "signals", body: ["In Buying intent, write what they need now, for example: looking for a new accounting system. Turn on Hiring now if a hiring company fits your offer. Funding stage appears only where the data has it.", "Signals narrow the audience, so keep location and industry broad enough."], result: "The audience shows its matching companies and people." },
          { title: "Compare two signals", where: "The Audience step → Add audience", shot: "audience", body: ["Duplicate the audience and change one signal, such as hiring against funding, so the campaign shows which one brings replies."], result: "Two audiences appear in the campaign." },
          { title: "Launch and read", where: "The Message step, then the campaign page", shot: "campaign", body: ["Confirm and choose Launch campaign. On the campaign page compare Replies, Interested and Meetings by audience."], result: "You can see which signal works in your market." },
        ],
        act: ["Move budget to the signal that brings meetings.", "Save it as an audience for your next campaign.", "Mention the reason you wrote in the Notes for Yolias."],
      },
      ar: {
        name: "شركات تُظهر نية الشراء", title: "صِل إلى الشركات وقت حاجتها لما تبيعه",
        lead: "الشركة التي توظّف أو تجمع تمويلًا أو تبحث عن خدمة أسهل في الوصول هذا الشهر منها بعد عام. يستهدف هذا المسار تلك الإشارات.",
        seoTitle: "جد الشركات التي تُظهر نية الشراء خطوة بخطوة | يولياس", seoDescription: "استخدم إشارات نية الشراء والتوظيف والتمويل لبناء جمهور، وشغّله كحملة في يولياس.",
        used: [
          { name: "الجماهير", role: "قسم الإشارات: نية الشراء، وتوظّف الآن، ومرحلة التمويل، والتقنيات، والكلمات المفتاحية." },
          { name: "العملاء", role: "الشركات التي وُجدت مع مصدرها وحملتها وحالتها." },
          { name: "الحملات", role: "تشغّل كل إشارة كجمهور وتقارن بينها." },
        ],
        problem: [
          "التوقيت يحسم معظم المبيعات. الشركة التي تتجاهلك اليوم ترد في الأسبوع الذي تبدأ فيه توظيف فريق مبيعات أو تفتح فرعًا جديدًا.",
          "من دون إشارات تبدو كل الشركات متساوية، فتتوزع الميزانية على شركات ليس لديها سبب للشراء الآن.",
          "الفكرة أن تصف اللحظة لا الشركة فقط: ما تحتاجه الآن، والعلامات التي تدل عليه.",
        ],
        how: ["صف ما يحتاجونه الآن.", "أضف الإشارات الدالة عليه.", "اجعل لكل إشارة جمهورًا.", "شغّل وقارن."],
        steps: [
          { title: "أنشئ الحملة", where: "الحملات ← إنشاء حملة", shot: "builder", body: ["أدخل عرضك وهدف الاجتماعات وميزانية لا تقل عن 5 دولارات."], result: "يعرض الملخص عدد من تصل إليهم ميزانيتك." },
          { title: "أضف الإشارات", where: "خطوة الجمهور ← الإشارات", shot: "signals", body: ["في نية الشراء اكتب ما يحتاجونه الآن، مثل: يبحثون عن نظام محاسبة جديد. فعّل توظّف الآن إذا كان عرضك يناسب الشركات الموظِّفة. وتظهر مرحلة التمويل حيث تتوفر البيانات.", "الإشارات تضيّق الجمهور، فاترك الموقع والمجال واسعين بما يكفي."], result: "يعرض الجمهور الشركات والأشخاص المطابقين." },
          { title: "قارن إشارتين", where: "خطوة الجمهور ← إضافة جمهور", shot: "audience", body: ["كرر الجمهور وغيّر إشارة واحدة، مثل التوظيف مقابل التمويل، لتعرض الحملة أيهما يأتي بالردود."], result: "يظهر جمهوران في الحملة." },
          { title: "شغّل واقرأ", where: "خطوة الرسالة ثم صفحة الحملة", shot: "campaign", body: ["أكّد واختر تشغيل الحملة. وفي صفحة الحملة قارن الردود والمهتمين والاجتماعات لكل جمهور."], result: "ترى أي إشارة تنجح في سوقك." },
        ],
        act: ["وجّه الميزانية إلى الإشارة التي تأتي بالاجتماعات.", "احفظها كجمهور لحملتك التالية.", "اذكر السبب في ملاحظات يولياس."],
      },
    },
  },
  {
    slug: "icp-company-search", status: "published", updated: "2026-11-05", category: "find", template: "/templates/companies-by-size",
    related: ["buying-intent", "find-decision-makers"],
    help: [help("/help-center/audiences", "Audiences", "الجماهير"), help("/docs/customer-profile", "Customer profile", "ملف العميل")],
    text: {
      en: {
        name: "Companies that match your ideal customer", title: "Turn your ideal customer into a list you can reach",
        lead: "Knowing your ideal customer is half the work. This workflow turns that description into an audience with real companies and people.",
        seoTitle: "Find Companies Matching Your Ideal Customer Profile | Yolias", seoDescription: "Turn your ideal customer profile into targeting: location, industry, size and titles, then review the companies Yolias finds.",
        used: [
          { name: "Company Knowledge", role: "Your ideal customer, in your words." },
          { name: "Audiences", role: "Targeting by location, industry, company type, size and job title." },
          { name: "Leads", role: "Every company found, with its people." },
        ],
        problem: [
          "Most ideal customer descriptions live in a slide. Turning them into a real list takes days of searching, and the list is out of date by the time it's ready.",
          "A vague description gives a wide list, and wide lists are expensive: you pay to reach people who could never buy.",
          "The idea is to write the description as filters, then let the audience size tell you if it is too wide or too narrow.",
        ],
        how: ["Write who your ideal customer is.", "Translate it into targeting.", "Check the audience size.", "Launch and review the companies found."],
        steps: [
          { title: "Write your ideal customer", where: "Company Knowledge", shot: "knowledge", body: ["Describe who buys from you and why. Yolias uses this in every email and in Build with Yolias."], result: "Company Knowledge shows how complete it is." },
          { title: "Set the targeting", where: "Campaigns → Create campaign → Audience", shot: "audience", body: ["Under Locations pick countries and cities. Under Companies pick the industry and size. Under People add job titles. Inside a field Yolias matches any value; across fields, all of them."], result: "A check shows the matching companies and people." },
          { title: "Launch", where: "The Message step", shot: "message", body: ["Choose Send from, confirm and choose Launch campaign."], result: "The campaign is running." },
          { title: "Review the companies", where: "Leads → Companies", shot: "companies", body: ["Check who was found. Open a company to see its details and its people."], result: "The Companies tab lists each company with its source, campaign and status." },
        ],
        act: ["Refine the targeting from what you saw.", "Exclude companies under Exclusions.", "Save the audience for later campaigns."],
      },
      ar: {
        name: "شركات تطابق عميلك المثالي", title: "حوّل عميلك المثالي إلى قائمة تصل إليها",
        lead: "معرفة عميلك المثالي نصف العمل. يحوّل هذا المسار الوصف إلى جمهور بشركات وأشخاص حقيقيين.",
        seoTitle: "جد الشركات المطابقة لعميلك المثالي | يولياس", seoDescription: "حوّل ملف عميلك المثالي إلى استهداف: الموقع والمجال والحجم والمسميات، وراجع الشركات التي يجدها يولياس.",
        used: [
          { name: "معرفة الشركة", role: "عميلك المثالي بكلماتك." },
          { name: "الجماهير", role: "الاستهداف حسب الموقع والمجال ونوع الشركة والحجم والمسمى." },
          { name: "العملاء", role: "كل شركة وُجدت مع أشخاصها." },
        ],
        problem: [
          "معظم أوصاف العميل المثالي تعيش في عرض تقديمي. وتحويلها إلى قائمة حقيقية يأخذ أيامًا من البحث، وتصبح القائمة قديمة عند اكتمالها.",
          "الوصف الغامض يعطي قائمة واسعة، والقوائم الواسعة مكلفة: تدفع للوصول إلى من لن يشتروا.",
          "الفكرة أن تكتب الوصف كفلاتر، ثم يخبرك حجم الجمهور هل هو واسع أو ضيق.",
        ],
        how: ["اكتب من هو عميلك المثالي.", "حوّله إلى استهداف.", "راجع حجم الجمهور.", "شغّل وراجع الشركات."],
        steps: [
          { title: "اكتب عميلك المثالي", where: "معرفة الشركة", shot: "knowledge", body: ["صف من يشتري منك ولماذا. يستخدم يولياس ذلك في كل رسالة وفي أنشئ مع يولياس."], result: "تعرض معرفة الشركة نسبة اكتمالها." },
          { title: "اضبط الاستهداف", where: "الحملات ← إنشاء حملة ← الجمهور", shot: "audience", body: ["في المواقع اختر الدول والمدن، وفي الشركات اختر المجال والحجم، وفي الأشخاص أضف المسميات. داخل الحقل الواحد يكفي أي قيمة، وبين الحقول يجب أن تتحقق كلها."], result: "يعرض الفحص الشركات والأشخاص المطابقين." },
          { title: "شغّل الحملة", where: "خطوة الرسالة", shot: "message", body: ["اختر الإرسال من، وأكّد، واختر تشغيل الحملة."], result: "الحملة تعمل." },
          { title: "راجع الشركات", where: "العملاء ← الشركات", shot: "companies", body: ["راجع من وُجد. وافتح شركة لترى تفاصيلها وأشخاصها."], result: "يعرض تبويب الشركات كل شركة بمصدرها وحملتها وحالتها." },
        ],
        act: ["حسّن الاستهداف مما رأيته.", "استبعد الشركات في الاستبعادات.", "احفظ الجمهور للحملات القادمة."],
      },
    },
  },
  {
    slug: "local-business-leads", status: "published", updated: "2026-11-05", category: "find", template: "/templates/companies-by-location",
    related: ["find-clients", "icp-company-search"],
    help: [help("/help-center/audiences", "Audiences", "الجماهير"), help("/help-center/connect-imap-smtp", "Connecting another mailbox", "ربط بريد آخر")],
    text: {
      en: {
        name: "Local businesses in your city", title: "Reach local businesses in the cities you serve",
        lead: "Clinics, restaurants, gyms and salons are rarely in business databases. This workflow finds them by city and contacts them.",
        seoTitle: "Find Local Business Leads by City, Step by Step | Yolias", seoDescription: "Find local businesses by city and category, then contact them with a campaign in Yolias.",
        used: [
          { name: "Audiences", role: "Countries, regions and cities, with the business category." },
          { name: "Leads", role: "Each business found, with its website and contact details where public." },
          { name: "Campaigns", role: "One audience per city, to compare them." },
        ],
        problem: [
          "Selling to local businesses usually means walking, calling or buying a list that is mostly closed shops.",
          "Their owners answer their own phone and email, so one good message reaches the person who decides, if you can find them.",
          "The idea is to work city by city, and let results show which city is worth the budget.",
        ],
        how: ["Pick the cities and the category.", "Make one audience per city.", "Launch.", "Compare cities."],
        steps: [
          { title: "Create the campaign", where: "Campaigns → Create campaign", shot: "builder", body: ["Write an offer a shop owner understands in one line, and set a budget."], result: "The summary shows the reach of your budget." },
          { title: "Pick the place", where: "The Audience step → Locations", shot: "audience", body: ["Search the country, then include its cities. Add the category under Companies, such as dental clinics. Add one audience for each city with Add audience."], result: "Each audience shows its matches." },
          { title: "Launch", where: "The Message step", shot: "message", body: ["Choose the language and tone your market expects, confirm and choose Launch campaign."], result: "The campaign is running." },
          { title: "Compare the cities", where: "The campaign page", shot: "campaign", body: ["Read replies and meetings per audience, and see today's budget split."], result: "You can see which city answers." },
        ],
        act: ["Pause the weak city.", "Add the next city as a new audience."],
      },
      ar: {
        name: "الأنشطة المحلية في مدينتك", title: "صِل إلى الأنشطة المحلية في المدن التي تخدمها",
        lead: "العيادات والمطاعم والصالات والصالونات نادرًا ما تكون في قواعد البيانات. يجدها هذا المسار حسب المدينة ويتواصل معها.",
        seoTitle: "جد الأنشطة المحلية حسب المدينة خطوة بخطوة | يولياس", seoDescription: "جد الأنشطة المحلية حسب المدينة والفئة، وتواصل معها بحملة في يولياس.",
        used: [
          { name: "الجماهير", role: "الدول والمناطق والمدن مع فئة النشاط." },
          { name: "العملاء", role: "كل نشاط وُجد مع موقعه وبيانات التواصل المعلنة." },
          { name: "الحملات", role: "جمهور لكل مدينة للمقارنة." },
        ],
        problem: [
          "البيع للأنشطة المحلية يعني عادة المشي أو الاتصال أو شراء قائمة معظمها محلات مغلقة.",
          "أصحابها يردون بأنفسهم، فالرسالة الجيدة تصل إلى من يقرر، إذا استطعت إيجادهم.",
          "الفكرة أن تعمل مدينة بمدينة، وتدع النتائج تقول أي مدينة تستحق الميزانية.",
        ],
        how: ["اختر المدن والفئة.", "جمهور لكل مدينة.", "شغّل.", "قارن المدن."],
        steps: [
          { title: "أنشئ الحملة", where: "الحملات ← إنشاء حملة", shot: "builder", body: ["اكتب عرضًا يفهمه صاحب المحل في سطر، وحدد ميزانية."], result: "يعرض الملخص وصول ميزانيتك." },
          { title: "اختر المكان", where: "خطوة الجمهور ← المواقع", shot: "audience", body: ["ابحث عن الدولة ثم أضف مدنها. وأضف الفئة في الشركات، مثل عيادات الأسنان. وأضف جمهورًا لكل مدينة بزر إضافة جمهور."], result: "يعرض كل جمهور مطابقاته." },
          { title: "شغّل الحملة", where: "خطوة الرسالة", shot: "message", body: ["اختر اللغة والأسلوب المناسبين لسوقك، وأكّد، واختر تشغيل الحملة."], result: "الحملة تعمل." },
          { title: "قارن المدن", where: "صفحة الحملة", shot: "campaign", body: ["اقرأ الردود والاجتماعات لكل جمهور، وشاهد توزيع ميزانية اليوم."], result: "ترى أي مدينة ترد." },
        ],
        act: ["أوقف المدينة الضعيفة.", "أضف المدينة التالية كجمهور جديد."],
      },
    },
  },
  {
    slug: "ai-prospecting", status: "published", updated: "2026-11-05", category: "convert",
    related: ["find-clients", "buying-intent"],
    help: [help("/help-center/yolias-ai", "Yolias AI", "Yolias AI"), help("/help-center/conversations", "Conversations", "المحادثات"), help("/help-center/deals-and-meetings", "Meetings and deals", "الاجتماعات والصفقات")],
    text: {
      en: {
        name: "From first email to booked meeting", title: "Let Yolias AI run the path from first email to booked meeting",
        lead: "Finding people is the easy half. This workflow covers what happens after: replies, objections, follow-ups and the booking.",
        seoTitle: "AI Customer Acquisition: From First Email to Booked Meeting | Yolias", seoDescription: "How Yolias AI follows up, answers replies and books meetings, step by step, with you in control.",
        used: [
          { name: "Yolias AI", role: "Writes, follows up and answers from your Company Knowledge." },
          { name: "Conversations", role: "Every thread, and those that need you." },
          { name: "Meetings", role: "Your booking page and booked meetings." },
          { name: "Google Calendar", role: "Bookings land on your calendar." },
        ],
        problem: [
          "Most deals are lost in the days after the first reply. A slow answer, a missed follow-up or a booking back-and-forth is enough.",
          "Following up by hand doesn't scale past a few conversations a day, and the busiest day is the day it gets dropped.",
          "The idea is to let Yolias handle the routine replies and hand you the ones that need a person.",
        ],
        how: ["Set your booking page.", "Launch a meetings campaign.", "Yolias follows up twice and answers.", "You take the conversations that need you."],
        steps: [
          { title: "Set your booking page", where: "Meetings", shot: "meetings", body: ["Set your hours, the meeting length and the place. People who are interested book here."], result: "Your booking link is ready." },
          { title: "Launch the campaign", where: "Campaigns → Create campaign", shot: "message", body: ["Yolias follows up twice when there's no reply, in your hours."], result: "The campaign is running." },
          { title: "Read Conversations", where: "Conversations", shot: "inbox", body: ["Yolias answers questions from your Company Knowledge and offers two free times and your booking page to interested people. Tag conversations to find them later."], result: "Every reply is listed, with Needs you on those waiting for you." },
          { title: "Take the handoffs", where: "Conversations → Needs you", shot: "inbox", body: ["Complaints, negotiations and questions Yolias can't answer stop and wait. Reply with text, files or a voice note."], result: "The conversation leaves Needs you." },
          { title: "See the meeting", where: "Meetings", shot: "meetings", body: ["Booked meetings appear with who they are and which campaign brought them."], result: "The meeting is listed, and on your calendar when Google Calendar is connected." },
        ],
        act: ["Mark whether the meeting was held.", "Mark deals won or lost, so Yolias learns.", "Read cost per meeting in the campaign."],
      },
      ar: {
        name: "من أول رسالة إلى اجتماع محجوز", title: "دع Yolias AI يدير الطريق من أول رسالة إلى الاجتماع",
        lead: "إيجاد الأشخاص هو النصف السهل. يغطي هذا المسار ما يأتي بعده: الردود والاعتراضات والمتابعات والحجز.",
        seoTitle: "اكتساب العملاء بالذكاء الاصطناعي: من أول رسالة إلى الاجتماع | يولياس", seoDescription: "كيف يتابع Yolias AI ويرد ويحجز الاجتماعات خطوة بخطوة، والتحكم بيدك.",
        used: [
          { name: "Yolias AI", role: "يكتب ويتابع ويجيب من معرفة شركتك." },
          { name: "المحادثات", role: "كل محادثة، وما يحتاجك منها." },
          { name: "الاجتماعات", role: "صفحة الحجز والاجتماعات المحجوزة." },
          { name: "تقويم Google", role: "تصل الحجوزات إلى تقويمك." },
        ],
        problem: [
          "تضيع معظم الصفقات في الأيام التي تلي الرد الأول. يكفي رد بطيء أو متابعة منسية أو ذهاب وعودة حول الموعد.",
          "المتابعة اليدوية لا تتسع لأكثر من محادثات قليلة يوميًا، وأكثر الأيام انشغالًا هو يوم ضياعها.",
          "الفكرة أن يتولى يولياس الردود المعتادة ويسلمك ما يحتاج إلى شخص.",
        ],
        how: ["اضبط صفحة الحجز.", "شغّل حملة اجتماعات.", "يتابع يولياس مرتين ويرد.", "تتولى ما يحتاجك."],
        steps: [
          { title: "اضبط صفحة الحجز", where: "الاجتماعات", shot: "meetings", body: ["حدد ساعاتك ومدة الاجتماع والمكان. يحجز المهتمون من هنا."], result: "رابط الحجز جاهز." },
          { title: "شغّل الحملة", where: "الحملات ← إنشاء حملة", shot: "message", body: ["يتابع يولياس مرتين إذا لم يصل رد، في ساعاتك."], result: "الحملة تعمل." },
          { title: "اقرأ المحادثات", where: "المحادثات", shot: "inbox", body: ["يجيب يولياس عن الأسئلة من معرفة شركتك، ويعرض وقتين متاحين وصفحة الحجز على المهتمين. أضف تاجات للمحادثات لتجدها لاحقًا."], result: "يظهر كل رد، مع علامة على ما ينتظرك." },
          { title: "تولَّ ما يُسلَّم لك", where: "المحادثات", shot: "inbox", body: ["الشكاوى والتفاوض والأسئلة التي لا يستطيع يولياس إجابتها تتوقف وتنتظرك. رد بنص أو ملفات أو تسجيل صوتي."], result: "تخرج المحادثة من قائمة ما ينتظرك." },
          { title: "شاهد الاجتماع", where: "الاجتماعات", shot: "meetings", body: ["تظهر الاجتماعات المحجوزة مع صاحبها والحملة التي جاءت به."], result: "يظهر الاجتماع، وفي تقويمك عند ربط تقويم Google." },
        ],
        act: ["حدد هل عُقد الاجتماع.", "حدد الصفقات المكسوبة والخاسرة ليتعلم يولياس.", "اقرأ تكلفة الاجتماع في الحملة."],
      },
    },
  },
];

export const workflowOf = (slug: string) => workflows.find((w) => w.slug === slug && w.status === "published") ?? null;
