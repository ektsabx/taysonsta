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
    find: "Describe your ideal customer in plain language, in English or Arabic, or attach a brief, CSV or screenshot; Yolias turns it into criteria and runs the search",
    finds: "Companies, local businesses by category and area, decision makers at matching companies, and companies similar to ones you name",
    why: "A match score with the criteria each result met",
    contacts: "The business contact details a company publishes, labelled by verification state; no promise of a personal email or phone number for every person",
    outreach: "Writes first emails and follow-ups in 15 languages and sends them from your own Gmail or IMAP/SMTP mailbox after you approve, within daily limits and sending hours per mailbox",
    replies: "Replies arrive in Conversations, sorted, with a suggested answer; meeting requests get two free times and your booking page, and bookings land in Meetings",
    channels: "Email, sent by Yolias from your own mailbox",
    users: "Unlimited users on every plan",
    language: "The whole product in Arabic and English",
  },
  ar: {
    find: "تصف عميلك المثالي بلغة طبيعية، بالعربية أو الإنجليزية، أو ترفق ملفًا أو CSV أو صورة، فيحوّله يولياس إلى معايير ويشغّل البحث",
    finds: "الشركات، والأنشطة المحلية حسب النوع والمنطقة، وصنّاع القرار في الشركات المطابقة، والشركات المشابهة لشركات تذكرها",
    why: "نسبة تطابق مع المعايير التي حققتها كل نتيجة",
    contacts: "بيانات التواصل التي تنشرها الشركة، مصنّفة حسب حالة التحقق؛ ولا وعد ببريد أو رقم شخصي لكل شخص",
    outreach: "يكتب الرسائل الأولى والمتابعات بخمس عشرة لغة ويرسلها من Gmail أو بريد IMAP/SMTP الخاص بك بعد موافقتك، ضمن حد يومي وساعات إرسال لكل صندوق بريد",
    replies: "تصل الردود إلى المحادثات مصنّفة مع رد مقترح، وطلبات الاجتماع يُرد عليها بموعدين متاحين وصفحة الحجز، والحجوزات في الاجتماعات",
    channels: "البريد، يرسله يولياس من صندوق بريدك",
    users: "عدد غير محدود من المستخدمين في كل الخطط",
    language: "المنتج كله بالعربية والإنجليزية",
  },
};

export const CTA = {
  en: { title: "Try it on your own market.", body: "Create an account, describe who you want to reach and review the list and the emails Yolias prepares before anything is sent.", label: "Try Yolias" },
  ar: { title: "جرّبه على سوقك.", body: "أنشئ حسابًا، وصِف من تريد الوصول إليه، وراجع القائمة والرسائل التي يجهّزها يولياس قبل إرسال أي شيء.", label: "جرّب يولياس" },
};
