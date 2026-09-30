import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { isLocale, localizedPath, type Locale } from "@/lib/i18n";
import { getDictionary } from "@/content/dictionaries";
import { getCareerJobBySlug } from "@/services/careers";
import { ApplicationForm } from "@/components/careers/ApplicationForm";
import { Section } from "@/components/ui/Section";
import { PageTopSpacer } from "@/components/ui/PageTopSpacer";

interface PageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale: localeParam, slug } = await params;
  const locale: Locale = isLocale(localeParam) ? localeParam : "ar";
  const dictionary = getDictionary(locale);
  const job = await getCareerJobBySlug(slug);

  if (!job) {
    return {};
  }

  const canonical = localizedPath(locale, `/careers/${job.slug}`);

  return {
    title: `${job.title} — ${dictionary.careers.title}`,
    description: job.summary,
    alternates: { canonical },
    openGraph: {
      title: job.title,
      description: job.summary,
      type: "article",
    },
    twitter: {
      card: "summary",
      title: job.title,
      description: job.summary,
    },
  };
}

export default async function CareerJobPage({ params }: PageProps) {
  const { locale: localeParam, slug } = await params;

  if (!isLocale(localeParam)) {
    notFound();
  }

  const locale: Locale = localeParam;
  const dictionary = getDictionary(locale);
  const job = await getCareerJobBySlug(slug);

  if (!job) {
    notFound();
  }

  const cookieStore = await cookies();
  const alreadyApplied = cookieStore.get(`career_applied_${job.id}`)?.value === "1";

  return (
    <>
      <PageTopSpacer />
      <section className="sec">
        <div className="career-hero">
          <h1 className="career-hero-title">{job.title}</h1>
          <div className="career-hero-meta-list">
            {job.published_at ? (
              <div>
                📅 {dictionary.careers.postedOn}: {new Date(job.published_at).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-US")}
              </div>
            ) : null}
            <div>👥 {dictionary.careers.teamLabel}: {job.team}</div>
            <div>📍 {dictionary.careers.locationLabel}: {job.location}</div>
            <div>🕒 {dictionary.careers.employmentTypeLabel}: {job.employment_type}</div>
          </div>
        </div>
      </section>

      <Section tag={dictionary.careers.sectionSummary} heading={dictionary.careers.sectionSummary}>
        <div className="about-prose">
          <p>{job.summary}</p>
        </div>
      </Section>

      <Section variant="dark" tag={dictionary.careers.sectionRole} heading={dictionary.careers.sectionRole}>
        <div className="about-prose">
          <p>{job.role_description}</p>
        </div>
      </Section>

      <Section tag={dictionary.careers.sectionIdeal} heading={dictionary.careers.sectionIdeal}>
        <div className="about-prose">
          <p>{job.ideal_candidate}</p>
        </div>
      </Section>

      <Section variant="dark" tag={dictionary.careers.sectionRequirements} heading={dictionary.careers.sectionRequirements}>
        <div className="about-prose">
          <p>{job.requirements}</p>
        </div>
      </Section>

      <Section tag={dictionary.careers.sectionResponsibilities} heading={dictionary.careers.sectionResponsibilities}>
        <div className="about-prose">
          <p>{job.responsibilities}</p>
        </div>
      </Section>

      <Section variant="dark" tag={dictionary.careers.sectionDisqualifiers} heading={dictionary.careers.sectionDisqualifiers}>
        <div className="about-prose">
          <p>{job.disqualifiers}</p>
        </div>
      </Section>

      <Section tag={dictionary.careers.applyHeading} heading={dictionary.careers.applyHeading}>
        <ApplicationForm jobId={job.id} t={dictionary.careers} alreadyApplied={alreadyApplied} />
      </Section>
    </>
  );
}
