import type { Doc, Localized } from "./types";

export interface BlogPost {
  slug: string;
  date: string;
  category: Localized<string>;
  doc: Localized<Doc>;
}

export const blogHero: Localized<{ eyebrow: string; title: string; lead: string }> = {
  en: { eyebrow: "BLOG", title: "Notes from the Yolias team", lead: "Product updates, practical guides and how we think about finding customers." },
  ar: { eyebrow: "المدونة", title: "ملاحظات من فريق يولـياس", lead: "تحديثات المنتج وأدلة عملية وطريقة تفكيرنا في العثور على العملاء." },
};

export const posts: BlogPost[] = [
  {
    slug: "introducing-yolias",
    date: "2026-10-01",
    category: { en: "Product", ar: "المنتج" },
    doc: {
      en: {
        title: "Introducing Yolias",
        summary: "A customer-discovery assistant that starts from one sentence about who you want to sell to.",
        blocks: [
          { p: "Every B2B team has the same Monday problem: the pipeline needs new names, and building the list takes longer than working it. Someone opens a spreadsheet, a directory and a dozen tabs, and the afternoon is gone." },
          { p: "Yolias starts from a different place. Instead of a filter panel, you get a single box and one question: who do you want to sell to? Write the answer the way you would brief a new hire — the market, the kind of company, how big, which signals matter, which people you need to reach." },
          { h2: "What happens next" },
          { p: "Yolias AI reads the request alongside what it already knows about your business, and turns it into a customer profile: countries and cities, industries, company size, hiring or funding signals, and the decision makers to find. Whatever you didn’t specify is filled in and shown as an assumption, so nothing is hidden." },
          { p: "The profile becomes a campaign — a discovery mission with a target, a status and an activity log. As results arrive, each decision maker comes with a match score that explains itself: which criteria the person and their company meet." },
          { h2: "Built for the region" },
          { p: "Yolias works fully in Arabic and English. The interface mirrors right-to-left, requests can be written in either language, and the summaries Yolias writes follow the language you choose." },
          { h2: "Where to start" },
          { p: "Choose a plan on [Pricing](/pricing), describe your business during onboarding, and write your first strategy. The [Quickstart](/docs/quickstart) walks through it." },
        ],
      },
      ar: {
        title: "نقدّم لكم يولـياس",
        summary: "مساعد لاكتشاف العملاء يبدأ من جملة واحدة عمّن تريد أن تبيع له.",
        blocks: [
          { p: "لدى كل فريق B2B مشكلة يوم الأحد نفسها: خط المبيعات يحتاج أسماء جديدة، وبناء القائمة يستغرق وقتًا أطول من العمل عليها. يفتح أحدهم جدولًا ودليلًا وعشرات التبويبات، فيضيع اليوم." },
          { p: "يبدأ يولـياس من مكان مختلف. بدل لوحة فلاتر، تحصل على مربع واحد وسؤال واحد: لمن تريد أن تبيع؟ اكتب الإجابة كما تشرح المهمة لموظف جديد — السوق، ونوع الشركة، وحجمها، والمؤشرات المهمة، والأشخاص الذين تريد الوصول إليهم." },
          { h2: "ما الذي يحدث بعد ذلك" },
          { p: "يقرأ يولـياس AI الطلب مع ما يعرفه عن عملك، ويحوّله إلى ملف عميل مثالي: الدول والمدن، والقطاعات، وحجم الشركة، ومؤشرات التوظيف أو التمويل، وصنّاع القرار المطلوبين. وما لم تحدده يُكمَل ويظهر كافتراض، فلا شيء مخفي." },
          { p: "يتحول الملف إلى حملة — مهمة اكتشاف لها هدف وحالة وسجل نشاط. ومع وصول النتائج يأتي كل صانع قرار بنسبة تطابق تشرح نفسها: أي المعايير يحققها الشخص وشركته." },
          { h2: "مصمم للمنطقة" },
          { p: "يعمل يولـياس بالكامل بالعربية والإنجليزية. تنعكس الواجهة من اليمين لليسار، ويمكن كتابة الطلبات بأي من اللغتين، وتتبع الملخصات التي يكتبها يولـياس اللغة التي تختارها." },
          { h2: "من أين تبدأ" },
          { p: "اختر خطة من [الأسعار](/pricing)، وصِف عملك أثناء الإعداد الأولي، واكتب أول استراتيجية. يشرح [البدء السريع](/docs/quickstart) الخطوات." },
        ],
      },
    },
  },
  {
    slug: "writing-better-strategies",
    date: "2026-10-01",
    category: { en: "Guides", ar: "أدلة" },
    doc: {
      en: {
        title: "Three rewrites that make a strategy sharper",
        summary: "The same request, improved step by step — and why each change helps.",
        blocks: [
          { p: "Yolias can work with a vague request, but every detail you add replaces an assumption with a decision. Here is one strategy, rewritten three times." },
          { h2: "Start: “Find me fintech companies.”" },
          { p: "Yolias will open a campaign, but it has to assume almost everything: your default country, any size, a target of one hundred, and decision makers inferred from what you sell. The result card lists all of those as assumptions." },
          { h2: "Rewrite 1 — add the market and size" },
          { p: "“Find fintech companies in the UAE with 50–200 employees.” Now the market and size criteria count toward each match score, and companies outside them stop scoring well." },
          { h2: "Rewrite 2 — add a signal" },
          { p: "“…that are hiring engineers.” Signals separate companies that look right from companies that are moving. Hiring, a recent funding round or a technology they use are all good candidates." },
          { h2: "Rewrite 3 — name the people" },
          { p: "“…and reach the CTO or head of engineering.” Naming roles is the single biggest improvement: it decides who appears in your prospects and adds the decision-maker criterion to every score." },
          { note: "Tip: attach a CSV of three or four of your best customers. Yolias reads it as an example of what “right” looks like." },
        ],
      },
      ar: {
        title: "ثلاث إعادات صياغة تجعل استراتيجيتك أدق",
        summary: "الطلب نفسه يتحسن خطوة بخطوة — ولماذا يفيد كل تغيير.",
        blocks: [
          { p: "يستطيع يولـياس العمل مع طلب عام، لكن كل تفصيل تضيفه يستبدل افتراضًا بقرار. إليك استراتيجية واحدة أُعيدت صياغتها ثلاث مرات." },
          { h2: "البداية: «ابحث لي عن شركات تقنية مالية.»" },
          { p: "سيفتح يولـياس حملة، لكنه سيفترض كل شيء تقريبًا: دولتك الافتراضية، وأي حجم، وهدف مئة شركة، وصنّاع قرار يستنتجهم مما تبيعه. وتعرض بطاقة النتيجة كل ذلك كافتراضات." },
          { h2: "الصياغة الأولى — أضف السوق والحجم" },
          { p: "«ابحث عن شركات تقنية مالية في الإمارات بها 50–200 موظف.» الآن يدخل معيارا السوق والحجم في كل نسبة تطابق، وتتراجع نتائج الشركات خارجهما." },
          { h2: "الصياغة الثانية — أضف مؤشرًا" },
          { p: "«…وتوظّف مهندسين.» تفرّق المؤشرات بين شركات تبدو مناسبة وشركات تتحرك فعلًا. التوظيف أو جولة تمويل حديثة أو تقنية تستخدمها كلها مؤشرات جيدة." },
          { h2: "الصياغة الثالثة — سمِّ الأشخاص" },
          { p: "«…وأريد الوصول إلى المدير التقني أو رئيس الهندسة.» تسمية المناصب هي أكبر تحسين منفرد: تحدد من يظهر في قائمتك وتضيف معيار صانع القرار إلى كل تقييم." },
          { note: "نصيحة: أرفق ملف CSV لثلاثة أو أربعة من أفضل عملائك. يقرأه يولـياس كمثال على شكل العميل المناسب." },
        ],
      },
    },
  },
  {
    slug: "why-yolias-stops-at-discovery",
    date: "2026-10-01",
    category: { en: "Perspective", ar: "رأي" },
    doc: {
      en: {
        title: "Why Yolias stops at discovery",
        summary: "We chose not to send messages for you. Here is the reasoning.",
        blocks: [
          { p: "The obvious next feature for a product like Yolias is outreach: write the emails, send them, follow up automatically. We decided not to build it — at least not now — and the reasons shape the whole product." },
          { h2: "Quality is decided before the first message" },
          { p: "Most outreach fails because it reaches the wrong people, not because the email was badly written. Every hour we spend on discovery — better criteria, clearer match scores, verified channels — improves every conversation that follows, whichever tool you use for it." },
          { h2: "Your voice should stay yours" },
          { p: "How you introduce your company to a founder in Riyadh or a procurement head in Cairo is a judgment call. Automating it at scale tends to produce the messages everyone has learned to ignore." },
          { h2: "Compliance belongs with the sender" },
          { p: "Rules for contacting people differ by country and channel. Keeping outreach in your hands keeps responsibility clear: Yolias finds and qualifies, and you decide whether and how to get in touch." },
          { p: "That is why the product ends with a list you can trust and an export button, not a send button." },
        ],
      },
      ar: {
        title: "لماذا يتوقف يولـياس عند الاكتشاف",
        summary: "اخترنا ألا نرسل الرسائل نيابةً عنك. إليك الأسباب.",
        blocks: [
          { p: "الميزة التالية البديهية لمنتج مثل يولـياس هي التواصل: كتابة الرسائل وإرسالها ومتابعتها تلقائيًا. قررنا ألا نبنيها — على الأقل الآن — وهذه الأسباب تشكّل المنتج كله." },
          { h2: "الجودة تتحدد قبل الرسالة الأولى" },
          { p: "يفشل معظم التواصل لأنه يصل إلى الأشخاص الخطأ، لا لأن الرسالة سيئة الصياغة. كل ساعة نقضيها في الاكتشاف — معايير أفضل، ونسب تطابق أوضح، وقنوات موثّقة — تحسّن كل محادثة تليها، أيًا كانت الأداة التي تستخدمها." },
          { h2: "صوتك يجب أن يبقى لك" },
          { p: "طريقة تقديم شركتك لمؤسس في الرياض أو مدير مشتريات في القاهرة قرار يحتاج تقديرًا. وأتمتتها على نطاق واسع تنتج غالبًا الرسائل التي تعلّم الجميع تجاهلها." },
          { h2: "الامتثال مسؤولية المرسِل" },
          { p: "تختلف قواعد التواصل مع الأشخاص من دولة لأخرى ومن قناة لأخرى. وإبقاء التواصل بين يديك يجعل المسؤولية واضحة: يولـياس يجد ويؤهل، وأنت تقرر هل تتواصل وكيف." },
          { p: "لهذا ينتهي المنتج بقائمة يمكنك الوثوق بها وزر تصدير، لا زر إرسال." },
        ],
      },
    },
  },
];
