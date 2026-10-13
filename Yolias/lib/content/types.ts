import type { Locale } from "@/lib/i18n/config";

// Structured long-form content (legal, docs, help, blog). Inline text
// supports **bold** and [label](/href).
export type Block =
  | { h2: string; id?: string }
  | { h3: string }
  | { p: string }
  | { ul: string[] }
  | { ol: string[] }
  | { note: string }
  | { table: { head: string[]; rows: string[][] } }
  /** A real screenshot with numbered markers (x / y in % of the image) explained in the caption. */
  | { figure: { src: string; alt: string; caption?: string; marks?: { x: number; y: number; label: string }[] } };

export interface Doc {
  title: string;
  summary: string;
  blocks: Block[];
}

export type Localized<T> = Record<Locale, T>;

/** Stable ids for h2 headings ("On this page" links). */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

export function headings(blocks: Block[]): { id: string; text: string }[] {
  return blocks.flatMap((b) => ("h2" in b ? [{ id: b.id ?? slugify(b.h2), text: b.h2 }] : []));
}

export function readingMinutes(blocks: Block[]): number {
  const words = blocks
    .flatMap((b) => ("p" in b ? [b.p] : "ul" in b ? b.ul : "ol" in b ? b.ol : "note" in b ? [b.note] : []))
    .join(" ")
    .split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

/** The page as Markdown ("Copy page" on docs, help and blog articles). Links become absolute. */
export function toMarkdown(doc: Doc, base: string): string {
  const inline = (s: string) => s.replace(/\]\((\/[^)]*)\)/g, (_m, href: string) => `](${base}${href})`);
  const out = [`# ${doc.title}`, "", inline(doc.summary)];
  for (const b of doc.blocks) {
    out.push("");
    if ("h2" in b) out.push(`## ${b.h2}`);
    else if ("h3" in b) out.push(`### ${b.h3}`);
    else if ("p" in b) out.push(inline(b.p));
    else if ("ul" in b) out.push(...b.ul.map((x) => `- ${inline(x)}`));
    else if ("ol" in b) out.push(...b.ol.map((x, i) => `${i + 1}. ${inline(x)}`));
    else if ("note" in b) out.push(`> ${inline(b.note)}`);
    else if ("table" in b) out.push(`| ${b.table.head.join(" | ")} |`, `| ${b.table.head.map(() => "---").join(" | ")} |`, ...b.table.rows.map((r) => `| ${r.map(inline).join(" | ")} |`));
    else if ("figure" in b) out.push(`![${b.figure.alt}](${b.figure.src.startsWith("/") ? base + b.figure.src : b.figure.src})${b.figure.caption ? `\n*${inline(b.figure.caption)}*` : ""}`);
  }
  return out.join("\n").trim() + "\n";
}
