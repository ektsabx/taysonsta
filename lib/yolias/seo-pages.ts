// SEO pages as edited in Yolias Admin → SEO (D-257). Mirrors
// Yolias/lib/content/seo-pages.ts (meta / seo shape) — keep the two in sync.
// Structured fields are edited as plain lines so the editor stays one form:
//   FAQ:      "Q: question" then "A: answer" (blank line between pairs)
//   Steps:    "Title | what to do"
//   Compare:  "Point | Yolias | Competitor"
//   Links:    "/path | English label | Arabic label"
//   Lists:    one item per line

export const seoKinds = ["compare", "alternatives", "solution", "template"] as const;
export type SeoKind = (typeof seoKinds)[number];
export const seoKindLabel: Record<SeoKind, string> = { compare: "مقارنة", alternatives: "بدائل", solution: "حل لجمهور", template: "قالب" };
export const seoBase: Record<SeoKind, string> = { compare: "/compare", alternatives: "/alternatives", solution: "/solutions", template: "/templates" };
export const seoPath = (kind: SeoKind, slug: string) => `${seoBase[kind]}/${slug}`;

/** Solutions pages shipped in code (Yolias/lib/content/solutions.ts): an Admin page can't take their address. */
export const codeSolutionSlugs = ["marketing-agencies", "software-agencies", "consultants", "recruitment-agencies", "freelancers", "real-estate", "sales-teams"] as const;

export const seoStatuses = ["draft", "scheduled", "published", "hidden"] as const;
export type SeoStatus = (typeof seoStatuses)[number];
export const seoStatusLabel: Record<SeoStatus, { tone: "neutral" | "success" | "warning"; label: string }> = {
  draft: { tone: "neutral", label: "مسودة" },
  scheduled: { tone: "neutral", label: "مجدولة" },
  published: { tone: "success", label: "منشورة" },
  hidden: { tone: "warning", label: "مخفية" },
};

type L<T> = { en: T; ar: T };
export interface SeoMeta {
  format?: "versus" | "list";
  competitor?: string;
  tools?: string[];
  answer: L<string>;
  audience: L<string[]>;
  criteria: L<string[]>;
  steps: L<{ title: string; body: string }[]>;
  compare: L<{ label: string; yolias: string; them: string }[]>;
  faq: L<{ q: string; a: string }[]>;
  cta: L<{ title: string; body: string; label: string }>;
  links: L<{ path: string; label: string }[]>;
  prompt: L<string>;
  /** Where the claims on the page come from (kept for review, not shown). */
  sources?: string[];
  /** Who wrote it: "ai_draft" until a person reviewed it. */
  origin?: "ai_draft" | "human";
}
export interface SeoFields {
  meta_title: L<string>;
  meta_description: L<string>;
  h1: L<string>;
  canonical?: string;
  robots?: "index" | "noindex";
  schema?: "auto" | "none";
}

const lines = (s: string) => s.replace(/\r\n/g, "\n").split("\n").map((x) => x.trim()).filter(Boolean);
const pipes = (line: string) => line.split("|").map((x) => x.trim());

export const parseList = (s: string): string[] => lines(s);
export const formatList = (v: string[] | undefined): string => (v ?? []).join("\n");

export function parseFaq(s: string): { q: string; a: string }[] {
  const out: { q: string; a: string }[] = [];
  let q: string | null = null;
  let a: string[] = [];
  const flush = () => {
    if (q && a.length) out.push({ q, a: a.join(" ") });
    q = null;
    a = [];
  };
  for (const raw of s.replace(/\r\n/g, "\n").split("\n")) {
    const t = raw.trim();
    const mq = /^(Q|س)\s*[:：]\s*(.+)$/i.exec(t);
    const ma = /^(A|ج)\s*[:：]\s*(.+)$/i.exec(t);
    if (mq) { flush(); q = mq[2].trim(); } else if (ma && q) a.push(ma[2].trim()); else if (t && q && a.length) a.push(t);
  }
  flush();
  return out;
}
export const formatFaq = (v: { q: string; a: string }[] | undefined, ar = false) => (v ?? []).map((f) => `${ar ? "س" : "Q"}: ${f.q}\n${ar ? "ج" : "A"}: ${f.a}`).join("\n\n");

export const parseSteps = (s: string) => lines(s).map(pipes).filter((p) => p[0]).map(([title, ...rest]) => ({ title, body: rest.join(" | ") }));
export const formatSteps = (v: { title: string; body: string }[] | undefined) => (v ?? []).map((x) => (x.body ? `${x.title} | ${x.body}` : x.title)).join("\n");

export const parseCompare = (s: string) => lines(s).map(pipes).filter((p) => p.length >= 3 && p[0]).map(([label, yolias, ...them]) => ({ label, yolias, them: them.join(" | ") }));
export const formatCompare = (v: { label: string; yolias: string; them: string }[] | undefined) => (v ?? []).map((r) => `${r.label} | ${r.yolias} | ${r.them}`).join("\n");

/** Links are one list for both languages: "/path | English | العربية". */
export function parseLinks(s: string): L<{ path: string; label: string }[]> {
  const rows = lines(s).map(pipes).filter((p) => /^\/(?!\/)/.test(p[0]) && p[1]);
  return { en: rows.map((p) => ({ path: p[0], label: p[1] })), ar: rows.map((p) => ({ path: p[0], label: p[2] || p[1] })) };
}
export function formatLinks(v: L<{ path: string; label: string }[]> | undefined): string {
  return (v?.en ?? []).map((l, i) => `${l.path} | ${l.label} | ${v?.ar?.[i]?.label ?? ""}`.replace(/ \| $/, "")).join("\n");
}

/** Normalised keyword for duplicate checks ("Apollo  Alternatives" = "apollo alternatives"). */
export const normKeyword = (k: string) => k.trim().toLowerCase().replace(/\s+/g, " ");

export const emptyMeta = (): SeoMeta => ({
  answer: { en: "", ar: "" }, audience: { en: [], ar: [] }, criteria: { en: [], ar: [] }, steps: { en: [], ar: [] }, compare: { en: [], ar: [] },
  faq: { en: [], ar: [] }, cta: { en: { title: "", body: "", label: "" }, ar: { title: "", body: "", label: "" } }, links: { en: [], ar: [] }, prompt: { en: "", ar: "" },
});
