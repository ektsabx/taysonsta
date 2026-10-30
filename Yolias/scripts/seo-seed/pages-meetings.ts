import { CTA, type SeedPage } from "./types.ts";

// Meetings pages (owner, 2026-10-30, D-268): Yolias vs the scheduling tools
// (Calendly, Cal.com, Chili Piper, SavvyCal, TidyCal), Calendly alternatives,
// and two pages about booking sales meetings. A scheduler books the meeting
// someone already wants; Yolias also finds the people and writes to them, and
// its booking page comes with every plan. Their prices are as their own
// pricing pages showed them on 30 October 2026 (sources listed); Yolias's
// limits are said plainly: one booking page per member with up to four meeting
// types, no team scheduling, Google Calendar only (D-269: busy times from the
// main Google Calendar are read, so they're never offered).

type L = { en: string; ar: string };
type Row = "what" | "find" | "reach" | "book" | "calendar" | "team" | "price";
const labels: Record<Row, L> = {
  what: { en: "What it is", ar: "ما هو" },
  find: { en: "Finding who to meet", ar: "إيجاد من تقابلهم" },
  reach: { en: "Reaching them", ar: "التواصل معهم" },
  book: { en: "Booking page", ar: "صفحة الحجز" },
  calendar: { en: "Calendar and video", ar: "التقويم والفيديو" },
  team: { en: "Teams and routing", ar: "الفرق وتوزيع الاجتماعات" },
  price: { en: "Price", ar: "السعر" },
};
const rows: Row[] = ["what", "find", "reach", "book", "calendar", "team", "price"];

const Y: Record<Exclude<Row, "price" | "team">, L> = {
  what: { en: "An AI sales agent: finds matching companies and decision makers, emails them from your mailbox, and books the meeting", ar: "وكيل مبيعات بالذكاء الاصطناعي: يجد الشركات وصنّاع القرار المطابقين، ويراسلهم من بريدك، ويحجز الاجتماع" },
  find: { en: "You describe your ideal customer in a sentence, in Arabic or English, and Yolias finds them with a match score", ar: "تصف عميلك المثالي في جملة، بالعربية أو الإنجليزية، فيجدهم يولياس مع نسبة تطابق" },
  reach: { en: "Writes the first email and follow-ups and sends them from your Gmail or company mailbox after one approval", ar: "يكتب الرسالة الأولى والمتابعات ويرسلها من Gmail أو بريد شركتك بعد موافقة واحدة" },
  book: { en: "Your page at yolias.com/meet/your-name: length, break, notice, booking window and weekly hours; when a lead asks for a meeting, Yolias replies with two free times and the page", ar: "صفحتك على yolias.com/meet/اسمك: المدة والاستراحة والمهلة ومدة الإتاحة وساعات الأسبوع؛ وعندما يطلب العميل اجتماعًا يرد يولياس بموعدين متاحين والصفحة" },
  calendar: { en: "Google Calendar: busy times in your main calendar are never offered; each booking goes to a calendar Yolias creates, with a Google Meet link and Google's invitation; email reminder an hour before", ar: "تقويم Google: أوقات انشغالك في تقويمك الرئيسي لا تُعرض أبدًا؛ وكل حجز يُضاف إلى تقويم ينشئه يولياس، برابط Google Meet ودعوة من Google؛ وتذكير بالبريد قبلها بساعة" },
};
const YT: L = { en: "One booking page per member with up to four meeting types, booked one-to-one; no round-robin or routing forms", ar: "صفحة حجز واحدة لكل عضو بحتى أربعة أنواع اجتماعات، والحجز فردي؛ لا توزيع دوري ولا نماذج توجيه" };
const YP = (en: string, ar: string): L => ({ en: `Pay As You Go from $5, or Pro $50 and Growth $100 a month, unlimited users; the booking page is included. ${en}`, ar: `الدفع حسب الاستخدام من 5 دولارات، أو Pro بـ 50 وGrowth بـ 100 دولار شهريًا، ومستخدمون بلا حد؛ وصفحة الحجز مشمولة. ${ar}` });

const limits: L[] = [
  { en: "Yolias reads busy times from your main Google Calendar only; events in other calendars (Outlook, iCloud or a second Google calendar) aren't seen.", ar: "يقرأ يولياس أوقات الانشغال من تقويم Google الرئيسي فقط؛ ولا يرى مواعيد التقويمات الأخرى (Outlook أو iCloud أو تقويم Google ثانٍ)." },
  { en: "Google Calendar only; no Outlook or iCloud calendar yet.", ar: "تقويم Google فقط؛ لا Outlook ولا iCloud حتى الآن." },
  { en: "Up to four meeting types per member: no team pages, round-robin, routing forms, payments or SMS reminders.", ar: "حتى أربعة أنواع اجتماعات لكل عضو: لا صفحات فرق ولا توزيع دوري ولا نماذج توجيه ولا دفع ولا تذكير برسائل SMS." },
];

interface Vs {
  slug: string; name: string; keyword: string; secondary: string[];
  them: Record<Row, L>; yTeam?: L; yPrice: L;
  lead: L; answer: L;
  chooseThem: { en: string[]; ar: string[] }; chooseYolias: { en: string[]; ar: string[] };
  faq: { en: { q: string; a: string }[]; ar: { q: string; a: string }[] };
  sources: string[];
}

function versus(v: Vs): SeedPage {
  const side = (l: "en" | "ar") => ({
    title: l === "en" ? `Yolias vs ${v.name}` : `يولياس مقابل ${v.name}`,
    h1: l === "en" ? `Yolias vs ${v.name}: booking meetings, or getting them?` : `يولياس أم ${v.name}: تحجز الاجتماعات أم تحصل عليها؟`,
    metaTitle: l === "en" ? `Yolias vs ${v.name} for sales meetings` : `يولياس مقابل ${v.name} لاجتماعات المبيعات`,
    metaDescription: l === "en"
      ? `${v.name} books meetings people already want. Yolias finds the people, emails them and books the meeting. Features, prices and limits compared.`
      : `${v.name} يحجز اجتماعات يريدها الناس بالفعل، ويولياس يجد الأشخاص ويراسلهم ويحجز الاجتماع. مقارنة المزايا والأسعار والحدود.`,
    lead: v.lead[l],
    answer: v.answer[l],
    compare: rows.map((r) => ({
      label: labels[r][l],
      yolias: r === "price" ? v.yPrice[l] : r === "team" ? (v.yTeam ?? YT)[l] : Y[r][l],
      them: v.them[r][l],
    })),
    blocks: [
      { h2: l === "en" ? `When ${v.name} is the better choice` : `متى يكون ${v.name} الخيار الأفضل` },
      { ul: v.chooseThem[l] },
      { h2: l === "en" ? "When Yolias is the better choice" : "متى يكون يولياس الخيار الأفضل" },
      { ul: v.chooseYolias[l] },
      { h2: l === "en" ? "What Yolias doesn't do" : "ما الذي لا يفعله يولياس" },
      { ul: limits.map((x) => x[l]) },
    ],
    faq: v.faq[l],
    cta: CTA[l],
  });
  return {
    kind: "compare", slug: v.slug, format: "versus", competitor: v.slug, tools: [v.slug],
    primary_keyword: v.keyword, secondary_keywords: v.secondary,
    links: [
      { path: "/alternatives/calendly", en: "Calendly alternatives", ar: "بدائل Calendly" },
      { path: "/solutions/sales-meeting-booking", en: "Booking sales meetings with AI", ar: "حجز اجتماعات المبيعات بالذكاء الاصطناعي" },
      { path: "/pricing", en: "Yolias pricing", ar: "أسعار يولياس" },
    ],
    sources: v.sources,
    en: side("en"), ar: side("ar"),
  };
}

export const meetingComparePages: SeedPage[] = [
  versus({
    slug: "calendly", name: "Calendly", keyword: "yolias vs calendly", secondary: ["calendly vs yolias", "calendly for sales prospecting", "calendly alternative for sales"],
    lead: {
      en: "Calendly is the best-known scheduling tool: you share a link and people pick a time. It books the meetings people already want. Yolias works one step earlier: it finds the companies you should meet, writes to them, and when they say yes, books the meeting on your own page.",
      ar: "Calendly أشهر أداة جدولة: تشارك رابطًا فيختار الناس موعدًا. هو يحجز الاجتماعات التي يريدها الناس بالفعل. أما يولياس فيعمل قبل ذلك بخطوة: يجد الشركات التي يجب أن تقابلها، ويراسلها، وعندما توافق يحجز الاجتماع في صفحتك.",
    },
    answer: {
      en: "Keep Calendly if your calendar is already full of people who want to meet you and you need team scheduling, routing and payments. Choose Yolias if the problem is getting those meetings in the first place: it finds the prospects, emails them, and its booking page is part of every plan.",
      ar: "احتفظ بـ Calendly إذا كان تقويمك ممتلئًا بأشخاص يريدون مقابلتك وتحتاج جدولة الفرق والتوجيه والدفع. واختر يولياس إذا كانت المشكلة هي الحصول على هذه الاجتماعات أصلًا: فهو يجد العملاء المحتملين ويراسلهم، وصفحة الحجز جزء من كل خطة.",
    },
    them: {
      what: { en: "Scheduling: \"All the work around meetings, handled\" (its homepage), with an AI scheduling assistant and meeting notes", ar: "جدولة: «كل العمل حول الاجتماعات» (من صفحته الرئيسية)، مع مساعد جدولة بالذكاء الاصطناعي وملاحظات الاجتماعات" },
      find: { en: "Not part of the product: it schedules people who already found you", ar: "ليس جزءًا من المنتج: يجدول من وصلوا إليك بالفعل" },
      reach: { en: "Reminders and follow-ups for booked meetings; no cold outreach", ar: "تذكيرات ومتابعات للاجتماعات المحجوزة؛ لا تواصل مع عملاء جدد" },
      book: { en: "Booking pages with one event type on Free and unlimited event types from Standard", ar: "صفحات حجز بنوع حدث واحد في المجانية، وأنواع غير محدودة من Standard" },
      calendar: { en: "One calendar on Free, several from Standard; video and CRM integrations", ar: "تقويم واحد في المجانية وعدة تقويمات من Standard؛ مع تكاملات الفيديو وCRM" },
      team: { en: "Round-robin, team scheduling and lead routing on Teams ($16 a seat a month)", ar: "توزيع دوري وجدولة فرق وتوجيه عملاء في Teams (16 دولارًا للمقعد شهريًا)" },
      price: { en: "Free; Standard $10 and Teams $16 a seat a month; Enterprise from $15k a year (its pricing page, 30 Oct 2026)", ar: "مجانية؛ وStandard بـ 10 وTeams بـ 16 دولارًا للمقعد شهريًا؛ وEnterprise من 15 ألف دولار سنويًا (صفحة أسعاره، 30 أكتوبر 2026)" },
    },
    yPrice: YP("For a team of five, Calendly Teams is $80 a month for scheduling alone.", "لفريق من خمسة، Calendly Teams بـ 80 دولارًا شهريًا للجدولة وحدها."),
    chooseThem: {
      en: ["Inbound demand already fills your calendar and you only need people to pick a time.", "You need team pages, round-robin or routing forms for many reps.", "You take payments or need Outlook and several calendars per person."],
      ar: ["الطلب الوارد يملأ تقويمك وتحتاج فقط أن يختار الناس موعدًا.", "تحتاج صفحات فرق أو توزيعًا دوريًا أو نماذج توجيه لمندوبين كثيرين.", "تحصّل مدفوعات أو تحتاج Outlook وعدة تقويمات لكل شخص."],
    },
    chooseYolias: {
      en: ["Your calendar is empty because nobody knows you yet: you need the meetings, not only the link.", "You want one subscription for finding clients, emailing them and booking, with unlimited users.", "You sell in Arabic or to Egypt and the Gulf and want the booking page and the emails in Arabic."],
      ar: ["تقويمك فارغ لأن أحدًا لا يعرفك بعد: تحتاج الاجتماعات، لا الرابط فقط.", "تريد اشتراكًا واحدًا لإيجاد العملاء ومراسلتهم والحجز، بمستخدمين بلا حد.", "تبيع بالعربية أو في مصر والخليج وتريد صفحة الحجز والرسائل بالعربية."],
    },
    faq: {
      en: [
        { q: "Can Yolias replace Calendly?", a: "For one-to-one sales meetings booked from your outreach, yes: every member has a booking page with weekly hours and up to four meeting types, busy times in Google Calendar are never offered, and bookings go to Google Calendar with a Meet link. For team scheduling, routing, payments or Outlook, keep Calendly." },
        { q: "Is Yolias cheaper than Calendly?", a: "For scheduling alone, Calendly's Standard plan at $10 a seat is cheaper. Yolias costs more than a scheduler because it also finds and emails your prospects; its booking page is included, with unlimited users." },
        { q: "Can I use both?", a: "Yes. Yolias offers its own booking page to leads who ask for a meeting; you can keep Calendly for your other meetings." },
      ],
      ar: [
        { q: "هل يمكن أن يحل يولياس محل Calendly؟", a: "لاجتماعات المبيعات الفردية التي تأتي من تواصلك، نعم: لكل عضو صفحة حجز بساعات أسبوعية وحتى أربعة أنواع اجتماعات، ولا تُعرض أوقات انشغالك في تقويم Google، وتذهب الحجوزات إلى تقويم Google برابط Meet. أما جدولة الفرق والتوجيه والدفع وOutlook فاحتفظ لها بـ Calendly." },
        { q: "هل يولياس أرخص من Calendly؟", a: "للجدولة وحدها، خطة Standard في Calendly بـ 10 دولارات للمقعد أرخص. يولياس أغلى من أداة الجدولة لأنه يجد عملاءك ويراسلهم أيضًا، وصفحة الحجز مشمولة، بمستخدمين بلا حد." },
        { q: "هل يمكن استخدام الاثنين؟", a: "نعم. يقدّم يولياس صفحة الحجز الخاصة به للعملاء الذين يطلبون اجتماعًا، ويمكنك الإبقاء على Calendly لاجتماعاتك الأخرى." },
      ],
    },
    sources: ["https://calendly.com/", "https://calendly.com/pricing"],
  }),
  versus({
    slug: "cal-com", name: "Cal.com", keyword: "yolias vs cal.com", secondary: ["cal.com vs yolias", "cal.com alternative for sales", "cal com for sales meetings"],
    lead: {
      en: "Cal.com is an open scheduling platform with a generous free plan, many apps and team features. Like any scheduler, it waits for people to come. Yolias goes and gets them: it finds matching companies, emails the decision makers and offers your booking page when they're interested.",
      ar: "Cal.com منصة جدولة مفتوحة بخطة مجانية سخية وتطبيقات كثيرة وميزات للفرق. وككل أدوات الجدولة، ينتظر أن يأتي الناس. أما يولياس فيذهب إليهم: يجد الشركات المطابقة، ويراسل صنّاع القرار، ويقدّم صفحة الحجز عندما يهتمون.",
    },
    answer: {
      en: "Pick Cal.com for flexible scheduling, self-hosting, many integrations and team routing. Pick Yolias when you need new sales meetings: it fills the top of the funnel and books the meeting on a page that comes with the plan.",
      ar: "اختر Cal.com لجدولة مرنة واستضافة ذاتية وتكاملات كثيرة وتوجيه للفرق. واختر يولياس عندما تحتاج اجتماعات مبيعات جديدة: فهو يملأ بداية المسار ويحجز الاجتماع في صفحة مشمولة في الخطة.",
    },
    them: {
      what: { en: "Scheduling infrastructure with 100+ apps, routing forms and a mobile app", ar: "بنية جدولة بأكثر من 100 تطبيق ونماذج توجيه وتطبيق للجوال" },
      find: { en: "Not part of the product", ar: "ليس جزءًا من المنتج" },
      reach: { en: "Email and SMS notifications for bookings; no prospecting or cold email", ar: "إشعارات بالبريد وSMS للحجوزات؛ لا بحث عن عملاء ولا بريد بارد" },
      book: { en: "Unlimited event types and calendars, even on the free plan", ar: "أنواع أحداث وتقويمات غير محدودة، حتى في الخطة المجانية" },
      calendar: { en: "Many calendars and video apps; two-way CRM syncing", ar: "تقويمات وتطبيقات فيديو كثيرة؛ ومزامنة CRM في الاتجاهين" },
      team: { en: "Round-robin, collective events and routing forms on Teams", ar: "توزيع دوري وأحداث جماعية ونماذج توجيه في خطة Teams" },
      price: { en: "Free for one user; Teams $12 and Organizations $28 per user a month billed yearly (its pricing page, 30 Oct 2026)", ar: "مجاني لمستخدم واحد؛ وTeams بـ 12 وOrganizations بـ 28 دولارًا للمستخدم شهريًا بالدفع السنوي (صفحة أسعاره، 30 أكتوبر 2026)" },
    },
    yPrice: YP("Cal.com is free for one person who only needs scheduling.", "Cal.com مجاني لشخص واحد يحتاج الجدولة فقط."),
    chooseThem: {
      en: ["You want to self-host or build on a scheduling API.", "You need many event types, calendars and apps for free.", "Your team needs routing forms and collective events."],
      ar: ["تريد الاستضافة الذاتية أو البناء على واجهة برمجة للجدولة.", "تحتاج أنواع أحداث وتقويمات وتطبيقات كثيرة مجانًا.", "فريقك يحتاج نماذج توجيه وأحداثًا جماعية."],
    },
    chooseYolias: {
      en: ["Scheduling isn't your problem; an empty pipeline is.", "You want the agent that writes to prospects to also offer the times.", "You want everything, from search to the booked meeting, in one Arabic and English product."],
      ar: ["مشكلتك ليست الجدولة بل مسار مبيعات فارغ.", "تريد أن يقدّم الوكيل الذي يراسل العملاء المواعيد أيضًا.", "تريد كل شيء، من البحث إلى الاجتماع المحجوز، في منتج واحد بالعربية والإنجليزية."],
    },
    faq: {
      en: [
        { q: "Is Cal.com free?", a: "Its pricing page lists a free plan for one user with unlimited event types and calendars. Team plans are paid per user." },
        { q: "Does Yolias have routing forms like Cal.com?", a: "No. Yolias books one-to-one meetings on each member's page. It qualifies leads before the meeting through the conversation instead of a form." },
        { q: "Can Yolias send my Cal.com link instead?", a: "Yolias sends its own booking page so the meeting lands in Meetings and on the lead's record. For a purchase campaign you can set any website link." },
      ],
      ar: [
        { q: "هل Cal.com مجاني؟", a: "تعرض صفحة أسعاره خطة مجانية لمستخدم واحد بأنواع أحداث وتقويمات غير محدودة، وخطط الفرق مدفوعة لكل مستخدم." },
        { q: "هل في يولياس نماذج توجيه مثل Cal.com؟", a: "لا. يحجز يولياس اجتماعات فردية في صفحة كل عضو، ويؤهل العملاء قبل الاجتماع من خلال المحادثة بدل النموذج." },
        { q: "هل يمكن أن يرسل يولياس رابط Cal.com الخاص بي؟", a: "يرسل يولياس صفحة الحجز الخاصة به ليظهر الاجتماع في الاجتماعات وفي سجل العميل. ولحملات الشراء يمكنك وضع أي رابط لموقعك." },
      ],
    },
    sources: ["https://cal.com/", "https://cal.com/pricing"],
  }),
  versus({
    slug: "chili-piper", name: "Chili Piper", keyword: "yolias vs chili piper", secondary: ["chili piper alternative", "chili piper alternative for small teams", "chili piper pricing alternative"],
    lead: {
      en: "Chili Piper turns inbound demand into meetings: forms route each lead to the right rep and book them on the spot, priced for revenue teams. Yolias is for teams that don't have that inbound flow yet: it creates the demand by finding and emailing prospects, then books them.",
      ar: "Chili Piper يحوّل الطلب الوارد إلى اجتماعات: النماذج توجّه كل عميل إلى المندوب المناسب وتحجز فورًا، بأسعار مصممة لفرق الإيرادات. أما يولياس فللفرق التي لا تملك هذا الطلب الوارد بعد: يصنع الطلب بإيجاد العملاء ومراسلتهم، ثم يحجز لهم.",
    },
    answer: {
      en: "Chili Piper fits companies with heavy inbound traffic, Salesforce and many reps. Yolias fits small teams and agencies that need outbound meetings without a five-figure contract.",
      ar: "Chili Piper يناسب الشركات ذات الطلب الوارد الكبير وSalesforce والمندوبين الكثيرين. ويولياس يناسب الفرق الصغيرة والوكالات التي تحتاج اجتماعات من التواصل الصادر بلا عقد بآلاف الدولارات.",
    },
    them: {
      what: { en: "Inbound conversion: form-to-calendar booking, lead routing and AI agents for revenue teams", ar: "تحويل الطلب الوارد: حجز من النموذج إلى التقويم، وتوجيه العملاء، ووكلاء ذكاء اصطناعي لفرق الإيرادات" },
      find: { en: "Account identification and ABM targeting on its higher plan", ar: "تحديد الحسابات واستهداف ABM في خطته الأعلى" },
      reach: { en: "Re-engagement flows for leads who didn't book", ar: "مسارات إعادة تفاعل للعملاء الذين لم يحجزوا" },
      book: { en: "Instant booking from web forms and smart scheduling links", ar: "حجز فوري من نماذج الموقع وروابط جدولة ذكية" },
      calendar: { en: "Calendar, CRM and messaging integrations", ar: "تكاملات مع التقويم وCRM والمراسلة" },
      team: { en: "Lead routing, round-robin and SDR-to-AE handoff", ar: "توجيه العملاء وتوزيع دوري وتسليم من SDR إلى AE" },
      price: { en: "Routing & Scheduling $1,250 a month with 15 seats; Experiences $3,500 a month; ChiliCal $12 a user with 200 seats minimum (its pricing page, 30 Oct 2026)", ar: "Routing & Scheduling بـ 1,250 دولارًا شهريًا مع 15 مقعدًا؛ وExperiences بـ 3,500 دولار شهريًا؛ وChiliCal بـ 12 دولارًا للمستخدم بحد أدنى 200 مقعد (صفحة أسعاره، 30 أكتوبر 2026)" },
    },
    yTeam: { en: "Each member has their own page; no routing between reps", ar: "لكل عضو صفحته؛ لا توجيه بين المندوبين" },
    yPrice: YP("No seat minimum and no yearly contract.", "بلا حد أدنى للمقاعد وبلا عقد سنوي."),
    chooseThem: {
      en: ["Thousands of inbound form fills a month need routing to the right rep.", "You run Salesforce and need SDR-to-AE handoffs.", "Your budget fits a yearly contract."],
      ar: ["آلاف النماذج الواردة شهريًا تحتاج توجيهًا إلى المندوب المناسب.", "تعمل على Salesforce وتحتاج تسليمًا من SDR إلى AE.", "ميزانيتك تناسب عقدًا سنويًا."],
    },
    chooseYolias: {
      en: ["You have little inbound and need to create meetings with outbound email.", "You're a small team or an agency and want monthly pricing without seat minimums.", "You work in Arabic markets and want the whole flow in Arabic."],
      ar: ["لديك طلب وارد قليل وتحتاج صنع الاجتماعات بالبريد الصادر.", "أنت فريق صغير أو وكالة وتريد سعرًا شهريًا بلا حد أدنى للمقاعد.", "تعمل في الأسواق العربية وتريد المسار كله بالعربية."],
    },
    faq: {
      en: [
        { q: "Is there a cheaper Chili Piper alternative?", a: "For outbound meetings, Yolias starts at $5 of Pay As You Go credit or $50 a month, with unlimited users. It doesn't replace Chili Piper's inbound routing." },
        { q: "Does Yolias route leads between reps?", a: "No. Each member books on their own page. Leads reach the member whose campaign wrote to them." },
      ],
      ar: [
        { q: "هل يوجد بديل أرخص لـ Chili Piper؟", a: "لاجتماعات التواصل الصادر، يبدأ يولياس من 5 دولارات بالدفع حسب الاستخدام أو 50 دولارًا شهريًا، بمستخدمين بلا حد. لكنه لا يحل محل توجيه الطلب الوارد في Chili Piper." },
        { q: "هل يوزّع يولياس العملاء بين المندوبين؟", a: "لا. كل عضو يحجز في صفحته، ويصل العميل إلى العضو الذي راسلته حملته." },
      ],
    },
    sources: ["https://www.chilipiper.com/", "https://www.chilipiper.com/pricing"],
  }),
  versus({
    slug: "savvycal", name: "SavvyCal", keyword: "yolias vs savvycal", secondary: ["savvycal alternative", "savvycal vs calendly vs yolias"],
    lead: {
      en: "SavvyCal is a scheduling tool focused on the person booking: they overlay their own calendar to pick a time, and you get polls and ranked availability. Yolias focuses on who you should be meeting at all, and books them on a simple page.",
      ar: "SavvyCal أداة جدولة تركّز على من يحجز: يرى تقويمه فوق مواعيدك ليختار، مع استطلاعات وترتيب للأوقات. أما يولياس فيركّز على من يجب أن تقابلهم أصلًا، ويحجز لهم في صفحة بسيطة.",
    },
    answer: {
      en: "Use SavvyCal for a polished booking experience across Google, Microsoft, iCloud and Fastmail calendars. Use Yolias to find and email the prospects who will book, with the page included.",
      ar: "استخدم SavvyCal لتجربة حجز مصقولة عبر تقويمات Google وMicrosoft وiCloud وFastmail. واستخدم يولياس لإيجاد العملاء الذين سيحجزون ومراسلتهم، مع الصفحة مشمولة.",
    },
    them: {
      what: { en: "Scheduling links and polls focused on the invitee's experience", ar: "روابط جدولة واستطلاعات تركّز على تجربة المدعو" },
      find: { en: "Not part of the product", ar: "ليس جزءًا من المنتج" },
      reach: { en: "Booking emails, from your own address on Premium", ar: "رسائل الحجز، ومن عنوانك الخاص في Premium" },
      book: { en: "Unlimited scheduling links and polls; booking pages on your own domain on Premium", ar: "روابط جدولة واستطلاعات غير محدودة؛ وصفحات حجز على نطاقك في Premium" },
      calendar: { en: "Unlimited calendars across Google, Microsoft, iCloud and Fastmail", ar: "تقويمات غير محدودة عبر Google وMicrosoft وiCloud وFastmail" },
      team: { en: "Team scheduling with round robin and shared availability", ar: "جدولة فرق بتوزيع دوري وإتاحة مشتركة" },
      price: { en: "Basic $12 and Premium $20 per user a month, or $10 and $17 yearly (its pricing page, 30 Oct 2026)", ar: "Basic بـ 12 وPremium بـ 20 دولارًا للمستخدم شهريًا، أو 10 و17 بالدفع السنوي (صفحة أسعاره، 30 أكتوبر 2026)" },
    },
    yPrice: YP("Unlimited users on one plan, where SavvyCal is priced per user.", "مستخدمون بلا حد في خطة واحدة، بينما SavvyCal بسعر لكل مستخدم."),
    chooseThem: {
      en: ["You book many meetings with people who already know you and want the nicest booking experience.", "You use Microsoft, iCloud or Fastmail calendars.", "You need polls and ranked availability."],
      ar: ["تحجز اجتماعات كثيرة مع من يعرفونك وتريد أفضل تجربة حجز.", "تستخدم تقويم Microsoft أو iCloud أو Fastmail.", "تحتاج استطلاعات وترتيبًا للأوقات."],
    },
    chooseYolias: {
      en: ["Most of the people you need to meet don't know you yet.", "You want the replies and the bookings from one campaign in one place.", "You want a whole team on one price."],
      ar: ["معظم من تحتاج مقابلتهم لا يعرفونك بعد.", "تريد الردود والحجوزات من حملة واحدة في مكان واحد.", "تريد فريقك كله بسعر واحد."],
    },
    faq: {
      en: [
        { q: "Does Yolias support Microsoft calendars like SavvyCal?", a: "Not yet. Yolias adds bookings to Google Calendar. Without Google Calendar, guests get an \"Add to Google Calendar\" link in their confirmation." },
        { q: "Can guests see their calendar on Yolias's page?", a: "No. Guests see your free times in their own time zone and pick one." },
      ],
      ar: [
        { q: "هل يدعم يولياس تقويمات Microsoft مثل SavvyCal؟", a: "ليس بعد. يضيف يولياس الحجوزات إلى تقويم Google. ومن دونه يصل الضيف رابط «أضف إلى تقويم Google» في رسالة التأكيد." },
        { q: "هل يرى الضيوف تقويمهم في صفحة يولياس؟", a: "لا. يرى الضيف مواعيدك المتاحة بتوقيته ويختار أحدها." },
      ],
    },
    sources: ["https://savvycal.com/", "https://savvycal.com/pricing"],
  }),
  versus({
    slug: "tidycal", name: "TidyCal", keyword: "yolias vs tidycal", secondary: ["tidycal alternative", "tidycal for sales"],
    lead: {
      en: "TidyCal is a low-cost booking tool, sold as a one-time lifetime deal, with paid bookings and Zoom or Meet links. It is a booking page and nothing more, which is often all a freelancer needs. Yolias adds the part before the booking: finding clients and writing to them.",
      ar: "TidyCal أداة حجز منخفضة التكلفة تُباع كصفقة مدى الحياة بدفعة واحدة، مع حجوزات مدفوعة وروابط Zoom أو Meet. هي صفحة حجز فقط، وهذا غالبًا كل ما يحتاجه المستقل. ويضيف يولياس الجزء الذي قبل الحجز: إيجاد العملاء ومراسلتهم.",
    },
    answer: {
      en: "If you already have clients asking to book, TidyCal's one-time price is hard to beat. If you need new clients to book in the first place, Yolias finds them, emails them and includes the booking page.",
      ar: "إذا كان لديك عملاء يطلبون الحجز بالفعل، فسعر TidyCal لمرة واحدة يصعب منافسته. وإذا كنت تحتاج عملاء جددًا يحجزون أصلًا، فيولياس يجدهم ويراسلهم ومعه صفحة الحجز.",
    },
    them: {
      what: { en: "A simple booking page with paid, recurring and group bookings", ar: "صفحة حجز بسيطة مع حجوزات مدفوعة ومتكررة وجماعية" },
      find: { en: "Not part of the product", ar: "ليس جزءًا من المنتج" },
      reach: { en: "Booking emails; SMS reminders on higher plans", ar: "رسائل الحجز؛ وتذكير SMS في الخطط الأعلى" },
      book: { en: "Unlimited bookings and booking types, even on the free plan", ar: "حجوزات وأنواع حجز غير محدودة، حتى في الخطة المجانية" },
      calendar: { en: "Up to 10 calendars and Zoom, Meet or Teams links on the lifetime plan", ar: "حتى 10 تقويمات وروابط Zoom أو Meet أو Teams في خطة مدى الحياة" },
      team: { en: "Round-robin and collective meetings on the Agency plan", ar: "توزيع دوري واجتماعات جماعية في خطة Agency" },
      price: { en: "Free; Individual $29 and Agency $79 one time; Pro $12 a month (its pricing page, 30 Oct 2026)", ar: "مجانية؛ وIndividual بـ 29 وAgency بـ 79 دولارًا لمرة واحدة؛ وPro بـ 12 دولارًا شهريًا (صفحة أسعاره، 30 أكتوبر 2026)" },
    },
    yPrice: YP("A scheduler alone costs less; Yolias is priced for finding and emailing prospects too.", "أداة الجدولة وحدها أقل تكلفة؛ وسعر يولياس يشمل إيجاد العملاء ومراسلتهم أيضًا."),
    chooseThem: {
      en: ["You only need a booking page and want to pay once.", "You charge for sessions at booking time.", "You need group or recurring bookings."],
      ar: ["تحتاج صفحة حجز فقط وتريد الدفع مرة واحدة.", "تحصّل ثمن الجلسات عند الحجز.", "تحتاج حجوزات جماعية أو متكررة."],
    },
    chooseYolias: {
      en: ["You're a freelancer or agency who needs more clients, not just a page.", "You want the emails that create the meetings and the page that books them to work together.", "You want to know which industries turn meetings into clients, so your next search aims there."],
      ar: ["أنت مستقل أو وكالة تحتاج عملاء أكثر، لا صفحة فقط.", "تريد أن تعمل الرسائل التي تصنع الاجتماعات والصفحة التي تحجزها معًا.", "تريد معرفة المجالات التي تتحول فيها الاجتماعات إلى عملاء، لتتجه إليها عمليات بحثك القادمة."],
    },
    faq: {
      en: [
        { q: "Does Yolias charge per booking?", a: "No. The booking page is part of every plan. Yolias charges for the prospects it finds; emails and bookings aren't charged." },
        { q: "Can I take payments on Yolias's booking page?", a: "No. Use TidyCal or another tool for paid sessions." },
      ],
      ar: [
        { q: "هل يحسب يولياس رسومًا لكل حجز؟", a: "لا. صفحة الحجز جزء من كل خطة. يحسب يولياس العملاء المحتملين الذين يجدهم، ولا تُحسب الرسائل ولا الحجوزات." },
        { q: "هل يمكنني تحصيل مدفوعات في صفحة حجز يولياس؟", a: "لا. استخدم TidyCal أو أداة أخرى للجلسات المدفوعة." },
      ],
    },
    sources: ["https://tidycal.com/", "https://tidycal.com/pricing"],
  }),
];

const meetLinks = [
  { path: "/compare/calendly", en: "Yolias vs Calendly", ar: "يولياس مقابل Calendly" },
  { path: "/compare/cal-com", en: "Yolias vs Cal.com", ar: "يولياس مقابل Cal.com" },
  { path: "/solutions/sales-meeting-booking", en: "Booking sales meetings with AI", ar: "حجز اجتماعات المبيعات بالذكاء الاصطناعي" },
];

export const meetingAlternativesPages: SeedPage[] = [{
  kind: "alternatives", slug: "calendly", competitor: "calendly", tools: ["cal-com", "savvycal", "tidycal", "chili-piper"],
  primary_keyword: "calendly alternatives", secondary_keywords: ["calendly alternative", "cheaper calendly alternative", "calendly competitors", "calendly alternative for sales", "free calendly alternative"],
  links: [meetLinks[0], meetLinks[2], { path: "/pricing", en: "Yolias pricing", ar: "أسعار يولياس" }],
  sources: ["https://calendly.com/pricing", "https://cal.com/pricing", "https://savvycal.com/pricing", "https://tidycal.com/pricing", "https://www.chilipiper.com/pricing"],
  en: {
    title: "Calendly alternatives", h1: "Calendly alternatives: pick by what your calendar is missing",
    metaTitle: "Calendly alternatives for 2026, cheaper and for sales",
    metaDescription: "Cal.com, SavvyCal, TidyCal, Chili Piper and Yolias compared by what you need: a cheaper link, team routing, or the meetings themselves. Prices from each site.",
    lead: "Most people leave Calendly for one of three reasons: the price per seat as the team grows, a feature on a higher plan, or a calendar with too few meetings in it. Each reason has a different answer.",
    answer: "For a cheaper or free booking link, look at Cal.com or TidyCal. For a nicer booking experience, SavvyCal. For routing inbound leads to many reps, Chili Piper. If the real problem is that too few of the right people book, Yolias finds them, emails them and books them on a page included in every plan.",
    criteria: [
      "**What's missing:** a lower price, team features, or more meetings.",
      "**Your calendars:** Google only, or Microsoft and iCloud too.",
      "**Per-seat or flat price:** matters as soon as you're more than three people.",
      "**Where meetings come from:** inbound traffic, or outreach you still have to do.",
    ],
    blocks: [
      { h2: "By what you need" },
      { table: { head: ["If you need…", "Look at", "Why"], rows: [
        ["A free or cheaper booking link", "Cal.com, TidyCal", "Cal.com is free for one user; TidyCal sells a $29 lifetime plan"],
        ["The best booking experience", "SavvyCal", "Invitees overlay their own calendar; polls and ranked times"],
        ["Routing inbound leads to many reps", "Chili Piper", "Form-to-calendar booking and routing, from $1,250 a month"],
        ["More meetings with the right people", "Yolias", "Finds matching companies, emails them from your mailbox and books them on your page"],
      ] } },
      { h2: "How Yolias fits next to a scheduler" },
      { p: "Schedulers assume someone already wants to meet you. Yolias starts before that: you describe your ideal customer, it finds the companies and decision makers, writes the emails and follow-ups, and when someone asks for a meeting it replies with two free times and your booking page. Every booking lands in Meetings and in Google Calendar with a Meet link." },
      { note: "Yolias's booking page is one-to-one and works with Google Calendar only; it skips busy times in your main Google Calendar but not in Outlook or iCloud. Keep a scheduler if you need team pages, routing or payments." },
    ],
    faq: [
      { q: "What is the cheapest Calendly alternative?", a: "For scheduling alone, Cal.com's free plan for one user or TidyCal's one-time price. Yolias isn't the cheapest scheduler; it's priced for finding and emailing prospects, with the booking page included." },
      { q: "What's the best Calendly alternative for sales?", a: "If your reps need inbound routing, Chili Piper. If you need outbound meetings with new prospects, Yolias, because it does the outreach that fills the calendar." },
      { q: "Is there a Calendly alternative in Arabic?", a: "Yolias's app, booking page and emails work in Arabic and English, and guests see times in their own time zone." },
    ],
    cta: CTA.en,
  },
  ar: {
    title: "بدائل Calendly", h1: "بدائل Calendly: اختر حسب ما ينقص تقويمك",
    metaTitle: "بدائل Calendly في 2026، أرخص وللمبيعات",
    metaDescription: "مقارنة Cal.com وSavvyCal وTidyCal وChili Piper ويولياس حسب حاجتك: رابط أرخص، أو توجيه للفرق، أو الاجتماعات نفسها. الأسعار من موقع كل منها.",
    lead: "يترك معظم الناس Calendly لأحد ثلاثة أسباب: السعر لكل مقعد مع نمو الفريق، أو ميزة في خطة أعلى، أو تقويم فيه اجتماعات قليلة. ولكل سبب إجابة مختلفة.",
    answer: "لرابط حجز مجاني أو أرخص، انظر إلى Cal.com أو TidyCal. ولتجربة حجز أجمل، SavvyCal. ولتوجيه الطلبات الواردة إلى مندوبين كثيرين، Chili Piper. وإذا كانت المشكلة الحقيقية أن قلة من الأشخاص المناسبين يحجزون، فيولياس يجدهم ويراسلهم ويحجز لهم في صفحة مشمولة في كل خطة.",
    criteria: [
      "**ما الذي ينقصك:** سعر أقل، أو ميزات للفرق، أو اجتماعات أكثر.",
      "**تقويماتك:** Google فقط، أم Microsoft وiCloud أيضًا.",
      "**سعر لكل مقعد أم ثابت:** يهم بمجرد أن تكونوا أكثر من ثلاثة.",
      "**من أين تأتي الاجتماعات:** زيارات واردة، أم تواصل ما زال عليك القيام به.",
    ],
    blocks: [
      { h2: "حسب حاجتك" },
      { table: { head: ["إذا كنت تحتاج…", "انظر إلى", "السبب"], rows: [
        ["رابط حجز مجاني أو أرخص", "Cal.com، TidyCal", "Cal.com مجاني لمستخدم واحد، وTidyCal يبيع خطة مدى الحياة بـ 29 دولارًا"],
        ["أفضل تجربة حجز", "SavvyCal", "يرى المدعو تقويمه فوق مواعيدك، مع استطلاعات وترتيب للأوقات"],
        ["توجيه الطلبات الواردة لمندوبين كثيرين", "Chili Piper", "حجز من النموذج إلى التقويم مع التوجيه، من 1,250 دولارًا شهريًا"],
        ["اجتماعات أكثر مع الأشخاص المناسبين", "يولياس", "يجد الشركات المطابقة ويراسلها من بريدك ويحجز في صفحتك"],
      ] } },
      { h2: "كيف يعمل يولياس بجانب أداة الجدولة" },
      { p: "تفترض أدوات الجدولة أن شخصًا يريد مقابلتك بالفعل. أما يولياس فيبدأ قبل ذلك: تصف عميلك المثالي، فيجد الشركات وصنّاع القرار، ويكتب الرسائل والمتابعات، وعندما يطلب أحدهم اجتماعًا يرد بموعدين متاحين وصفحة الحجز الخاصة بك. وكل حجز يظهر في الاجتماعات وفي تقويم Google برابط Meet." },
      { note: "صفحة الحجز في يولياس فردية وتعمل مع تقويم Google فقط؛ تتجنب أوقات انشغالك في تقويم Google الرئيسي، لكن لا ترى Outlook أو iCloud. احتفظ بأداة جدولة إذا كنت تحتاج صفحات فرق أو توجيهًا أو دفعًا." },
    ],
    faq: [
      { q: "ما أرخص بديل لـ Calendly؟", a: "للجدولة وحدها، خطة Cal.com المجانية لمستخدم واحد أو سعر TidyCal لمرة واحدة. يولياس ليس أرخص أداة جدولة؛ سعره يشمل إيجاد العملاء ومراسلتهم، وصفحة الحجز مشمولة." },
      { q: "ما أفضل بديل لـ Calendly للمبيعات؟", a: "إذا كان مندوبوك يحتاجون توجيه الطلبات الواردة، فـ Chili Piper. وإذا كنت تحتاج اجتماعات من التواصل مع عملاء جدد، فيولياس، لأنه يقوم بالتواصل الذي يملأ التقويم." },
      { q: "هل يوجد بديل لـ Calendly بالعربية؟", a: "تطبيق يولياس وصفحة الحجز والرسائل تعمل بالعربية والإنجليزية، ويرى الضيوف المواعيد بتوقيتهم." },
    ],
    cta: CTA.ar,
  },
}];

export const meetingSolutionPages: SeedPage[] = [
  {
    kind: "solution", slug: "sales-meeting-booking",
    primary_keyword: "ai meeting booking", secondary_keywords: ["book sales meetings with ai", "ai appointment setter", "ai sdr book meetings", "automated meeting booking", "book more sales meetings"],
    links: meetLinks, sources: [],
    en: {
      title: "Booking sales meetings", h1: "Book sales meetings with the right companies, with AI",
      metaTitle: "AI meeting booking: from prospect to booked call",
      metaDescription: "Yolias finds matching companies, emails the decision makers from your mailbox, offers two free times when they reply, and books the meeting on your page.",
      lead: "A booking link only helps once someone wants to talk. Yolias does the work that gets you there: it finds the companies that fit, writes to them, follows up, and turns a \"yes, let's talk\" into a meeting on your calendar.",
      answer: "To book more sales meetings, reach the right decision makers with a short, specific email, follow up a few times, and make booking a single click when they agree. Yolias runs that sequence: it finds the prospects, sends the emails from your own mailbox after you approve, and replies to meeting requests with two free times and your Yolias booking page.",
      audience: ["Agencies and consultants who sell through calls", "Founders doing their own sales", "Small sales teams without SDRs"],
      criteria: ["A clear description of who you want to meet", "A meeting campaign goal, so every email asks for a short call", "Booking hours that leave room for other work", "Google Calendar connected, for Meet links and invitations"],
      steps: [
        { title: "Describe who you want to meet", body: "For example: \"Marketing managers at private schools in Cairo and Giza.\" Yolias turns it into criteria and finds matching schools and people." },
        { title: "Approve a meeting campaign", body: "Yolias writes the first email and follow-ups; from the first follow-up they carry your booking page." },
        { title: "Let Yolias answer", body: "When someone asks for a meeting, Yolias replies in the same thread with two free times and the page." },
        { title: "Meet and record the outcome", body: "The booking lands in Meetings and Google Calendar. After the call, mark whether they became a customer, so the next search aims at what works." },
      ],
      blocks: [
        { h2: "What happens when someone books" },
        { ul: ["They pick a time in their own time zone on yolias.com/meet/your-name.", "You get an email and a notice; they get a confirmation with a cancel link.", "With Google Calendar connected, the event has a Google Meet link and Google sends the invitation.", "Yolias reminds you by email an hour before, and can write a short brief about the company and the conversation."] },
        { note: "Yolias doesn't promise a number of meetings: results depend on your market, your offer and the contacts available for it." },
      ],
      faq: [
        { q: "Is Yolias an AI appointment setter?", a: "Yes, for email: it finds prospects, writes and sends the emails after your approval, answers meeting requests with free times and books the meeting on your page. It works by email only." },
        { q: "Do I need Calendly to use it?", a: "No. Every member has a booking page in Yolias. Connect Google Calendar for Meet links and invitations." },
        { q: "Can Yolias book a time the lead suggests in their reply?", a: "It offers your free times and the page; when the lead picks one, the meeting is booked. If they propose another time, you can add the meeting in Meetings." },
      ],
      cta: CTA.en,
    },
    ar: {
      title: "حجز اجتماعات المبيعات", h1: "احجز اجتماعات مبيعات مع الشركات المناسبة بالذكاء الاصطناعي",
      metaTitle: "حجز اجتماعات المبيعات بالذكاء الاصطناعي",
      metaDescription: "يجد يولياس الشركات المطابقة، ويراسل صنّاع القرار من بريدك، ويقترح موعدين متاحين عندما يردون، ويحجز الاجتماع في صفحتك.",
      lead: "رابط الحجز لا يفيد إلا عندما يريد أحدهم التحدث. ويولياس يقوم بالعمل الذي يوصلك إلى ذلك: يجد الشركات المناسبة، ويراسلها، ويتابع، ويحوّل «نعم، لنتحدث» إلى اجتماع في تقويمك.",
      answer: "لتحجز اجتماعات مبيعات أكثر، صِل إلى صنّاع القرار المناسبين برسالة قصيرة ومحددة، وتابع عدة مرات، واجعل الحجز ضغطة واحدة عندما يوافقون. ويولياس يدير هذا التسلسل: يجد العملاء، ويرسل الرسائل من بريدك بعد موافقتك، ويرد على طلبات الاجتماع بموعدين متاحين وصفحة الحجز الخاصة بك في يولياس.",
      audience: ["الوكالات والاستشاريون الذين يبيعون عبر المكالمات", "المؤسسون الذين يبيعون بأنفسهم", "فرق المبيعات الصغيرة بلا مندوبي تواصل"],
      criteria: ["وصف واضح لمن تريد مقابلتهم", "هدف الحملة حجز اجتماع، لتطلب كل رسالة مكالمة قصيرة", "ساعات حجز تترك وقتًا لعملك الآخر", "ربط تقويم Google لروابط Meet والدعوات"],
      steps: [
        { title: "صِف من تريد مقابلتهم", body: "مثلًا: «مديرو التسويق في المدارس الخاصة في القاهرة والجيزة». يحوّله يولياس إلى معايير ويجد المدارس والأشخاص المطابقين." },
        { title: "وافق على حملة اجتماعات", body: "يكتب يولياس الرسالة الأولى والمتابعات، ومن أول متابعة تحمل صفحة الحجز الخاصة بك." },
        { title: "دع يولياس يرد", body: "عندما يطلب أحدهم اجتماعًا، يرد يولياس في نفس المحادثة بموعدين متاحين والصفحة." },
        { title: "قابِل وسجّل النتيجة", body: "يظهر الحجز في الاجتماعات وتقويم Google. وبعد المكالمة سجّل هل صار عميلًا، لتتجه عمليات البحث القادمة إلى ما ينجح." },
      ],
      blocks: [
        { h2: "ماذا يحدث عندما يحجز أحدهم" },
        { ul: ["يختار موعدًا بتوقيته في yolias.com/meet/اسمك.", "يصلك بريد وإشعار، ويصله تأكيد فيه رابط للإلغاء.", "مع ربط تقويم Google يحمل الحدث رابط Google Meet وترسل Google الدعوة.", "يذكّرك يولياس بالبريد قبلها بساعة، ويمكنه كتابة ملخص قصير عن الشركة والمحادثة."] },
        { note: "لا يَعِد يولياس بعدد معين من الاجتماعات: النتائج تعتمد على سوقك وعرضك وبيانات التواصل المتاحة له." },
      ],
      faq: [
        { q: "هل يولياس منسّق مواعيد بالذكاء الاصطناعي؟", a: "نعم، بالبريد: يجد العملاء، ويكتب الرسائل ويرسلها بعد موافقتك، ويرد على طلبات الاجتماع بمواعيد متاحة ويحجز في صفحتك. ويعمل بالبريد فقط." },
        { q: "هل أحتاج Calendly لاستخدامه؟", a: "لا. لكل عضو صفحة حجز في يولياس. اربط تقويم Google لروابط Meet والدعوات." },
        { q: "هل يحجز يولياس موعدًا يقترحه العميل في رده؟", a: "يقدّم مواعيدك المتاحة والصفحة، وعندما يختار العميل أحدها يُحجز الاجتماع. وإذا اقترح موعدًا آخر يمكنك إضافة الاجتماع من صفحة الاجتماعات." },
      ],
      cta: CTA.ar,
    },
  },
  {
    kind: "solution", slug: "booking-page",
    primary_keyword: "free booking page for sales", secondary_keywords: ["meeting booking page", "online booking page for consultants", "booking page with google meet", "صفحة حجز مواعيد"],
    links: meetLinks, sources: [],
    en: {
      title: "Booking page", h1: "A booking page that comes with the outreach that fills it",
      metaTitle: "Booking page with Google Meet, included with Yolias",
      metaDescription: "Your own page at yolias.com/meet/your-name: weekly hours, length, breaks and notice, Google Calendar and Meet, and bookings that land with the conversation.",
      lead: "Every Yolias member gets a booking page. What makes it different from a standalone scheduler is what's connected to it: the campaigns that send it, the replies that lead to it, and the Meetings page where every booking ends up.",
      answer: "A good sales booking page shows only the times you really want to meet, in the guest's time zone, asks for a name and email and nothing more, and sends both sides a confirmation. Yolias's page does that and is shared by the agent whenever a lead asks for a meeting.",
      audience: ["Consultants and agencies who meet clients online", "Teams that want each member's own link", "Anyone who books calls from cold email"],
      criteria: ["Weekly hours with up to three ranges a day", "Meeting length, a break between meetings and the shortest notice", "How many days ahead people can book", "A place: Google Meet, Zoom, a phone number or an address"],
      steps: [
        { title: "Set your hours", body: "In Meetings → Booking page, choose your days and hours, the meeting length and the break after each meeting." },
        { title: "Connect Google Calendar", body: "In Settings → Integrations. Yolias creates its own calendar there and adds a Google Meet link to every booking." },
        { title: "Share it, or let Yolias do it", body: "Copy the link, or let your meeting campaigns include it and answer meeting requests with two free times." },
      ],
      blocks: [
        { h2: "What your guest sees" },
        { ul: ["Free days and times in their own time zone.", "A short form: name, email and an optional note.", "A confirmation with the link or place, and a link to cancel.", "In Arabic or English."] },
        { note: "Yolias reads busy times from your main Google Calendar and never offers them. Meetings in Outlook or iCloud aren't seen, so keep your hours clear of them." },
      ],
      faq: [
        { q: "Is the booking page free?", a: "It's included in every Yolias plan, with unlimited users. Yolias charges for the prospects it finds, not for bookings." },
        { q: "Can I change my link?", a: "Yes, the address after yolias.com/meet/ is yours to set." },
        { q: "What happens if a guest cancels?", a: "The time is free again on your page, you get an email, and the Google Calendar event is removed." },
      ],
      cta: CTA.en,
    },
    ar: {
      title: "صفحة الحجز", h1: "صفحة حجز يأتي معها التواصل الذي يملؤها",
      metaTitle: "صفحة حجز مواعيد مع Google Meet ضمن يولياس",
      metaDescription: "صفحتك على yolias.com/meet/اسمك: ساعات الأسبوع والمدة والاستراحات والمهلة، وتقويم Google وMeet، وحجوزات تصل مع المحادثة.",
      lead: "كل عضو في يولياس لديه صفحة حجز. وما يميزها عن أداة جدولة منفصلة هو ما يرتبط بها: الحملات التي ترسلها، والردود التي تقود إليها، وصفحة الاجتماعات التي ينتهي إليها كل حجز.",
      answer: "صفحة حجز المبيعات الجيدة تعرض فقط الأوقات التي تريد فعلًا الاجتماع فيها، بتوقيت الضيف، وتطلب الاسم والبريد فقط، وترسل للطرفين تأكيدًا. وصفحة يولياس تفعل ذلك، ويشاركها الوكيل كلما طلب عميل اجتماعًا.",
      audience: ["الاستشاريون والوكالات الذين يقابلون العملاء عبر الإنترنت", "الفرق التي تريد رابطًا خاصًا لكل عضو", "كل من يحجز مكالمات من البريد البارد"],
      criteria: ["ساعات أسبوعية حتى ثلاث فترات في اليوم", "مدة الاجتماع والاستراحة بين الاجتماعات وأقل مهلة", "عدد الأيام المتاحة للحجز مقدمًا", "المكان: Google Meet أو Zoom أو رقم هاتف أو عنوان"],
      steps: [
        { title: "حدّد ساعاتك", body: "من الاجتماعات ← صفحة الحجز، اختر أيامك وساعاتك ومدة الاجتماع والاستراحة بعد كل اجتماع." },
        { title: "اربط تقويم Google", body: "من الإعدادات ← التكاملات. ينشئ يولياس تقويمه الخاص هناك ويضيف رابط Google Meet لكل حجز." },
        { title: "شاركها أو دع يولياس يشاركها", body: "انسخ الرابط، أو دع حملات الاجتماعات تضيفه وترد على طلبات الاجتماع بموعدين متاحين." },
      ],
      blocks: [
        { h2: "ماذا يرى ضيفك" },
        { ul: ["الأيام والأوقات المتاحة بتوقيته.", "نموذج قصير: الاسم والبريد وملاحظة اختيارية.", "تأكيد فيه الرابط أو المكان ورابط للإلغاء.", "بالعربية أو الإنجليزية."] },
        { note: "يقرأ يولياس أوقات انشغالك في تقويم Google الرئيسي ولا يعرضها أبدًا. أما مواعيد Outlook أو iCloud فلا يراها، فاجعل ساعاتك خالية منها." },
      ],
      faq: [
        { q: "هل صفحة الحجز مجانية؟", a: "مشمولة في كل خطط يولياس، بمستخدمين بلا حد. يحسب يولياس العملاء المحتملين الذين يجدهم، لا الحجوزات." },
        { q: "هل يمكنني تغيير الرابط؟", a: "نعم، العنوان بعد yolias.com/meet/ تختاره أنت." },
        { q: "ماذا يحدث إذا ألغى الضيف؟", a: "يعود الموعد متاحًا في صفحتك، ويصلك بريد، ويُحذف حدث تقويم Google." },
      ],
      cta: CTA.ar,
    },
  },
];
