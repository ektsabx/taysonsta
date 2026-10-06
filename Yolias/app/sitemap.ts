import type { MetadataRoute } from "next";
import { blogPosts, docPages, helpArticles } from "@/lib/content/store";
import { legalSlugs } from "@/lib/content/legal";

// Public pages for search engines (final spec phase 9, SEO). The app itself
// (signed-in pages) is not listed and is disallowed in robots.ts.
const site = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3200").replace(/\/$/, "");

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = site();
  const [help, docs, posts] = await Promise.all([helpArticles(), docPages(), blogPosts()]);
  const page = (path: string, priority: number, lastModified?: string): MetadataRoute.Sitemap[number] => ({ url: `${base}${path}`, priority, ...(lastModified ? { lastModified } : {}) });
  return [
    page("/", 1), page("/product", 0.9), page("/pricing", 0.9), page("/about", 0.6), page("/contact", 0.6),
    page("/help-center", 0.7), page("/blog", 0.7), page("/docs", 0.7),
    ...help.map((a) => page(`/help-center/${a.slug}`, 0.5)),
    ...docs.map((d) => page(`/docs/${d.slug}`, 0.5)),
    ...posts.map((p) => page(`/blog/${p.slug}`, 0.5, p.date)),
    ...legalSlugs.map((s) => page(`/legal/${s}`, 0.3)),
  ];
}
