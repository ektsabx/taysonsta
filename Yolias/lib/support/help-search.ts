import "server-only";
import { docPages, helpArticles } from "@/lib/content/store";
import { norm, scoreDoc } from "./help-search-score";

// Search over the published Help Center and docs (the same content the site
// shows: code pages plus pages edited in Yolias Admin), for the Help tab of
// the support messenger (D-180). Plain scoring: title words weigh most, then
// the summary, then the text. Results link to the real article page.

export interface HelpResult { title: string; summary: string; url: string }

export async function searchHelp(q: string, locale: "en" | "ar", limit = 8): Promise<HelpResult[]> {
  const words = norm(q).split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 2).slice(0, 8);
  if (!words.length) return [];
  const [help, docs] = await Promise.all([helpArticles(), docPages()]);
  const pool = [
    ...help.map((a) => ({ doc: a.doc[locale], other: a.doc[locale === "ar" ? "en" : "ar"], url: `/help-center/${a.slug}` })),
    ...docs.map((d) => ({ doc: d.doc[locale], other: d.doc[locale === "ar" ? "en" : "ar"], url: `/docs/${d.slug}` })),
  ];
  return pool
    // A query in the other language still finds the article.
    .map((p) => ({ ...p, score: Math.max(scoreDoc(p.doc, words), scoreDoc(p.other, words)) }))
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((p) => ({ title: p.doc.title, summary: p.doc.summary, url: p.url }));
}
