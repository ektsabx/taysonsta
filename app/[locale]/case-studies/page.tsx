import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/lib/i18n";
import { buildMetadata } from "@/lib/seo";
import { getDictionary } from "@/content/dictionaries";
import { getCaseStudies } from "@/services/case-studies";
import { CaseStudyGrid } from "@/components/case-studies/CaseStudyGrid";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageTopSpacer } from "@/components/ui/PageTopSpacer";
import { Reveal } from "@/components/ui/Reveal";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale: localeParam } = await params;
  const locale: Locale = isLocale(localeParam) ? localeParam : "ar";
  const dictionary = getDictionary(locale);

  return buildMetadata({
    locale,
    path: "/case-studies",
    title: `${dictionary.caseStudies.title} - Taysonsta`,
    description: dictionary.caseStudies.subtitle,
  });
}

export default async function CaseStudiesPage({ params }: PageProps) {
  const { locale: localeParam } = await params;

  if (!isLocale(localeParam)) {
    notFound();
  }

  const locale: Locale = localeParam;
  const dictionary = getDictionary(locale);
  const caseStudies = await getCaseStudies();

  return (
    <>
      <PageTopSpacer />
      <section className="sec">
        <div className="sec-tag">{dictionary.nav.caseStudies}</div>
        <h2 className="sec-h2">{dictionary.caseStudies.title}</h2>
        <p className="sec-p">{dictionary.caseStudies.subtitle}</p>
        {caseStudies.length === 0 ? (
          <EmptyState title={dictionary.caseStudies.emptyTitle} description={dictionary.caseStudies.emptyDesc} />
        ) : (
          <Reveal><CaseStudyGrid caseStudies={caseStudies} locale={locale} /></Reveal>
        )}
      </section>
    </>
  );
}
