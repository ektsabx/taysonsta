import type { Block, Doc, Localized } from "./types";

// One shape for every help and docs article (owner, 2026-11-05, strict rule):
// what it is, how it works, the steps, an example, requirements, notes,
// troubleshooting and related articles. A section with nothing to say is left out.

export interface GuideText {
  title: string; summary: string;
  what: string[]; how?: string[];
  steps?: { title: string; items: string[]; done: string }[];
  table?: { title: string; head: string[]; rows: string[][] };
  example?: string;
  needs?: string[];
  notes?: string[];
  trouble?: [string, string][];
  related: [string, string][];
}

const H = {
  en: { what: "What is it?", how: "How it works", example: "Example", needs: "Requirements and limits", notes: "Important notes", trouble: "Troubleshooting", related: "Related articles", done: "How to know it worked:" },
  ar: { what: "ما هو؟", how: "كيف يعمل", example: "مثال", needs: "المتطلبات والقيود", notes: "ملاحظات مهمة", trouble: "حل المشكلات", related: "مقالات ذات صلة", done: "كيف تعرف أن الخطوة نجحت:" },
};

function blocks(g: GuideText, l: "en" | "ar"): Block[] {
  const h = H[l];
  const out: Block[] = [{ h2: h.what }, ...g.what.map((p) => ({ p }))];
  if (g.how?.length) out.push({ h2: h.how }, ...g.how.map((p) => ({ p })));
  for (const s of g.steps ?? []) out.push({ h2: s.title }, { ol: s.items }, { p: `**${h.done}** ${s.done}` });
  if (g.table) out.push({ h2: g.table.title }, { table: { head: g.table.head, rows: g.table.rows } });
  if (g.example) out.push({ h2: h.example }, { p: g.example });
  if (g.needs?.length) out.push({ h2: h.needs }, { ul: g.needs });
  if (g.notes?.length) out.push({ h2: h.notes }, ...g.notes.map((note) => ({ note })));
  if (g.trouble?.length) { out.push({ h2: h.trouble }); for (const [q, a] of g.trouble) out.push({ h3: q }, { p: a }); }
  out.push({ h2: h.related }, { ul: g.related.map(([t, u]) => `[${t}](${u})`) });
  return out;
}

export const guide = (x: Localized<GuideText>, updated = "2026-11-05"): Localized<Doc> => ({
  en: { title: x.en.title, summary: x.en.summary, updated, blocks: blocks(x.en, "en") },
  ar: { title: x.ar.title, summary: x.ar.summary, updated, blocks: blocks(x.ar, "ar") },
});
