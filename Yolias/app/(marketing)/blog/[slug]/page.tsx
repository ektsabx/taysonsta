import type { Metadata } from "next";
import Link from "next/link";
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
  return { title: `${doc.title} — Yolias`, description: doc.summary };
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
      <article className="site-width max-w-[780px] py-16">
        <Link href="/blog" className="crumbs inline-flex"><ArrowLeft width={14} height={14} className="flip-rtl" /> {fmt(t.site.backTo, { page: t.site.blog })}</Link>
        <div className="post-meta">
          <b>{post.category[locale]}</b>
          <span>{formatDate(post.date, locale, "UTC")}</span>
          <span>{fmt(t.site.minRead, { count: readingMinutes(doc.blocks) })}</span>
        </div>
        <h1 className="doc-title mt-4">{doc.title}</h1>
        <p className="doc-summary">{doc.summary}</p>
        <div className="doc-divider" />
        <Prose blocks={doc.blocks} />
      </article>
      <section className="section alt">
        <div className="site-width post-grid">
          {others.map((p) => (
            <Link key={p.slug} href={`/blog/${p.slug}`} className="post-card">
              <div className="post-meta"><b>{p.category[locale]}</b><span>{formatDate(p.date, locale, "UTC")}</span></div>
              <h2>{p.doc[locale].title}</h2>
              <p>{p.doc[locale].summary}</p>
              <span className="read">{t.site.readMore} {locale === "ar" ? "←" : "→"}</span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
