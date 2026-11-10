import type { Metadata } from "next";
import { JsonLd } from "@/components/marketing/JsonLd";
import { breadcrumbSchema, pageMetadata, webPageSchema } from "@/lib/seo";
import Link from "@/components/LocaleLink";
import { ArticleFeedback, CopyPageButton } from "@/components/marketing/ArticleTools";
import { toMarkdown } from "@/lib/content/types";
import { siteUrl } from "@/lib/seo";

import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { Prose } from "@/components/marketing/Prose";
import { articles as shippedArticles, collections } from "@/lib/content/help";
import { helpArticles } from "@/lib/content/store";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { articleVideo, TUTORIALS_KEY, youtubeThumb, type PlayableTutorial } from "@/lib/tutorials";
import { ArticleVideo } from "./ArticleVideo";

/** The article's video, set in Yolias Admin → Platform videos (read live). */
async function videoOf(slug: string, locale: "en" | "ar"): Promise<PlayableTutorial | null> {
  try {
    const { data } = await createAdminClient().from("site_settings").select("value").eq("key", TUTORIALS_KEY).maybeSingle();
    return articleVideo(data?.value, slug, locale);
  } catch {
    return null;
  }
}

export function generateStaticParams() {
  return shippedArticles.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: PageProps<"/help-center/[slug]">): Promise<Metadata> {
  const articles = await helpArticles();
  const { slug } = await params;
  const article = articles.find((a) => a.slug === slug);
  if (!article) return {};
  const doc = article.doc[await getLocale()];
  return pageMetadata({ title: `${doc.title} | Yolias Help Center`, description: doc.summary, path: `/help-center/${slug}` });
}

export default async function HelpArticlePage({ params }: PageProps<"/help-center/[slug]">) {
  const articles = await helpArticles();
  const { slug } = await params;
  const article = articles.find((a) => a.slug === slug);
  if (!article) notFound();
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  const doc = article.doc[locale];
  const collection = collections.find((c) => c.id === article.collection)!;
  const related = articles.filter((a) => a.collection === article.collection && a.slug !== slug);
  const video = await videoOf(slug, locale);
  const thumb = video ? youtubeThumb(video.url) : null;

  return (
    <div className="site-width doc-layout">
      <JsonLd nodes={[
        webPageSchema({ title: doc.title, description: doc.summary, path: `/help-center/${slug}` }),
        breadcrumbSchema([{ name: t.site.helpCenter, path: "/help-center" }, { name: doc.title, path: `/help-center/${slug}` }]),
        ...(video ? [{
          "@type": "VideoObject", name: video.title, description: video.description || doc.summary,
          ...(video.kind === "iframe" ? { embedUrl: video.src } : { contentUrl: video.src }),
          ...(thumb ? { thumbnailUrl: thumb } : {}), ...(video.addedAt ? { uploadDate: video.addedAt } : {}),
        }] : []),
      ]} />
      <article className="doc-main">
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link href="/help-center">{t.site.helpCenter}</Link>
          <ChevronRight width={14} height={14} className="flip-rtl" />
          <Link href={`/help-center#${collection.id}`}>{collection.text[locale].title}</Link>
        </nav>
        <div className="doc-title-row">
          <h1 className="doc-title">{doc.title}</h1>
          <CopyPageButton markdown={toMarkdown(doc, siteUrl())} />
        </div>
        <p className="doc-summary">{doc.summary}</p>
        {doc.updated && <p className="doc-updated">{locale === "ar" ? "آخر تحديث" : "Last updated"}: <time dateTime={doc.updated}>{doc.updated}</time></p>}
        <div className="doc-divider" />
        {video && <ArticleVideo video={video} />}
        <Prose blocks={doc.blocks} />
        <ArticleFeedback kind="help" slug={slug} />
        <div className="help-cta">
          <strong>{t.help.stillNeed}</strong>
          <Link className="btn-ghost" href="/contact?topic=support">{t.help.contactUs}</Link>
        </div>
      </article>
      <aside className="toc">
        <div className="toc-title">{collection.text[locale].title}</div>
        {related.map((a) => <Link key={a.slug} href={`/help-center/${a.slug}`}>{a.doc[locale].title}</Link>)}
      </aside>
    </div>
  );
}
