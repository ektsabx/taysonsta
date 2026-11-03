import type { Localized } from "./types";
import type { SolutionSlug } from "./solutions";

// Search intent and real questions for each Solutions page (D-179; rewritten
// for the AI advertising platform, owner 2026-11-03, D-276). The title
// targets what people in that business search for; answers are short and
// confident and describe the product as it works today.

export interface SolutionSeo {
  /** Page title (before " | Yolias"): the search intent the page answers. */
  seoTitle: string;
  limitsTitle: string;
  /** Kept for the page's shape; empty: the pages don't list what Yolias doesn't do (owner's copy rule). */
  limits: string[];
  faqTitle: string;
  faq: { q: string; a: string }[];
}

const common = {
  en: { limitsTitle: "", limits: [] as string[], faqTitle: "Questions" },
  ar: { limitsTitle: "", limits: [] as string[], faqTitle: "أسئلة شائعة" },
};
const shared = {
  en: {
    cost: { q: "How much does it cost?", a: "Pay As You Go from $5, or Growth ($100) and Scale ($200) a month, 20% off yearly. Every feature and unlimited users on every option." },
    team: { q: "Can my whole team use it?", a: "Yes. Unlimited users on every plan, with Admin, Advertiser and Analyst roles." },
  },
  ar: {
    cost: { q: "كم التكلفة؟", a: "الدفع حسب الاستخدام من 5 دولارات، أو النمو (100 دولار) والتوسع (200 دولار) شهريًا، بخصم 20% سنويًا. كل الميزات ومستخدمون بلا حد في كل خيار." },
    team: { q: "هل يستطيع فريقي كله استخدامه؟", a: "نعم. مستخدمون بلا حد في كل خطة، بأدوار مسؤول ومعلن ومحلل." },
  },
};

const page = (en: { title: string; q: string; a: string }, ar: { title: string; q: string; a: string }): Localized<SolutionSeo> => ({
  en: { ...common.en, seoTitle: en.title, faq: [{ q: en.q, a: en.a }, shared.en.cost, shared.en.team] },
  ar: { ...common.ar, seoTitle: ar.title, faq: [{ q: ar.q, a: ar.a }, shared.ar.cost, shared.ar.team] },
});

export const solutionSeo: Record<SolutionSlug, Localized<SolutionSeo>> = {
  "marketing-agencies": page(
    { title: "Get Clients for Your Marketing Agency with AI", q: "How do marketing agencies get clients with Yolias?", a: "Define the businesses you serve best, by industry, city and size. Yolias reaches their owners and marketing heads, writes to each one and books the meeting on your calendar." },
    { title: "عملاء لوكالة التسويق بالذكاء الاصطناعي", q: "كيف تحصل وكالات التسويق على عملاء مع يولياس؟", a: "حدد الشركات التي تخدمها بأفضل شكل حسب المجال والمدينة والحجم، ويصل يولياس إلى أصحابها ومديري التسويق فيها، ويكتب لكل منهم ويحجز الاجتماع في تقويمك." },
  ),
  "software-agencies": page(
    { title: "Get Clients for Your Software Development Company", q: "Who does Yolias reach for a software agency?", a: "Founders, CTOs and operations heads at the companies you choose, by industry, country and size, then the AI Sales Agent books the discovery call." },
    { title: "عملاء لشركة تطوير البرمجيات بالذكاء الاصطناعي", q: "من يصل إليه يولياس لشركة البرمجيات؟", a: "المؤسسون ومديرو التقنية والعمليات في الشركات التي تختارها حسب المجال والدولة والحجم، ثم يحجز وكيل المبيعات الذكي مكالمة التعرّف." },
  ),
  consultants: page(
    { title: "Get Consulting Clients with AI Campaigns", q: "Does Yolias write in my voice?", a: "Yes. It writes from your Company Knowledge and the tone you choose, in each person's language, and answers replies the same way." },
    { title: "عملاء للاستشارات بحملات ذكية", q: "هل يكتب يولياس بأسلوبي؟", a: "نعم. يكتب من معرفة شركتك وبالأسلوب الذي تختاره وبلغة كل شخص، ويرد على الردود بالطريقة نفسها." },
  ),
  "recruitment-agencies": page(
    { title: "Get Recruitment Clients: Reach Companies Hiring Now", q: "Can Yolias target companies that are hiring?", a: "Yes. Add hiring to the audience's signals and the job titles you place; Yolias reaches the hiring managers and HR heads at those companies." },
    { title: "عملاء لوكالة التوظيف: صِل إلى الشركات التي توظّف", q: "هل يستهدف يولياس الشركات التي توظّف؟", a: "نعم. أضف التوظيف إلى إشارات الجمهور والمسميات التي تعيّنها، ويصل يولياس إلى مديري التوظيف والموارد البشرية في تلك الشركات." },
  ),
  freelancers: page(
    { title: "Get Direct Freelance Clients with AI", q: "Is Yolias worth it for one person?", a: "Yes. Start from $5 with Pay As You Go, reach the businesses that need your skills and keep 100% of what they pay you." },
    { title: "عملاء مباشرون للمستقلين بالذكاء الاصطناعي", q: "هل يناسب يولياس شخصًا يعمل وحده؟", a: "نعم. ابدأ من 5 دولارات بالدفع حسب الاستخدام، وصِل إلى الشركات التي تحتاج مهاراتك، واحتفظ بكل ما يدفعونه لك." },
  ),
  "real-estate": page(
    { title: "Commercial Real Estate Leads: Companies That Need Space", q: "How does Yolias find companies that need space?", a: "Target growing companies by city, size and hiring, and the decision makers there. Yolias writes about your properties and books the viewing." },
    { title: "عملاء العقار التجاري: شركات تحتاج مساحات", q: "كيف يجد يولياس الشركات التي تحتاج مساحات؟", a: "استهدف الشركات النامية حسب المدينة والحجم والتوظيف وصنّاع القرار فيها، ويكتب يولياس عن عقاراتك ويحجز المعاينة." },
  ),
  "sales-teams": page(
    { title: "AI Prospecting and Meeting Booking for B2B Sales Teams", q: "How does Yolias fit a sales team?", a: "Each campaign targets your accounts; meetings land on each rep's calendar, and every campaign shows meetings and cost per meeting." },
    { title: "البحث عن العملاء وحجز الاجتماعات لفرق المبيعات بالذكاء الاصطناعي", q: "كيف يناسب يولياس فريق المبيعات؟", a: "كل حملة تستهدف حساباتك، وتصل الاجتماعات إلى تقويم كل مندوب، وتعرض كل حملة اجتماعاتها وتكلفة الاجتماع." },
  ),
};
