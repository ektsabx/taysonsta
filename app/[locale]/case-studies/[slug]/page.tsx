import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, localizedPath, type Locale } from "@/lib/i18n";
import { getDictionary } from "@/content/dictionaries";
import { getHomeContent } from "@/content/home";
import { getCaseStudyBySlug } from "@/services/case-studies";
import { CaseStudyHero } from "@/components/case-studies/CaseStudyHero";
import { CaseStudyMetrics } from "@/components/case-studies/CaseStudyMetrics";
import { CaseStudyMedia } from "@/components/case-studies/CaseStudyMedia";
import { CaseStudyTestimonial } from "@/components/case-studies/CaseStudyTestimonial";
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
  const caseStudy = await getCaseStudyBySlug(slug);

  if (!caseStudy) {
    return {};
  }

  const canonical = localizedPath(locale, `/case-studies/${caseStudy.slug}`);
  const shortDescription = locale === "ar" ? caseStudy.short_description_ar : caseStudy.short_description_en;

  return {
    title: `${caseStudy.title} - Taysonsta Clients`,
    description: shortDescription ?? undefined,
    alternates: { canonical },
    openGraph: {
      title: caseStudy.title,
      description: shortDescription ?? undefined,
      images: caseStudy.featured_image ? [storageUrl(caseStudy.featured_image)] : undefined,
      type: "article",
      publishedTime: caseStudy.published_at ?? undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: caseStudy.title,
      description: shortDescription ?? undefined,
      images: caseStudy.featured_image ? [storageUrl(caseStudy.featured_image)] : undefined,
    },
  };
}

export default async function CaseStudyPage({ params }: PageProps) {
  const { locale: localeParam, slug } = await params;

  if (!isLocale(localeParam)) {
    notFound();
  }

  const locale: Locale = localeParam;
  const dictionary = getDictionary(locale);
  const finalCta = getHomeContent(locale).finalCta;
  const caseStudy = await getCaseStudyBySlug(slug);

  if (!caseStudy) {
    notFound();
  }

  const overview = locale === "ar" ? caseStudy.description_ar : caseStudy.description_en;
  const challenge = locale === "ar" ? caseStudy.challenge_ar : caseStudy.challenge_en;
  const productStrategy = locale === "ar" ? caseStudy.solution_ar : caseStudy.solution_en;
  const result = locale === "ar" ? caseStudy.result_ar : caseStudy.result_en;
  const hasResults = Boolean(result) || caseStudy.metrics.length > 0;

  const cs = dictionary.caseStudies;
  const n = (num: string, label: string) => `${num} — ${label}`;

  return (
    <>
      <PageTopSpacer />
      <section className="sec">
        <CaseStudyHero caseStudy={caseStudy} locale={locale} dictionary={dictionary} />
      </section>

      {overview ? (
        <Section tag={cs.sectionOverview} heading={n("01", cs.sectionOverview)}>
          <div className="about-prose">
            <p>{overview}</p>
          </div>
        </Section>
      ) : null}

      {challenge ? (
        <Section variant="dark" tag={cs.sectionChallenge} heading={n("02", cs.sectionChallenge)}>
          <div className="about-prose">
            <p>{challenge}</p>
          </div>
        </Section>
      ) : null}

      {productStrategy ? (
        <Section tag={cs.sectionProductStrategy} heading={n("03", cs.sectionProductStrategy)}>
          <div className="about-prose">
            <p>{productStrategy}</p>
          </div>
        </Section>
      ) : null}

      {caseStudy.media.length > 0 ? (
        <Section variant="dark" tag={cs.sectionDesignDev} heading={n("04", cs.sectionDesignDev)}>
          <CaseStudyMedia media={caseStudy.media} />
        </Section>
      ) : null}

      {caseStudy.key_features.length > 0 ? (
        <Section tag={cs.sectionKeyFeatures} heading={n("05", cs.sectionKeyFeatures)}>
          <div className="company-tag-list">
            {caseStudy.key_features.map((feature) => (
              <span className="company-tag" key={feature}>
                {feature}
              </span>
            ))}
          </div>
        </Section>
      ) : null}

      {caseStudy.website_url ? (
        <Section variant="dark" tag={cs.sectionLaunch} heading={n("06", cs.sectionLaunch)}>
          <a href={caseStudy.website_url} target="_blank" rel="noreferrer" className="admin-btn">
            {cs.visitLive}
          </a>
        </Section>
      ) : null}

      {hasResults ? (
        <Section tag={cs.sectionResults} heading={n("07", cs.sectionResults)}>
          {result ? (
            <div className="about-prose">
              <p>{result}</p>
            </div>
          ) : null}
          <CaseStudyMetrics metrics={caseStudy.metrics} />
        </Section>
      ) : null}

      {caseStudy.testimonial_quote_ar || caseStudy.testimonial_quote_en ? (
        <Section variant="dark" tag={cs.sectionTestimonial} heading={n("08", cs.sectionTestimonial)}>
          <CaseStudyTestimonial caseStudy={caseStudy} locale={locale} />
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
