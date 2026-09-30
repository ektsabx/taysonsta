import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/lib/i18n";
import { buildMetadata } from "@/lib/seo";
import { getDictionary } from "@/content/dictionaries";
import { getPortfolioCompanies, getPortfolioStats } from "@/services/portfolio-companies";
import type { PortfolioRelationshipType } from "@/types/database";
import { PortfolioGrid } from "@/components/portfolio/PortfolioGrid";
import { PortfolioFilters } from "@/components/portfolio/PortfolioFilters";
import { PortfolioStats } from "@/components/portfolio/PortfolioStats";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageTopSpacer } from "@/components/ui/PageTopSpacer";
import { Reveal } from "@/components/ui/Reveal";

const validTypes: PortfolioRelationshipType[] = ["owned", "co_founded", "equity", "acquired"];

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ type?: string }>;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: localeParam } = await params;
  const locale: Locale = isLocale(localeParam) ? localeParam : "ar";
  const dictionary = getDictionary(locale);

  return buildMetadata({
    locale,
    path: "/portfolio",
    title: `${dictionary.portfolio.title} - Taysonsta`,
    description: dictionary.portfolio.subtitle,
  });
}

export default async function PortfolioPage({ params, searchParams }: PageProps) {
  const { locale: localeParam } = await params;
  const { type } = await searchParams;

  if (!isLocale(localeParam)) {
    notFound();
  }

  const locale: Locale = localeParam;
  const dictionary = getDictionary(locale);
  const activeType = validTypes.includes(type as PortfolioRelationshipType) ? (type as PortfolioRelationshipType) : null;

  const [companies, stats] = await Promise.all([
    getPortfolioCompanies(activeType ?? undefined),
    getPortfolioStats(),
  ]);

  return (
    <>
      <PageTopSpacer />
      <section className="sec">
        <div className="sec-tag">{dictionary.nav.portfolio}</div>
        <h2 className="sec-h2">{dictionary.portfolio.title}</h2>
        <p className="sec-p">{dictionary.portfolio.subtitle}</p>
        <PortfolioStats stats={stats} dictionary={dictionary} />
        <PortfolioFilters activeType={activeType} locale={locale} dictionary={dictionary} />
        {companies.length === 0 ? (
          <EmptyState title={dictionary.portfolio.emptyTitle} description={dictionary.portfolio.emptyDesc} />
        ) : (
          <Reveal><PortfolioGrid companies={companies} locale={locale} dictionary={dictionary} /></Reveal>
        )}
      </section>
    </>
  );
}
