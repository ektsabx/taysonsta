import type { Block } from "@/lib/content/types.ts";

// The shape of a seeded SEO page (D-257), in both languages. Written with AI
// and published with the owner's approval (2026-10-27).

export interface Side {
  title: string;
  h1: string;
  metaTitle: string;
  metaDescription: string;
  lead: string;
  answer: string;
  audience?: string[];
  criteria?: string[];
  steps?: { title: string; body: string }[];
  compare?: { label: string; yolias: string; them: string }[];
  blocks: Block[];
  faq: { q: string; a: string }[];
  cta: { title: string; body: string; label: string };
  prompt?: string;
}

export interface SeedPage {
  kind: "compare" | "alternatives" | "solution" | "template";
  slug: string;
  primary_keyword: string;
  secondary_keywords: string[];
  format?: "versus" | "list";
  competitor?: string;
  tools?: string[];
  links: { path: string; en: string; ar: string }[];
  sources: string[];
  en: Side;
  ar: Side;
}

/** The row content_entries stores. */
export function toRow(p: SeedPage, sort: number) {
  const both = <T>(f: (s: Side) => T) => ({ en: f(p.en), ar: f(p.ar) });
  return {
    kind: p.kind,
    slug: p.slug,
    sort,
    status: "published" as const,
    published_at: new Date().toISOString(),
    primary_keyword: p.primary_keyword,
    secondary_keywords: p.secondary_keywords,
    doc: both((s) => ({ title: s.title, summary: s.lead, blocks: s.blocks })),
    seo: { meta_title: both((s) => s.metaTitle), meta_description: both((s) => s.metaDescription), h1: both((s) => s.h1), robots: "index", schema: "auto" },
    meta: {
      format: p.format, competitor: p.competitor, tools: p.tools ?? [],
      answer: both((s) => s.answer), audience: both((s) => s.audience ?? []), criteria: both((s) => s.criteria ?? []), steps: both((s) => s.steps ?? []),
      compare: both((s) => s.compare ?? []), faq: both((s) => s.faq), cta: both((s) => s.cta), prompt: both((s) => s.prompt ?? ""),
      links: { en: p.links.map((l) => ({ path: l.path, label: l.en })), ar: p.links.map((l) => ({ path: l.path, label: l.ar })) },
      sources: p.sources, origin: "human",
    },
    updated_by: "seo-seed",
  };
}

// What Yolias does today, in the words every comparison uses (from the home
// FAQ and llms.txt). Keep in step with the product.
export const Y = {
  en: {
    find: "You create a campaign in three steps (the result you want, the audiences, how Yolias speaks for you): countries, regions and cities worldwide, industries, company size, job titles and exclusions, or a saved, custom or lookalike audience",
    finds: "Companies, local businesses by category and area, decision makers at matching companies, and companies similar to your best customers",
    why: "A match score with the criteria each result met",
    contacts: "The business contact details a company publishes, labelled by verification state; no promise of a personal email or phone number for every person",
    outreach: "Yolias AI, the engine of every campaign: writes a different email to each person in 15 languages and sends it from your own Gmail or IMAP/SMTP mailbox, follows up twice, within daily limits and sending hours",
    replies: "Answers replies itself: questions and objections from your Company Knowledge, interest with two free times and your booking page, and books the meeting; it hands a conversation to you when a person is needed",
    channels: "Email, sent by Yolias from your own mailbox",
    users: "Unlimited users on every plan",
    language: "The whole product in Arabic and English",
  },
  ar: {
    find: "تنشئ حملة في ثلاث خطوات (النتيجة التي تريدها، والجماهير، وكيف يتحدث يولياس باسمك): دول ومناطق ومدن العالم، والمجالات، وحجم الشركة، والمسميات الوظيفية، والاستبعادات، أو جمهور محفوظ أو مخصص أو مشابه",
    finds: "الشركات، والأنشطة المحلية حسب النوع والمنطقة، وصنّاع القرار في الشركات المطابقة، والشركات المشابهة لأفضل عملائك",
    why: "نسبة تطابق مع المعايير التي حققتها كل نتيجة",
    contacts: "بيانات التواصل التي تنشرها الشركة، مصنّفة حسب حالة التحقق؛ ولا وعد ببريد أو رقم شخصي لكل شخص",
    outreach: "Yolias AI، محرك كل حملة: يكتب رسالة مختلفة لكل شخص بخمس عشرة لغة ويرسلها من Gmail أو بريد IMAP/SMTP الخاص بك، ويتابع مرتين، ضمن حد يومي وساعات إرسال",
    replies: "يرد على الردود بنفسه: الأسئلة والاعتراضات من معرفة شركتك، والاهتمام بموعدين متاحين وصفحة الحجز، ويحجز الاجتماع؛ ويسلّمك المحادثة عندما تحتاج إلى شخص",
    channels: "البريد، يرسله يولياس من صندوق بريدك",
    users: "عدد غير محدود من المستخدمين في كل الخطط",
    language: "المنتج كله بالعربية والإنجليزية",
  },
};

export const CTA = {
  en: { title: "Get customers, not lists.", body: "Create an account, choose the result you want (meetings, leads or sales) and the customers to reach, preview the message Yolias writes, and launch. Yolias finds the people, writes, answers and books.", label: "Try Yolias" },
  ar: { title: "احصل على عملاء، لا قوائم.", body: "أنشئ حسابًا، واختر النتيجة التي تريدها (اجتماعات أو عملاء أو مبيعات) والعملاء الذين تريد الوصول إليهم، وعاين الرسالة التي يكتبها يولياس، ثم أطلق الحملة. يجد يولياس الأشخاص ويكتب ويرد ويحجز.", label: "جرّب يولياس" },
};
