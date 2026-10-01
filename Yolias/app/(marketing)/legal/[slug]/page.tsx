import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Prose } from "@/components/marketing/Prose";
import { Toc } from "@/components/marketing/Toc";
import { legal, legalSlugs, LEGAL_UPDATED, type LegalSlug } from "@/lib/content/legal";
import { formatDate } from "@/lib/format";
import { fmt } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/server";

const isLegal = (s: string): s is LegalSlug => (legalSlugs as readonly string[]).includes(s);

export function generateStaticParams() {
  return legalSlugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/legal/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  if (!isLegal(slug)) return {};
  const doc = legal[slug][await getLocale()];
  return { title: `${doc.title} — Yolias`, description: doc.summary };
}

export default async function LegalPage({ params }: PageProps<"/legal/[slug]">) {
  const { slug } = await params;
  if (!isLegal(slug)) notFound();
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  const doc = legal[slug][locale];

  return (
    <div className="site-width doc-layout with-nav">
      <nav className="side-nav" aria-label={t.site.legal}>
        <div className="side-nav-group">
          <div className="side-nav-title">{t.site.legal}</div>
          {legalSlugs.map((s) => (
            <Link key={s} href={`/legal/${s}`} className={s === slug ? "active" : undefined}>{legal[s][locale].title}</Link>
          ))}
        </div>
      </nav>
      <article className="doc-main">
        <h1 className="doc-title">{doc.title}</h1>
        <p className="doc-summary">{doc.summary}</p>
        <p className="doc-meta">{fmt(t.site.lastUpdated, { date: formatDate(LEGAL_UPDATED, locale, "UTC") })}</p>
        <div className="doc-divider" />
        <Prose blocks={doc.blocks} />
      </article>
      <Toc blocks={doc.blocks} title={t.site.onThisPage} />
    </div>
  );
}
