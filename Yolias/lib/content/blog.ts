import type { Doc, Localized } from "./types";
import { guidePosts } from "./blog-guides";
import { aeoPosts } from "./blog-aeo";

export interface BlogPost {
  slug: string;
  date: string;
  category: Localized<string>;
  doc: Localized<Doc>;
}

export const blogHero: Localized<{ eyebrow: string; title: string; lead: string }> = {
  en: { eyebrow: "BLOG", title: "Notes from the Yolias team", lead: "Product updates, practical guides and how we think about finding customers." },
  ar: { eyebrow: "المدونة", title: "ملاحظات من فريق يولياس", lead: "تحديثات المنتج وأدلة عملية وطريقة تفكيرنا في العثور على العملاء." },
};

export const posts: BlogPost[] = [
  // Newest first: answer-first guides (lib/content/blog-aeo.ts), then long-form guides (lib/content/blog-guides.ts).
  ...aeoPosts,
  ...guidePosts,
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
          { p: "Yolias starts from a different place. Instead of a filter panel, you get a single box and one question: who do you want to sell to? Write the answer the way you would brief a new hire: the market, the kind of company, how big, which signals matter, which people you need to reach." },
          { h2: "What happens next" },
          { p: "Yolias AI reads the request alongside what it already knows about your business, and turns it into a customer profile: countries and cities, industries, company size, hiring or funding signals, and the decision makers to find. Whatever you didn’t specify is filled in and shown as an assumption, so nothing is hidden." },
          { p: "The profile becomes a campaign: a discovery mission with a target, a status and an activity log. As results arrive, each decision maker comes with a match score that explains itself: which criteria the person and their company meet." },
          { h2: "Built for the region" },
          { p: "Yolias works fully in Arabic and English. The interface mirrors right-to-left, requests can be written in either language, and the summaries Yolias writes follow the language you choose." },
          { h2: "Where to start" },
          { p: "Choose a plan on [Pricing](/pricing), describe your business during onboarding, and run your first search. The [Quickstart](/docs/quickstart) walks through it." },
        ],
      },
      ar: {
        title: "نقدّم لكم يولياس",
        summary: "مساعد لاكتشاف العملاء يبدأ من جملة واحدة عمّن تريد أن تبيع له.",
        blocks: [
          { p: "لدى كل فريق B2B مشكلة يوم الأحد نفسها: خط المبيعات يحتاج أسماء جديدة، وبناء القائمة يستغرق وقتًا أطول من العمل عليها. يفتح أحدهم جدولًا ودليلًا وعشرات التبويبات، فيضيع اليوم." },
          { p: "يبدأ يولياس من مكان مختلف. بدل لوحة فلاتر، تحصل على مربع واحد وسؤال واحد: لمن تريد أن تبيع؟ اكتب الإجابة كما تشرح المهمة لموظف جديد، السوق، ونوع الشركة، وحجمها، والمؤشرات المهمة، والأشخاص الذين تريد الوصول إليهم." },
          { h2: "ما الذي يحدث بعد ذلك" },
          { p: "يقرأ يولياس AI الطلب مع ما يعرفه عن عملك، ويحوّله إلى ملف عميل مثالي: الدول والمدن، والقطاعات، وحجم الشركة، ومؤشرات التوظيف أو التمويل، وصنّاع القرار المطلوبين. وما لم تحدده يُكمَل ويظهر كافتراض، فلا شيء مخفي." },
          { p: "يتحول الملف إلى حملة، مهمة اكتشاف لها هدف وحالة وسجل نشاط. ومع وصول النتائج يأتي كل صانع قرار بنسبة تطابق تشرح نفسها: أي المعايير يحققها الشخص وشركته." },
          { h2: "مصمم للمنطقة" },
          { p: "يعمل يولياس بالكامل بالعربية والإنجليزية. تنعكس الواجهة من اليمين لليسار، ويمكن كتابة الطلبات بأي من اللغتين، وتتبع الملخصات التي يكتبها يولياس اللغة التي تختارها." },
          { h2: "من أين تبدأ" },
          { p: "اختر خطة من [الأسعار](/pricing)، وصِف عملك أثناء الإعداد الأولي، وابدأ أول بحث. يشرح [البدء السريع](/docs/quickstart) الخطوات." },
        ],
      },
    },
  },
  {
    slug: "writing-better-searches",
    date: "2026-10-01",
    category: { en: "Guides", ar: "أدلة" },
    doc: {
      en: {
        title: "Three rewrites that make a search sharper",
        summary: "The same request, improved step by step, and why each change helps.",
        blocks: [
          { p: "Yolias can work with a vague request, but every detail you add replaces an assumption with a decision. Here is one search, rewritten three times." },
          { h2: "Start: “Find me fintech companies.”" },
          { p: "Yolias will open a campaign, but it has to assume almost everything: your default country, any size, a target of one hundred, and decision makers inferred from what you sell. The result card lists all of those as assumptions." },
          { h2: "Rewrite 1: add the market and size" },
          { p: "“Find fintech companies in the UAE with 50–200 employees.” Now the market and size criteria count toward each match score, and companies outside them stop scoring well." },
          { h2: "Rewrite 2: add a signal" },
          { p: "“…that are hiring engineers.” Signals separate companies that look right from companies that are moving. Hiring, a recent funding round or a technology they use are all good candidates." },
          { h2: "Rewrite 3: name the people" },
          { p: "“…and reach the CTO or head of engineering.” Naming roles is the single biggest improvement: it decides who appears in your prospects and adds the decision-maker criterion to every score." },
          { note: "Tip: attach a CSV of three or four of your best customers. Yolias reads it as an example of what “right” looks like." },
        ],
      },
      ar: {
        title: "ثلاث إعادات صياغة تجعل بحثك أدق",
        summary: "الطلب نفسه يتحسن خطوة بخطوة، ولماذا يفيد كل تغيير.",
        blocks: [
          { p: "يستطيع يولياس العمل مع طلب عام، لكن كل تفصيل تضيفه يستبدل افتراضًا بقرار. إليك بحثًا واحدًا أُعيدت صياغته ثلاث مرات." },
          { h2: "البداية: «ابحث لي عن شركات تقنية مالية.»" },
          { p: "سيفتح يولياس حملة، لكنه سيفترض كل شيء تقريبًا: دولتك الافتراضية، وأي حجم، وهدف مئة شركة، وصنّاع قرار يستنتجهم مما تبيعه. وتعرض بطاقة النتيجة كل ذلك كافتراضات." },
          { h2: "الصياغة الأولى، أضف السوق والحجم" },
          { p: "«ابحث عن شركات تقنية مالية في الإمارات بها 50–200 موظف.» الآن يدخل معيارا السوق والحجم في كل نسبة تطابق، وتتراجع نتائج الشركات خارجهما." },
          { h2: "الصياغة الثانية، أضف مؤشرًا" },
          { p: "«…وتوظّف مهندسين.» تفرّق المؤشرات بين شركات تبدو مناسبة وشركات تتحرك فعلًا. التوظيف أو جولة تمويل حديثة أو تقنية تستخدمها كلها مؤشرات جيدة." },
          { h2: "الصياغة الثالثة، سمِّ الأشخاص" },
          { p: "«…وأريد الوصول إلى المدير التقني أو رئيس الهندسة.» تسمية المناصب هي أكبر تحسين منفرد: تحدد من يظهر في قائمتك وتضيف معيار صانع القرار إلى كل تقييم." },
          { note: "نصيحة: أرفق ملف CSV لثلاثة أو أربعة من أفضل عملائك. يقرأه يولياس كمثال على شكل العميل المناسب." },
        ],
      },
    },
  },
];
