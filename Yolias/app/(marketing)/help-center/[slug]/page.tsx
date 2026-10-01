import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { Prose } from "@/components/marketing/Prose";
import { articles, collections } from "@/lib/content/help";
import { getDictionary, getLocale } from "@/lib/i18n/server";

export function generateStaticParams() {
  return articles.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: PageProps<"/help-center/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const article = articles.find((a) => a.slug === slug);
  if (!article) return {};
  const doc = article.doc[await getLocale()];
  return { title: `${doc.title} — Yolias`, description: doc.summary };
}

export default async function HelpArticlePage({ params }: PageProps<"/help-center/[slug]">) {
  const { slug } = await params;
  const article = articles.find((a) => a.slug === slug);
  if (!article) notFound();
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  const doc = article.doc[locale];
  const collection = collections.find((c) => c.id === article.collection)!;
  const related = articles.filter((a) => a.collection === article.collection && a.slug !== slug);

  return (
    <div className="site-width doc-layout">
      <article className="doc-main">
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link href="/help-center">{t.site.helpCenter}</Link>
          <ChevronRight width={14} height={14} className="flip-rtl" />
          <Link href={`/help-center#${collection.id}`}>{collection.text[locale].title}</Link>
        </nav>
        <h1 className="doc-title">{doc.title}</h1>
        <p className="doc-summary">{doc.summary}</p>
        <div className="doc-divider" />
        <Prose blocks={doc.blocks} />
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
