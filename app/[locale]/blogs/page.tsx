import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/lib/i18n";
import { buildMetadata } from "@/lib/seo";
import { getDictionary } from "@/content/dictionaries";
import { getPublishedBlogs } from "@/services/blog";
import { BlogGrid } from "@/components/blog/BlogGrid";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageTopSpacer } from "@/components/ui/PageTopSpacer";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale: localeParam } = await params;
  const locale: Locale = isLocale(localeParam) ? localeParam : "ar";
  const dictionary = getDictionary(locale);

  return buildMetadata({
    locale,
    path: "/blogs",
    title: `${dictionary.blog.title} - Taysonsta`,
    description: dictionary.blog.subtitle,
  });
}

export default async function BlogsPage({ params }: PageProps) {
  const { locale: localeParam } = await params;

  if (!isLocale(localeParam)) {
    notFound();
  }

  const locale: Locale = localeParam;
  const dictionary = getDictionary(locale);
  const posts = await getPublishedBlogs();

  return (
    <>
    <PageTopSpacer />
    <section className="sec">
      <div className="sec-tag">{dictionary.blog.title}</div>
      <h2 className="sec-h2">{dictionary.blog.title}</h2>
      <p className="sec-p">{dictionary.blog.subtitle}</p>
      {posts.length === 0 ? (
        <EmptyState title={dictionary.common.emptyBlogTitle} description={dictionary.common.emptyBlogDesc} />
      ) : (
        <BlogGrid posts={posts} locale={locale} dictionary={dictionary} />
      )}
    </section>
    </>
  );
}
