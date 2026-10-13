import type { Block, Doc } from "../content/types";

// Pure scoring for the Help search (lib/support/help-search.ts).

function text(blocks: Block[]): string {
  return blocks.flatMap((b) => ("p" in b ? [b.p] : "ul" in b ? b.ul : "ol" in b ? b.ol : "note" in b ? [b.note] : "h2" in b ? [b.h2] : "h3" in b ? [b.h3] : [])).join(" ");
}

export const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[\u064B-\u065F\u0670]/g, "").replace(/[إأآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه");

export function scoreDoc(doc: Doc, words: string[]): number {
  const title = norm(doc.title), summary = norm(doc.summary), body = norm(text(doc.blocks));
  let score = 0;
  for (const w of words) {
    if (title.includes(w)) score += 6;
    if (summary.includes(w)) score += 3;
    if (body.includes(w)) score += 1;
  }
  // Every word must appear somewhere.
  return words.every((w) => title.includes(w) || summary.includes(w) || body.includes(w)) ? score : 0;
}

