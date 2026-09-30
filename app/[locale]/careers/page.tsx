import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/lib/i18n";
import { buildMetadata } from "@/lib/seo";
import { getDictionary } from "@/content/dictionaries";
import { getPublishedCareerJobs } from "@/services/careers";
import { CareerGrid } from "@/components/careers/CareerGrid";
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
    path: "/careers",
    title: `${dictionary.careers.title} - Taysonsta`,
    description:
      locale === "ar"
        ? "انضم إلى فريق Taysonsta وكن جزءًا من بناء الجيل القادم من الشركات الرقمية."
        : "Join the Taysonsta team and help build the next generation of digital businesses.",
  });
}

export default async function CareersPage({ params }: PageProps) {
  const { locale: localeParam } = await params;

  if (!isLocale(localeParam)) {
    notFound();
  }

  const locale: Locale = localeParam;
  const dictionary = getDictionary(locale);
  const jobs = await getPublishedCareerJobs();

  return (
    <>
      <PageTopSpacer />
      <section className="sec">
        <div className="sec-tag">{dictionary.nav.careers}</div>
        <h2 className="sec-h2">{dictionary.careers.title}</h2>
        {jobs.length === 0 ? (
          <EmptyState title={dictionary.careers.emptyTitle} />
        ) : (
          <Reveal>
            <CareerGrid jobs={jobs} locale={locale} dictionary={dictionary} />
          </Reveal>
        )}
      </section>
    </>
  );
}
