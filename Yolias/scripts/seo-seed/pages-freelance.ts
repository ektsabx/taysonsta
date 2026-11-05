import { CTA, type SeedPage } from "./types.ts";
import type { SeedCompetitor } from "./competitors.ts";

// Freelancer pages (owner, 2026-10-31, D-273): Yolias vs Fiverr, Upwork and
// Freelancer.com, and two audience pages (service providers, founders). The
// marketplaces and Yolias are different models, said plainly: on a
// marketplace clients come to the platform and pick among many sellers, who
// pay a commission on every order; with Yolias the freelancer goes to the
// clients they choose, by email from their own mailbox, and keeps the client.
// Fees as the marketplaces publish them, read on 2 November 2026: Freelancer.com
// from its own fees page; Fiverr's and Upwork's from their help centres as
// widely reported, listed unverified until a second reading in Admin → SEO.

type L = { en: string; ar: string };
type Row = "model" | "clients" | "competition" | "fees" | "relationship" | "effort" | "price";
const labels: Record<Row, L> = {
  model: { en: "How it works", ar: "كيف يعمل" },
  clients: { en: "Where clients come from", ar: "من أين يأتي العملاء" },
  competition: { en: "Competition for each job", ar: "المنافسة على كل عمل" },
  fees: { en: "What you pay", ar: "ما تدفعه" },
  relationship: { en: "Who owns the client", ar: "لمن العميل" },
  effort: { en: "Your time", ar: "وقتك" },
  price: { en: "Price", ar: "السعر" },
};
const rows: Row[] = ["model", "clients", "competition", "fees", "relationship", "effort", "price"];

const Y: Record<Row, L> = {
  model: { en: "Yolias AI, the engine of every campaign: finds the companies you want to work for, emails the decision makers from your own mailbox, answers replies and books the meeting", ar: "Yolias AI، محرك كل حملة: يجد الشركات التي تريد العمل معها، ويراسل صنّاع القرار من بريدك، ويرد على الردود ويحجز الاجتماع" },
  clients: { en: "Companies you choose: by country, city, industry, size and the people who decide, in any market", ar: "شركات تختارها أنت: حسب الدولة والمدينة والمجال والحجم وصنّاع القرار، في أي سوق" },
  competition: { en: "None on the platform: each email is a direct conversation between you and one company", ar: "لا توجد على منصة: كل رسالة محادثة مباشرة بينك وبين شركة واحدة" },
  fees: { en: "No commission on your work: you pay for the people Yolias finds and reaches for your campaigns", ar: "لا عمولة على عملك: تدفع مقابل الأشخاص الذين يجدهم يولياس ويتواصل معهم لحملاتك" },
  relationship: { en: "Yours from the first email: the conversation, the contract and the payment are between you and the client", ar: "لك من أول رسالة: المحادثة والعقد والدفع بينك وبين العميل" },
  effort: { en: "You set the audience once; Yolias writes, follows up and answers; you take the meetings", ar: "تحدد الجمهور مرة واحدة؛ ويكتب يولياس ويتابع ويرد؛ وأنت تحضر الاجتماعات" },
  price: { en: "Pay As You Go from $5 (about $0.10 a person reached), or Growth $100 and Scale $200 a month", ar: "الدفع حسب الاستخدام من 5 دولارات (نحو 0.10 دولار لكل شخص)، أو النمو بـ 100 والتوسع بـ 200 دولار شهريًا" },
};

const limits: L[] = [
  { en: "Yolias doesn't bring you buyers who are already looking for a freelancer: it starts conversations with companies that may not be looking yet.", ar: "لا يجلب يولياس مشترين يبحثون بالفعل عن مستقل: بل يبدأ محادثات مع شركات قد لا تبحث بعد." },
  { en: "It doesn't hold payments, write contracts or resolve disputes; those stay between you and your client.", ar: "لا يحتفظ بالمدفوعات ولا يكتب العقود ولا يحل النزاعات؛ فهذه تبقى بينك وبين عميلك." },
  { en: "Email only, from your own mailbox, within safe daily limits; results depend on your market and your offer.", ar: "بالبريد فقط، من بريدك، في حدود يومية آمنة؛ والنتائج تعتمد على سوقك وعرضك." },
];

interface Vs {
  slug: string; name: string; keyword: string; secondary: string[];
  them: Record<Row, L>; lead: L; answer: L;
  chooseThem: { en: string[]; ar: string[] }; chooseYolias: { en: string[]; ar: string[] };
  faq: { en: { q: string; a: string }[]; ar: { q: string; a: string }[] };
  sources: string[];
}

function versus(v: Vs): SeedPage {
  const side = (l: "en" | "ar") => ({
    title: l === "en" ? `Yolias vs ${v.name}` : `يولياس مقابل ${v.name}`,
    h1: l === "en" ? `Yolias vs ${v.name} for freelancers: wait for clients, or go to them?` : `يولياس أم ${v.name} للمستقلين: تنتظر العملاء أم تذهب إليهم؟`,
    metaTitle: l === "en" ? `Yolias vs ${v.name} for freelancers` : `يولياس مقابل ${v.name} للمستقلين`,
    metaDescription: l === "en"
      ? `${v.name} is a marketplace where clients pick among many sellers. Yolias finds companies for you and emails them from your mailbox. Fees and limits compared.`
      : `${v.name} سوق يختار فيه العملاء بين بائعين كثيرين، ويولياس يجد لك الشركات ويراسلها من بريدك. مقارنة الرسوم والحدود.`,
    lead: v.lead[l], answer: v.answer[l],
    compare: rows.map((r) => ({ label: labels[r][l], yolias: Y[r][l], them: v.them[r][l] })),
    blocks: [
      { h2: l === "en" ? "Two different models" : "نموذجان مختلفان" },
      { p: l === "en"
        ? `${v.name} is a marketplace: clients come to it, post or search, and choose among many freelancers; the platform takes a fee on the work. Yolias isn't a marketplace and doesn't send you clients who are already shopping. It works for you: it finds the companies you want as clients, writes to the people who decide there from your own mailbox, answers their replies and books the meeting. Many freelancers use both.`
        : `${v.name} سوق: يأتي العملاء إليه، وينشرون أو يبحثون، ويختارون بين مستقلين كثيرين؛ وتأخذ المنصة رسومًا على العمل. يولياس ليس سوقًا ولا يرسل لك عملاء يتسوقون بالفعل. بل يعمل لك: يجد الشركات التي تريدها عملاء، ويراسل أصحاب القرار فيها من بريدك، ويرد على ردودهم ويحجز الاجتماع. وكثير من المستقلين يستخدمون الاثنين.` },
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
      { path: "/solutions/freelancers", en: "Yolias for freelancers", ar: "يولياس للمستقلين" },
      { path: "/compare/fiverr", en: "Yolias vs Fiverr", ar: "يولياس مقابل Fiverr" },
      { path: "/compare/upwork", en: "Yolias vs Upwork", ar: "يولياس مقابل Upwork" },
      { path: "/compare/freelancer", en: "Yolias vs Freelancer", ar: "يولياس مقابل Freelancer" },
      { path: "/pricing", en: "Yolias pricing", ar: "أسعار يولياس" },
    ].filter((x) => x.path !== `/compare/${v.slug}`),
    sources: v.sources,
    en: side("en"), ar: side("ar"),
  };
}

const commonFaq = (name: string) => ({
  en: [
    { q: `Is Yolias a ${name} alternative?`, a: `Not in the same way. ${name} is a marketplace where clients pick among freelancers. Yolias is Yolias AI that finds companies you choose and emails them from your mailbox, so it's a way to win clients outside a marketplace, not another marketplace.` },
    { q: "Do I pay a commission on projects I win with Yolias?", a: "No. You pay for the people Yolias finds and reaches for your campaigns; the project, the price and the payment are between you and your client." },
    { q: "Can I use both?", a: `Yes. Keep ${name} for buyers who are already looking, and use Yolias to reach the companies you'd most like to work with.` },
  ],
  ar: [
    { q: `هل يولياس بديل لـ ${name}؟`, a: `ليس بالطريقة نفسها. ${name} سوق يختار فيه العملاء بين المستقلين. أما يولياس فوكيل مبيعات يجد الشركات التي تختارها ويراسلها من بريدك، فهو طريقة لكسب عملاء خارج الأسواق، وليس سوقًا آخر.` },
    { q: "هل أدفع عمولة على المشاريع التي أكسبها مع يولياس؟", a: "لا. تدفع مقابل الأشخاص الذين يجدهم يولياس ويتواصل معهم لحملاتك؛ أما المشروع والسعر والدفع فبينك وبين عميلك." },
    { q: "هل يمكن استخدام الاثنين؟", a: `نعم. احتفظ بـ ${name} للمشترين الذين يبحثون بالفعل، واستخدم يولياس للوصول إلى الشركات التي تفضّل العمل معها.` },
  ],
});

export const freelanceComparePages: SeedPage[] = [
  versus({
    slug: "fiverr", name: "Fiverr", keyword: "yolias vs fiverr", secondary: ["fiverr alternative for freelancers", "find clients without fiverr", "how to get clients outside fiverr"],
    lead: { en: "Fiverr lets buyers order fixed-price services (gigs) from a catalogue of sellers. It's a fast way to get small orders, but you compete with thousands of gigs and the platform keeps a share of every order. Yolias works the other way: you choose the companies you want, and it gets you meetings with them.", ar: "تتيح Fiverr للمشترين طلب خدمات بسعر ثابت (Gigs) من كتالوج بائعين. إنها طريقة سريعة لطلبات صغيرة، لكنك تنافس آلاف العروض وتحتفظ المنصة بحصة من كل طلب. أما يولياس فيعمل بالعكس: تختار الشركات التي تريدها، ويحصل لك على اجتماعات معها." },
    answer: { en: "Use Fiverr if you sell small, packaged services to buyers who are already searching. Use Yolias when you want bigger clients you pick yourself, direct relationships and no commission on the work: it finds the companies, emails the decision makers from your mailbox and books the meeting.", ar: "استخدم Fiverr إذا كنت تبيع خدمات صغيرة جاهزة لمشترين يبحثون بالفعل. واستخدم يولياس عندما تريد عملاء أكبر تختارهم بنفسك، وعلاقات مباشرة، بلا عمولة على العمل: فهو يجد الشركات ويراسل صنّاع القرار من بريدك ويحجز الاجتماع." },
    them: {
      model: { en: "A marketplace of fixed-price services (gigs) that buyers browse and order", ar: "سوق لخدمات بسعر ثابت (Gigs) يتصفحها المشترون ويطلبونها" },
      clients: { en: "Buyers who search Fiverr's catalogue", ar: "مشترون يبحثون في كتالوج Fiverr" },
      competition: { en: "Every gig competes with many similar ones on ranking, reviews and price", ar: "كل عرض ينافس عروضًا مشابهة كثيرة على الترتيب والتقييمات والسعر" },
      fees: { en: "Fiverr keeps 20% of each order; buyers also pay a service fee (its help center, unverified)", ar: "تحتفظ Fiverr بـ 20% من كل طلب، ويدفع المشتري رسوم خدمة أيضًا (مركز مساعدتها، غير موثّق)" },
      relationship: { en: "Communication and payment stay on Fiverr", ar: "التواصل والدفع يبقيان على Fiverr" },
      effort: { en: "Building gigs, reviews and ranking, and answering buyers fast", ar: "بناء العروض والتقييمات والترتيب، والرد السريع على المشترين" },
      price: { en: "Free to join; the fee is taken from each order", ar: "الانضمام مجاني؛ وتُخصم الرسوم من كل طلب" },
    },
    chooseThem: { en: ["You sell small, well-defined services at a fixed price.", "You want buyers who are already searching, without outreach.", "You're starting out and need reviews."], ar: ["تبيع خدمات صغيرة محددة بسعر ثابت.", "تريد مشترين يبحثون بالفعل، بلا تواصل منك.", "تبدأ للتو وتحتاج تقييمات."] },
    chooseYolias: { en: ["You want to choose your clients: the industries, countries and size of company you do your best work for.", "You want direct, long-term clients without a commission on every project.", "You'd rather spend your time in meetings than on proposals and rankings."], ar: ["تريد اختيار عملائك: المجالات والدول وحجم الشركات التي تقدم لها أفضل عملك.", "تريد عملاء مباشرين وطويلي الأمد بلا عمولة على كل مشروع.", "تفضّل قضاء وقتك في الاجتماعات بدل العروض والترتيب."] },
    faq: commonFaq("Fiverr"),
    sources: ["https://www.fiverr.com/", "https://help.fiverr.com/"],
  }),
  versus({
    slug: "upwork", name: "Upwork", keyword: "yolias vs upwork", secondary: ["upwork alternative for freelancers", "find clients without upwork", "how to get clients outside upwork"],
    lead: { en: "On Upwork, clients post jobs and freelancers send proposals, paying Connects to apply and a service fee on what they earn. It works when you win the proposal race. Yolias doesn't wait for a job post: it finds companies that fit your service and starts the conversation for you.", ar: "على Upwork ينشر العملاء الوظائف ويرسل المستقلون عروضًا، ويدفعون Connects للتقديم ورسوم خدمة على ما يكسبونه. ينجح الأمر عندما تفوز في سباق العروض. أما يولياس فلا ينتظر إعلان وظيفة: يجد الشركات المناسبة لخدمتك ويبدأ المحادثة نيابةً عنك." },
    answer: { en: "Use Upwork to answer clients who already posted a job. Use Yolias to reach companies before they post anything: it emails the decision makers from your mailbox, answers their replies and books the meeting, with no fee on your contracts.", ar: "استخدم Upwork للرد على عملاء نشروا وظيفة بالفعل. واستخدم يولياس للوصول إلى الشركات قبل أن تنشر شيئًا: فهو يراسل صنّاع القرار من بريدك ويرد ويحجز الاجتماع، بلا رسوم على عقودك." },
    them: {
      model: { en: "A marketplace where clients post jobs and freelancers send proposals", ar: "سوق ينشر فيه العملاء الوظائف ويرسل المستقلون عروضًا" },
      clients: { en: "Clients who post a job on Upwork", ar: "عملاء ينشرون وظيفة على Upwork" },
      competition: { en: "Many proposals for each job", ar: "عروض كثيرة لكل وظيفة" },
      fees: { en: "A variable freelancer service fee of 0% to 15% per contract, and Connects to send proposals (its help center, unverified)", ar: "رسوم خدمة متغيرة على المستقل من 0% إلى 15% لكل عقد، وConnects لإرسال العروض (مركز مساعدتها، غير موثّق)" },
      relationship: { en: "Contracts and payments run through Upwork", ar: "العقود والمدفوعات تمر عبر Upwork" },
      effort: { en: "Finding jobs, writing proposals and keeping your profile ranked", ar: "إيجاد الوظائف وكتابة العروض والحفاظ على ترتيب ملفك" },
      price: { en: "Free basic plan with some Connects; more Connects and a paid plan for extra features", ar: "خطة أساسية مجانية ببعض الـ Connects؛ ومزيد منها وخطة مدفوعة لميزات إضافية" },
    },
    chooseThem: { en: ["You want clients who already know they need a freelancer.", "You like Upwork's contracts, time tracking and payment protection.", "You have a strong profile and win proposals."], ar: ["تريد عملاء يعرفون بالفعل أنهم يحتاجون مستقلًا.", "تحب عقود Upwork وتتبع الوقت وحماية الدفع.", "لديك ملف قوي وتفوز بالعروض."] },
    chooseYolias: { en: ["You're tired of competing on every job post.", "You want to reach specific companies and decision makers directly.", "You want to keep the whole contract value."], ar: ["سئمت المنافسة على كل إعلان وظيفة.", "تريد الوصول إلى شركات وصنّاع قرار محددين مباشرة.", "تريد الاحتفاظ بقيمة العقد كاملة."] },
    faq: commonFaq("Upwork"),
    sources: ["https://www.upwork.com/", "https://support.upwork.com/"],
  }),
  versus({
    slug: "freelancer", name: "Freelancer.com", keyword: "yolias vs freelancer.com", secondary: ["freelancer.com alternative", "find clients without freelancer.com", "freelancer.com vs upwork vs yolias"],
    lead: { en: "Freelancer.com is a marketplace of projects and contests where freelancers bid for work. Yolias goes to the clients instead: it finds the companies you'd like to work with and gets you meetings with the people who decide.", ar: "Freelancer.com سوق للمشاريع والمسابقات يقدّم فيه المستقلون عروضًا على العمل. أما يولياس فيذهب إلى العملاء: يجد الشركات التي تحب العمل معها ويحصل لك على اجتماعات مع أصحاب القرار." },
    answer: { en: "Use Freelancer.com to bid on projects that are already posted. Use Yolias to create your own opportunities with companies you choose, with no project fee.", ar: "استخدم Freelancer.com للتقديم على مشاريع منشورة بالفعل. واستخدم يولياس لصنع فرصك مع شركات تختارها، بلا رسوم على المشروع." },
    them: {
      model: { en: "A marketplace of projects and contests that freelancers bid on", ar: "سوق مشاريع ومسابقات يقدّم عليها المستقلون عروضًا" },
      clients: { en: "Employers who post projects or contests", ar: "أصحاب عمل ينشرون مشاريع أو مسابقات" },
      competition: { en: "Many bids for each project", ar: "عروض كثيرة لكل مشروع" },
      fees: { en: "10% of fixed-price projects or $5, whichever is greater, and 10% of hourly payments (its fees page, 2 Nov 2026)", ar: "10% من المشاريع بسعر ثابت أو 5 دولارات أيهما أكبر، و10% من المدفوعات بالساعة (صفحة رسومه، 2 نوفمبر 2026)" },
      relationship: { en: "Projects and payments run through Freelancer.com", ar: "المشاريع والمدفوعات تمر عبر Freelancer.com" },
      effort: { en: "Bidding on projects and competing on price", ar: "التقديم على المشاريع والمنافسة بالسعر" },
      price: { en: "Free to join; fees taken from projects; paid memberships for more bids", ar: "الانضمام مجاني؛ والرسوم تُخصم من المشاريع؛ وعضويات مدفوعة لعروض أكثر" },
    },
    chooseThem: { en: ["You like bidding on many small projects.", "You want contests and milestone payments on a platform."], ar: ["تحب التقديم على مشاريع صغيرة كثيرة.", "تريد المسابقات والدفعات المرحلية على منصة."] },
    chooseYolias: { en: ["You want to stop competing on price.", "You want clients you chose, in the markets you know.", "You want meetings, not bids."], ar: ["تريد التوقف عن المنافسة بالسعر.", "تريد عملاء اخترتهم، في الأسواق التي تعرفها.", "تريد اجتماعات، لا عروضًا."] },
    faq: commonFaq("Freelancer.com"),
    sources: ["https://www.freelancer.com/", "https://www.freelancer.com/feesandcharges"],
  }),
];

const D = "2026-11-02";
export const freelanceCompetitors: SeedCompetitor[] = [
  ["fiverr", "Fiverr", "https://www.fiverr.com", "https://www.fiverr.com",
    { en: "A marketplace where buyers order fixed-price services (gigs) from freelancers.", ar: "سوق يطلب فيه المشترون خدمات بسعر ثابت (Gigs) من المستقلين." },
    { en: "Freelancers selling small, packaged services to buyers who are already searching.", ar: "المستقلون الذين يبيعون خدمات صغيرة جاهزة لمشترين يبحثون بالفعل." }],
  ["upwork", "Upwork", "https://www.upwork.com", "https://www.upwork.com",
    { en: "A marketplace where clients post jobs and freelancers send proposals.", ar: "سوق ينشر فيه العملاء الوظائف ويرسل المستقلون عروضًا." },
    { en: "Freelancers who win proposals for jobs clients already posted.", ar: "المستقلون الذين يفوزون بعروض على وظائف نشرها العملاء." }],
  ["freelancer", "Freelancer.com", "https://www.freelancer.com", "https://www.freelancer.com/feesandcharges",
    { en: "A marketplace of projects and contests that freelancers bid on.", ar: "سوق مشاريع ومسابقات يقدّم عليها المستقلون عروضًا." },
    { en: "Freelancers who bid on many posted projects.", ar: "المستقلون الذين يقدّمون على مشاريع منشورة كثيرة." }],
].map(([slug, name, website, pricing_url, summary, best_for]) => ({
  slug: slug as string, name: name as string, website: website as string, pricing_url: pricing_url as string, publishes_prices: null,
  summary: summary as L, best_for: best_for as L,
  strengths: { en: ["Buyers who are already looking for a freelancer"], ar: ["مشترون يبحثون بالفعل عن مستقل"] },
  limits: { en: ["You compete with many sellers on each job, and the platform takes a fee on the work"], ar: ["تنافس بائعين كثيرين على كل عمل، وتأخذ المنصة رسومًا على العمل"] },
  pricing: [], facts: [], last_reviewed_at: D,
}));

const audienceSteps = (ex: L) => ({
  en: [
    { title: "Set the result", body: "Create a campaign: the meetings you want, what you offer, the budget and the dates." },
    { title: "Choose who to reach", body: `Pick the audience from lists, or describe it, for example: "${ex.en}".` },
    { title: "Preview and launch", body: "Pick your mailbox and tone, preview Yolias's email, and launch." },
    { title: "Take the meetings", body: "Yolias writes, follows up, answers and books; you see the meetings booked and what each one cost." },
  ],
  ar: [
    { title: "حدد النتيجة", body: "أنشئ حملة: الاجتماعات التي تريدها، وما تقدمه، والميزانية والتواريخ." },
    { title: "اختر من تريد الوصول إليهم", body: `اختر الجمهور من القوائم، أو صفه، مثلًا: «${ex.ar}».` },
    { title: "عاين ثم شغّل", body: "اختر بريدك والأسلوب، وعاين رسالة يولياس، ثم شغّل الحملة." },
    { title: "احضر الاجتماعات", body: "يكتب يولياس ويتابع ويرد ويحجز؛ وترى الاجتماعات وتكلفة الاجتماع." },
  ],
});

function audience(slug: string, keyword: string, secondary: string[], en: { title: string; h1: string; metaTitle: string; metaDescription: string; lead: string; answer: string; audience: string[]; criteria: string[]; ex: string; faq: { q: string; a: string }[] }, ar: { title: string; h1: string; metaTitle: string; metaDescription: string; lead: string; answer: string; audience: string[]; criteria: string[]; ex: string; faq: { q: string; a: string }[] }): SeedPage {
  const st = audienceSteps({ en: en.ex, ar: ar.ex });
  const side = (x: typeof en, l: "en" | "ar") => ({
    title: x.title, h1: x.h1, metaTitle: x.metaTitle, metaDescription: x.metaDescription, lead: x.lead, answer: x.answer, audience: x.audience, criteria: x.criteria,
    steps: st[l], blocks: [], faq: x.faq, cta: CTA[l],
  });
  return {
    kind: "solution", slug, primary_keyword: keyword, secondary_keywords: secondary, sources: [],
    links: [
      { path: "/solutions/freelancers", en: "Freelancers", ar: "المستقلون" },
      { path: "/solutions/consultants", en: "Consultants", ar: "الاستشاريون" },
      { path: "/solutions/sales-teams", en: "Sales teams", ar: "فرق المبيعات" },
      { path: "/compare/apollo", en: "Yolias vs Apollo", ar: "يولياس مقابل Apollo" },
    ],
    en: side(en, "en"), ar: side(ar, "ar"),
  };
}

export const freelanceSolutionPages: SeedPage[] = [
  audience("service-providers", "ai sales agent for service providers", ["how to get clients for a service business", "client acquisition for service providers", "b2b appointment setting ai"],
    {
      title: "Service providers", h1: "Meetings with the companies your service is built for",
      metaTitle: "Yolias AI for service providers | Yolias",
      metaDescription: "For agencies, studios and service firms: Yolias finds companies that need your service, emails the decision makers from your mailbox and books the meetings.",
      lead: "A service business grows one client conversation at a time. Yolias starts those conversations for you with the companies you choose, and books the meetings when they're interested.",
      answer: "To get more clients for a service business, pick the companies your service fits best, reach the person who decides with a short email about their situation, follow up, and make booking a call easy. Yolias does all of that as Yolias AI and shows what each meeting cost.",
      audience: ["Agencies (marketing, design, development, SEO)", "IT and managed service providers", "Accounting, legal and HR firms", "Training and consulting firms"],
      criteria: ["Industries and company sizes you've served before", "Countries and cities you can serve", "The roles that buy your service", "Companies to leave out: current clients and competitors"],
      ex: "Clinics in Riyadh and Jeddah with 10–50 employees; owners and operations managers",
      faq: [
        { q: "Will Yolias find clients who are ready to buy?", a: "It finds companies that match who you serve and starts the conversation; who is ready shows in the replies. Yolias answers those, sends interested people your booking page and books the meeting." },
        { q: "Does it send from my email?", a: "Yes, from your own Gmail or IMAP/SMTP mailbox, within daily limits, and it never writes again to anyone who says no." },
      ],
    },
    {
      title: "مقدمو الخدمات", h1: "اجتماعات مع الشركات التي صُممت خدمتك لها",
      metaTitle: "Yolias AI لمقدمي الخدمات | يولياس",
      metaDescription: "للوكالات والاستوديوهات وشركات الخدمات: يجد يولياس الشركات التي تحتاج خدمتك، ويراسل صنّاع القرار من بريدك، ويحجز الاجتماعات.",
      lead: "ينمو نشاط الخدمات بمحادثة مع عميل تلو الأخرى. يبدأ يولياس هذه المحادثات نيابةً عنك مع الشركات التي تختارها، ويحجز الاجتماعات عندما تهتم.",
      answer: "لتحصل على عملاء أكثر لنشاط خدمي، اختر الشركات التي تناسبها خدمتك أكثر، وتواصل مع صاحب القرار برسالة قصيرة عن وضعه، وتابع، واجعل حجز المكالمة سهلًا. يقوم يولياس بكل ذلك كوكيل مبيعات ويعرض تكلفة كل اجتماع.",
      audience: ["الوكالات (تسويق، تصميم، برمجة، SEO)", "مزودو خدمات تقنية المعلومات", "مكاتب المحاسبة والمحاماة والموارد البشرية", "شركات التدريب والاستشارات"],
      criteria: ["المجالات وأحجام الشركات التي خدمتها من قبل", "الدول والمدن التي تستطيع خدمتها", "الأدوار التي تشتري خدمتك", "شركات تُستبعد: عملاؤك الحاليون ومنافسوك"],
      ex: "عيادات في الرياض وجدة بها 10–50 موظفًا؛ الملاك ومديرو العمليات",
      faq: [
        { q: "هل سيجد يولياس عملاء جاهزين للشراء؟", a: "يجد الشركات المطابقة لمن تخدمهم ويبدأ المحادثة؛ ومن هو جاهز يظهر في الردود. يرد يولياس عليها، ويرسل للمهتمين صفحة الحجز، ويحجز الاجتماع." },
        { q: "هل يرسل من بريدي؟", a: "نعم، من Gmail أو بريد IMAP/SMTP الخاص بك، في حدود يومية، ولا يكتب أبدًا مرة أخرى لمن يرفض." },
      ],
    }),
  audience("founders", "ai sales agent for founders", ["founder led sales automation", "how founders get first customers", "outbound for early stage startups"],
    {
      title: "Founders", h1: "Founder-led sales, without the founder running the campaigns",
      metaTitle: "Yolias AI for founders | Yolias",
      metaDescription: "Founders: set the customers you want to meet and Yolias finds them, emails them from your mailbox, answers replies and books the meetings, with the cost per meeting.",
      lead: "Early on, the founder sells. Yolias takes the slow part off your plate: finding the right companies and people, writing to each one and handling the replies, so your time goes into the meetings.",
      answer: "Founders get first customers by talking to many well-chosen leads quickly. Set the companies and roles you want, launch a campaign with a small daily budget, and let Yolias write, follow up and book. Watch the cost per meeting to see which audience works.",
      audience: ["Pre-seed and seed startups", "Founders of SaaS and service businesses", "Solo founders without a sales team"],
      criteria: ["Your best early customers (start a lookalike audience from them)", "The roles that feel the problem you solve", "Countries where you can sell and support"],
      ex: "Fintech startups in the UAE and Saudi Arabia with 10–100 employees; founders and CTOs",
      faq: [
        { q: "How much budget do I need to start?", a: "Pay As You Go starts at $5. A daily budget keeps spend predictable while you see which audience gets meetings." },
        { q: "Will the emails sound like me?", a: "Yolias writes from your Company Knowledge, your notes and the tone you choose, signs with your name, and you preview a sample before launching." },
      ],
    },
    {
      title: "المؤسسون", h1: "مبيعات يقودها المؤسس، دون أن يبحث المؤسس عن العملاء بنفسه",
      metaTitle: "Yolias AI للمؤسسين | يولياس",
      metaDescription: "للمؤسسين: حدد العملاء الذين تريد مقابلتهم، فيجدهم يولياس ويراسلهم من بريدك ويرد ويحجز الاجتماعات، مع تكلفة الاجتماع.",
      lead: "في البداية يبيع المؤسس بنفسه. يأخذ يولياس الجزء البطيء عنك: إيجاد الشركات والأشخاص المناسبين، والكتابة لكل منهم، والتعامل مع الردود، ليذهب وقتك إلى الاجتماعات.",
      answer: "يحصل المؤسسون على أول عملائهم بالتحدث مع كثير من العملاء المختارين جيدًا بسرعة. حدد الشركات والأدوار التي تريدها، وشغّل حملة بميزانية يومية صغيرة، ودع يولياس يكتب ويتابع ويحجز. وتابع تكلفة الاجتماع لترى أي جمهور ينجح.",
      audience: ["الشركات الناشئة في مراحلها الأولى", "مؤسسو شركات SaaS والخدمات المهنية", "المؤسسون المنفردون بلا فريق مبيعات"],
      criteria: ["أفضل عملائك الأوائل (ابدأ منهم جمهورًا مشابهًا)", "الأدوار التي تشعر بالمشكلة التي تحلها", "الدول التي تستطيع البيع والدعم فيها"],
      ex: "شركات التقنية المالية الناشئة في الإمارات والسعودية (10–100 موظف)؛ المؤسسون والمديرون التقنيون",
      faq: [
        { q: "ما الميزانية التي أحتاجها للبدء؟", a: "الدفع حسب الاستخدام يبدأ من 5 دولارات. والميزانية اليومية تبقي الإنفاق متوقعًا بينما ترى أي جمهور يجلب اجتماعات." },
        { q: "هل ستبدو الرسائل كأنها مني؟", a: "يكتب يولياس من معرفة شركتك وملاحظاتك والأسلوب الذي تختاره، ويوقّع باسمك، وتعاين رسالة نموذجية قبل التشغيل." },
      ],
    }),
];
