import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/lib/i18n";
import { buildMetadata } from "@/lib/seo";
import { getHomeContent } from "@/content/home";
import { PageTopSpacer } from "@/components/ui/PageTopSpacer";
import { Packages } from "@/components/home/Packages";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale: localeParam } = await params;
  const locale: Locale = isLocale(localeParam) ? localeParam : "ar";

  return buildMetadata({
    locale,
    path: "/booking",
    title: locale === "ar" ? "اختر باقتك - تايسونستا" : "Choose Your Package - Taysonsta",
    description:
      locale === "ar"
        ? "اختر الباقة المناسبة لمشروعك واحجز مكالمة مع فريق Taysonsta."
        : "Choose the right package for your project and book a call with the Taysonsta team.",
  });
}

export default async function BookingChoicePage({ params }: PageProps) {
  const { locale: localeParam } = await params;

  if (!isLocale(localeParam)) {
    notFound();
  }

  const locale: Locale = localeParam;
  const content = getHomeContent(locale).packages;

  return (
    <>
      <PageTopSpacer />
      <section className="sec">
        <div className="sec-tag">{content.tag}</div>
        <h1 className="sec-h2">{content.heading}</h1>
        <p className="sec-p">{content.subtitle}</p>
        <Packages content={content} locale={locale} bare />
      </section>
    </>
  );
}
