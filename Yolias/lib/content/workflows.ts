import type { Localized } from "./types";

// Use cases as working guides (owner, 2026-11-05): each page takes a visitor
// from a business problem to a running workflow in Yolias. A new one is one
// entry here. Only what Yolias does today, with its real button names; `shot`
// is a real screenshot in public/use-cases/<shot>-<locale>.png.

export type WorkflowShot = "campaigns" | "audience" | "message" | "leads" | "inbox" | "meetings" | "audiences";

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
  en: { used: "What we used", resources: "Free resources", template: "Open the ready-made template", before: "Before we begin", how: "How it works", steps: "Step by step", step: "Step", where: "Where", result: "What you should see", act: "Act on the results", related: "Related resources", start: "Start building now", ready: "Run this workflow in Yolias", readyLead: "Sign up free, build the campaign and pay when you launch it, from $5.", updated: "Updated", example: "Screenshot from Yolias with sample data" },
  ar: { used: "ما استخدمناه", resources: "موارد مجانية", template: "افتح القالب الجاهز", before: "قبل أن نبدأ", how: "كيف يعمل", steps: "خطوة بخطوة", step: "الخطوة", where: "المكان", result: "ما يجب أن تراه", act: "ماذا تفعل بالنتائج", related: "موارد ذات صلة", start: "ابدأ البناء الآن", ready: "نفّذ هذا المسار في يولياس", readyLead: "سجّل مجانًا، وابنِ الحملة، وادفع عند إطلاقها من 5 دولارات.", updated: "آخر تحديث", example: "لقطة من يولياس ببيانات توضيحية" },
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
          { title: "Describe your agency", where: "Company Knowledge in the sidebar", shot: "campaigns", body: ["Add your services, the clients you serve best, and one or two results you can stand behind. Yolias uses only what you write here, so anything you leave out won't appear in an email."], result: "The page shows how complete your Company Knowledge is." },
          { title: "Connect your mailbox", where: "Integrations", shot: "message", body: ["Open Gmail or IMAP/SMTP mailbox, choose Connect and finish the steps. Use an address on a domain you can send from, with a daily limit you are comfortable with."], result: "The integration shows 1 active." },
          { title: "Create the campaign", where: "Campaigns → Create campaign", shot: "campaigns", body: ["Choose Build with Yolias to fill the whole campaign from your Company Knowledge, or enter it yourself: the name, the Meetings objective, your offer, the number of meetings you want and a budget of at least $5.", "The summary box shows how many people the budget reaches, how long it takes, and the replies and meetings to expect."], result: "The summary shows a forecast for your budget." },
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
          { title: "صف وكالتك", where: "معرفة الشركة في الشريط الجانبي", shot: "campaigns", body: ["أضف خدماتك والعملاء الذين تخدمهم أفضل، ونتيجة أو نتيجتين تثق بهما. يستخدم يولياس ما تكتبه هنا فقط، فما لا تكتبه لن يظهر في أي رسالة."], result: "تعرض الصفحة نسبة اكتمال معرفة الشركة." },
          { title: "اربط بريدك", where: "التكاملات", shot: "message", body: ["افتح Gmail أو بريد IMAP/SMTP، واختر اربط وأكمل الخطوات. استخدم عنوانًا على نطاق تستطيع الإرسال منه، بحد يومي مناسب لك."], result: "يعرض التكامل 1 نشط." },
          { title: "أنشئ الحملة", where: "الحملات ← إنشاء حملة", shot: "campaigns", body: ["اختر أنشئ مع يولياس ليملأ الحملة كاملة من معرفة شركتك، أو أدخلها بنفسك: الاسم، وهدف الاجتماعات، وعرضك، وعدد الاجتماعات، وميزانية لا تقل عن 5 دولارات.", "يعرض صندوق الملخص عدد من تصل إليهم الميزانية والمدة والردود والاجتماعات المتوقعة."], result: "يعرض الملخص توقعًا لميزانيتك." },
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
          { title: "Create the campaign", where: "Campaigns → Create campaign", shot: "campaigns", body: ["Enter your offer and budget. Budget is split between audiences, so allow enough for each one: the summary shows how many people it reaches."], result: "The campaign is saved when you choose Save draft." },
          { title: "One audience per title", where: "The Audience step", shot: "audience", body: ["Name the first audience Owners and add its job titles. Choose Add audience for Sales leaders and again for Marketing leaders. Keep location, industry and company size the same in each, so the title is the only difference."], result: "Each audience shows its matching companies and people." },
          { title: "Launch", where: "The Message step", shot: "message", body: ["Choose your mailbox, tone and language, review the openings, confirm and choose Launch campaign."], result: "Yolias starts finding people for each audience within the budget." },
          { title: "Check who it found", where: "Leads → People", shot: "leads", body: ["The People tab lists each person with their title, company, source, campaign and status. Filter by the campaign to see this one only."], result: "You see real titles and companies in the campaign." },
          { title: "Compare the titles", where: "The campaign page", shot: "campaigns", body: ["Read Reached, Replies, Interested and Meetings for each audience. Give it time: a title needs enough people reached before its numbers mean something."], result: "You can see which title brings replies and meetings." },
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
          { title: "أنشئ الحملة", where: "الحملات ← إنشاء حملة", shot: "campaigns", body: ["أدخل عرضك وميزانيتك. تُقسم الميزانية بين الجماهير، فاترك ما يكفي لكل جمهور: يعرض الملخص عدد من تصل إليهم."], result: "تُحفظ الحملة عند اختيار حفظ كمسودة." },
          { title: "جمهور لكل مسمى", where: "خطوة الجمهور", shot: "audience", body: ["سمِّ الجمهور الأول الملاك وأضف مسمياته. اختر إضافة جمهور لقادة المبيعات، ثم لقادة التسويق. أبقِ الموقع والمجال وحجم الشركة كما هي، ليكون المسمى هو الفرق الوحيد."], result: "يعرض كل جمهور الشركات والأشخاص المطابقين." },
          { title: "شغّل الحملة", where: "خطوة الرسالة", shot: "message", body: ["اختر البريد والأسلوب واللغة، وراجع الافتتاحيات، وأكّد، ثم اختر تشغيل الحملة."], result: "يبدأ يولياس إيجاد الأشخاص لكل جمهور في حدود الميزانية." },
          { title: "راجع من وجدهم", where: "العملاء ← الأشخاص", shot: "leads", body: ["يعرض تبويب الأشخاص كل شخص بمسماه وشركته ومصدره وحملته وحالته. صفِّ حسب الحملة لتراها وحدها."], result: "ترى مسميات وشركات حقيقية في الحملة." },
          { title: "قارن المسميات", where: "صفحة الحملة", shot: "campaigns", body: ["اقرأ وصلت إليهم والردود والمهتمين والاجتماعات لكل جمهور. امنحها وقتًا: يحتاج المسمى إلى عدد كافٍ من الأشخاص قبل أن تعني أرقامه شيئًا."], result: "ترى أي مسمى يأتي بالردود والاجتماعات." },
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
          { title: "Create the lookalike audience", where: "Audiences → Create audience", shot: "audiences", body: ["Choose Lookalike audience, then the base: for example people who booked meetings, or a custom audience of your customers. A base with more people gives clearer traits."], result: "Yolias lists the traits the base shares." },
          { title: "Save it", where: "The same window", shot: "audiences", body: ["Choose how far to widen it, name the audience and save it. Building an audience never contacts anyone."], result: "The audience appears in Audiences." },
          { title: "Use it in a campaign", where: "Campaigns → Create campaign → Audience", shot: "audience", body: ["Under People choose Use a saved audience and pick it. New companies like the ones that work for you are found while the campaign runs."], result: "The audience shows in the campaign." },
          { title: "Compare it", where: "The campaign page", shot: "campaigns", body: ["Add a second audience with ordinary targeting in the same campaign, launch, and compare the cost per meeting of both."], result: "You can see whether the lookalike beats your usual targeting." },
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
          { title: "أنشئ الجمهور المشابه", where: "الجماهير ← إنشاء جمهور", shot: "audiences", body: ["اختر جمهور مشابه ثم الأساس: مثل من حجزوا اجتماعات أو جمهورًا مخصصًا من عملائك. الأساس الأكبر يعطي سمات أوضح."], result: "يعرض يولياس السمات المشتركة في الأساس." },
          { title: "احفظه", where: "النافذة نفسها", shot: "audiences", body: ["اختر مدى التوسيع، وسمِّ الجمهور واحفظه. إنشاء جمهور لا يتواصل مع أحد."], result: "يظهر الجمهور في الجماهير." },
          { title: "استخدمه في حملة", where: "الحملات ← إنشاء حملة ← الجمهور", shot: "audience", body: ["في الأشخاص اختر استخدام جمهور محفوظ وحدده. تُكتشف الشركات الجديدة المشابهة أثناء عمل الحملة."], result: "يظهر الجمهور في الحملة." },
          { title: "قارنه", where: "صفحة الحملة", shot: "campaigns", body: ["أضف جمهورًا ثانيًا باستهداف عادي في الحملة نفسها، وشغّلها، وقارن تكلفة الاجتماع بينهما."], result: "ترى هل يتفوق الجمهور المشابه على استهدافك المعتاد." },
        ],
        act: ["امنح الجمهور الفائز ميزانية أكبر.", "أعد بناء الجمهور كلما زادت اجتماعاتك: الأساس الأكبر يعطي سمات أوضح."],
      },
    },
  },
];

export const workflowOf = (slug: string) => workflows.find((w) => w.slug === slug && w.status === "published") ?? null;
