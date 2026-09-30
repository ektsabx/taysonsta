import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, localizedPath, type Locale } from "@/lib/i18n";
import { getDictionary } from "@/content/dictionaries";
import { getHomeContent } from "@/content/home";
import { getPortfolioCompanyBySlug } from "@/services/portfolio-companies";
import { CompanyHero } from "@/components/portfolio/CompanyHero";
import { CompanyRole } from "@/components/portfolio/CompanyRole";
import { CompanyBuiltItems } from "@/components/portfolio/CompanyBuiltItems";
import { CompanyMetrics } from "@/components/portfolio/CompanyMetrics";
import { CompanyTimeline } from "@/components/portfolio/CompanyTimeline";
import { Section } from "@/components/ui/Section";
import { PageTopSpacer } from "@/components/ui/PageTopSpacer";
import { FinalCtaBanner } from "@/components/ui/FinalCtaBanner";
import { storageUrl } from "@/lib/storage";

interface PageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale: localeParam, slug } = await params;
  const locale: Locale = isLocale(localeParam) ? localeParam : "ar";
  const company = await getPortfolioCompanyBySlug(slug);

  if (!company) {
    return {};
  }

  const canonical = localizedPath(locale, `/portfolio/${company.slug}`);
  const shortDescription = locale === "ar" ? company.short_description_ar : company.short_description_en;

  return {
    title: `${company.name} - Taysonsta Portfolio`,
    description: shortDescription ?? undefined,
    alternates: { canonical },
    openGraph: {
      title: company.name,
      description: shortDescription ?? undefined,
      images: company.cover_image ? [storageUrl(company.cover_image)] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: company.name,
      description: shortDescription ?? undefined,
      images: company.cover_image ? [storageUrl(company.cover_image)] : undefined,
    },
  };
}

export default async function PortfolioCompanyPage({ params }: PageProps) {
  const { locale: localeParam, slug } = await params;

  if (!isLocale(localeParam)) {
    notFound();
  }

  const locale: Locale = localeParam;
  const dictionary = getDictionary(locale);
  const finalCta = getHomeContent(locale).finalCta;
  const company = await getPortfolioCompanyBySlug(slug);

  if (!company) {
    notFound();
  }

  const n = (num: string, label: string) => `${num} — ${label}`;

  return (
    <>
      <PageTopSpacer />
      <section className="sec">
        <CompanyHero company={company} locale={locale} dictionary={dictionary} />
      </section>

      {(locale === "ar" ? company.description_ar : company.description_en) || company.metrics.length > 0 ? (
        <Section tag={dictionary.portfolio.sectionAbout} heading={n("01", dictionary.portfolio.sectionAbout)}>
          {(locale === "ar" ? company.description_ar : company.description_en) ? (
            <div className="about-prose">
              <p>{locale === "ar" ? company.description_ar : company.description_en}</p>
            </div>
          ) : null}
          <CompanyMetrics metrics={company.metrics} />
        </Section>
      ) : null}

      {company.builtItems.length > 0 ? (
        <Section variant="dark" tag={dictionary.portfolio.sectionWhatWeBuilt} heading={n("02", dictionary.portfolio.sectionWhatWeBuilt)}>
          <CompanyBuiltItems items={company.builtItems} />
        </Section>
      ) : null}

      {company.roles.length > 0 ? (
        <Section tag={dictionary.portfolio.sectionRole} heading={n("03", dictionary.portfolio.sectionRole)}>
          <CompanyRole roles={company.roles} />
        </Section>
      ) : null}

      {company.timeline.length > 0 ? (
        <Section variant="dark" tag={dictionary.portfolio.sectionTimeline} heading={n("04", dictionary.portfolio.sectionTimeline)}>
          <CompanyTimeline timeline={company.timeline} />
        </Section>
      ) : null}

      <FinalCtaBanner
        heading={finalCta.heading}
        body={finalCta.body}
        ctaLabel={finalCta.cta}
        ctaHref={localizedPath(locale, "/booking")}
      />
    </>
  );
}
