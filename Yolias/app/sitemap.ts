import type { MetadataRoute } from "next";
import { blogPosts, docPages, helpArticles } from "@/lib/content/store";
import { legalSlugs } from "@/lib/content/legal";
import { listCareerJobs } from "@/lib/careers";
import { solutionSlugs } from "@/lib/content/solutions";
import { useCaseSlugs } from "@/lib/content/use-cases";
import { siteUrl } from "@/lib/seo";

// Public, indexable pages only (D-179), on the production domain
// (NEXT_PUBLIC_SITE_URL). Every URL here is its own canonical: no redirects
// (/docs redirects to its first page, so only the pages are listed), no app,
// auth, checkout or referral links, no query strings. The app is disallowed
// in robots.ts and its pages are noindex.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const [help, docs, posts, jobs] = await Promise.all([helpArticles(), docPages(), blogPosts(), listCareerJobs()]);
  const page = (path: string, priority: number, lastModified?: string): MetadataRoute.Sitemap[number] => ({ url: `${base}${path}`, priority, ...(lastModified ? { lastModified } : {}) });
  const entries = [
    page("/", 1), page("/product", 0.9), page("/pricing", 0.9),
    page("/solutions", 0.8), ...solutionSlugs.map((s) => page(`/solutions/${s}`, 0.8)),
    page("/use-cases", 0.8), ...useCaseSlugs.map((s) => page(`/use-cases/${s}`, 0.8)),
    page("/about", 0.6), page("/contact", 0.6), page("/affiliates", 0.5), page("/partners/terms", 0.3), page("/community", 0.5), page("/careers", 0.5), page("/status", 0.4),
    page("/help-center", 0.7), page("/blog", 0.7),
    ...help.map((a) => page(`/help-center/${a.slug}`, 0.5)),
    ...docs.map((d) => page(`/docs/${d.slug}`, 0.5)),
    ...posts.map((p) => page(`/blog/${p.slug}`, 0.6, p.date)),
    ...legalSlugs.map((s) => page(`/legal/${s}`, 0.3)),
    ...(jobs ?? []).map((j) => page(`/careers/${j.slug}`, 0.4, j.publishedAt ?? undefined)),
  ];
  // Never the same URL twice (e.g. a CMS page with the slug of a code page).
  const seen = new Set<string>();
  return entries.filter((e) => (seen.has(e.url) ? false : (seen.add(e.url), true)));
}
