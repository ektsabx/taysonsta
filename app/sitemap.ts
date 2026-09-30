import { nowMs } from "@/lib/bos/clock";
import type { MetadataRoute } from "next";
import { locales, localizedPath } from "@/lib/i18n";
import { siteUrl } from "@/lib/seo";
import { bookingServiceIds, bookingServices } from "@/content/booking-services";
import { getPublishedBlogs } from "@/services/blog";
import { getPublishedCareerJobs } from "@/services/careers";
import { getCaseStudies } from "@/services/case-studies";
import { getPortfolioCompanies } from "@/services/portfolio-companies";

const staticPaths = [
  "/",
  "/about",
  "/booking",
  "/careers",
  "/portfolio",
  "/case-studies",
  "/blogs",
  ...bookingServiceIds.map((id) => bookingServices[id].path),
];

function entriesFor(path: string): MetadataRoute.Sitemap {
  return locales.map((locale) => ({
    url: `${siteUrl}${localizedPath(locale, path)}`,
    lastModified: new Date(nowMs()),
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [blogs, jobs, caseStudies, companies] = await Promise.all([
    getPublishedBlogs().catch(() => []),
    getPublishedCareerJobs().catch(() => []),
    getCaseStudies().catch(() => []),
    getPortfolioCompanies().catch(() => []),
  ]);

  const entries: MetadataRoute.Sitemap = staticPaths.flatMap(entriesFor);

  for (const blog of blogs) {
    entries.push(...entriesFor(`/blogs/${blog.slug}`));
  }
  for (const job of jobs) {
    entries.push(...entriesFor(`/careers/${job.slug}`));
  }
  for (const caseStudy of caseStudies) {
    entries.push(...entriesFor(`/case-studies/${caseStudy.slug}`));
  }
  for (const company of companies) {
    entries.push(...entriesFor(`/portfolio/${company.slug}`));
  }

  return entries;
}
