import type { Doc, Localized } from "./types";
import { guidePosts } from "./blog-guides";
import { aeoPosts } from "./blog-aeo";
import { questionPosts } from "./blog-questions";

// The blog (rewritten 2026-11-03 for the campaign platform). Slugs stay, so
// links and search results keep working. Only what Yolias does today; no
// invented numbers.

export interface BlogPost {
  slug: string;
  date: string;
  category: Localized<string>;
  doc: Localized<Doc>;
}

export const blogHero: Localized<{ eyebrow: string; title: string; lead: string }> = {
  en: { eyebrow: "BLOG", title: "Notes from the Yolias team", lead: "How to run customer acquisition as campaigns: audiences, messages, budgets and results." },
  ar: { eyebrow: "المدونة", title: "ملاحظات من فريق يولياس", lead: "كيف تدير اكتساب العملاء كحملات: الجماهير والرسائل والميزانيات والنتائج." },
};

export const posts: BlogPost[] = [
  ...questionPosts,
  ...aeoPosts,
  ...guidePosts,
  {
    slug: "introducing-yolias",
    date: "2026-11-03",
    category: { en: "Product", ar: "المنتج" },
    doc: {
      en: {
        title: "Introducing Yolias: an ad platform for acquiring customers",
        summary: "Yolias runs customer acquisition the way advertisers run ads: campaigns, audiences, budgets and results, with Yolias AI doing the work in between.",
        blocks: [
          { p: "Every business that sells to other businesses needs new customers every month. Most get them through a stack of separate tools: one to find companies, one to find contacts, one to send emails, a spreadsheet to follow up and another to report. Nobody can say what a meeting cost or which audience brought it." },
          { p: "Ad platforms solved this problem for ads years ago. You create a campaign, pick an objective, define the audience, set a budget and read the results with the cost of each one. Yolias brings the same model to acquiring customers directly." },
          { h2: "How it works" },
          { ol: [
            "**Campaign**: choose the objective (meetings, sales or website leads), your offer, the target and the budget in US dollars.",
            "**Audiences**: the companies and people you want, by country and city, industry, company size and job title, or a saved, custom or lookalike audience.",
            "**Message**: the mailbox to send from, your tone and language. Yolias AI writes a different email to each person from your Company Knowledge.",
          ] },
          { p: "Then Yolias AI runs the campaign: it finds the people every day within the budget, sends from your own mailbox in your hours, follows up, answers questions and objections, offers times and books meetings on your calendar." },
          { h2: "One engine, many objectives" },
          { p: "Under every campaign is one engine. The objective only tells it which result to pursue. A meetings campaign sends interested people to your booking page; a sales campaign sends them to your product page and the Yolias pixel counts the purchase." },
          { h2: "Results you can manage" },
          { p: "Every campaign shows reached, replies, interested, meetings, spend and cost per result, by day, audience, country or job title. Once a day Yolias moves the budget toward the audiences that bring results." },
          { p: "Yolias works in Arabic and English, with unlimited users on every plan, from $20 with Pay As You Go. [Create your first campaign](/signup)." },
        ],
      },
      ar: {
        title: "نقدّم لكم يولياس: منصة إعلانية لاكتساب العملاء",
        summary: "يدير يولياس اكتساب العملاء كما يدير المعلنون إعلاناتهم: حملات وجماهير وميزانيات ونتائج، ويتولى Yolias AI العمل بينها.",
        blocks: [
          { p: "كل شركة تبيع لشركات أخرى تحتاج عملاء جددًا كل شهر. ومعظمها يحصل عليهم عبر أدوات متفرقة: أداة لإيجاد الشركات، وأخرى لبيانات التواصل، وثالثة لإرسال البريد، وجدول للمتابعة، وأخرى للتقارير. ولا أحد يعرف كم كلّف الاجتماع ولا أي جمهور جاء به." },
          { p: "منصات الإعلانات حلّت هذه المشكلة للإعلانات منذ سنوات: تنشئ حملة، وتختار الهدف، وتحدد الجمهور، وتضبط الميزانية، وتقرأ النتائج مع تكلفة كل نتيجة. ويطبق يولياس النموذج نفسه على اكتساب العملاء مباشرة." },
          { h2: "كيف يعمل" },
          { ol: [
            "**الحملة**: اختر الهدف (اجتماعات أو مبيعات أو نماذج الموقع)، وعرضك، والمستهدف، والميزانية بالدولار.",
            "**الجماهير**: الشركات والأشخاص الذين تريدهم حسب الدولة والمدينة والمجال وحجم الشركة والمسمى الوظيفي، أو جمهور محفوظ أو مخصص أو مشابه.",
            "**الرسالة**: البريد الذي تُرسل منه، وأسلوبك ولغتك. ويكتب Yolias AI رسالة مختلفة لكل شخص من معرفة شركتك.",
          ] },
          { p: "ثم يدير Yolias AI الحملة: يجد الأشخاص كل يوم في حدود الميزانية، ويرسل من بريدك في ساعاتك، ويتابع، ويجيب عن الأسئلة والاعتراضات، ويقترح المواعيد ويحجز الاجتماعات في تقويمك." },
          { h2: "محرك واحد وأهداف متعددة" },
          { p: "تحت كل حملة محرك واحد، والهدف يحدد له النتيجة التي يسعى إليها. حملة الاجتماعات ترسل المهتمين إلى صفحة الحجز، وحملة المبيعات ترسلهم إلى صفحة منتجك ويحسب بيكسل يولياس عملية الشراء." },
          { h2: "نتائج تستطيع إدارتها" },
          { p: "تعرض كل حملة من وصلت إليهم والردود والمهتمين والاجتماعات والإنفاق وتكلفة كل نتيجة، حسب اليوم أو الجمهور أو البلد أو المسمى. ومرة يوميًا يوجّه يولياس الميزانية نحو الجماهير التي تأتي بالنتائج." },
          { p: "يعمل يولياس بالعربية والإنجليزية، مع مستخدمين بلا حد في كل خطة، ويبدأ من 20 دولارًا بالدفع حسب الاستخدام. [أنشئ حملتك الأولى](/signup)." },
        ],
      },
    },
  },
  {
    slug: "writing-better-searches",
    date: "2026-11-03",
    category: { en: "Guides", ar: "أدلة" },
    doc: {
      en: {
        title: "Three changes that make a campaign audience sharper",
        summary: "A precise audience is the biggest lever on a campaign's cost per meeting. Three changes that make it precise.",
        blocks: [
          { p: "Most campaigns that disappoint have a message problem on the surface and an audience problem underneath. When the audience is broad, even a good email reaches people who can't buy. Three changes fix most of it." },
          { h2: "1. Name the market, not the world" },
          { p: "“Companies in the Gulf” is a region. “Real estate developers in Riyadh and Jeddah” is a market. Pick the countries and cities you can actually serve, and exclude the rest. A smaller audience you can win beats a large one you can't." },
          { h2: "2. Describe the buyer, not the company" },
          { p: "Industry and size choose the companies; job titles choose who reads your email. Add the two or three titles that own the problem you solve (for example Head of Sales and Marketing Director), and the seniority that signs." },
          { h2: "3. Split, then compare" },
          { p: "Instead of one audience with every title, create two or three audiences in the same campaign: owners, sales leaders, marketing leaders. Yolias gives each an equal share while it learns, then moves the budget toward the one that books meetings. The campaign page shows today's split." },
          { h2: "Before you launch" },
          { ul: [
            "Check the number of matching companies and people Yolias already knows for each audience.",
            "Exclude your customers and competitors in **Companies never to contact**.",
            "Pick the offer from Company Knowledge that fits this audience.",
          ] },
          { p: "Read more in [Audiences](/help-center/audiences)." },
        ],
      },
      ar: {
        title: "ثلاثة تغييرات تجعل جمهور حملتك أدق",
        summary: "الجمهور الدقيق هو أكبر ما يؤثر في تكلفة الاجتماع. ثلاثة تغييرات تجعله دقيقًا.",
        blocks: [
          { p: "معظم الحملات المخيبة للآمال تبدو مشكلتها في الرسالة، بينما مشكلتها الحقيقية في الجمهور. فإذا كان الجمهور واسعًا تصل حتى الرسالة الجيدة إلى من لا يستطيع الشراء. وثلاثة تغييرات تحل معظم ذلك." },
          { h2: "1. حدد السوق لا العالم" },
          { p: "«شركات في الخليج» منطقة، أما «المطورون العقاريون في الرياض وجدة» فسوق. اختر الدول والمدن التي تستطيع خدمتها فعلًا واستبعد الباقي. فالجمهور الأصغر الذي تستطيع كسبه أفضل من جمهور كبير لا تستطيع." },
          { h2: "2. صف المشتري لا الشركة" },
          { p: "المجال والحجم يختاران الشركات، والمسميات الوظيفية تختار من يقرأ رسالتك. أضف المسميين أو الثلاثة المسؤولين عن المشكلة التي تحلها (مثل مدير المبيعات ومدير التسويق)، والمستوى الذي يوقّع." },
          { h2: "3. قسّم ثم قارن" },
          { p: "بدل جمهور واحد بكل المسميات، أنشئ جمهورين أو ثلاثة في الحملة نفسها: الملاك، وقادة المبيعات، وقادة التسويق. يعطي يولياس كلًا منها نصيبًا متساويًا أثناء التعلم، ثم يوجّه الميزانية نحو الجمهور الذي يحجز الاجتماعات. وتعرض صفحة الحملة توزيع اليوم." },
          { h2: "قبل الإطلاق" },
          { ul: [
            "راجع عدد الشركات والأشخاص المطابقين الذين يعرفهم يولياس لكل جمهور.",
            "استبعد عملاءك ومنافسيك في **الشركات التي لا تريد التواصل معها**.",
            "اختر من معرفة الشركة العرض الذي يناسب هذا الجمهور.",
          ] },
          { p: "اقرأ المزيد في [الجماهير](/help-center/audiences)." },
        ],
      },
    },
  },
];
