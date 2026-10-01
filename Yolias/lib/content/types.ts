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
  | { table: { head: string[]; rows: string[][] } };

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
