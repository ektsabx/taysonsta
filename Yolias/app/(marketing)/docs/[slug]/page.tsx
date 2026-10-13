import type { Metadata } from "next";
import { JsonLd } from "@/components/marketing/JsonLd";
import { breadcrumbSchema, pageMetadata, webPageSchema } from "@/lib/seo";
import Link from "next/link";
import { ArticleFeedback, CopyPageButton } from "@/components/marketing/ArticleTools";
import { toMarkdown } from "@/lib/content/types";
import { siteUrl } from "@/lib/seo";

import { notFound } from "next/navigation";
import { Prose } from "@/components/marketing/Prose";
import { Toc } from "@/components/marketing/Toc";
import { docGroups, docs as shippedDocs } from "@/lib/content/docs";
import { docPages } from "@/lib/content/store";
import { getDictionary, getLocale } from "@/lib/i18n/server";

export function generateStaticParams() {
  return shippedDocs.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: PageProps<"/docs/[slug]">): Promise<Metadata> {
  const docs = await docPages();
  const { slug } = await params;
  const page = docs.find((d) => d.slug === slug);
  if (!page) return {};
  const doc = page.doc[await getLocale()];
  return pageMetadata({ title: `${doc.title} | Yolias Docs`, description: doc.summary, path: `/docs/${slug}` });
}

// Documentation (Claude-docs layout): sections nav · content · on this page.
export default async function DocPage({ params }: PageProps<"/docs/[slug]">) {
  const docs = await docPages();
  const { slug } = await params;
  const index = docs.findIndex((d) => d.slug === slug);
  if (index < 0) notFound();
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  const doc = docs[index].doc[locale];
  const prev = docs[index - 1];
  const next = docs[index + 1];

  return (
    <div className="site-width doc-layout with-nav">
      <JsonLd nodes={[
        webPageSchema({ title: doc.title, description: doc.summary, path: `/docs/${slug}` }),
        breadcrumbSchema([{ name: t.site.documentation, path: `/docs/${docs[0].slug}` }, { name: doc.title, path: `/docs/${slug}` }]),
      ]} />
      <nav className="side-nav" aria-label={t.site.documentation}>
        {docGroups.map((g) => (
          <div className="side-nav-group" key={g.id}>
            <div className="side-nav-title">{g.title[locale]}</div>
            {docs.filter((d) => d.group === g.id).map((d) => (
              <Link key={d.slug} href={`/docs/${d.slug}`} className={d.slug === slug ? "active" : undefined}>{d.doc[locale].title}</Link>
            ))}
          </div>
        ))}
      </nav>
      <article className="doc-main">
        <p className="eyebrow">{docGroups.find((g) => g.id === docs[index].group)!.title[locale]}</p>
        <div className="doc-title-row">
          <h1 className="doc-title mt-3">{doc.title}</h1>
          <CopyPageButton markdown={toMarkdown(doc, siteUrl())} />
        </div>
        <p className="doc-summary">{doc.summary}</p>
        <div className="doc-divider" />
        <Prose blocks={doc.blocks} />
        <ArticleFeedback kind="docs" slug={slug} />
        <div className="pager">
          {prev && (
            <Link href={`/docs/${prev.slug}`}>
              <small>{locale === "ar" ? "→" : "←"}</small>
              <strong>{prev.doc[locale].title}</strong>
            </Link>
          )}
          {next && (
            <Link href={`/docs/${next.slug}`} className="next">
              <small>{locale === "ar" ? "←" : "→"}</small>
              <strong>{next.doc[locale].title}</strong>
            </Link>
          )}
        </div>
      </article>
      <Toc blocks={doc.blocks} title={t.site.onThisPage} />
    </div>
  );
}
