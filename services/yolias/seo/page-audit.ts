// On-page audit of every public page (D-265), run by the site crawl
// (services/yolias/seo/indexing.ts) on each page of the live sitemap. Pure
// functions over the page's HTML: no network, no database, so they are
// tested on their own (scripts/test-seo-audit.mts). Only what can be measured
// from the page is reported; nothing is scored or guessed.

export type PageIssue =
  | "no_title" | "long_title" | "short_title" | "duplicate_title"
  | "no_description" | "long_description" | "short_description" | "duplicate_description"
  | "no_h1" | "many_h1" | "wrong_lang" | "canonical_not_self" | "no_canonical" | "no_hreflang"
  | "invalid_jsonld" | "no_jsonld" | "thin" | "not_arabic" | "near_duplicate" | "brand_spelling";

export interface PageAudit {
  path: string;
  locale: "en" | "ar";
  title: string | null;
  description: string | null;
  h1: number;
  words: number;
  /** Share of Arabic letters among Arabic and Latin letters in the main text, 0–100. */
  arabic: number;
  jsonld: number;
  issues: PageIssue[];
  /** For near_duplicate: the most similar page in the same language and how similar (0–100). */
  similar?: { path: string; score: number };
  /** MinHash signature of the main text; used across pages, not stored. */
  sig?: number[];
}

const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&quot;/g, "\"").replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ");
const tag = (html: string, re: RegExp) => {
  const m = re.exec(html);
  return m ? decode(m[1]).replace(/\s+/g, " ").trim() : null;
};

/** The page's own words: no scripts, styles, header, navigation or footer. */
export function mainText(html: string): string {
  const body = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<(header|nav|footer)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  return decode(body).replace(/\s+/g, " ").trim();
}

const SEEDS = Array.from({ length: 32 }, (_, i) => (Math.imul(i + 1, 0x9e3779b1) >>> 0) || 1);
function fnv(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
}
/** 32 minimum hashes of the text's 5-word shingles (the first 2,000 words). */
export function signature(text: string): number[] {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 2000);
  const sig = new Array<number>(SEEDS.length).fill(0xffffffff);
  for (let i = 0; i + 5 <= words.length; i++) {
    const h = fnv(words.slice(i, i + 5).join(" "));
    for (let k = 0; k < SEEDS.length; k++) {
      const v = (Math.imul(h ^ SEEDS[k], 0x85ebca6b) ^ (h >>> 13)) >>> 0;
      if (v < sig[k]) sig[k] = v;
    }
  }
  return sig;
}
export const similarity = (a: number[], b: number[]) => Math.round((a.filter((v, i) => v === b[i]).length / a.length) * 100);

export function auditPage(path: string, html: string, base: string): PageAudit {
  const locale = path === "/ar" || path.startsWith("/ar/") ? "ar" : "en";
  const title = tag(html, /<title[^>]*>([^<]*)<\/title>/i);
  const description = tag(html, /<meta[^>]+name="description"[^>]+content="([^"]*)"/i);
  const h1 = (html.match(/<h1[\s>]/gi) ?? []).length;
  const lang = tag(html, /<html[^>]+lang="([^"]+)"/i);
  const canonical = tag(html, /<link[^>]+rel="canonical"[^>]+href="([^"]*)"/i);
  const hreflangs = new Set([...html.matchAll(/<link[^>]+rel="alternate"[^>]+hre[fF]Lang="([^"]+)"/g)].map((m) => m[1].toLowerCase()));
  const blocks = [...html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
  const text = mainText(html);
  const letters = { ar: (text.match(/[؀-ۿ]/g) ?? []).length, la: (text.match(/[A-Za-z]/g) ?? []).length };
  const arabic = letters.ar + letters.la ? Math.round((letters.ar / (letters.ar + letters.la)) * 100) : 0;
  const words = text.split(/\s+/).filter(Boolean).length;
  const issues: PageIssue[] = [];
  if (!title) issues.push("no_title");
  else if (title.length > 65) issues.push("long_title");
  else if (title.length < 15) issues.push("short_title");
  if (!description) issues.push("no_description");
  else if (description.length > 170) issues.push("long_description");
  else if (description.length < 50) issues.push("short_description");
  if (h1 !== 1) issues.push(h1 === 0 ? "no_h1" : "many_h1");
  if (lang !== locale) issues.push("wrong_lang");
  if (!canonical) issues.push("no_canonical");
  else {
    const self = `${base}${path === "/" ? "" : path}`.replace(/\/$/, "");
    if (canonical.replace(/\/$/, "") !== self) issues.push("canonical_not_self");
  }
  if (!hreflangs.has("en") || !hreflangs.has("ar") || !hreflangs.has("x-default")) issues.push("no_hreflang");
  if (!blocks.length) issues.push("no_jsonld");
  else if (blocks.some((b) => { try { JSON.parse(b); return false; } catch { return true; } })) issues.push("invalid_jsonld");
  // Thin only where a page has to win a search on its words: the core pages, articles
  // and the commercial page families. Help, docs, legal and contact pages are short on purpose.
  const bare = locale === "ar" ? path.replace(/^\/ar/, "") || "/" : path;
  if (words < 250 && /^\/($|product$|pricing$|about$|(solutions|use-cases|compare|alternatives|templates|blog)\/.+)/.test(bare)) issues.push("thin");
  if (locale === "ar" && arabic < 50) issues.push("not_arabic");
  // The Arabic brand is «يولياس», the way people search for it (D-265).
  if (html.includes("يولـياس")) issues.push("brand_spelling");
  return { path, locale, title, description, h1, words, arabic, jsonld: blocks.length, issues, sig: signature(text) };
}

/** Issues only visible across pages: the same title or description, and near-duplicate text (doorway pages). */
export function crossPageIssues(pages: PageAudit[], threshold = 80): PageAudit[] {
  for (const locale of ["en", "ar"] as const) {
    const mine = pages.filter((p) => p.locale === locale);
    for (const field of ["title", "description"] as const) {
      const seen = new Map<string, number>();
      for (const p of mine) if (p[field]) seen.set(p[field]!, (seen.get(p[field]!) ?? 0) + 1);
      for (const p of mine) if (p[field] && (seen.get(p[field]!) ?? 0) > 1) p.issues.push(field === "title" ? "duplicate_title" : "duplicate_description");
    }
    for (let i = 0; i < mine.length; i++) {
      for (let j = i + 1; j < mine.length; j++) {
        const a = mine[i], b = mine[j];
        if (!a.sig || !b.sig || a.words < 80 || b.words < 80) continue;
        const s = similarity(a.sig, b.sig);
        if (s >= threshold) {
          if (!a.similar || s > a.similar.score) a.similar = { path: b.path, score: s };
          if (!b.similar || s > b.similar.score) b.similar = { path: a.path, score: s };
        }
      }
    }
    for (const p of mine) if (p.similar) p.issues.push("near_duplicate");
  }
  for (const p of pages) delete p.sig;
  return pages;
}
