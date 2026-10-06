import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { articles as codeArticles, type HelpArticle, type HelpCollection } from "./help";
import { docs as codeDocs, type DocGroup, type DocPage } from "./docs";
import { posts as codePosts, type BlogPost } from "./blog";
import { legal as codeLegal, legalSlugs, type LegalSlug } from "./legal";
import type { Doc, Localized } from "./types";

// Website content as the site shows it (final spec phase 9): published rows
// from content_entries (edited in Yolias Admin) over the content shipped in
// code. A "hidden" row removes a page; a draft changes nothing yet.

type Row = { kind: string; slug: string; meta: Record<string, unknown>; doc: Localized<Doc>; status: "published" | "hidden"; sort: number };

const entries = cache(async (): Promise<Row[]> => {
  // Public content only (RLS lets anyone read published / hidden rows).
  const { data, error } = await createAdminClient().from("content_entries").select("kind, slug, meta, doc, status, sort").in("status", ["published", "hidden"]).order("sort");
  if (error) return [];
  return (data ?? []).filter((r) => validDoc(r.doc)) as unknown as Row[];
});

function validDoc(d: unknown): boolean {
  const ok = (x: unknown) => Boolean(x && typeof x === "object" && typeof (x as Doc).title === "string" && Array.isArray((x as Doc).blocks));
  return Boolean(d && typeof d === "object" && ok((d as Localized<Doc>).en) && ok((d as Localized<Doc>).ar));
}

function merge<T extends { slug: string }>(code: T[], rows: Row[], kind: string, from: (r: Row, base: T | undefined) => T | null): T[] {
  const mine = rows.filter((r) => r.kind === kind);
  const bySlug = new Map(mine.map((r) => [r.slug, r]));
  const out: T[] = [];
  for (const item of code) {
    const r = bySlug.get(item.slug);
    if (!r) out.push(item);
    else if (r.status === "published") {
      const v = from(r, item);
      if (v) out.push(v);
    }
  }
  for (const r of mine) {
    if (r.status !== "published" || code.some((c) => c.slug === r.slug)) continue;
    const v = from(r, undefined);
    if (v) out.push(v);
  }
  return out;
}

export const helpArticles = cache(async (): Promise<HelpArticle[]> =>
  merge(codeArticles, await entries(), "help", (r, base) => {
    const collection = (r.meta.collection as HelpCollection["id"] | undefined) ?? base?.collection;
    return collection ? { slug: r.slug, collection, doc: r.doc } : null;
  }));

export const docPages = cache(async (): Promise<DocPage[]> =>
  merge(codeDocs, await entries(), "docs", (r, base) => {
    const group = (r.meta.group as DocGroup["id"] | undefined) ?? base?.group;
    return group ? { slug: r.slug, group, doc: r.doc } : null;
  }));

export const blogPosts = cache(async (): Promise<BlogPost[]> =>
  merge(codePosts, await entries(), "blog", (r, base) => {
    const date = (r.meta.date as string | undefined) ?? base?.date;
    const category = (r.meta.category as Localized<string> | undefined) ?? base?.category;
    return date && category ? { slug: r.slug, date, category, doc: r.doc } : null;
  }).sort((a, b) => b.date.localeCompare(a.date)));

/** Legal pages exist by slug (privacy, terms, cookies, security); only their text is editable. */
export const legalDocs = cache(async (): Promise<Record<LegalSlug, Localized<Doc>>> => {
  const rows = (await entries()).filter((r) => r.kind === "legal" && r.status === "published");
  const out = { ...codeLegal };
  for (const r of rows) if ((legalSlugs as readonly string[]).includes(r.slug)) out[r.slug as LegalSlug] = r.doc;
  return out;
});
