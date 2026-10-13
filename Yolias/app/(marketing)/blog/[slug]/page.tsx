import type { Metadata } from "next";
import { JsonLd } from "@/components/marketing/JsonLd";
import { articleSchema, breadcrumbSchema, pageMetadata } from "@/lib/seo";
import Link from "next/link";
import { ArticleFeedback, CopyPageButton } from "@/components/marketing/ArticleTools";
import { toMarkdown } from "@/lib/content/types";
import { siteUrl } from "@/lib/seo";

import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Prose } from "@/components/marketing/Prose";
import { posts as shippedPosts } from "@/lib/content/blog";
import { blogPosts } from "@/lib/content/store";
import { readingMinutes } from "@/lib/content/types";
import { formatDate } from "@/lib/format";
import { fmt } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/server";

export function generateStaticParams() {
  return shippedPosts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const posts = await blogPosts();
  const { slug } = await params;
  const post = posts.find((p) => p.slug === slug);
  if (!post) return {};
  const doc = post.doc[await getLocale()];
  return pageMetadata({ title: `${doc.title} | Yolias`, description: doc.summary, path: `/blog/${slug}`, type: "article", publishedTime: post.date });
}

export default async function BlogPostPage({ params }: PageProps<"/blog/[slug]">) {
  const posts = await blogPosts();
  const { slug } = await params;
  const post = posts.find((p) => p.slug === slug);
  if (!post) notFound();
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  const doc = post.doc[locale];
  const others = posts.filter((p) => p.slug !== slug);

  return (
    <>
      <JsonLd nodes={[
        articleSchema({ title: doc.title, description: doc.summary, path: `/blog/${slug}`, date: post.date }),
        breadcrumbSchema([{ name: t.site.blog, path: "/blog" }, { name: doc.title, path: `/blog/${slug}` }]),
      ]} />
      <article className="site-width max-w-[780px] py-16">
        <Link href="/blog" className="crumbs inline-flex"><ArrowLeft width={14} height={14} className="flip-rtl" /> {fmt(t.site.backTo, { page: t.site.blog })}</Link>
        <div className="post-meta">
          <b>{post.category[locale]}</b>
          <span>{formatDate(post.date, locale, "UTC")}</span>
          <span>{fmt(t.site.minRead, { count: readingMinutes(doc.blocks) })}</span>
        </div>
        <div className="doc-title-row">
          <h1 className="doc-title mt-4">{doc.title}</h1>
          <CopyPageButton markdown={toMarkdown(doc, siteUrl())} />
        </div>
        <p className="doc-summary">{doc.summary}</p>
        <div className="doc-divider" />
        <Prose blocks={doc.blocks} />
        <ArticleFeedback kind="blog" slug={slug} />
      </article>
      <section className="section alt">
        <div className="site-width post-grid">
          {others.map((p) => (
            <Link key={p.slug} href={`/blog/${p.slug}`} className="post-card">
              <div className="post-meta"><b>{p.category[locale]}</b><span>{formatDate(p.date, locale, "UTC")}</span></div>
              <h2>{p.doc[locale].title}</h2>
              <p>{p.doc[locale].summary}</p>
              <span className="read">{t.site.readMore}</span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
